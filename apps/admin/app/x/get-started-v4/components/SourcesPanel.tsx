"use client";

/**
 * SourcesPanel — compact content sources panel for the wizard right column.
 *
 * Sits below the ScaffoldPanel under "Building your course". Handles:
 * - File drop zone (compact, right-panel friendly)
 * - Auto-classify + auto-ingest in nonBlocking mode
 * - Live extraction tracking via useSourceStatus
 * - Callbacks to parent for data bag updates
 *
 * Replaces the inline PackUploadStep that used to block the chat input area.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Upload, FileText, Check, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useSourceStatus } from "@/hooks/useSourceStatus";
import { SourceStatusDots } from "@/components/shared/SourceStatusDots";
import { getDocTypeInfo } from "@/lib/doc-type-icons";

// ── Types ────────────────────────────────────────────────

export interface SourcesReadyData {
  subjects: Array<{ id: string; name: string }>;
  sourceIds: string[];
  sourceCount: number;
  classifications: Array<{
    fileName: string;
    documentType: string;
    confidence: number;
    reasoning: string;
  }>;
}

interface SourcesPanelProps {
  domainId: string;
  courseName: string;
  interactionPattern?: string;
  teachingMode?: string;
  subjectDiscipline?: string;
  institutionName?: string;
  /** Called when sources are created and extraction is running in background */
  onSourcesReady?: (data: SourcesReadyData) => void;
  /** Called when background extraction finishes (all sources have assertions) */
  onExtractionDone?: (totals: { assertions: number; questions: number; vocabulary: number }) => void;
}

type Phase = "idle" | "analyzing" | "uploading" | "tracking" | "done" | "error";

const VALID_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".json"];
const ACCEPT_ATTR = VALID_EXTENSIONS.join(",");

// ── Component ────────────────────────────────────────────

export function SourcesPanel({
  domainId,
  courseName,
  interactionPattern,
  teachingMode,
  subjectDiscipline,
  institutionName,
  onSourcesReady,
  onExtractionDone,
}: SourcesPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<SourcesReadyData["classifications"]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifiedDone = useRef(false);

  // ── Live extraction tracking ──────────────────────────

  const statusMap = useSourceStatus(sourceIds, {
    enabled: sourceIds.length > 0 && phase === "tracking",
    pollInterval: 5_000,
  });

  const { totalAssertions, totalEmbedded, extractionDone } = useMemo(() => {
    const values = Object.values(statusMap);
    if (values.length === 0 || values.length < sourceIds.length) {
      return { totalAssertions: 0, totalEmbedded: 0, extractionDone: false };
    }
    const assertions = values.reduce((sum, s) => sum + s.assertionCount, 0);
    const embedded = values.reduce((sum, s) => sum + s.embeddedCount, 0);
    const done = values.every((s) => s.assertionCount > 0);
    return { totalAssertions: assertions, totalEmbedded: embedded, extractionDone: done };
  }, [statusMap, sourceIds]);

  // Auto-transition when extraction completes
  useEffect(() => {
    if (extractionDone && phase === "tracking" && !notifiedDone.current) {
      notifiedDone.current = true;
      setPhase("done");
      onExtractionDone?.({ assertions: totalAssertions, questions: 0, vocabulary: 0 });
    }
  }, [extractionDone, phase, totalAssertions, onExtractionDone]);

  // ── File handling ─────────────────────────────────────

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) => {
      const name = f.name.toLowerCase();
      return VALID_EXTENSIONS.some((ext) => name.endsWith(ext));
    });
    if (valid.length === 0) return;

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existingNames.has(f.name))];
    });
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  // ── Process: analyze → ingest (nonBlocking) ───────────

  const handleProcess = useCallback(async () => {
    if (files.length === 0 || !domainId) return;

    setPhase("analyzing");
    setError(null);

    try {
      // Step 1: Classify files
      const analyzeForm = new FormData();
      analyzeForm.append("courseName", courseName);
      analyzeForm.append("domainId", domainId);
      for (const file of files) analyzeForm.append("files", file);

      const analyzeRes = await fetch("/api/course-pack/analyze", {
        method: "POST",
        body: analyzeForm,
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeData.ok) throw new Error(analyzeData.error || "Analysis failed");

      const manifest = analyzeData.manifest;

      // Build classifications from manifest
      const classificationsList: SourcesReadyData["classifications"] = [
        ...(manifest.groups?.flatMap((g: any) =>
          g.files.map((f: any) => ({
            fileName: f.fileName,
            documentType: f.documentType,
            confidence: f.confidence,
            reasoning: f.reasoning,
          })),
        ) || []),
        ...(manifest.pedagogyFiles?.map((f: any) => ({
          fileName: f.fileName,
          documentType: f.documentType,
          confidence: f.confidence,
          reasoning: f.reasoning,
        })) || []),
      ];
      setClassifications(classificationsList);

      // Step 2: Ingest (nonBlocking — creates sources, fires off extraction)
      setPhase("uploading");

      const ingestForm = new FormData();
      ingestForm.append("manifest", JSON.stringify(manifest));
      ingestForm.append("domainId", domainId);
      ingestForm.append("courseName", courseName);
      ingestForm.append("nonBlocking", "true");
      if (interactionPattern) ingestForm.append("interactionPattern", interactionPattern);
      if (teachingMode) ingestForm.append("teachingMode", teachingMode);
      if (subjectDiscipline) ingestForm.append("subjectDiscipline", subjectDiscipline);
      for (const file of files) ingestForm.append("files", file);

      const ingestRes = await fetch("/api/course-pack/ingest", {
        method: "POST",
        body: ingestForm,
      });
      const ingestData = await ingestRes.json();
      if (!ingestData.ok) throw new Error(ingestData.error || "Upload failed");

      setSourceIds(ingestData.sourceIds || []);
      setPhase("tracking");
      notifiedDone.current = false;

      // Notify parent — sources ready, extraction running in background
      onSourcesReady?.({
        subjects: ingestData.subjects || [],
        sourceIds: ingestData.sourceIds || [],
        sourceCount: ingestData.sourceCount || 0,
        classifications: classificationsList,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }, [files, domainId, courseName, interactionPattern, teachingMode, subjectDiscipline, onSourcesReady]);

  // Auto-process when files are added (after a short debounce to allow multi-file drops)
  const processTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (files.length > 0 && phase === "idle") {
      if (processTimer.current) clearTimeout(processTimer.current);
      processTimer.current = setTimeout(() => handleProcess(), 800);
    }
    return () => {
      if (processTimer.current) clearTimeout(processTimer.current);
    };
  }, [files, phase, handleProcess]);

  // ── Render ────────────────────────────────────────────

  const isProcessing = phase === "analyzing" || phase === "uploading";
  const hasResults = classifications.length > 0;
  const showDropZone = phase === "idle" || phase === "error";

  return (
    <div className="cv4-sources">
      <div className="cv4-sources-header">Teaching Materials</div>

      {/* Drop zone */}
      {showDropZone && (
        <div
          className={`cv4-sources-dropzone${dragOver ? " cv4-sources-dropzone--active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} />
          <span>Drop files here</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="cv4-sources-file-input"
        accept={ACCEPT_ATTR}
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Processing indicator */}
      {isProcessing && (
        <div className="cv4-sources-status">
          <Loader2 size={14} className="hf-spinner" />
          <span>{phase === "analyzing" ? "Classifying..." : "Uploading..."}</span>
        </div>
      )}

      {/* File list with classifications */}
      {hasResults && (
        <div className="cv4-sources-files">
          {classifications.map((c) => {
            const info = getDocTypeInfo(c.documentType);
            const sourceStatus = sourceIds.length > 0
              ? Object.values(statusMap).find((_, i) => i < classifications.indexOf(c) + 1)
              : null;
            return (
              <div key={c.fileName} className="cv4-sources-file">
                <FileText size={12} />
                <span className="cv4-sources-filename">{c.fileName}</span>
                <span
                  className="cv4-sources-doctype"
                  style={{ "--badge-color": info.color, "--badge-bg": info.bg } as React.CSSProperties}
                >
                  {info.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Extraction progress */}
      {phase === "tracking" && (
        <div className="cv4-sources-extraction">
          <div className="cv4-sources-extraction-row">
            <span className="cv4-sources-pulse" />
            <span>Extracting teaching points...</span>
          </div>
          {totalAssertions > 0 && (
            <div className="cv4-sources-count">
              {totalAssertions} teaching point{totalAssertions !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="cv4-sources-done">
          <Check size={14} />
          <span>{totalAssertions} teaching point{totalAssertions !== 1 ? "s" : ""} ready</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="cv4-sources-error">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button
            className="cv4-sources-retry"
            onClick={() => { setPhase("idle"); setError(null); }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* Add more files (when tracking or done) */}
      {(phase === "tracking" || phase === "done") && (
        <button
          className="cv4-sources-add-more"
          onClick={() => fileInputRef.current?.click()}
        >
          + Add more files
        </button>
      )}
    </div>
  );
}
