"use client";

import { useState, useEffect, useMemo } from "react";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

type PathsApiResponse = {
  ok: boolean;
  resolved?: {
    root: string;
    sources: Record<string, string>;
    derived: Record<string, string>;
    exports: Record<string, string>;
  };
  validation?: {
    valid: boolean;
    missing: string[];
    existing: string[];
  };
  error?: string;
};

function PathRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ width: 120, fontSize: 11, fontWeight: 600, color: "#6b7280", flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: mono,
            color: "#374151",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={value}
        >
          {value}
        </div>
        {hint && (
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{hint}</div>
        )}
      </div>
    </div>
  );
}

export default function EnvironmentPathsCard() {
  const [pathsData, setPathsData] = useState<PathsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  const status = useMemo(() => {
    if (error) return { color: "#ef4444", text: "Error" };
    if (loading) return { color: "#9ca3af", text: "Loading" };
    if (!pathsData?.ok) return { color: "#ef4444", text: "Error" };
    if (!pathsData?.validation?.valid) return { color: "#f59e0b", text: "Missing Paths" };
    return { color: "#10b981", text: "Ready" };
  }, [pathsData, error, loading]);

  const fetchPaths = async () => {
    try {
      const res = await fetch("/api/paths");
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        setPathsData(null);
      } else {
        setPathsData(json);
        setError(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load paths");
      setPathsData(null);
    } finally {
      setLoading(false);
    }
  };

  const initializeKb = async () => {
    setInitializing(true);
    try {
      const res = await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init" }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchPaths();
      } else {
        setError(json?.error || "Failed to initialize");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to initialize");
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    fetchPaths();
  }, []);

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status.color,
            }}
          />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Environment Paths</h2>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 4,
            background: status.color === "#10b981" ? "#ecfdf5" : status.color === "#ef4444" ? "#fef2f2" : "#f9fafb",
            color: status.color,
          }}
        >
          {status.text}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 12, padding: 8, background: "#fef2f2", borderRadius: 4 }}>
          {error}
        </div>
      )}

      {/* Missing paths warning + Initialize button */}
      {pathsData?.validation && !pathsData.validation.valid && (
        <div style={{ marginBottom: 12, padding: 10, background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#b45309", marginBottom: 6 }}>
            Missing directories ({pathsData.validation.missing.length})
          </div>
          <div style={{ fontSize: 10, color: "#92400e", marginBottom: 8 }}>
            {pathsData.validation.missing.slice(0, 3).join(", ")}
            {pathsData.validation.missing.length > 3 && ` +${pathsData.validation.missing.length - 3} more`}
          </div>
          <button
            onClick={initializeKb}
            disabled={initializing}
            style={{
              fontSize: 11,
              padding: "6px 12px",
              borderRadius: 4,
              border: "none",
              background: "#f59e0b",
              color: "white",
              fontWeight: 600,
              cursor: initializing ? "not-allowed" : "pointer",
              opacity: initializing ? 0.6 : 1,
            }}
          >
            {initializing ? "Initializing..." : "Initialize KB Structure"}
          </button>
        </div>
      )}

      {/* Paths */}
      {pathsData?.resolved && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <PathRow
            label="KB Root"
            value={pathsData.resolved.root}
            hint="Set HF_KB_PATH in .env.local"
          />

          {/* Sources */}
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginTop: 8, marginBottom: 4 }}>
            Sources
          </div>
          {Object.entries(pathsData.resolved.sources).map(([key, val]) => (
            <PathRow key={key} label={key} value={val} />
          ))}

          {/* Derived */}
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginTop: 8, marginBottom: 4 }}>
            Derived
          </div>
          {Object.entries(pathsData.resolved.derived).map(([key, val]) => (
            <PathRow key={key} label={key} value={val} />
          ))}

          {/* Exports */}
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginTop: 8, marginBottom: 4 }}>
            Exports
          </div>
          {Object.entries(pathsData.resolved.exports).map(([key, val]) => (
            <PathRow key={key} label={key} value={val} />
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && !pathsData && (
        <div style={{ fontSize: 11, color: "#9ca3af", padding: 12, textAlign: "center" }}>
          Loading paths configuration...
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 12, fontSize: 10, color: "#9ca3af" }}>
        Paths resolved via <code style={{ fontSize: 10 }}>/api/paths</code>
      </div>
    </section>
  );
}
