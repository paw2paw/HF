"use client";

import { useState, useEffect } from "react";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type PromptTemplate = {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  systemPrompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { playbookItems: number };
};

export default function PromptTemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    slug: "",
    name: "",
    description: "",
    systemPrompt: "",
  });

  const fetchTemplates = () => {
    fetch("/api/prompt-templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setTemplates(data.templates || []);
        } else {
          setError(data.error || "Failed to load templates");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreate = async () => {
    if (!newTemplate.slug || !newTemplate.name || !newTemplate.systemPrompt) {
      alert("Slug, name, and system prompt are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/prompt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateModal(false);
        setNewTemplate({ slug: "", name: "", description: "", systemPrompt: "" });
        fetchTemplates();
      } else {
        alert("Failed to create template: " + data.error);
      }
    } catch (err: any) {
      alert("Error creating template: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <SourcePageHeader
        title="Prompt Templates"
        description="Output templates for Playbooks with Mustache-style variables"
        dataNodeId="prompt-templates"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            + New Template
          </button>
        }
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : templates.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No prompt templates yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Create prompt templates to configure behaviour
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {templates.map((template) => (
            <div
              key={template.id}
              style={{
                background: "#fff",
                border: template.isActive ? "2px solid #10b981" : "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{template.name}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>v{template.version}</span>
                    <code style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4, color: "#6b7280" }}>
                      {template.slug}
                    </code>
                  </div>
                  {template.description && (
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{template.description}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {template.isActive && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        background: "#ecfdf5",
                        color: "#10b981",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#374151",
                  maxHeight: 150,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {template.systemPrompt.slice(0, 500)}
                {template.systemPrompt.length > 500 && "..."}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </div>
                {template._count && template._count.playbookItems > 0 && (
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    Used in {template._count.playbookItems} playbook{template._count.playbookItems !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              width: 600,
              maxWidth: "90%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 20 }}>Create New Template</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Slug *
              </label>
              <input
                type="text"
                value={newTemplate.slug}
                onChange={(e) =>
                  setNewTemplate({
                    ...newTemplate,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  })
                }
                placeholder="e.g., tutor-default"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Name *
              </label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="e.g., Default Tutor Template"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Description
              </label>
              <input
                type="text"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="What is this template for?"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                System Prompt *
              </label>
              <textarea
                value={newTemplate.systemPrompt}
                onChange={(e) => setNewTemplate({ ...newTemplate, systemPrompt: e.target.value })}
                placeholder="You are a helpful assistant...&#10;&#10;Use {{personality.openness}} and {{memories.facts}} for dynamic content."
                rows={10}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Supports Mustache variables: {"{{personality.*}}"}, {"{{memories.*}}"}, {"{{caller.*}}"}, {"{{domain.*}}"}
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  background: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
