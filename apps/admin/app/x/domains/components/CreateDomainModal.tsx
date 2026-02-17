"use client";

import { useState } from "react";

interface CreateDomainModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (domainId: string) => void;
  onError: (error: string) => void;
}

export function CreateDomainModal({ open, onClose, onCreated, onError }: CreateDomainModalProps) {
  const [newDomain, setNewDomain] = useState({ slug: "", name: "", description: "" });
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    if (!newDomain.slug || !newDomain.name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomain),
      });
      const data = await res.json();
      if (data.ok) {
        setNewDomain({ slug: "", name: "", description: "" });
        onCreated(data.domain.id);
      } else {
        onError(data.error);
      }
    } catch (e: any) {
      onError(e.message);
    } finally {
      setCreating(false);
    }
  };

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
        style={{ background: "var(--surface-primary)", borderRadius: 12, padding: 24, width: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px 0", fontSize: 18 }}>New Domain</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Slug</label>
          <input
            type="text"
            value={newDomain.slug}
            onChange={(e) => setNewDomain({ ...newDomain, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
            placeholder="e.g., tutor"
            style={{ width: "100%", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 6 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Name</label>
          <input
            type="text"
            value={newDomain.name}
            onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
            placeholder="e.g., AI Tutor"
            style={{ width: "100%", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 6 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Description</label>
          <textarea
            value={newDomain.description}
            onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
            rows={2}
            style={{ width: "100%", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 6, resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", background: "var(--surface-secondary)", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !newDomain.slug || !newDomain.name}
            style={{
              padding: "8px 16px",
              background: "var(--button-primary-bg)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
