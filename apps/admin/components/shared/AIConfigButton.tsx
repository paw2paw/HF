"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AIConfigButtonProps {
  /** The call point identifier (e.g., "spec.assistant", "pipeline.measure") */
  callPoint: string;
  /** Optional label to show on hover */
  label?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Optional: show inline config popup instead of linking to page */
  inline?: boolean;
}

interface ConfigInfo {
  provider: string;
  model: string;
  isCustomized: boolean;
  hasKey: boolean;
}

/**
 * Small robot button that links to AI configuration for a specific call point.
 * Place this next to any UI element that uses AI.
 */
export function AIConfigButton({
  callPoint,
  label,
  size = "sm",
  inline = false,
}: AIConfigButtonProps) {
  const [configInfo, setConfigInfo] = useState<ConfigInfo | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch current config on hover (lazy load)
  const fetchConfig = useCallback(async () => {
    if (configInfo) return; // Already loaded
    setLoading(true);
    try {
      const res = await fetch("/api/ai-config");
      const data = await res.json();
      if (data.ok) {
        const config = data.configs.find((c: { callPoint: string }) => c.callPoint === callPoint);
        if (config) {
          setConfigInfo({
            provider: config.provider,
            model: config.model,
            isCustomized: config.isCustomized,
            hasKey: config.hasKey ?? data.keyStatus?.[config.provider] ?? false,
          });
        }
      }
    } catch (e) {
      console.error("Failed to load AI config:", e);
    } finally {
      setLoading(false);
    }
  }, [callPoint, configInfo]);

  const sizeStyles = size === "sm"
    ? { width: 20, height: 20, fontSize: 12 }
    : { width: 24, height: 24, fontSize: 14 };

  // Determine button state colors
  const hasKeyProblem = configInfo && !configInfo.hasKey;
  const buttonBg = hasKeyProblem
    ? "#fef2f2" // Red tint for missing key
    : configInfo?.isCustomized
      ? "#ede9fe"
      : "#f3f4f6";
  const buttonBorder = hasKeyProblem
    ? "1px solid #fca5a5" // Red border for missing key
    : configInfo?.isCustomized
      ? "1px solid #c4b5fd"
      : "1px solid #e5e7eb";

  const buttonContent = (
    <div
      style={{
        ...sizeStyles,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        background: buttonBg,
        border: buttonBorder,
        cursor: "pointer",
        position: "relative",
        transition: "all 0.15s",
      }}
      onMouseEnter={() => {
        setShowTooltip(true);
        fetchConfig();
      }}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={inline ? () => setShowPopup(!showPopup) : undefined}
      title={label || `Configure AI: ${callPoint}`}
    >
      <span style={{ lineHeight: 1 }}>{hasKeyProblem ? "⚠️" : "🤖"}</span>

      {/* Warning dot for missing API key */}
      {hasKeyProblem && (
        <div
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#ef4444",
            border: "1px solid #fff",
          }}
        />
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 4,
            padding: "6px 10px",
            background: "#1f2937",
            color: "#fff",
            borderRadius: 6,
            fontSize: 11,
            whiteSpace: "nowrap",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {loading ? (
            "Loading..."
          ) : configInfo ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {label || callPoint}
              </div>
              <div style={{ opacity: 0.8 }}>
                {configInfo.provider} / {configInfo.model.split("-").slice(0, 2).join("-")}
              </div>
              {!configInfo.hasKey && (
                <div style={{ color: "#fca5a5", marginTop: 4, fontWeight: 600 }}>
                  ⚠️ No API key for {configInfo.provider}
                </div>
              )}
              {configInfo.isCustomized && configInfo.hasKey && (
                <div style={{ color: "#a5b4fc", marginTop: 2 }}>Customized</div>
              )}
            </div>
          ) : (
            <div>Configure AI</div>
          )}
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        {buttonContent}
        {showPopup && (
          <InlineConfigPopup
            callPoint={callPoint}
            onClose={() => setShowPopup(false)}
            onSave={() => {
              setConfigInfo(null); // Reset to refetch
              setShowPopup(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/x/ai-config?highlight=${encodeURIComponent(callPoint)}`}
      style={{ display: "inline-block", textDecoration: "none" }}
    >
      {buttonContent}
    </Link>
  );
}

/**
 * Inline popup for quick AI configuration
 */
function InlineConfigPopup({
  callPoint,
  onClose,
  onSave,
}: {
  callPoint: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [config, setConfig] = useState<{
    provider: string;
    model: string;
    maxTokens: number | null;
    temperature: number | null;
    defaultProvider: string;
    defaultModel: string;
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<Record<string, { id: string; label: string }[]> | null>(null);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/ai-config");
        const data = await res.json();
        if (data.ok) {
          const cfg = data.configs.find((c: { callPoint: string }) => c.callPoint === callPoint);
          if (cfg) {
            setConfig(cfg);
            setProvider(cfg.provider);
            setModel(cfg.model);
          }
          setAvailableModels(data.availableModels);
          setKeyStatus(data.keyStatus || {});
        }
      } catch (e) {
        console.error("Failed to load config:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [callPoint]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callPoint,
          provider,
          model,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onSave();
      }
    } catch (e) {
      console.error("Failed to save config:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!config) return;
    setProvider(config.defaultProvider);
    setModel(config.defaultModel);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: 4,
        padding: 16,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 200,
        minWidth: 280,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>AI Configuration</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: "#6b7280",
            padding: 0,
          }}
        >
          &times;
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                // Reset model when provider changes
                const models = availableModels?.[e.target.value];
                if (models && models.length > 0) {
                  setModel(models[0].id);
                }
              }}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: keyStatus[provider] === false ? "1px solid #fca5a5" : "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 12,
                background: keyStatus[provider] === false ? "#fef2f2" : "#fff",
              }}
            >
              <option value="claude">Claude (Anthropic) {keyStatus.claude === false ? "⚠️ No key" : ""}</option>
              <option value="openai">OpenAI {keyStatus.openai === false ? "⚠️ No key" : ""}</option>
              <option value="mock">Mock (Testing)</option>
            </select>
            {keyStatus[provider] === false && (
              <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>
                ⚠️ No API key configured for {provider}. Add to .env.local
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              {availableModels?.[provider]?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleReset}
              style={{
                flex: 1,
                padding: "6px 12px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1,
                padding: "6px 12px",
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          <div style={{ marginTop: 8, textAlign: "center" }}>
            <Link
              href={`/x/ai-config?highlight=${encodeURIComponent(callPoint)}`}
              style={{ fontSize: 11, color: "#6b7280" }}
            >
              Advanced settings &rarr;
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
