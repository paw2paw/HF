"use client";

import { useState, useEffect } from "react";

type PromptTemplate = {
  id: string;
  name: string;
  version: string;
  description: string | null;
  systemPrompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    controlSets: number;
  };
};

export default function PromptTemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Prompt Templates</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          System prompts with personality modifiers for agents
        </p>
      </div>

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
            Create prompt templates to configure agent behavior
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
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {template._count?.controlSets || 0} control sets
                  </span>
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

              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
                Updated {new Date(template.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
