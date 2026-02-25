"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { TypePicker } from "@/components/shared/TypePicker";

interface CreateInstitutionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (domain: { id: string; name: string; slug: string }) => void;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateInstitutionModal({ open, onClose, onCreated }: CreateInstitutionModalProps) {
  const [name, setName] = useState("");
  const [selectedTypeSlug, setSelectedTypeSlug] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const slug = toSlug(name);

  // Focus input on open, reset state
  useEffect(() => {
    if (open) {
      setName("");
      setSelectedTypeSlug(null);
      setSelectedTypeId(undefined);
      setError(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const s = toSlug(trimmed);
    if (!s) {
      setError("Name must contain at least one alphanumeric character");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create institution (with type if selected)
      const instBody: Record<string, any> = { name: trimmed, slug: s };
      if (selectedTypeId) instBody.typeId = selectedTypeId;
      else if (selectedTypeSlug) instBody.typeSlug = selectedTypeSlug;

      const instRes = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instBody),
      });
      const instData = await instRes.json();
      if (!instData.ok) {
        setError(instData.error || "Failed to create institution");
        setLoading(false);
        return;
      }

      // Step 2: Create domain linked to institution
      const domRes = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          slug: s,
          institutionId: instData.institution.id,
        }),
      });
      const domData = await domRes.json();
      if (!domData.ok) {
        setError(domData.error || "Failed to create domain");
        setLoading(false);
        return;
      }

      // Step 3: Scaffold domain (fire-and-forget — archetype resolved from type chain)
      fetch(`/api/domains/${domData.domain.id}/scaffold`, { method: "POST" }).catch(() => {});

      // Success
      onCreated({
        id: domData.domain.id,
        name: trimmed,
        slug: domData.domain.slug || s,
      });
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }, [name, selectedTypeSlug, selectedTypeId, onCreated]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current && !loading) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div className="dtw-modal-card" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="dtw-modal-header">
          <span className="dtw-modal-title">Create Institution</span>
          <button
            onClick={onClose}
            disabled={loading}
            className="dtw-modal-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="dtw-modal-body">
          {/* Type picker */}
          <div style={{ marginBottom: 16 }}>
            <TypePicker
              value={selectedTypeSlug}
              onChange={(typeSlug, typeId) => {
                setSelectedTypeSlug(typeSlug);
                setSelectedTypeId(typeId);
              }}
            />
          </div>

          {/* Name field */}
          <label className="dtw-section-label">Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !loading) handleCreate();
            }}
            placeholder="e.g. Oakwood Primary School"
            disabled={loading}
            className="dtw-modal-input"
          />

          {slug && (
            <div className="dtw-modal-slug">{slug}</div>
          )}

          {error && (
            <div className="dtw-modal-error">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="dtw-modal-footer">
          <button
            onClick={onClose}
            disabled={loading}
            className="dtw-btn-back"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className={`dtw-btn-next ${name.trim() && !loading ? "dtw-btn-next-enabled" : "dtw-btn-next-disabled"}`}
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
