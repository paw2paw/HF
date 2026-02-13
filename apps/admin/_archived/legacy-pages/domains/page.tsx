"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Domain = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  callerCount: number;
  playbookCount: number;
  publishedPlaybook: {
    id: string;
    name: string;
    version: string;
    publishedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export default function DomainsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDomain, setNewDomain] = useState({
    slug: "",
    name: "",
    description: "",
    isDefault: false,
  });

  const { data: domains, loading, error, refetch } = useApi<Domain[]>(
    "/api/domains",
    { transform: (res) => res.domains as Domain[] }
  );

  const handleCreate = async () => {
    if (!newDomain.slug || !newDomain.name) {
      alert("Slug and name are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomain),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateModal(false);
        setNewDomain({ slug: "", name: "", description: "", isDefault: false });
        refetch();
      } else {
        alert("Failed to create domain: " + data.error);
      }
    } catch (err: any) {
      alert("Error creating domain: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (domain: Domain) => {
    if (!domain.isActive) {
      return (
        <span style={{ fontSize: 10, padding: "2px 6px", background: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
          Inactive
        </span>
      );
    }
    if (domain.isDefault) {
      return (
        <span style={{ fontSize: 10, padding: "2px 6px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 4 }}>
          Default
        </span>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: 32 }}>
      <SourcePageHeader
        title="Domains"
        description="Caller segmentation by use case"
        dataNodeId="domains"
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
            + New Domain
          </button>
        }
      />

      {loading && <p style={{ color: "#6b7280" }}>Loading domains...</p>}
      {error && <p style={{ color: "#dc2626" }}>Error: {error}</p>}

      {!loading && !error && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {(domains || []).map((domain) => (
              <Link
                key={domain.id}
                href={`/domains/${domain.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 20,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#4f46e5";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(79, 70, 229, 0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{domain.name}</h3>
                    {statusBadge(domain)}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                    {domain.description || <em>No description</em>}
                  </p>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
                    <span>
                      <strong>{domain.callerCount}</strong> callers
                    </span>
                    <span>
                      <strong>{domain.playbookCount}</strong> playbooks
                    </span>
                  </div>
                  {domain.publishedPlaybook && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "8px 12px",
                        background: "#f0fdf4",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#166534", fontWeight: 500 }}>Published:</span>{" "}
                      <span style={{ color: "#15803d" }}>
                        {domain.publishedPlaybook.name} v{domain.publishedPlaybook.version}
                      </span>
                    </div>
                  )}
                  {!domain.publishedPlaybook && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "8px 12px",
                        background: "#fef3c7",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#92400e",
                      }}
                    >
                      No published playbook
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create Domain Modal */}
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
              width: 400,
              maxWidth: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 20 }}>Create New Domain</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Slug *
              </label>
              <input
                type="text"
                value={newDomain.slug}
                onChange={(e) => setNewDomain({ ...newDomain, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="e.g., healthcare"
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
                value={newDomain.name}
                onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                placeholder="e.g., Healthcare"
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
              <textarea
                value={newDomain.description}
                onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
                placeholder="What is this domain for?"
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={newDomain.isDefault}
                  onChange={(e) => setNewDomain({ ...newDomain, isDefault: e.target.checked })}
                />
                Set as default domain
              </label>
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
                {creating ? "Creating..." : "Create Domain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
