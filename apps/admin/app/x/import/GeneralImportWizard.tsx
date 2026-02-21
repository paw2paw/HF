"use client";

import { RefObject } from "react";

interface GeneralImportWizardProps {
  step: 1 | 2 | 3 | 4;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  rawText: string;
  setRawText: (text: string) => void;
  parsing: boolean;
  setParsing: (parsing: boolean) => void;
  detectedType: string | null;
  setDetectedType: (type: string | null) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  extracting: boolean;
  setExtracting: (extracting: boolean) => void;
  extractedSpec: any;
  setExtractedSpec: (spec: any) => void;
  error: string | null;
  setError: (error: string | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  autoActivate: boolean;
  setAutoActivate: (autoActivate: boolean) => void;
  onImportComplete: (result: any) => void;
}

const SPEC_TYPES = [
  {
    value: "CURRICULUM",
    label: "Curriculum",
    description: "Module-based learning content with learning outcomes",
    icon: "📚",
    bestFor: "Course materials, training guides, certifications",
  },
  {
    value: "MEASURE",
    label: "Measure",
    description: "Behavioral parameters and measurement specs",
    icon: "📊",
    bestFor: "Personality traits, engagement metrics, scoring",
  },
  {
    value: "IDENTITY",
    label: "Identity",
    description: "Agent persona and character definition",
    icon: "🎭",
    bestFor: "Character sheets, role definitions, voice",
  },
  {
    value: "CONTENT",
    label: "Content",
    description: "Book or source knowledge for teaching",
    icon: "📖",
    bestFor: "Reference materials, textbooks, articles",
  },
  {
    value: "ADAPT",
    label: "Adapt",
    description: "Behavior adaptation rules and triggers",
    icon: "🔄",
    bestFor: "Teaching style adjustments, personalization",
  },
  {
    value: "GUARDRAIL",
    label: "Guardrail",
    description: "Safety constraints and boundaries",
    icon: "🛡️",
    bestFor: "Compliance rules, content filters, limits",
  },
];

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
    {Array.from({ length: total }, (_, i) => i + 1).map((num) => (
      <div key={num} style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 600,
            background: num === current
              ? "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #6366f1) 100%)"
              : num < current
              ? "var(--success-text)"
              : "var(--surface-tertiary)",
            color: num <= current ? "white" : "var(--text-muted)",
            transition: "all 0.2s",
          }}
        >
          {num < current ? "✓" : num}
        </div>
        {num < total && (
          <div
            style={{
              width: 40,
              height: 2,
              background: num < current ? "var(--success-text)" : "var(--border-default)",
              marginLeft: 8,
            }}
          />
        )}
      </div>
    ))}
    <div style={{ marginLeft: 16, fontSize: 13, color: "var(--text-muted)" }}>
      {current === 1 && "Upload Document"}
      {current === 2 && "Confirm Spec Type"}
      {current === 3 && "Review & Edit"}
      {current === 4 && "Export"}
    </div>
  </div>
);

export function GeneralImportWizard({
  step,
  setStep,
  file,
  setFile,
  rawText,
  setRawText,
  parsing,
  setParsing,
  detectedType,
  setDetectedType,
  selectedType,
  setSelectedType,
  extracting,
  setExtracting,
  extractedSpec,
  setExtractedSpec,
  error,
  setError,
  fileInputRef,
  autoActivate,
  setAutoActivate,
  onImportComplete,
}: GeneralImportWizardProps) {
  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setParsing(true);

    try {
      // Read file content
      const text = await selectedFile.text();
      setRawText(text);

      // Call parse-document API
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/specs/parse-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.ok) {
        setDetectedType(data.suggestedType);
        setSelectedType(data.suggestedType || "CURRICULUM");
        setStep(2);
      } else {
        setError(data.error || "Failed to parse document");
      }
    } catch (err) {
      setError("Error reading file: " + (err as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    // Create a synthetic event to reuse handleFileChange logic
    const input = fileInputRef.current;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(droppedFile);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  // Extract structure
  const handleExtract = async () => {
    setExtracting(true);
    setError(null);

    try {
      const res = await fetch("/api/specs/extract-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          specType: selectedType,
          fileName: file?.name,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setExtractedSpec(data.spec);
        setStep(3);
      } else {
        setError(data.error || "Failed to extract structure");
      }
    } catch (err) {
      setError("Error extracting structure: " + (err as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  // Download spec
  const handleDownload = () => {
    if (!extractedSpec) return;

    const blob = new Blob([JSON.stringify(extractedSpec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${extractedSpec.id || "spec"}.spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!extractedSpec) return;
    await navigator.clipboard.writeText(JSON.stringify(extractedSpec, null, 2));
  };

  // Import directly
  const handleImportNow = async () => {
    if (!extractedSpec) return;

    setExtracting(true);
    setError(null);

    try {
      const res = await fetch("/api/specs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specs: [extractedSpec],
          autoActivate,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        onImportComplete(data);
      } else {
        setError(data.error || "Failed to import spec");
      }
    } catch (err) {
      setError("Error importing: " + (err as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setRawText("");
    setDetectedType(null);
    setSelectedType("CURRICULUM");
    setExtractedSpec(null);
    setError(null);
  };

  return (
    <div>
      <StepIndicator current={step} total={4} />

      {/* Step 1: Upload */}
      {step === 1 && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--accent-primary)",
              borderRadius: 16,
              padding: 48,
              textAlign: "center",
              cursor: "pointer",
              background: "linear-gradient(135deg, var(--accent-bg) 0%, transparent 100%)",
              transition: "all 0.2s",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.docx"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {parsing ? (
              <div>
                <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1s infinite" }}>🔍</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent-primary)" }}>
                  Analyzing document...
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                  Detecting structure and spec type
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                  Drop your document here
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
                  Supports <strong>.md</strong>, <strong>.txt</strong>, and <strong>.docx</strong> files
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
                  AI will analyze the content and convert it to a spec.json format
                </div>
              </div>
            )}
          </div>

          {/* Info cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
            <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Curriculum</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Course outlines, learning modules, training guides
              </div>
            </div>
            <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Measures</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Behavioral traits, scoring rubrics, assessment criteria
              </div>
            </div>
            <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎭</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Identity</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Character definitions, persona descriptions, voice guides
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Confirm Type */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
              Document: <strong style={{ color: "var(--text-primary)" }}>{file?.name}</strong>
            </div>
            {detectedType && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: "var(--success-bg)",
                  border: "1px solid var(--success-border)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 16 }}>✓</span>
                <span style={{ color: "var(--success-text)" }}>
                  AI detected: <strong>{detectedType}</strong>
                </span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
              Select Spec Type
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {SPEC_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  style={{
                    padding: 16,
                    background: selectedType === type.value
                      ? "linear-gradient(135deg, var(--accent-bg) 0%, var(--surface-primary) 100%)"
                      : "var(--surface-secondary)",
                    border: selectedType === type.value
                      ? "2px solid var(--accent-primary)"
                      : "1px solid var(--border-default)",
                    borderRadius: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{type.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                        {type.label}
                        {type.value === detectedType && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              padding: "2px 6px",
                              background: "var(--success-text)",
                              color: "white",
                              borderRadius: 4,
                            }}
                          >
                            DETECTED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {type.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Best for: {type.bestFor}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              onClick={handleExtract}
              disabled={extracting}
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                background: extracting
                  ? "var(--text-placeholder)"
                  : "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #6366f1) 100%)",
                color: "white",
                cursor: extracting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {extracting ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite" }}>⏳</span>
                  Extracting...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Extract Structure
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && extractedSpec && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              {extractedSpec.title || extractedSpec.id}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              ID: {extractedSpec.id} | Type: {extractedSpec.specType} | Role: {extractedSpec.specRole || "—"}
            </div>
          </div>

          {/* JSON Preview */}
          <div
            style={{
              background: "var(--surface-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 16,
              maxHeight: 500,
              overflow: "auto",
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                fontFamily: "Monaco, Consolas, monospace",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(extractedSpec, null, 2)}
            </pre>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-secondary)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={handleExtract}
                disabled={extracting}
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid var(--warning-border)",
                  background: "var(--warning-bg)",
                  color: "var(--warning-text)",
                  cursor: "pointer",
                }}
              >
                Regenerate
              </button>
            </div>
            <button
              onClick={() => setStep(4)}
              style={{
                padding: "12px 32px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, var(--status-success-text) 0%, var(--status-success-text) 100%)",
                color: "white",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Continue to Export
              <span style={{ fontSize: 18 }}>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Export */}
      {step === 4 && extractedSpec && (
        <div>
          <div
            style={{
              background: "linear-gradient(135deg, var(--success-bg) 0%, var(--surface-primary) 100%)",
              border: "1px solid var(--success-border)",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Spec Ready!
            </div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
              <strong>{extractedSpec.title}</strong> has been converted to .spec.json format
            </div>
          </div>

          {/* Export options */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            <button
              onClick={handleDownload}
              style={{
                padding: 20,
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>💾</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Download JSON
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Save .spec.json file to disk
              </div>
            </button>

            <button
              onClick={handleCopy}
              style={{
                padding: 20,
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Copy to Clipboard
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Copy JSON for manual paste
              </div>
            </button>

            <button
              onClick={handleImportNow}
              disabled={extracting}
              style={{
                padding: 20,
                background: "linear-gradient(135deg, var(--accent-bg) 0%, var(--surface-primary) 100%)",
                border: "2px solid var(--accent-primary)",
                borderRadius: 12,
                textAlign: "left",
                cursor: extracting ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                gridColumn: "span 2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 32 }}>🚀</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-primary)" }}>
                    {extracting ? "Importing..." : "Import Now"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    Import directly to database and activate
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Auto-activate option */}
          <div style={{ marginTop: 16, padding: 12, background: "var(--surface-secondary)", borderRadius: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoActivate}
                onChange={(e) => setAutoActivate(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <div>
                <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary)" }}>
                  Auto-activate on import
                </span>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Create Parameters, ScoringAnchors, and AnalysisSpec records
                </div>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep(3)}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Back to Review
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontSize: 14, color: "var(--error-text)" }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "var(--error-text)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
