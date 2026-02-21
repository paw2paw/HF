"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";

const ARTIFACT_TYPES = [
  { value: "STUDY_NOTE", label: "Study Note" },
  { value: "EXERCISE", label: "Exercise" },
  { value: "KEY_FACT", label: "Key Fact" },
  { value: "FORMULA", label: "Formula" },
  { value: "RESOURCE_LINK", label: "Resource Link" },
  { value: "SUMMARY", label: "Summary" },
  { value: "REMINDER", label: "Reminder" },
  { value: "MEDIA", label: "Media" },
];

interface SendArtifactModalProps {
  target:
    | { type: "student"; id: string; name?: string }
    | { type: "classroom"; id: string; name?: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function SendArtifactModal({ target, onClose, onSuccess }: SendArtifactModalProps) {
  const [type, setType] = useState("STUDY_NOTE");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);

    const endpoint =
      target.type === "student"
        ? `/api/educator/students/${target.id}/artifacts`
        : `/api/educator/classrooms/${target.id}/artifacts`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          content: content.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to send");
        setSending(false);
        return;
      }

      onSuccess();
    } catch {
      setError("Network error");
      setSending(false);
    }
  };

  const targetLabel =
    target.type === "student"
      ? target.name || "this student"
      : target.name || "this classroom";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {target.type === "student" ? "Send Content" : "Send to Class"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Send to {targetLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}
            >
              {ARTIFACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Key formulas for Chapter 3"
              required
              maxLength={200}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the content here (supports markdown)..."
              required
              rows={6}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-y"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Media URL (optional) */}
          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Media URL (optional)
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--status-error-text)" }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={sending || !title.trim() || !content.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity"
            style={{
              background: "var(--accent-primary)",
              opacity: sending || !title.trim() || !content.trim() ? 0.5 : 1,
              border: "none",
              cursor:
                sending || !title.trim() || !content.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            <Send size={14} />
            {sending
              ? "Sending..."
              : target.type === "student"
                ? "Send to Student"
                : "Send to All Students"}
          </button>
        </form>
      </div>
    </div>
  );
}
