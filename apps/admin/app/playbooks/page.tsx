"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Domain = {
  id: string;
  slug: string;
  name: string;
};

type Spec = {
  id: string;
  slug: string;
  name: string;
  scope: string;
  outputType: string;
};

type PromptTemplate = {
  id: string;
  slug: string;
  name: string;
};

type PlaybookItem = {
  id: string;
  itemType: string;
  spec: Spec | null;
  promptTemplate: PromptTemplate | null;
};

type Playbook = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  domain: Domain;
  items: PlaybookItem[];
  _count: { items: number };
};

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({
    name: "",
    description: "",
    domainId: "",
  });

  const fetchData = async () => {
    try {
      const [playbooksRes, domainsRes] = await Promise.all([
        fetch(`/api/playbooks${filterDomain ? `?domainId=${filterDomain}` : ""}${filterStatus ? `${filterDomain ? "&" : "?"}status=${filterStatus}` : ""}`),
        fetch("/api/domains"),
      ]);

      const playbooksData = await playbooksRes.json();
      const domainsData = await domainsRes.json();

      if (playbooksData.ok) {
        setPlaybooks(playbooksData.playbooks);
      } else {
        setError(playbooksData.error);
      }

      if (domainsData.ok) {
        setDomains(domainsData.domains);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDomain, filterStatus]);

  const handleCreate = async () => {
    if (!newPlaybook.name || !newPlaybook.domainId) {
      alert("Name and domain are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlaybook),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/playbooks/${data.playbook.id}`);
      } else {
        alert("Failed to create playbook: " + data.error);
      }
    } catch (err: any) {
      alert("Error creating playbook: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      DRAFT: { bg: "#fef3c7", color: "#92400e" },
      PUBLISHED: { bg: "#dcfce7", color: "#166534" },
      ARCHIVED: { bg: "#f3f4f6", color: "#6b7280" },
    };
    const s = styles[status] || styles.DRAFT;
    return (
      <span style={{ fontSize: 10, padding: "2px 6px", background: s.bg, color: s.color, borderRadius: 4, fontWeight: 500 }}>
        {status}
      </span>
    );
  };

  const outputTypeBadge = (outputType: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      MEASURE: { bg: "#dcfce7", color: "#166534" },
      LEARN: { bg: "#ede9fe", color: "#5b21b6" },
      ADAPT: { bg: "#fef3c7", color: "#92400e" },
      MEASURE_AGENT: { bg: "#e0e7ff", color: "#4338ca" },
    };
    const s = styles[outputType] || { bg: "#f3f4f6", color: "#6b7280" };
    return (
      <span style={{ fontSize: 9, padding: "1px 4px", background: s.bg, color: s.color, borderRadius: 3 }}>
        {outputType}
      </span>
    );
  };

  return (
    <div style={{ padding: 32 }}>
      <SourcePageHeader
        title="Playbooks"
        description="Bundles of specifications and prompt templates per domain"
        dataNodeId="playbooks"
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
            + New Playbook
          </button>
        }
      />

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, marginBottom: 24 }}>
        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 150,
          }}
        >
          <option value="">All Domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 150,
          }}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading && <p style={{ color: "#6b7280" }}>Loading playbooks...</p>}
      {error && <p style={{ color: "#dc2626" }}>Error: {error}</p>}

      {!loading && !error && playbooks.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", background: "#f9fafb", borderRadius: 8 }}>
          <p style={{ color: "#6b7280", marginBottom: 16 }}>No playbooks found</p>
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
            Create First Playbook
          </button>
        </div>
      )}

      {!loading && !error && playbooks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {playbooks.map((playbook) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.id}`}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{playbook.name}</span>
                      {statusBadge(playbook.status)}
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>v{playbook.version}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                      {playbook.domain.name}
                      {playbook.description && ` — ${playbook.description}`}
                    </div>

                    {/* Items preview */}
                    {playbook.items.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {playbook.items.slice(0, 6).map((item, idx) => (
                          <span key={idx} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {item.spec && (
                              <>
                                {outputTypeBadge(item.spec.outputType)}
                                <span style={{ fontSize: 11, color: "#6b7280" }}>{item.spec.name}</span>
                              </>
                            )}
                            {item.promptTemplate && (
                              <>
                                <span style={{ fontSize: 9, padding: "1px 4px", background: "#fce7f3", color: "#be185d", borderRadius: 3 }}>
                                  TEMPLATE
                                </span>
                                <span style={{ fontSize: 11, color: "#6b7280" }}>{item.promptTemplate.name}</span>
                              </>
                            )}
                          </span>
                        ))}
                        {playbook.items.length > 6 && (
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>+{playbook.items.length - 6} more</span>
                        )}
                      </div>
                    )}

                    {playbook.items.length === 0 && (
                      <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>No items yet</div>
                    )}
                  </div>

                  <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
                    {playbook.publishedAt ? (
                      <div>Published {new Date(playbook.publishedAt).toLocaleDateString()}</div>
                    ) : (
                      <div>Updated {new Date(playbook.updatedAt).toLocaleDateString()}</div>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/playbooks/${playbook.id}/tree`);
                      }}
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        padding: "4px 10px",
                        fontSize: 11,
                        background: "#f0fdf4",
                        color: "#15803d",
                        border: "1px solid #86efac",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      🌳 View Tree
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Playbook Modal */}
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
            <h2 style={{ margin: "0 0 20px 0", fontSize: 20 }}>Create New Playbook</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Domain *
              </label>
              <select
                value={newPlaybook.domainId}
                onChange={(e) => setNewPlaybook({ ...newPlaybook, domainId: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <option value="">Select a domain...</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                Name *
              </label>
              <input
                type="text"
                value={newPlaybook.name}
                onChange={(e) => setNewPlaybook({ ...newPlaybook, name: e.target.value })}
                placeholder="e.g., Default Tutor Playbook"
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
                Description
              </label>
              <textarea
                value={newPlaybook.description}
                onChange={(e) => setNewPlaybook({ ...newPlaybook, description: e.target.value })}
                placeholder="What does this playbook do?"
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
                {creating ? "Creating..." : "Create & Edit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
