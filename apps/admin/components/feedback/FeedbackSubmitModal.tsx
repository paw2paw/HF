"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useEntityContext } from "@/contexts";
import {
  Paperclip,
  Link,
  X,
  Send,
  Loader2,
  Bug,
  Lightbulb,
  HelpCircle,
  LifeBuoy,
} from "lucide-react";
import "./feedback-submit.css";

type Category = "BUG" | "FEATURE" | "QUESTION" | "SUPPORT";

interface FeedbackSubmitModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (ticketNumber: number) => void;
  /** Optional pre-selected category */
  defaultCategory?: Category;
}

interface Attachment {
  name: string;
  type: string;
  dataUrl: string;
  sizeKb: number;
}

const CATEGORIES: {
  key: Category;
  icon: typeof Bug;
  label: string;
  hint: string;
}[] = [
  {
    key: "BUG",
    icon: Bug,
    label: "Something's broken",
    hint: "It crashed, errored, or didn't do what I expected",
  },
  {
    key: "FEATURE",
    icon: Lightbulb,
    label: "I have an idea",
    hint: "A new feature, improvement, or change",
  },
  {
    key: "QUESTION",
    icon: HelpCircle,
    label: "I have a question",
    hint: "Not sure how something works",
  },
  {
    key: "SUPPORT",
    icon: LifeBuoy,
    label: "I need help",
    hint: "I'm stuck and need someone to look at this",
  },
];

const MAX_FILE_SIZE_MB = 5;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function FeedbackSubmitModal({
  open,
  onClose,
  onSuccess,
  defaultCategory,
}: FeedbackSubmitModalProps): React.ReactElement | null {
  const pathname = usePathname();
  const entityContext = useEntityContext();

  const [category, setCategory] = useState<Category | null>(
    defaultCategory ?? null,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCategory(defaultCategory ?? null);
      setTitle("");
      setDescription("");
      setAttachments([]);
      setShowLinkInput(false);
      setLinkUrl("");
      setLinkLabel("");
      setError(null);
    }
  }, [open, defaultCategory]);

  // Dismiss with Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Build page context string
  const breadcrumbs = entityContext.breadcrumbs || [];
  const pageContextStr =
    breadcrumbs.length > 0
      ? breadcrumbs.map((b) => b.label || b.type || "?").join(" → ")
      : pathname || "";

  // File handler — reads file as data URL
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_FILE_SIZE_MB) {
        setError(`${file.name} is too large (${sizeMb.toFixed(1)}MB). Max ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            dataUrl,
            sizeKb: Math.round(file.size / 1024),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!category) {
      setError("Please choose a category.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }

    // Append link to description if provided
    let fullDescription = description.trim();
    if (linkUrl.trim()) {
      const label = linkLabel.trim() || linkUrl.trim();
      fullDescription += `\n\n[${label}](${linkUrl.trim()})`;
    }

    // Use first image attachment as screenshot
    const imageAttachment = attachments.find((a) => IMAGE_TYPES.includes(a.type));

    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: fullDescription,
          category,
          pageContext: pageContextStr,
          screenshot: imageAttachment?.dataUrl ?? undefined,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      onSuccess(data.ticket?.ticketNumber ?? 0);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    category,
    title,
    description,
    linkUrl,
    linkLabel,
    pageContextStr,
    attachments,
    onSuccess,
  ]);

  if (!open) return null;

  const isImage = (type: string) => IMAGE_TYPES.includes(type);

  return (
    <div className="fb-modal-overlay" onClick={onClose}>
      <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="fb-modal-title">Send Feedback</h2>
        <p className="fb-modal-subtitle">
          We read every submission. Pick a category to get started.
        </p>

        {/* Category picker — 2x2 grid */}
        <div className="fb-category-grid">
          {CATEGORIES.map(({ key, icon: Icon, label, hint }) => (
            <button
              key={key}
              type="button"
              className="fb-category-card"
              data-selected={category === key}
              onClick={() => setCategory(key)}
            >
              <div className="fb-category-card-icon">
                <Icon size={18} />
                <span className="fb-category-card-label">{label}</span>
              </div>
              <span className="fb-category-card-hint">{hint}</span>
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="fb-field">
          <label className="fb-label" htmlFor="fb-title">
            Title
          </label>
          <input
            id="fb-title"
            className="hf-input"
            type="text"
            placeholder="Brief summary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="fb-field">
          <label className="fb-label" htmlFor="fb-description">
            Description
          </label>
          <textarea
            id="fb-description"
            className="fb-textarea"
            placeholder="What happened? What did you expect?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Page context */}
        {pageContextStr && (
          <div className="fb-page-context">You&apos;re on: {pageContextStr}</div>
        )}

        {/* Attach buttons row */}
        <div className="fb-attach-row">
          <button
            type="button"
            className="hf-btn hf-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={16} />
            Attach file
          </button>

          {!showLinkInput && (
            <button
              type="button"
              className="hf-btn hf-btn-secondary"
              onClick={() => setShowLinkInput(true)}
            >
              <Link size={16} />
              Add a link
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
            className="fb-hidden-input"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="fb-attachments">
            {attachments.map((att, idx) => (
              <div key={idx} className="fb-attachment">
                {isImage(att.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.dataUrl} alt={att.name} className="fb-attachment-thumb" />
                ) : (
                  <div className="fb-attachment-file">
                    <Paperclip size={14} />
                    <span className="fb-attachment-name">{att.name}</span>
                  </div>
                )}
                <span className="fb-attachment-size">{att.sizeKb}KB</span>
                <button
                  type="button"
                  className="fb-attachment-remove"
                  onClick={() => removeAttachment(idx)}
                  aria-label="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link input */}
        {showLinkInput && (
          <div className="fb-link-row">
            <input
              className="hf-input"
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <input
              className="hf-input"
              type="text"
              placeholder="Label (optional)"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <button
              type="button"
              className="hf-btn hf-btn-secondary"
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl("");
                setLinkLabel("");
              }}
              aria-label="Remove link"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Error */}
        {error && <div className="fb-error">{error}</div>}

        {/* Actions */}
        <div className="fb-actions">
          <span className="fb-hint">Cmd+Shift+3 to take a screenshot</span>
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
            {submitting ? (
              <Loader2 size={16} className="hf-spinner" />
            ) : (
              <Send size={16} />
            )}
            {submitting ? "Sending..." : "Send Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
