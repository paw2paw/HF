"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type ImportTab = "transcripts" | "specs";

type TranscriptResult = {
  ok: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  savedToRaw?: string[];
  callers?: Array<{
    id: string;
    name: string | null;
    email: string | null;
    isNew: boolean;
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

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>("transcripts");

  // Transcript state
  const [transcriptFiles, setTranscriptFiles] = useState<File[]>([]);
  const [transcriptImporting, setTranscriptImporting] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<"skip" | "overwrite" | "create_new">("skip");
  const [saveToRaw, setSaveToRaw] = useState(true); // Default to saving for future imports
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);

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
    }
  };

  const handleTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setTranscriptFiles(Array.from(e.dataTransfer.files));
      setTranscriptResult(null);
      setTranscriptError(null);
    }
  };

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

    try {
      const res = await fetch("/api/transcripts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok) {
        setTranscriptResult(data);
        setTranscriptFiles([]);
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
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>Import</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Upload transcripts or BDD specs to populate the database
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid #e5e7eb" }}>
        {[
          { id: "transcripts" as const, label: "📞 Transcripts", desc: "Call recordings" },
          { id: "specs" as const, label: "📋 BDD Specs", desc: "Analysis specs" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              background: activeTab === tab.id ? "#f9fafb" : "transparent",
              color: activeTab === tab.id ? "#4f46e5" : "#6b7280",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transcripts Tab */}
      {activeTab === "transcripts" && (
        <div>
          {/* Drop Zone */}
          <div
            onDrop={handleTranscriptDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => transcriptFileInputRef.current?.click()}
            style={{
              border: "2px dashed #d1d5db",
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
              cursor: "pointer",
              background: transcriptFiles.length > 0 ? "#f0fdf4" : "#f9fafb",
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
                <div style={{ fontSize: 16, fontWeight: 600, color: "#166534" }}>
                  {transcriptFiles.length} file(s) selected
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {transcriptFiles.map((f) => f.name).join(", ")}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#374151" }}>
                  Drop transcript files here or click to browse
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  Supports JSON, TXT, CSV formats
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <div style={{ marginTop: 20, padding: 16, background: "#f9fafb", borderRadius: 8 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              If caller already exists:
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { value: "skip", label: "Skip", desc: "Keep existing, ignore new" },
                { value: "overwrite", label: "Overwrite", desc: "Replace existing data" },
                { value: "create_new", label: "Create New", desc: "Create as new caller" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: duplicateHandling === opt.value ? "#eef2ff" : "#fff",
                    border: duplicateHandling === opt.value ? "2px solid #4f46e5" : "1px solid #e5e7eb",
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
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, marginLeft: 20 }}>
                    {opt.desc}
                  </div>
                </label>
              ))}
            </div>

            {/* Save to raw folder option */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={saveToRaw}
                  onChange={(e) => setSaveToRaw(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>Save to raw folder</span>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    Copies files to HF_KB_PATH/sources/transcripts/raw for future bulk imports via Data Management
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Import Button */}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={handleTranscriptImport}
              disabled={transcriptFiles.length === 0 || transcriptImporting}
              style={{
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                background: transcriptFiles.length === 0 || transcriptImporting ? "#e5e7eb" : "#4f46e5",
                color: transcriptFiles.length === 0 || transcriptImporting ? "#9ca3af" : "#fff",
                border: "none",
                borderRadius: 8,
                cursor: transcriptFiles.length === 0 || transcriptImporting ? "not-allowed" : "pointer",
              }}
            >
              {transcriptImporting ? "Importing..." : "Import Transcripts"}
            </button>
          </div>

          {/* Error */}
          {transcriptError && (
            <div style={{ marginTop: 20, padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
              {transcriptError}
            </div>
          )}

          {/* Result */}
          {transcriptResult && (
            <div style={{ marginTop: 20, padding: 20, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#166534", marginBottom: 12 }}>
                Import Complete
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 14, color: "#374151" }}>
                {transcriptResult.created !== undefined && <span>Created: {transcriptResult.created}</span>}
                {transcriptResult.updated !== undefined && <span>Updated: {transcriptResult.updated}</span>}
                {transcriptResult.skipped !== undefined && <span>Skipped: {transcriptResult.skipped}</span>}
              </div>

              {transcriptResult.callers && transcriptResult.callers.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Imported callers:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {transcriptResult.callers.map((c) => (
                      <Link
                        key={c.id}
                        href={`/x/callers/${c.id}`}
                        style={{
                          padding: "6px 12px",
                          background: c.isNew ? "#dbeafe" : "#f3f4f6",
                          color: c.isNew ? "#1d4ed8" : "#374151",
                          borderRadius: 6,
                          fontSize: 13,
                          textDecoration: "none",
                        }}
                      >
                        {c.name || c.email || c.id.slice(0, 8)}
                        {c.isNew && <span style={{ marginLeft: 4, fontSize: 10 }}>NEW</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {transcriptResult.savedToRaw && transcriptResult.savedToRaw.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: "#eff6ff", borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1e40af", marginBottom: 4 }}>
                    📁 Saved to raw folder ({transcriptResult.savedToRaw.length} files):
                  </div>
                  <div style={{ fontSize: 12, color: "#1e3a8a" }}>
                    {transcriptResult.savedToRaw.join(", ")}
                  </div>
                </div>
              )}

              {transcriptResult.errors && transcriptResult.errors.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: "#fef3c7", borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#92400e", marginBottom: 4 }}>
                    Warnings:
                  </div>
                  {transcriptResult.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#78350f" }}>
                      {err}
                    </div>
                  ))}
                </div>
              )}
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
              border: "2px dashed #d1d5db",
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
              cursor: "pointer",
              background: specFiles.length > 0 ? "#fef3c7" : "#f9fafb",
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
                <div style={{ fontSize: 16, fontWeight: 600, color: "#92400e" }}>
                  {specFiles.length} spec file(s) selected
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {specFiles.map((f) => f.name).join(", ")}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#374151" }}>
                  Drop .spec.json files here or click to browse
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  BDD specification files (e.g., CA-001-cognitive-activation.spec.json)
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <div style={{ marginTop: 20, padding: 16, background: "#f9fafb", borderRadius: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoActivate}
                onChange={(e) => setAutoActivate(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <div>
                <span style={{ fontWeight: 500 }}>Auto-activate specs</span>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
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
                background: specFiles.length === 0 || specImporting ? "#e5e7eb" : "#f59e0b",
                color: specFiles.length === 0 || specImporting ? "#9ca3af" : "#fff",
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
            <div style={{ marginTop: 20, padding: 16, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
              {specError}
            </div>
          )}

          {/* Result */}
          {specResult && (
            <div style={{ marginTop: 20, padding: 20, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#92400e", marginBottom: 12 }}>
                Import Complete
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 14, color: "#374151" }}>
                <span>Created: {specResult.created || 0}</span>
                <span>Updated: {specResult.updated || 0}</span>
                {(specResult.errors || 0) > 0 && <span style={{ color: "#dc2626" }}>Errors: {specResult.errors}</span>}
              </div>

              {specResult.results && specResult.results.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Results:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {specResult.results.map((r) => (
                      <div
                        key={r.specId}
                        style={{
                          padding: "8px 12px",
                          background: r.status === "error" ? "#fef2f2" : r.status === "created" ? "#f0fdf4" : "#f3f4f6",
                          border: r.status === "error" ? "1px solid #fecaca" : "1px solid #e5e7eb",
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 500 }}>{r.specId}</span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: r.status === "error" ? "#dc2626" : r.status === "created" ? "#10b981" : "#6b7280",
                              color: "#fff",
                            }}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{r.name}</div>
                        {r.error && (
                          <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{r.error}</div>
                        )}
                        {r.compileWarnings && r.compileWarnings.length > 0 && (
                          <div style={{ color: "#92400e", fontSize: 11, marginTop: 4 }}>
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
          <div style={{ marginTop: 32, padding: 20, background: "#f9fafb", borderRadius: 8 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, color: "#374151" }}>
              About BDD Specs
            </h3>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
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
