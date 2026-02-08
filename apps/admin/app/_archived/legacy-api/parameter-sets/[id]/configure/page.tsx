"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ParameterEqualizer, ParameterConfig } from "@/components/equalizer/ParameterEqualizer";

interface ParameterSetData {
  id: string;
  name: string;
  createdAt: string;
  parameters: {
    id: string;
    parameterId: string;
    enabled: boolean;
    weight: number;
    biasValue: number | null;
    thresholdLow: number | null;
    thresholdHigh: number | null;
    parameter: {
      parameterId: string;
      name: string;
      domainGroup: string;
      definition: string | null;
      scaleType: string | null;
      directionality: string | null;
    };
  }[];
  _count: {
    parameters: number;
    runs: number;
  };
}

export default function ConfigureParameterSetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [parameterSet, setParameterSet] = useState<ParameterSetData | null>(null);
  const [parameters, setParameters] = useState<ParameterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch parameter set
  useEffect(() => {
    fetch(`/api/parameter-sets/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setParameterSet(data.parameterSet);
          // Transform to EQ format
          const eqParams: ParameterConfig[] = data.parameterSet.parameters.map((p: any) => ({
            parameterId: p.parameterId,
            name: p.parameter.name,
            domainGroup: p.parameter.domainGroup,
            definition: p.parameter.definition,
            scaleType: p.parameter.scaleType,
            directionality: p.parameter.directionality,
            enabled: p.enabled ?? true,
            weight: p.weight ?? 1.0,
            biasValue: p.biasValue ?? null,
            thresholdLow: p.thresholdLow ?? null,
            thresholdHigh: p.thresholdHigh ?? null,
            // Store defaults for comparison
            defaultWeight: 1.0,
            defaultEnabled: true,
          }));
          setParameters(eqParams);
        } else {
          setError(data.error || "Failed to load parameter set");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Handle parameter changes
  const handleChange = useCallback((updated: ParameterConfig[]) => {
    setParameters(updated);
    setHasChanges(true);
  }, []);

  // Save configuration
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/parameter-sets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parameters: parameters.map((p) => ({
            parameterId: p.parameterId,
            enabled: p.enabled,
            weight: p.weight,
            biasValue: p.biasValue,
            thresholdLow: p.thresholdLow,
            thresholdHigh: p.thresholdHigh,
          })),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setHasChanges(false);
        // Optionally refresh the data
        setParameterSet(data.parameterSet);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [id, parameters]);

  // Save as new preset
  const handleSaveAsNew = useCallback(async () => {
    const name = prompt("Enter a name for the new configuration:", `${parameterSet?.name} (Copy)`);
    if (!name) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/parameter-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parameters: parameters.map((p) => ({
            parameterId: p.parameterId,
            enabled: p.enabled,
            weight: p.weight,
            biasValue: p.biasValue,
            thresholdLow: p.thresholdLow,
            thresholdHigh: p.thresholdHigh,
          })),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        // Navigate to the new parameter set
        router.push(`/parameter-sets/${data.parameterSet.id}/configure`);
      } else {
        setError(data.error || "Failed to create");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [parameterSet, parameters, router]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading configuration...
      </div>
    );
  }

  if (error && !parameterSet) {
    return (
      <div style={{ padding: 40 }}>
        <div
          style={{
            padding: 20,
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
        <Link
          href="/parameter-sets"
          style={{
            display: "inline-block",
            marginTop: 16,
            color: "#3b82f6",
          }}
        >
          Back to Parameter Sets
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Link
              href="/parameter-sets"
              style={{
                color: "#6b7280",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Parameter Sets
            </Link>
            <span style={{ color: "#d1d5db" }}>/</span>
            <span style={{ color: "#374151", fontSize: 14, fontWeight: 500 }}>
              {parameterSet?.name}
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Configure Analyzer
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Adjust parameter weights and settings for your analysis run
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSaveAsNew}
            disabled={saving}
            style={{
              padding: "10px 20px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            Save as New
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            style={{
              padding: "10px 20px",
              background: hasChanges ? "#10b981" : "#9ca3af",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || !hasChanges ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#dc2626",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            x
          </button>
        </div>
      )}

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          You have unsaved changes. Click "Save Changes" to persist your configuration.
        </div>
      )}

      {/* Stats bar */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          gap: 16,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: 16,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#166534" }}>
            {parameters.filter((p) => p.enabled).length}
          </div>
          <div style={{ fontSize: 12, color: "#15803d" }}>Parameters Enabled</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: 16,
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#92400e" }}>
            {parameters.filter(
              (p) =>
                p.weight !== 1.0 ||
                !p.enabled ||
                (p.biasValue !== null && p.biasValue !== 0)
            ).length}
          </div>
          <div style={{ fontSize: 12, color: "#a16207" }}>Parameters Modified</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: 16,
            background: "#eff6ff",
            border: "1px solid #93c5fd",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1e40af" }}>
            {new Set(parameters.map((p) => p.domainGroup)).size}
          </div>
          <div style={{ fontSize: 12, color: "#1d4ed8" }}>Domain Groups</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: 16,
            background: "#faf5ff",
            border: "1px solid #d8b4fe",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#6b21a8" }}>
            {parameterSet?._count.runs || 0}
          </div>
          <div style={{ fontSize: 12, color: "#7e22ce" }}>Analysis Runs</div>
        </div>
      </div>

      {/* Equalizer */}
      <ParameterEqualizer
        parameters={parameters}
        onChange={handleChange}
        onSave={handleSave}
        title={`${parameterSet?.name} Configuration`}
        showPresets={true}
      />
    </div>
  );
}
