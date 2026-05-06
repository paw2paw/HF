"use client";

/**
 * ImportModulesDialog — paste markdown / drop a file, parse & import.
 *
 * Calls POST /api/courses/[courseId]/import-modules. Refreshes the parent
 * panel via `onImported` on success. Per-field-defaults-with-warnings:
 * even if the response includes warnings, the import succeeds — the panel
 * surfaces them in the validation list so the author can act.
 */

import { useState, useCallback, useRef } from "react";
import { X } from "lucide-react";
import "./authored-modules-panel.css";

interface ImportModulesDialogProps {
  courseId: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportModulesDialog({
  courseId,
  onClose,
  onImported,
}: ImportModulesDialogProps) {
  const [markdown, setMarkdown] = useState("");
  const [docId, setDocId] = useState("");
  const [version, setVersion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      setMarkdown(text);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!markdown.trim()) {
      setError("Paste markdown or upload a .md file before importing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: { markdown: string; sourceRef?: { docId: string; version: string } } = {
        markdown,
      };
      if (docId.trim() && version.trim()) {
        body.sourceRef = { docId: docId.trim(), version: version.trim() };
      }
      const res = await fetch(`/api/courses/${courseId}/import-modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Import failed (status ${res.status})`);
      }
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }, [markdown, docId, version, courseId, onImported]);

  return (
    <div
      className="authored-modules-dialog__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modules-title"
    >
      <div className="authored-modules-dialog hf-card">
        <div className="hf-flex hf-items-center hf-gap-sm hf-mb-md">
          <h2 id="import-modules-title" className="hf-section-title authored-modules-dialog__title">
            Import Modules from Course Reference
          </h2>
          <button
            type="button"
            className="hf-btn hf-btn-secondary authored-modules-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <p className="hf-text-xs hf-text-muted hf-mb-md">
          Paste Course Reference markdown that contains a{" "}
          <code>**Modules authored:** Yes</code> declaration and a{" "}
          <code>## Modules</code> section. Re-importing replaces the current
          Module Catalogue. Module IDs are preserved across re-imports if the
          new doc uses the same IDs.
        </p>

        <label htmlFor="import-modules-textarea" className="hf-label">
          Markdown
        </label>
        <textarea
          id="import-modules-textarea"
          className="hf-input authored-modules-dialog__textarea"
          rows={14}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="# Course Reference — ..."
        />

        <div className="hf-flex hf-items-center hf-gap-sm hf-mt-sm">
          <input
            ref={fileRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="authored-modules-dialog__file-hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="hf-btn hf-btn-secondary"
            onClick={() => fileRef.current?.click()}
          >
            Choose .md file
          </button>
          <span className="hf-text-xs hf-text-muted">
            File contents replace the textarea.
          </span>
        </div>

        <div className="authored-modules-dialog__sourceref">
          <span className="hf-label">Source ref (optional)</span>
          <div className="hf-flex hf-items-center hf-gap-sm">
            <input
              type="text"
              className="hf-input"
              placeholder="Doc ID"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
            />
            <input
              type="text"
              className="hf-input"
              placeholder="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <span className="hf-text-xs hf-text-muted">
            Recorded on the course for audit. Leave both blank to skip.
          </span>
        </div>

        {error && (
          <div className="hf-banner hf-banner-error hf-mt-md">{error}</div>
        )}

        <div className="hf-flex hf-items-center hf-gap-sm hf-mt-md authored-modules-dialog__actions">
          <button
            type="button"
            className="hf-btn hf-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hf-btn hf-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Importing…" : "Parse & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
