"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

type BDDUpload = {
  id: string;
  filename: string;
  fileType: "STORY" | "PARAMETER";
  status: "UPLOADED" | "VALIDATED" | "COMPILED" | "ERROR";
  storyId: string | null;
  parameterIds: string[];
  name: string | null;
  version: string | null;
  parseErrors: any;
  errorMessage: string | null;
  validatedAt: string | null;
  compiledAt: string | null;
  uploadedAt: string;
  featureSetId: string | null;
};

type LogEntry = {
  timestamp: Date;
  type: "info" | "success" | "error" | "detail";
  message: string;
};

export default function LabUploadPage() {
  const [uploads, setUploads] = useState<BDDUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [featureSetName, setFeatureSetName] = useState("");
  const [featureSetDescription, setFeatureSetDescription] = useState("");
  const [featureSetSpecType, setFeatureSetSpecType] = useState<"SYSTEM" | "DOMAIN" | "ADAPT" | "SUPERVISE">("DOMAIN");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true); // Default to AI-powered parsing
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { timestamp: new Date(), type, message }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/lab/uploads");
      const data = await res.json();
      if (data.ok) {
        setUploads(data.uploads || []);
      }
    } catch (err) {
      console.error("Failed to fetch uploads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    let validCount = 0;
    const fileNames: string[] = [];

    for (const file of Array.from(files)) {
      // Accept XML, markdown, text, and JSON files
      if (file.name.endsWith(".xml") || file.name.endsWith(".md") || file.name.endsWith(".txt") || file.name.endsWith(".json")) {
        formData.append("files", file);
        validCount++;
        fileNames.push(file.name);
      }
    }

    if (validCount === 0) {
      setError("No valid files selected. Please select .xml, .md, .txt, or .json files to upload.");
      setUploading(false);
      return;
    }

    addLog("info", `━━━ UPLOAD START ━━━`);
    addLog("info", `Files: ${fileNames.join(", ")}`);

    try {
      const res = await fetch("/api/lab/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(`Successfully uploaded ${data.uploads?.length || 0} file(s)`);
        addLog("success", `✓ Uploaded ${data.uploads?.length || 0} file(s)`);
        if (data.uploads && Array.isArray(data.uploads)) {
          for (const upload of data.uploads) {
            addLog("detail", `  → ${upload.filename} (${upload.fileType})`);
          }
        }
        await fetchUploads();
      } else {
        setError(data.error || "Upload failed");
        addLog("error", `✗ Upload failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
      addLog("error", `✗ Exception: ${err.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      addLog("info", `━━━ UPLOAD END ━━━`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ""; // Reset to allow re-selecting same file
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === uploads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uploads.map((u) => u.id)));
    }
  };

  const handleValidate = async () => {
    if (selectedIds.size === 0) return;

    setValidating(true);
    setError(null);
    setSuccess(null);

    const selectedFiles = uploads.filter((u) => selectedIds.has(u.id));
    addLog("info", `━━━ VALIDATE START ━━━`);
    addLog("info", `Mode: ${useAI ? "AI-Powered" : "Regex-based"}`);
    addLog("info", `Files: ${selectedFiles.map((f) => f.filename).join(", ")}`);

    try {
      // Use AI or regex-based validation
      const endpoint = useAI ? "/api/lab/uploads/validate-ai" : "/api/lab/uploads/validate";
      addLog("detail", `Calling ${endpoint}...`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await res.json();

      if (data.ok) {
        const engineMsg = data.engine ? ` (using ${data.engine})` : "";
        setSuccess(`Validated ${data.validated || 0} file(s)${engineMsg}. Now click "Create Feature Set" to continue.`);

        // Log detailed results
        addLog("success", `✓ Validated ${data.validated || 0} file(s)${engineMsg}`);

        if (data.results && Array.isArray(data.results)) {
          for (const result of data.results) {
            if (result.success) {
              const typeLabel = result.isHybrid ? "HYBRID (params + story)" : result.type;
              addLog("success", `  ✓ ${result.filename}: ${typeLabel}`);
              if (result.parameterCount) {
                addLog("detail", `    → ${result.parameterCount} parameters extracted`);
              }
              if (result.parameters && result.parameters.length > 0) {
                addLog("detail", `    → Parameters: ${result.parameters.join(", ")}`);
              }
              if (result.storyId) {
                addLog("detail", `    → Story ID: ${result.storyId}`);
              }
              if (result.storyTitle) {
                addLog("detail", `    → Story: ${result.storyTitle}`);
              }
              if (result.constraintCount) {
                addLog("detail", `    → ${result.constraintCount} constraints/failures`);
              }
              if (result.acceptanceCriteriaCount) {
                addLog("detail", `    → ${result.acceptanceCriteriaCount} acceptance criteria (Gherkin)`);
              }
            } else {
              addLog("error", `  ✗ ${result.filename}: ${result.error || "Unknown error"}`);
            }
          }
        }

        await fetchUploads();
        // Keep selection so user can immediately compile
      } else {
        setError(data.error || "Validation failed");
        addLog("error", `✗ Validation failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setError(err.message || "Validation failed");
      addLog("error", `✗ Exception: ${err.message || "Unknown error"}`);
    } finally {
      setValidating(false);
      addLog("info", `━━━ VALIDATE END ━━━`);
    }
  };

  const getCompilableUploads = () => {
    return uploads.filter(
      (u) => selectedIds.has(u.id) && (u.status === "VALIDATED" || u.status === "COMPILED")
    );
  };

  const generateDefaultName = () => {
    const compilable = getCompilableUploads();
    if (compilable.length === 0) return "New Feature Set";

    // Use first file's name (without extension) as base
    const firstName = compilable[0].name || compilable[0].filename.replace(/\.(bdd|param)?\.xml$/i, "");

    if (compilable.length === 1) {
      return firstName;
    }

    // Multiple files: "First Name + N more"
    return `${firstName} + ${compilable.length - 1} more`;
  };

  const handleOpenCreateModal = () => {
    const compilable = getCompilableUploads();
    if (compilable.length === 0) {
      setError("Select validated uploads to create a Feature Set");
      addLog("error", "No validated uploads selected");
      return;
    }

    setFeatureSetName(generateDefaultName());
    setFeatureSetDescription("");
    // Try to detect specType from parsed data
    let detectedSpecType: "SYSTEM" | "DOMAIN" | "ADAPT" | "SUPERVISE" = "DOMAIN";
    for (const upload of compilable) {
      const parsed = upload.parseErrors as any;
      if (parsed?.specType) {
        detectedSpecType = parsed.specType;
        break;
      }
    }
    setFeatureSetSpecType(detectedSpecType);
    setShowCreateModal(true);
  };

  const handleCreateFeatureSet = async () => {
    const compilableUploads = getCompilableUploads();
    if (compilableUploads.length === 0) {
      setError("Select validated uploads to compile");
      addLog("error", "No validated uploads selected for compilation");
      return;
    }

    setShowCreateModal(false);
    setCompiling(true);
    setError(null);
    setSuccess(null);

    addLog("info", `━━━ CREATE FEATURE SET ━━━`);
    addLog("info", `Name: ${featureSetName}`);
    addLog("info", `Spec Type: ${featureSetSpecType}`);
    addLog("info", `Mode: ${useAI ? "AI-Powered" : "Regex-based"}`);
    addLog("info", `Files: ${compilableUploads.map((f) => f.filename).join(", ")}`);

    try {
      // Use AI or regex-based compilation
      const endpoint = useAI ? "/api/lab/uploads/compile-ai" : "/api/lab/uploads/compile";
      addLog("detail", `Calling ${endpoint}...`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          name: featureSetName,
          description: featureSetDescription || undefined,
          specType: featureSetSpecType,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        const fs = data.featureSet;
        setSuccess(`Created Feature Set: ${fs?.name || featureSetName} (${fs?.parameterCount || 0} parameters)`);

        addLog("success", `✓ Feature Set Created`);
        addLog("success", `  Name: ${fs?.name || featureSetName}`);
        addLog("success", `  ID: ${fs?.featureId || fs?.id || "Unknown"}`);
        addLog("detail", `  Version: ${fs?.version || "1.0"}`);
        addLog("detail", `  Spec Type: ${fs?.specType || featureSetSpecType}`);
        addLog("detail", `  Parameters: ${fs?.parameterCount || 0}`);
        addLog("detail", `  Constraints: ${fs?.constraintCount || 0}`);
        addLog("detail", `  Definitions: ${fs?.definitionCount || 0}`);

        if (data.compilationDetails) {
          const cd = data.compilationDetails;
          if (cd.storiesProcessed) {
            addLog("detail", `  Stories processed: ${cd.storiesProcessed}`);
          }
          if (cd.parametersProcessed) {
            addLog("detail", `  Parameter files processed: ${cd.parametersProcessed}`);
          }
          if (cd.scoringSpec) {
            addLog("success", `  ✓ Scoring Spec generated`);
          }
        }

        await fetchUploads();
        setSelectedIds(new Set());
      } else {
        setError(data.error || "Failed to create Feature Set");
        addLog("error", `✗ Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create Feature Set");
      addLog("error", `✗ Exception: ${err.message || "Unknown error"}`);
    } finally {
      setCompiling(false);
      addLog("info", `━━━ CREATE END ━━━`);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} upload(s)? This cannot be undone.`)) return;

    try {
      const res = await fetch("/api/lab/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(`Deleted ${data.deleted || 0} upload(s)`);
        await fetchUploads();
        setSelectedIds(new Set());
      } else {
        setError(data.error || "Delete failed");
      }
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      UPLOADED: { bg: "#dbeafe", text: "#1d4ed8", label: "Uploaded" },
      VALIDATED: { bg: "#dcfce7", text: "#166534", label: "Validated" },
      COMPILED: { bg: "#f0fdf4", text: "#15803d", label: "Compiled" },
      ERROR: { bg: "#fef2f2", text: "#dc2626", label: "Error" },
    };
    const s = styles[status] || styles.UPLOADED;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          padding: "3px 8px",
          borderRadius: 4,
          background: s.bg,
          color: s.text,
        }}
      >
        {s.label}
      </span>
    );
  };

  const getFileTypeIcon = (fileType: string) => {
    return fileType === "STORY" ? "📖" : "📐";
  };

  const selectedCount = selectedIds.size;
  // Allow re-validation and re-compilation
  const selectedCanValidate = uploads.filter(
    (u) => selectedIds.has(u.id)
  ).length;
  const selectedCanCompile = uploads.filter(
    (u) => selectedIds.has(u.id) && (u.status === "VALIDATED" || u.status === "COMPILED")
  ).length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Link href="/lab" style={{ color: "#6b7280", textDecoration: "none" }}>
            ← Lab
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>📤</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Upload Specs</h1>
        </div>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 0 0" }}>
          Upload BDD XML specs. Supports both story specs (*.bdd.xml) and parameter specs (*.param.xml).
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div
          style={{
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: 12,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            color: "#166534",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {success}
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${dragOver ? "#4f46e5" : "#d1d5db"}`,
          borderRadius: 12,
          padding: 40,
          textAlign: "center",
          background: dragOver ? "#eef2ff" : "#f9fafb",
          marginBottom: 24,
          transition: "all 0.15s ease",
          cursor: "pointer",
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xml,.md,.txt,.json"
          multiple
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {uploading ? "⏳" : dragOver ? "📥" : "📄"}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
          {uploading ? "Uploading..." : dragOver ? "Drop files here" : "Drop spec files here or click to browse"}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Accepts .json, .xml, .md, and .txt files
        </div>
      </div>

      {/* AI Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          padding: 12,
          background: useAI ? "#eef2ff" : "#f9fafb",
          border: useAI ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
          borderRadius: 8,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => setUseAI(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: useAI ? "#4f46e5" : "#374151" }}>
            🤖 AI-Powered Parsing
          </span>
        </label>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {useAI
            ? "Uses Claude/OpenAI to intelligently extract parameters and specs from any format"
            : "Uses regex-based parsing (XML only, stricter format requirements)"}
        </span>
      </div>

      {/* Action Buttons */}
      {uploads.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            padding: 16,
            background: "#f9fafb",
            borderRadius: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleSelectAll}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {selectedIds.size === uploads.length ? "Deselect All" : "Select All"}
          </button>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 13, color: "#6b7280" }}>
            {selectedCount} selected
          </span>

          <button
            onClick={handleValidate}
            disabled={selectedCanValidate === 0 || validating}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: selectedCanValidate > 0 ? "#8b5cf6" : "#e5e7eb",
              color: selectedCanValidate > 0 ? "#fff" : "#9ca3af",
              border: "none",
              borderRadius: 6,
              cursor: selectedCanValidate > 0 ? "pointer" : "not-allowed",
            }}
          >
            {validating ? "Validating..." : "Validate"}
          </button>

          <button
            onClick={handleOpenCreateModal}
            disabled={selectedCanCompile === 0 || compiling}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: selectedCanCompile > 0 ? "#10b981" : "#e5e7eb",
              color: selectedCanCompile > 0 ? "#fff" : "#9ca3af",
              border: "none",
              borderRadius: 6,
              cursor: selectedCanCompile > 0 ? "pointer" : "not-allowed",
            }}
          >
            {compiling ? "Creating..." : "Create Feature Set"}
          </button>

          <button
            onClick={handleDelete}
            disabled={selectedCount === 0}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: selectedCount > 0 ? "#ef4444" : "#e5e7eb",
              color: selectedCount > 0 ? "#fff" : "#9ca3af",
              border: "none",
              borderRadius: 6,
              cursor: selectedCount > 0 ? "pointer" : "not-allowed",
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Uploads List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading uploads...</div>
      ) : uploads.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "#374151" }}>No uploads yet</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Upload XML specs to get started
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ width: 40, padding: "12px 16px", textAlign: "left" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === uploads.length && uploads.length > 0}
                    onChange={handleSelectAll}
                    style={{ width: 16, height: 16 }}
                  />
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Type
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Filename
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Name / ID
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Status
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr
                  key={upload.id}
                  onClick={() => handleToggleSelect(upload.id)}
                  style={{
                    borderTop: "1px solid #f3f4f6",
                    background: selectedIds.has(upload.id) ? "#eef2ff" : "#fff",
                    cursor: "pointer",
                    transition: "background 0.1s ease",
                  }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(upload.id)}
                      onChange={() => {}}
                      style={{ width: 16, height: 16 }}
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 20 }}>{getFileTypeIcon(upload.fileType)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{upload.filename}</div>
                    {upload.version && (
                      <div style={{ fontSize: 11, color: "#6b7280" }}>v{upload.version}</div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 13 }}>
                      {upload.name || upload.storyId || "-"}
                    </div>
                    {upload.parameterIds && upload.parameterIds.length > 0 && (
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {upload.parameterIds.length} parameter(s)
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {getStatusBadge(upload.status)}
                    {upload.errorMessage && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                        {upload.errorMessage}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(upload.uploadedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Workflow Info */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
        }}
      >
        <div style={{ fontWeight: 600, color: "#0369a1", marginBottom: 8, fontSize: 14 }}>
          Workflow
        </div>
        <div style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.6 }}>
          <strong>1. Upload</strong> – Drop JSON specs or XML/Markdown/text files<br />
          <strong>2. Validate</strong> – JSON specs parse instantly; other formats use AI extraction<br />
          <strong>3. Create Feature Set</strong> – Name and generate a Feature Set with scoring specification<br />
          <br />
          After creating, view your Feature Set in <Link href="/lab/features" style={{ color: "#2563eb" }}>Feature Sets</Link> to see the Data Dictionary, Scoring Spec, and test against real transcripts.
        </div>
      </div>

      {/* Log Panel */}
      <div
        style={{
          marginTop: 24,
          border: "1px solid #374151",
          borderRadius: 8,
          overflow: "hidden",
          background: "#1f2937",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "#111827",
            borderBottom: "1px solid #374151",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📋</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#f9fafb" }}>
              Operation Logs
            </span>
            {logs.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  background: "#374151",
                  borderRadius: 4,
                  color: "#9ca3af",
                }}
              >
                {logs.length} entries
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowLogs(!showLogs)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                background: "#374151",
                color: "#d1d5db",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {showLogs ? "Hide" : "Show"}
            </button>
            <button
              onClick={clearLogs}
              disabled={logs.length === 0}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                background: logs.length > 0 ? "#374151" : "#1f2937",
                color: logs.length > 0 ? "#d1d5db" : "#6b7280",
                border: "none",
                borderRadius: 4,
                cursor: logs.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {showLogs && (
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              padding: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: "#6b7280", fontStyle: "italic" }}>
                No logs yet. Upload files and click Validate or Compile to see operation logs.
              </div>
            ) : (
              logs.map((log, i) => {
                const colors: Record<LogEntry["type"], string> = {
                  info: "#60a5fa",
                  success: "#34d399",
                  error: "#f87171",
                  detail: "#9ca3af",
                };
                return (
                  <div key={i} style={{ color: colors[log.type] }}>
                    <span style={{ color: "#6b7280" }}>
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{" "}
                    {log.message}
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Create Feature Set Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>📦</span>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Create Feature Set</h2>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                value={featureSetName}
                onChange={(e) => setFeatureSetName(e.target.value)}
                placeholder="e.g., Personality Measurement Specs"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Description <span style={{ color: "#9ca3af" }}>(optional)</span>
              </label>
              <textarea
                value={featureSetDescription}
                onChange={(e) => setFeatureSetDescription(e.target.value)}
                placeholder="Brief description of what this feature set does..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Spec Type <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={featureSetSpecType}
                onChange={(e) => setFeatureSetSpecType(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="SYSTEM">SYSTEM – Runs for every call (memory, personality, guardrails)</option>
                <option value="DOMAIN">DOMAIN – Domain-specific, selected per playbook</option>
                <option value="ADAPT">ADAPT – Post-measurement (compute targets, deltas)</option>
                <option value="SUPERVISE">SUPERVISE – Meta-level (validate/refine targets)</option>
              </select>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                {featureSetSpecType === "SYSTEM" && "⚙️ SYSTEM specs run automatically for all calls across all playbooks"}
                {featureSetSpecType === "DOMAIN" && "📋 DOMAIN specs are selected manually when configuring a playbook"}
                {featureSetSpecType === "ADAPT" && "🎯 ADAPT specs compute personalized targets based on measurements"}
                {featureSetSpecType === "SUPERVISE" && "👁️ SUPERVISE specs validate and refine other spec outputs"}
              </div>
            </div>

            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 8 }}>
                Including {getCompilableUploads().length} spec(s):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {getCompilableUploads().slice(0, 5).map((u) => (
                  <div key={u.id} style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#10b981" }}>✓</span>
                    {u.name || u.filename}
                  </div>
                ))}
                {getCompilableUploads().length > 5 && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    + {getCompilableUploads().length - 5} more...
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  background: "#fff",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFeatureSet}
                disabled={!featureSetName.trim()}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: featureSetName.trim() ? "#10b981" : "#e5e7eb",
                  color: featureSetName.trim() ? "#fff" : "#9ca3af",
                  border: "none",
                  borderRadius: 6,
                  cursor: featureSetName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
