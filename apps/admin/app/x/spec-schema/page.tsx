"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type UploadResult = {
  ok: boolean;
  message?: string;
  error?: string;
  validationErrors?: string[];
  spec?: {
    id: string;
    title: string;
    version: string;
    domain?: string;
    specType?: string;
    parameterCount: number;
  };
  filename?: string;
  isOverwrite?: boolean;
};

export default function SpecSchemaPage() {
  const [schema, setSchema] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSchema();
  }, []);

  async function loadSchema() {
    setLoadingSchema(true);
    try {
      const res = await fetch("/api/x/spec-schema");
      const data = await res.json();
      if (data.ok) {
        setSchema(data.schema);
      } else {
        setSchemaError(data.error || "Failed to load schema");
      }
    } catch (e: any) {
      setSchemaError(e.message || "Network error");
    } finally {
      setLoadingSchema(false);
    }
  }

  function handleDownload() {
    if (!schema) return;
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feature-spec-schema.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadResult(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/x/spec-schema", {
        method: "POST",
        body: formData,
      });
      const data: UploadResult = await res.json();
      setUploadResult(data);

      if (data.ok) {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (e: any) {
      setUploadResult({ ok: false, error: e.message || "Network error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          BDD Spec Schema
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          View the schema, download it, and upload new BDD spec files
        </p>
      </div>

      {/* Download + Info Card */}
      <div
        style={{
          padding: 20,
          background: "var(--surface-primary)",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            feature-spec-schema.json
          </div>
          <button
            onClick={handleDownload}
            disabled={!schema}
            style={{
              padding: "8px 16px",
              background: schema ? "var(--button-primary-bg)" : "var(--button-disabled-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: schema ? "pointer" : "not-allowed",
              opacity: schema ? 1 : 0.6,
            }}
          >
            Download Schema
          </button>
        </div>

        <div
          style={{
            padding: 12,
            background: "var(--status-info-bg)",
            border: "1px solid var(--status-info-border)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--status-info-text)",
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          This schema defines the structure of BDD spec files. Download it, create a <code>.spec.json</code> file
          conforming to this schema, then upload it below. After uploading, go to{" "}
          <Link href="/x/data-management" style={{ fontWeight: 600, textDecoration: "underline" }}>
            Data Management
          </Link>{" "}
          to re-seed the system.
        </div>

        {/* Schema viewer */}
        {loadingSchema ? (
          <div style={{ fontSize: 14, color: "var(--text-muted)", padding: 20 }}>Loading schema...</div>
        ) : schemaError ? (
          <div style={{ fontSize: 14, color: "var(--status-error-text)", padding: 20 }}>{schemaError}</div>
        ) : (
          <div
            style={{
              maxHeight: 500,
              overflow: "auto",
              background: "var(--background)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: 16,
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
              }}
            >
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Upload Card */}
      <div
        style={{
          padding: 24,
          background: "var(--surface-primary)",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
          Upload BDD Spec
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: 32,
            border: `2px dashed ${dragOver ? "var(--button-primary-bg)" : "var(--border-default)"}`,
            borderRadius: 12,
            background: dragOver ? "var(--status-info-bg)" : "transparent",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {selectedFile ? "📄" : "📂"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            {selectedFile ? selectedFile.name : "Drop a .spec.json file here or click to browse"}
          </div>
          {selectedFile && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Upload button */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              padding: "10px 24px",
              background: selectedFile && !uploading ? "var(--button-primary-bg)" : "var(--button-disabled-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: selectedFile && !uploading ? "pointer" : "not-allowed",
              opacity: selectedFile && !uploading ? 1 : 0.6,
            }}
          >
            {uploading ? "Uploading..." : "Upload & Validate"}
          </button>

          {selectedFile && !uploading && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setUploadResult(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Upload result */}
        {uploadResult && (
          <div style={{ marginTop: 16 }}>
            {uploadResult.ok ? (
              <div>
                <div
                  style={{
                    padding: 16,
                    background: "var(--status-success-bg)",
                    border: "1px solid var(--status-success-border)",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-success-text)", marginBottom: 8 }}>
                    {uploadResult.message}
                  </div>
                  {uploadResult.spec && (
                    <div style={{ fontSize: 13, color: "var(--status-success-text)", lineHeight: 1.6 }}>
                      <div><strong>ID:</strong> {uploadResult.spec.id}</div>
                      <div><strong>Title:</strong> {uploadResult.spec.title}</div>
                      <div><strong>Version:</strong> {uploadResult.spec.version}</div>
                      {uploadResult.spec.domain && <div><strong>Domain:</strong> {uploadResult.spec.domain}</div>}
                      {uploadResult.spec.specType && <div><strong>Type:</strong> {uploadResult.spec.specType}</div>}
                      <div><strong>Parameters:</strong> {uploadResult.spec.parameterCount}</div>
                    </div>
                  )}
                </div>

                {/* Next steps */}
                <div
                  style={{
                    padding: 12,
                    background: "var(--status-info-bg)",
                    border: "1px solid var(--status-info-border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--status-info-text)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Next step:</strong> Go to{" "}
                  <Link href="/x/data-management" style={{ fontWeight: 600, textDecoration: "underline" }}>
                    Data Management
                  </Link>{" "}
                  and run <strong>Initialize System</strong> to sync this spec into the database.
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: 16,
                  background: "var(--status-error-bg)",
                  border: "1px solid var(--status-error-border)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-error-text)", marginBottom: 8 }}>
                  {uploadResult.error || "Upload failed"}
                </div>
                {uploadResult.validationErrors && uploadResult.validationErrors.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--status-error-text)", lineHeight: 1.6 }}>
                    {uploadResult.validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
