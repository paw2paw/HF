"use client";

import { useState, useEffect } from "react";

interface PromptPreviewData {
  promptSummary: string;
  voicePrompt: string;
  llmPrompt: any;
  metadata: any;
  createdPreviewCaller: boolean;
}

interface PromptPreviewModalProps {
  domainId: string;
  domainName?: string;
  open: boolean;
  onClose: () => void;
}

export function PromptPreviewModal({
  domainId,
  domainName,
  open,
  onClose,
}: PromptPreviewModalProps) {
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false);
  const [promptPreviewData, setPromptPreviewData] = useState<PromptPreviewData | null>(null);
  const [promptPreviewError, setPromptPreviewError] = useState<string | null>(null);
  const [promptPreviewTab, setPromptPreviewTab] = useState<"summary" | "voice" | "json">("summary");

  useEffect(() => {
    if (!open) return;

    // Reset state on open
    setPromptPreviewLoading(true);
    setPromptPreviewError(null);
    setPromptPreviewData(null);
    setPromptPreviewTab("summary");

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/domains/${domainId}/preview-prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || "Failed to generate preview");
        setPromptPreviewData(data);
      } catch (e: any) {
        if (!cancelled) {
          setPromptPreviewError(e.message || "Failed to generate preview");
        }
      } finally {
        if (!cancelled) {
          setPromptPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, domainId]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          borderRadius: 12,
          width: 900,
          maxWidth: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Prompt Preview &mdash; {domainName}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "4px 8px",
              }}
            >
              &times;
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginTop: 12 }}>
            {(["summary", "voice", "json"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPromptPreviewTab(tab)}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: promptPreviewTab === tab
                    ? "2px solid var(--accent-primary)"
                    : "2px solid transparent",
                  color: promptPreviewTab === tab
                    ? "var(--accent-primary)"
                    : "var(--text-muted)",
                  fontWeight: promptPreviewTab === tab ? 600 : 400,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {tab === "summary" ? "Full Summary" : tab === "voice" ? "Voice Prompt" : "Raw JSON"}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {promptPreviewLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              Composing first-call prompt...
            </div>
          ) : promptPreviewError ? (
            <div style={{
              padding: 16,
              background: "var(--status-error-bg)",
              color: "var(--status-error-text)",
              borderRadius: 8,
              fontSize: 14,
            }}>
              {promptPreviewError}
            </div>
          ) : promptPreviewData ? (
            <>
              {/* Metadata bar */}
              <div style={{
                marginBottom: 16,
                padding: 12,
                background: "var(--surface-secondary)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}>
                <strong style={{ color: "var(--text-primary)" }}>
                  {promptPreviewData.metadata.sectionsActivated.length}
                </strong>{" "}sections activated,{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {promptPreviewData.metadata.sectionsSkipped.length}
                </strong>{" "}skipped
                {promptPreviewData.metadata.identitySpec && (
                  <> &middot; Identity: <strong style={{ color: "var(--text-primary)" }}>{promptPreviewData.metadata.identitySpec}</strong></>
                )}
                {promptPreviewData.metadata.contentSpec && (
                  <> &middot; Content: <strong style={{ color: "var(--text-primary)" }}>{promptPreviewData.metadata.contentSpec}</strong></>
                )}
                {promptPreviewData.metadata.playbooksUsed.length > 0 && (
                  <> &middot; Playbooks: {promptPreviewData.metadata.playbooksUsed.join(", ")}</>
                )}
                <> &middot; {promptPreviewData.metadata.loadTimeMs}ms load, {promptPreviewData.metadata.transformTimeMs}ms transform</>
                {promptPreviewData.createdPreviewCaller && (
                  <div style={{ marginTop: 4, fontStyle: "italic" }}>
                    Note: Created a preview caller (no existing callers in this domain)
                  </div>
                )}
              </div>

              {/* Tab content */}
              {promptPreviewTab === "summary" && (
                <pre style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "inherit",
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                  color: "var(--text-primary)",
                }}>
                  {promptPreviewData.promptSummary}
                </pre>
              )}
              {promptPreviewTab === "voice" && (
                <pre style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: 0,
                  padding: 16,
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}>
                  {promptPreviewData.voicePrompt}
                </pre>
              )}
              {promptPreviewTab === "json" && (
                <pre style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 11,
                  lineHeight: 1.4,
                  margin: 0,
                  padding: 16,
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}>
                  {JSON.stringify(promptPreviewData.llmPrompt, null, 2)}
                </pre>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          justifyContent: "space-between",
        }}>
          <button
            onClick={() => {
              const text =
                promptPreviewTab === "json"
                  ? JSON.stringify(promptPreviewData?.llmPrompt, null, 2)
                  : promptPreviewTab === "voice"
                    ? promptPreviewData?.voicePrompt || ""
                    : promptPreviewData?.promptSummary || "";
              navigator.clipboard.writeText(text).catch(() => {});
            }}
            disabled={!promptPreviewData}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              cursor: promptPreviewData ? "pointer" : "not-allowed",
              opacity: promptPreviewData ? 1 : 0.5,
            }}
          >
            Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
