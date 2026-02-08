"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { DraggableTabs } from "@/components/shared/DraggableTabs";

type ImportTab = "transcripts" | "specs";

interface ImportConflict {
  conflictKey: string;
  matchType: "phone" | "tag";
  matchValue: string;
  existingCaller: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    callCount: number;
  };
  incomingCaller: {
    name: string | null;
    phone: string | null;
    callCount: number;
    firstTranscriptPreview: string;
  };
  resolution?: "merge" | "create_new" | "skip";
}

interface PreviewResult {
  ok: boolean;
  preview: true;
  conflicts: ImportConflict[];
  summary: {
    filesCount: number;
    callersCount: number;
    callsCount: number;
    conflictsCount: number;
  };
  parseErrors?: string[];
}

type TranscriptResult = {
  ok: boolean;
  created?: number;
  merged?: number;
  updated?: number;
  skipped?: number;
  callsImported?: number;
  errors?: string[];
  savedToRaw?: string[];
  callers?: Array<{
    id: string;
    name: string | null;
    email: string | null;
    isNew: boolean;
    merged?: boolean;
  }>;
};

type SpecResult = {
  ok: boolean;
  created?: number;
  updated?: number;
  errors?: number;
  total?: number;
  results?: Array<{
    specId: string;
    name: string;
    status: "created" | "updated" | "error";
    error?: string;
    compileWarnings?: string[];
  }>;
};

type ImportStep = "select" | "conflicts" | "result";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>("transcripts");

  // Transcript state
  const [transcriptFiles, setTranscriptFiles] = useState<File[]>([]);
  const [transcriptImporting, setTranscriptImporting] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<"skip" | "overwrite" | "create_new">("skip");
  const [saveToRaw, setSaveToRaw] = useState(true);
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);

  // Conflict resolution state
  const [importStep, setImportStep] = useState<ImportStep>("select");
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "merge" | "create_new" | "skip">>({});

  // Spec state
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [specImporting, setSpecImporting] = useState(false);
  const [specResult, setSpecResult] = useState<SpecResult | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);
  const [autoActivate, setAutoActivate] = useState(true);
  const specFileInputRef = useRef<HTMLInputElement>(null);

  // Transcript handlers
  const handleTranscriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTranscriptFiles(Array.from(e.target.files));
      setTranscriptResult(null);
      setTranscriptError(null);
      setPreviewResult(null);
      setConflictResolutions({});
      setImportStep("select");
    }
  };

  const handleTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setTranscriptFiles(Array.from(e.dataTransfer.files));
      setTranscriptResult(null);
      setTranscriptError(null);
      setPreviewResult(null);
      setConflictResolutions({});
      setImportStep("select");
    }
  };

  // Preview to detect conflicts
  const handleTranscriptPreview = async () => {
    if (transcriptFiles.length === 0) return;

    setTranscriptImporting(true);
    setTranscriptError(null);

    const formData = new FormData();
    for (const file of transcriptFiles) {
      formData.append("files", file);
    }
    formData.append("preview", "true");

    try {
      const res = await fetch("/api/transcripts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok && data.preview) {
        setPreviewResult(data);
        // Initialize resolutions to "merge" (default)
        const resolutions: Record<string, "merge" | "create_new" | "skip"> = {};
        for (const conflict of data.conflicts) {
          resolutions[conflict.conflictKey] = "merge";
        }
        setConflictResolutions(resolutions);

        if (data.conflicts.length > 0) {
          setImportStep("conflicts");
        } else {
          // No conflicts, proceed directly to import
          await handleTranscriptImport();
        }
      } else {
        setTranscriptError(data.error || "Preview failed");
      }
    } catch (err: unknown) {
      setTranscriptError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setTranscriptImporting(false);
    }
  };

  // Actual import with conflict resolutions
  const handleTranscriptImport = async () => {
    if (transcriptFiles.length === 0) return;

    setTranscriptImporting(true);
    setTranscriptError(null);
    setTranscriptResult(null);

    const formData = new FormData();
    for (const file of transcriptFiles) {
      formData.append("files", file);
    }
    formData.append("duplicateHandling", duplicateHandling);
    formData.append("saveToRaw", saveToRaw.toString());
    formData.append("conflictResolutions", JSON.stringify(conflictResolutions));

    try {
      const res = await fetch("/api/transcripts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        setTranscriptResult(data);
        setTranscriptFiles([]);
        setImportStep("result");
        if (transcriptFileInputRef.current) {
          transcriptFileInputRef.current.value = "";
        }
      } else {
        setTranscriptError(data.error || "Import failed");
      }
    } catch (err: unknown) {
      setTranscriptError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setTranscriptImporting(false);
    }
  };

  const handleConflictResolution = (conflictKey: string, resolution: "merge" | "create_new" | "skip") => {
    setConflictResolutions(prev => ({ ...prev, [conflictKey]: resolution }));
  };

  const resetImport = () => {
    setTranscriptFiles([]);
    setTranscriptResult(null);
    setTranscriptError(null);
    setPreviewResult(null);
    setConflictResolutions({});
    setImportStep("select");
    if (transcriptFileInputRef.current) {
      transcriptFileInputRef.current.value = "";
    }
  };

  // Spec handlers
  const handleSpecFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSpecFiles(Array.from(e.target.files));
      setSpecResult(null);
      setSpecError(null);
    }
  };

  const handleSpecDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const jsonFiles = Array.from(e.dataTransfer.files).filter(f =>
        f.name.endsWith(".spec.json") || f.name.endsWith(".json")
      );
      setSpecFiles(jsonFiles);
      setSpecResult(null);
      setSpecError(null);
    }
  };

  const handleSpecImport = async () => {
    if (specFiles.length === 0) return;

    setSpecImporting(true);
    setSpecError(null);
    setSpecResult(null);

    const formData = new FormData();
    for (const file of specFiles) {
      formData.append("files", file);
    }
    formData.append("autoActivate", autoActivate.toString());

    try {
      const res = await fetch("/api/specs/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        setSpecResult(data);
        setSpecFiles([]);
        if (specFileInputRef.current) {
          specFileInputRef.current.value = "";
        }
      } else {
        setSpecError(data.error || "Import failed");
      }
    } catch (err: unknown) {
      setSpecError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSpecImporting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Import</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Upload transcripts or BDD specs to populate the database
        </p>
      </div>

      {/* Tabs */}
      <DraggableTabs
        storageKey="import-tabs"
        tabs={[
          { id: "transcripts", label: "📞 Transcripts" },
          { id: "specs", label: "📋 BDD Specs" },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ImportTab)}
        containerStyle={{ marginBottom: 24 }}
      />

      {/* Transcripts Tab */}
      {activeTab === "transcripts" && (
        <div>
          {/* Step 1: File Selection */}
          {importStep === "select" && (
            <>
              {/* Drop Zone */}
              <div
                onDrop={handleTranscriptDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => transcriptFileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border-default)",
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                  cursor: "pointer",
                  background: transcriptFiles.length > 0 ? "var(--success-bg)" : "var(--surface-secondary)",
                  transition: "all 0.15s",
                }}
              >
                <input
                  ref={transcriptFileInputRef}
                  type="file"
                  multiple
                  accept=".json,.txt,.csv"
                  onChange={handleTranscriptFileChange}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
                {transcriptFiles.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--success-text)" }}>
                      {transcriptFiles.length} file(s) selected
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                      {transcriptFiles.map((f) => f.name).join(", ")}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
                      Drop transcript files here or click to browse
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                      Supports JSON, TXT, CSV formats
                    </div>
                  </div>
                )}
              </div>

              {/* Options */}
              <div style={{ marginTop: 20, padding: 16, background: "var(--surface-secondary)", borderRadius: 8 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-primary)" }}>
                  If call already exists (by ID):
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { value: "skip", label: "Skip", desc: "Keep existing call" },
                    { value: "overwrite", label: "Overwrite", desc: "Replace transcript" },
                    { value: "create_new", label: "Create New", desc: "Create duplicate" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        flex: 1,
                        padding: 12,
                        background: duplicateHandling === opt.value ? "var(--accent-bg)" : "var(--surface-primary)",
                        border: duplicateHandling === opt.value ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="duplicateHandling"
                        value={opt.value}
                        checked={duplicateHandling === opt.value}
                        onChange={(e) => setDuplicateHandling(e.target.value as any)}
                        style={{ marginRight: 8 }}
                      />
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{opt.label}</span>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, marginLeft: 20 }}>
                        {opt.desc}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Save to raw folder option */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-default)" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={saveToRaw}
                      onChange={(e) => setSaveToRaw(e.target.checked)}
                      style={{ width: 18, height: 18, marginTop: 2 }}
                    />
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary)" }}>Save to raw folder</span>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        Copies files to HF_KB_PATH/sources/transcripts/raw for future bulk imports
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Import Button */}
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleTranscriptPreview}
                  disabled={transcriptFiles.length === 0 || transcriptImporting}
                  style={{
                    padding: "12px 24px",
                    fontSize: 15,
                    fontWeight: 600,
                    background: transcriptFiles.length === 0 || transcriptImporting ? "var(--text-placeholder)" : "var(--accent-primary)",
                    color: transcriptFiles.length === 0 || transcriptImporting ? "var(--text-muted)" : "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: transcriptFiles.length === 0 || transcriptImporting ? "not-allowed" : "pointer",
                  }}
                >
                  {transcriptImporting ? "Checking..." : "Import Transcripts"}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Conflict Resolution */}
          {importStep === "conflicts" && previewResult && (
            <div>
              <div style={{ marginBottom: 20, padding: 16, background: "var(--warning-bg)", borderRadius: 8, border: "1px solid var(--warning-border)" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--warning-text)", marginBottom: 8 }}>
                  ⚠️ {previewResult.conflicts.length} Caller Conflict{previewResult.conflicts.length > 1 ? "s" : ""} Detected
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  The following callers match existing records by phone number but have different names.
                  Choose how to handle each one:
                </div>
              </div>

              {/* Summary */}
              <div style={{ marginBottom: 20, display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                <span>{previewResult.summary.filesCount} file(s)</span>
                <span>{previewResult.summary.callersCount} caller(s)</span>
                <span>{previewResult.summary.callsCount} call(s)</span>
              </div>

              {/* Conflict Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                {previewResult.conflicts.map((conflict) => (
                  <div
                    key={conflict.conflictKey}
                    style={{
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    {/* Match info */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                        Match by {conflict.matchType}: <code style={{ background: "var(--surface-secondary)", padding: "2px 6px", borderRadius: 4 }}>{conflict.matchValue}</code>
                      </div>
                    </div>

                    {/* Side by side comparison */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      {/* Existing Caller */}
                      <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                          Existing in Database
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                          {conflict.existingCaller.name || "(no name)"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {conflict.existingCaller.phone && <div>📱 {conflict.existingCaller.phone}</div>}
                          {conflict.existingCaller.email && <div>📧 {conflict.existingCaller.email}</div>}
                          <div>📞 {conflict.existingCaller.callCount} call(s) on record</div>
                        </div>
                        <Link
                          href={`/x/callers/${conflict.existingCaller.id}`}
                          target="_blank"
                          style={{ fontSize: 11, color: "var(--accent-primary)", marginTop: 8, display: "inline-block" }}
                        >
                          View caller →
                        </Link>
                      </div>

                      {/* Incoming Caller */}
                      <div style={{ padding: 16, background: "var(--accent-bg)", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                          From Import
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                          {conflict.incomingCaller.name || "(no name)"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {conflict.incomingCaller.phone && <div>📱 {conflict.incomingCaller.phone}</div>}
                          <div>📞 {conflict.incomingCaller.callCount} call(s) to import</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>
                          &ldquo;{conflict.incomingCaller.firstTranscriptPreview}&rdquo;
                        </div>
                      </div>
                    </div>

                    {/* Resolution Options */}
                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      {[
                        { value: "merge" as const, label: "Merge", desc: "Add calls to existing caller", color: "var(--success-text)" },
                        { value: "create_new" as const, label: "Create New", desc: "Create as separate caller", color: "var(--accent-primary)" },
                        { value: "skip" as const, label: "Skip", desc: "Don't import these calls", color: "var(--text-muted)" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleConflictResolution(conflict.conflictKey, opt.value)}
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            background: conflictResolutions[conflict.conflictKey] === opt.value ? "var(--surface-secondary)" : "transparent",
                            border: conflictResolutions[conflict.conflictKey] === opt.value ? `2px solid ${opt.color}` : "1px solid var(--border-default)",
                            borderRadius: 8,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13, color: conflictResolutions[conflict.conflictKey] === opt.value ? opt.color : "var(--text-primary)" }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setImportStep("select")}
                  style={{
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleTranscriptImport}
                  disabled={transcriptImporting}
                  style={{
                    padding: "12px 24px",
                    fontSize: 15,
                    fontWeight: 600,
                    background: transcriptImporting ? "var(--text-placeholder)" : "var(--success-text)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: transcriptImporting ? "not-allowed" : "pointer",
                  }}
                >
                  {transcriptImporting ? "Importing..." : "Confirm & Import"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {importStep === "result" && transcriptResult && (
            <div style={{ padding: 20, background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--success-text)", marginBottom: 12 }}>
                ✓ Import Complete
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 14, color: "var(--text-primary)", flexWrap: "wrap" }}>
                {transcriptResult.created !== undefined && transcriptResult.created > 0 && (
                  <span>🆕 {transcriptResult.created} new caller(s)</span>
                )}
                {transcriptResult.merged !== undefined && transcriptResult.merged > 0 && (
                  <span>🔗 {transcriptResult.merged} merged</span>
                )}
                {transcriptResult.callsImported !== undefined && (
                  <span>📞 {transcriptResult.callsImported} call(s) imported</span>
                )}
                {transcriptResult.skipped !== undefined && transcriptResult.skipped > 0 && (
                  <span style={{ color: "var(--text-muted)" }}>⏭️ {transcriptResult.skipped} skipped</span>
                )}
              </div>

              {transcriptResult.callers && transcriptResult.callers.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-secondary)" }}>Callers:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {transcriptResult.callers.map((c) => (
                      <Link
                        key={c.id}
                        href={`/x/callers/${c.id}`}
                        style={{
                          padding: "6px 12px",
                          background: c.isNew ? "var(--accent-bg)" : c.merged ? "var(--warning-bg)" : "var(--surface-secondary)",
                          color: c.isNew ? "var(--accent-primary)" : "var(--text-primary)",
                          borderRadius: 6,
                          fontSize: 13,
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {c.name || c.email || c.id.slice(0, 8)}
                        {c.isNew && <span style={{ fontSize: 10, background: "var(--accent-primary)", color: "#fff", padding: "1px 4px", borderRadius: 3 }}>NEW</span>}
                        {c.merged && <span style={{ fontSize: 10, background: "var(--warning-text)", color: "#fff", padding: "1px 4px", borderRadius: 3 }}>MERGED</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {transcriptResult.savedToRaw && transcriptResult.savedToRaw.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: "var(--accent-bg)", borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--accent-primary)", marginBottom: 4 }}>
                    📁 Saved to raw folder ({transcriptResult.savedToRaw.length} files)
                  </div>
                </div>
              )}

              {transcriptResult.errors && transcriptResult.errors.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: "var(--warning-bg)", borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--warning-text)", marginBottom: 4 }}>
                    Warnings:
                  </div>
                  {transcriptResult.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {err}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={resetImport}
                style={{
                  marginTop: 20,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "var(--surface-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Import More
              </button>
            </div>
          )}

          {/* Error */}
          {transcriptError && (
            <div style={{ marginTop: 20, padding: 16, background: "var(--error-bg)", color: "var(--error-text)", borderRadius: 8 }}>
              {transcriptError}
            </div>
          )}
        </div>
      )}

      {/* BDD Specs Tab */}
      {activeTab === "specs" && (
        <div>
          {/* Drop Zone */}
          <div
            onDrop={handleSpecDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => specFileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--border-default)",
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
              cursor: "pointer",
              background: specFiles.length > 0 ? "var(--warning-bg)" : "var(--surface-secondary)",
              transition: "all 0.15s",
            }}
          >
            <input
              ref={specFileInputRef}
              type="file"
              multiple
              accept=".json,.spec.json"
              onChange={handleSpecFileChange}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            {specFiles.length > 0 ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--warning-text)" }}>
                  {specFiles.length} spec file(s) selected
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  {specFiles.map((f) => f.name).join(", ")}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
                  Drop .spec.json files here or click to browse
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  BDD specification files (e.g., CA-001-cognitive-activation.spec.json)
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <div style={{ marginTop: 20, padding: 16, background: "var(--surface-secondary)", borderRadius: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoActivate}
                onChange={(e) => setAutoActivate(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <div>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Auto-activate specs</span>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Create Parameters, ScoringAnchors, and AnalysisSpec records automatically
                </div>
              </div>
            </label>
          </div>

          {/* Import Button */}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={handleSpecImport}
              disabled={specFiles.length === 0 || specImporting}
              style={{
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                background: specFiles.length === 0 || specImporting ? "var(--text-placeholder)" : "var(--warning-text)",
                color: specFiles.length === 0 || specImporting ? "var(--text-muted)" : "#fff",
                border: "none",
                borderRadius: 8,
                cursor: specFiles.length === 0 || specImporting ? "not-allowed" : "pointer",
              }}
            >
              {specImporting ? "Importing..." : "Import BDD Specs"}
            </button>
          </div>

          {/* Error */}
          {specError && (
            <div style={{ marginTop: 20, padding: 16, background: "var(--error-bg)", color: "var(--error-text)", borderRadius: 8 }}>
              {specError}
            </div>
          )}

          {/* Result */}
          {specResult && (
            <div style={{ marginTop: 20, padding: 20, background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--warning-text)", marginBottom: 12 }}>
                Import Complete
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 14, color: "var(--text-primary)" }}>
                <span>Created: {specResult.created || 0}</span>
                <span>Updated: {specResult.updated || 0}</span>
                {(specResult.errors || 0) > 0 && <span style={{ color: "var(--error-text)" }}>Errors: {specResult.errors}</span>}
              </div>

              {specResult.results && specResult.results.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-secondary)" }}>Results:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {specResult.results.map((r) => (
                      <div
                        key={r.specId}
                        style={{
                          padding: "8px 12px",
                          background: r.status === "error" ? "var(--error-bg)" : r.status === "created" ? "var(--success-bg)" : "var(--surface-secondary)",
                          border: r.status === "error" ? "1px solid var(--error-border)" : "1px solid var(--border-default)",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.specId}</span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: r.status === "error" ? "var(--error-text)" : r.status === "created" ? "var(--success-text)" : "var(--text-muted)",
                              color: "#fff",
                            }}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{r.name}</div>
                        {r.error && (
                          <div style={{ color: "var(--error-text)", fontSize: 11, marginTop: 4 }}>{r.error}</div>
                        )}
                        {r.compileWarnings && r.compileWarnings.length > 0 && (
                          <div style={{ color: "var(--warning-text)", fontSize: 11, marginTop: 4 }}>
                            Warnings: {r.compileWarnings.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Help Section */}
          <div style={{ marginTop: 32, padding: 20, background: "var(--surface-secondary)", borderRadius: 8 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              About BDD Specs
            </h3>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <p><strong>BDD Specs</strong> define analysis parameters, triggers, actions, and prompt guidance.</p>
              <p>Each spec creates:</p>
              <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                <li><strong>BDDFeatureSet</strong> - Stores the raw spec JSON</li>
                <li><strong>AnalysisSpec</strong> - Runtime spec with compiled promptTemplate</li>
                <li><strong>Parameters</strong> - Measurable dimensions (traits, behaviors)</li>
                <li><strong>ScoringAnchors</strong> - What high/low values mean</li>
                <li><strong>PromptSlugs</strong> - Reusable prompt components</li>
              </ul>
              <p>Specs are stored in the database, removing the need for filesystem access at runtime.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
