"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ParameterEqualizer, ParameterConfig } from "@/components/equalizer/ParameterEqualizer";

interface ParameterSetOption {
  id: string;
  name: string;
  createdAt: string;
  _count?: {
    parameters: number;
    runs: number;
  };
}

export default function AnalyzerConfigPage() {
  const router = useRouter();

  // Parameter data
  const [parameters, setParameters] = useState<ParameterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preset selection
  const [presets, setPresets] = useState<ParameterSetOption[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(true);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [configName, setConfigName] = useState(`Analysis Config ${new Date().toLocaleDateString()}`);

  // Fetch all parameters
  useEffect(() => {
    fetch("/api/parameters?range=[0,199]")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const params: ParameterConfig[] = data.map((p: any) => ({
            parameterId: p.parameterId,
            name: p.name,
            domainGroup: p.domainGroup || "Other",
            definition: p.definition,
            scaleType: p.scaleType,
            directionality: p.directionality,
            enabled: true,
            weight: 1.0,
            biasValue: null,
            thresholdLow: null,
            thresholdHigh: null,
            defaultWeight: 1.0,
            defaultEnabled: true,
          }));
          setParameters(params);
        } else {
          setError("Failed to load parameters");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Fetch available presets
  useEffect(() => {
    fetch("/api/parameter-sets")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setPresets(data.parameterSets || []);
        }
        setLoadingPresets(false);
      })
      .catch(() => {
        setLoadingPresets(false);
      });
  }, []);

  // Load preset configuration
  const loadPreset = useCallback(async (presetId: string) => {
    if (!presetId) {
      // Reset to defaults
      setParameters((prev) =>
        prev.map((p) => ({
          ...p,
          enabled: true,
          weight: 1.0,
          biasValue: null,
          thresholdLow: null,
          thresholdHigh: null,
        }))
      );
      setSelectedPreset(null);
      return;
    }

    try {
      const res = await fetch(`/api/parameter-sets/${presetId}`);
      const data = await res.json();

      if (data.ok && data.parameterSet) {
        const presetParams = data.parameterSet.parameters;
        setParameters((prev) =>
          prev.map((p) => {
            const match = presetParams.find(
              (pp: any) => pp.parameterId === p.parameterId
            );
            if (match) {
              return {
                ...p,
                enabled: match.enabled ?? true,
                weight: match.weight ?? 1.0,
                biasValue: match.biasValue ?? null,
                thresholdLow: match.thresholdLow ?? null,
                thresholdHigh: match.thresholdHigh ?? null,
              };
            }
            return p;
          })
        );
        setSelectedPreset(presetId);
        setConfigName(data.parameterSet.name);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Handle parameter changes
  const handleChange = useCallback((updated: ParameterConfig[]) => {
    setParameters(updated);
    setSelectedPreset(null); // Mark as modified from preset
  }, []);

  // Save as new configuration
  const handleSaveNew = useCallback(async () => {
    if (!configName.trim()) {
      setError("Please enter a name for the configuration");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/parameter-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: configName,
          parameters: parameters.map((p) => ({
            parameterId: p.parameterId,
            definition: p.definition,
            scaleType: p.scaleType,
            directionality: p.directionality,
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
        // Refresh presets and select the new one
        setPresets((prev) => [data.parameterSet, ...prev]);
        setSelectedPreset(data.parameterSet.id);
        router.push(`/parameter-sets/${data.parameterSet.id}/configure`);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [configName, parameters, router]);

  // Quick presets
  const applyQuickPreset = useCallback(
    (preset: "balanced" | "empathy" | "cognitive" | "minimal") => {
      switch (preset) {
        case "balanced":
          setParameters((prev) =>
            prev.map((p) => ({ ...p, enabled: true, weight: 1.0, biasValue: null }))
          );
          break;
        case "empathy":
          setParameters((prev) =>
            prev.map((p) => ({
              ...p,
              enabled: true,
              weight:
                p.domainGroup === "Emotional Intelligence"
                  ? 1.8
                  : p.domainGroup === "Social Dynamics"
                  ? 1.4
                  : 0.7,
              biasValue: null,
            }))
          );
          break;
        case "cognitive":
          setParameters((prev) =>
            prev.map((p) => ({
              ...p,
              enabled: true,
              weight:
                p.domainGroup === "Cognitive Style"
                  ? 1.8
                  : p.domainGroup === "Decision Making"
                  ? 1.4
                  : 0.7,
              biasValue: null,
            }))
          );
          break;
        case "minimal":
          setParameters((prev) =>
            prev.map((p, i) => ({
              ...p,
              enabled: i < 10, // Only enable first 10
              weight: 1.0,
              biasValue: null,
            }))
          );
          break;
      }
      setSelectedPreset(null);
    },
    []
  );

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading analyzer configuration...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Analyzer Configurator
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Configure personality analysis parameters like a graphic equalizer
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="text"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="Configuration name..."
            style={{
              padding: "10px 16px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              width: 250,
            }}
          />
          <button
            onClick={handleSaveNew}
            disabled={saving}
            style={{
              padding: "10px 24px",
              background: "#10b981",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Saving..." : "Save Configuration"}
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

      {/* Toolbar */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Load Preset */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
            Load Preset:
          </label>
          <select
            value={selectedPreset || ""}
            onChange={(e) => loadPreset(e.target.value)}
            disabled={loadingPresets}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              minWidth: 200,
            }}
          >
            <option value="">-- Start Fresh --</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} ({preset._count?.parameters || 0} params)
              </option>
            ))}
          </select>
        </div>

        {/* Quick Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
            Quick:
          </span>
          <button
            onClick={() => applyQuickPreset("balanced")}
            style={{
              padding: "6px 12px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Balanced
          </button>
          <button
            onClick={() => applyQuickPreset("empathy")}
            style={{
              padding: "6px 12px",
              background: "#fdf4ff",
              border: "1px solid #e9d5ff",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
              color: "#7e22ce",
            }}
          >
            Empathy Focus
          </button>
          <button
            onClick={() => applyQuickPreset("cognitive")}
            style={{
              padding: "6px 12px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
              color: "#047857",
            }}
          >
            Cognitive Focus
          </button>
          <button
            onClick={() => applyQuickPreset("minimal")}
            style={{
              padding: "6px 12px",
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
              color: "#92400e",
            }}
          >
            Minimal (10)
          </button>
        </div>

        {/* Stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>
              {parameters.filter((p) => p.enabled).length}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Enabled</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>
              {parameters.filter((p) => p.weight !== 1.0 || !p.enabled).length}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Modified</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6" }}>
              {new Set(parameters.map((p) => p.domainGroup)).size}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Domains</div>
          </div>
        </div>
      </div>

      {/* Main Equalizer */}
      <ParameterEqualizer
        parameters={parameters}
        onChange={handleChange}
        onSave={handleSaveNew}
        title="Personality Analyzer Parameters"
        showPresets={false}
      />

      {/* Footer Links */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          <Link
            href="/parameter-sets"
            style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none" }}
          >
            View All Presets
          </Link>
          <Link
            href="/admin#/parameters"
            style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none" }}
          >
            Manage Parameters
          </Link>
          <Link
            href="/flow"
            style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none" }}
          >
            Pipeline Flow
          </Link>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          Tip: Adjust parameter weights to fine-tune how the analyzer scores different traits
        </div>
      </div>
    </div>
  );
}
