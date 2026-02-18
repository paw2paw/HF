"use client";

import { useState, useEffect } from "react";

interface StepProps {
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  onNext: () => void;
  onPrev: () => void;
  endFlow: () => void;
}

type PromptPreviewData = {
  promptSummary: string;
  voicePrompt: string;
  llmPrompt: any;
  metadata: any;
  createdPreviewCaller: boolean;
};

export default function PreviewStep({ setData, getData, onNext, onPrev }: StepProps) {
  const domainId = getData<string>("domainId");
  const domainName = getData<string>("domainName");

  const [loading, setLoading] = useState(false);
  const [data, setPreviewData] = useState<PromptPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "voice" | "json">("summary");
  const [copied, setCopied] = useState(false);

  // ── Generate preview on mount ─────────────────────────
  useEffect(() => {
    if (!domainId) return;
    setLoading(true);
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/domains/${domainId}/preview-prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const result = await res.json();
        if (cancelled) return;
        if (!result.ok) throw new Error(result.error || "Failed to generate preview");
        setPreviewData(result);
        setData("promptPreviewGenerated", true);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to generate preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [domainId]);

  function handleCopy() {
    const text =
      tab === "json"
        ? JSON.stringify(data?.llmPrompt, null, 2)
        : tab === "voice"
          ? data?.voicePrompt || ""
          : data?.promptSummary || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (!domainId) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
          Preview Prompt
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px" }}>
          No domain selected. Go back to the Onboard step to select a domain.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onNext}
            style={{
              padding: "12px 32px", borderRadius: 8, border: "none",
              background: "var(--accent-primary)", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}>
            Skip to Done
          </button>
          <button onClick={onPrev}
            style={{
              padding: "12px 24px", borderRadius: 8,
              border: "1px solid var(--border-default)", background: "transparent",
              color: "var(--text-secondary)", fontSize: 14, cursor: "pointer",
            }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
        Here&apos;s what your AI tutor will say
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 16px" }}>
        This is Prompt 0 &mdash; the actual first prompt for <strong>{domainName}</strong>. If something looks wrong, go back to adjust.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--border-default)" }}>
        {(["summary", "voice", "json"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px", background: "none", border: "none",
              borderBottom: tab === t ? "2px solid var(--accent-primary)" : "2px solid transparent",
              color: tab === t ? "var(--accent-primary)" : "var(--text-muted)",
              fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: "pointer",
            }}
          >
            {t === "summary" ? "Full Summary" : t === "voice" ? "Voice Prompt" : "Raw JSON"}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Composing first-call prompt...
        </div>
      ) : error ? (
        <div style={{
          padding: 16, borderRadius: 8, marginBottom: 16,
          background: "color-mix(in srgb, var(--status-error-text) 8%, transparent)",
          color: "var(--status-error-text)",
          border: "1px solid color-mix(in srgb, var(--status-error-text) 20%, transparent)",
          fontSize: 14,
        }}>
          {error}
        </div>
      ) : data ? (
        <>
          {/* Metadata bar */}
          <div style={{
            marginBottom: 16, padding: 12, borderRadius: 8, fontSize: 12,
            background: "var(--surface-secondary)", color: "var(--text-muted)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--text-primary)" }}>
              {data.metadata.sectionsActivated.length}
            </strong> sections activated,{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {data.metadata.sectionsSkipped.length}
            </strong> skipped
            {data.metadata.identitySpec && (
              <> &middot; Identity: <strong style={{ color: "var(--text-primary)" }}>{data.metadata.identitySpec}</strong></>
            )}
            {data.metadata.contentSpec && (
              <> &middot; Content: <strong style={{ color: "var(--text-primary)" }}>{data.metadata.contentSpec}</strong></>
            )}
            <> &middot; {data.metadata.loadTimeMs}ms load, {data.metadata.transformTimeMs}ms transform</>
            {data.createdPreviewCaller && (
              <div style={{ marginTop: 4, fontStyle: "italic" }}>
                Note: Created a preview caller (no existing callers in this domain)
              </div>
            )}
          </div>

          {/* Tab content */}
          <div style={{
            maxHeight: 500, overflow: "auto", borderRadius: 8,
            border: "1px solid var(--border-default)", marginBottom: 16,
          }}>
            {tab === "summary" && (
              <pre style={{
                whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
                fontSize: 13, lineHeight: 1.6, margin: 0, padding: 16,
                color: "var(--text-primary)",
              }}>
                {data.promptSummary}
              </pre>
            )}
            {tab === "voice" && (
              <pre style={{
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.5,
                margin: 0, padding: 16, background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}>
                {data.voicePrompt}
              </pre>
            )}
            {tab === "json" && (
              <pre style={{
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "var(--font-mono, monospace)", fontSize: 11, lineHeight: 1.4,
                margin: 0, padding: 16, background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}>
                {JSON.stringify(data.llmPrompt, null, 2)}
              </pre>
            )}
          </div>

          {/* Copy button */}
          <button onClick={handleCopy} disabled={!data}
            style={{
              padding: "6px 16px", borderRadius: 6, fontSize: 12,
              border: "1px solid var(--border-default)", background: "var(--surface-secondary)",
              color: "var(--text-primary)", cursor: "pointer", marginBottom: 16,
            }}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </>
      ) : null}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button onClick={onNext}
          style={{
            padding: "12px 32px", borderRadius: 8, border: "none",
            background: "var(--accent-primary)", color: "#fff",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}
        >
          Looks Good — Continue
        </button>
        <button onClick={onPrev}
          style={{
            padding: "12px 24px", borderRadius: 8,
            border: "1px solid var(--border-default)", background: "transparent",
            color: "var(--text-secondary)", fontSize: 14, cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
