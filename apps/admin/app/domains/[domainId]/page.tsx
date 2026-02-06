"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Caller = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  _count: { calls: number };
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
  _count: { items: number };
};

type Domain = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  callers: Caller[];
  playbooks: Playbook[];
  _count: {
    callers: number;
    playbooks: number;
  };
};

export default function DomainDetailPage({
  params,
}: {
  params: Promise<{ domainId: string }>;
}) {
  const { domainId } = use(params);
  const router = useRouter();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"callers" | "playbooks" | "specs">("playbooks");
  const [domainSpecs, setDomainSpecs] = useState<{
    id: string;
    slug: string;
    name: string;
    outputType: string;
    scope: string;
    isActive: boolean;
    sourceFeatureSet?: { id: string; name: string } | null;
    playbooks: string[];
  }[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [showCreatePlaybookModal, setShowCreatePlaybookModal] = useState(false);
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: "", description: "" });

  const fetchDomain = async () => {
    try {
      const res = await fetch(`/api/domains/${domainId}`);
      const data = await res.json();
      if (data.ok) {
        setDomain(data.domain);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomain();
  }, [domainId]);

  // Fetch specs when switching to specs tab
  useEffect(() => {
    if (activeTab !== "specs" || !domain) return;
    if (domainSpecs.length > 0) return; // Already loaded

    const fetchSpecs = async () => {
      setSpecsLoading(true);
      try {
        // Fetch specs used in this domain's playbooks
        const playbookIds = domain.playbooks.map((p) => p.id);
        if (playbookIds.length === 0) {
          setDomainSpecs([]);
          return;
        }

        const res = await fetch(`/api/analysis-specs?include=full`);
        const data = await res.json();
        if (data.ok) {
          // Filter specs that are used in this domain's playbooks
          const specsInDomain = data.specs
            .filter((s: any) => s.playbooks?.some((p: any) => playbookIds.includes(p.id)))
            .map((s: any) => ({
              id: s.id,
              slug: s.slug,
              name: s.name,
              outputType: s.outputType,
              scope: s.scope,
              isActive: s.isActive,
              sourceFeatureSet: s.sourceFeatureSet,
              playbooks: s.playbooks?.filter((p: any) => playbookIds.includes(p.id)).map((p: any) => p.name) || [],
            }));
          setDomainSpecs(specsInDomain);
        }
      } catch (err) {
        console.error("Failed to fetch specs:", err);
      } finally {
        setSpecsLoading(false);
      }
    };
    fetchSpecs();
  }, [activeTab, domain, domainSpecs.length]);

  const handleCreatePlaybook = async () => {
    if (!newPlaybook.name) {
      alert("Name is required");
      return;
    }

    setCreatingPlaybook(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPlaybook,
          domainId,
        }),
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
      setCreatingPlaybook(false);
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
      <span style={{ fontSize: 10, padding: "2px 6px", background: s.bg, color: s.color, borderRadius: 4 }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "#6b7280" }}>Loading domain...</p>
      </div>
    );
  }

  if (error || !domain) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "#dc2626" }}>Error: {error || "Domain not found"}</p>
        <Link href="/domains" style={{ color: "#4f46e5" }}>
          Back to Domains
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <SourcePageHeader
        title={domain.name}
        description={domain.description || `Domain: ${domain.slug}`}
        dataNodeId="domains"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {domain.isDefault && (
              <span style={{ padding: "8px 12px", fontSize: 12, background: "#dbeafe", color: "#1d4ed8", borderRadius: 6 }}>
                Default Domain
              </span>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginTop: 24, marginBottom: 24 }}>
        <div style={{ padding: 16, background: "#f9fafb", borderRadius: 8, minWidth: 120 }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{domain._count.callers}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Callers</div>
        </div>
        <div style={{ padding: 16, background: "#f9fafb", borderRadius: 8, minWidth: 120 }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{domain._count.playbooks}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Playbooks</div>
        </div>
        <div style={{ padding: 16, background: "#f9fafb", borderRadius: 8, minWidth: 120 }}>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            {domain.playbooks.filter((p) => p.status === "PUBLISHED").length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Published</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <button
            onClick={() => setActiveTab("playbooks")}
            title="View and manage playbooks for this domain"
            style={{
              padding: "12px 0",
              background: "none",
              border: "none",
              borderBottom: activeTab === "playbooks" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "playbooks" ? "#4f46e5" : "#6b7280",
              fontWeight: activeTab === "playbooks" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Playbooks ({domain.playbooks.length})
          </button>
          <button
            onClick={() => setActiveTab("callers")}
            title="View and manage callers in this domain"
            style={{
              padding: "12px 0",
              background: "none",
              border: "none",
              borderBottom: activeTab === "callers" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "callers" ? "#4f46e5" : "#6b7280",
              fontWeight: activeTab === "callers" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Callers ({domain._count.callers})
          </button>
          <button
            onClick={() => setActiveTab("specs")}
            title="View analysis specs used in this domain"
            style={{
              padding: "12px 0",
              background: "none",
              border: "none",
              borderBottom: activeTab === "specs" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "specs" ? "#4f46e5" : "#6b7280",
              fontWeight: activeTab === "specs" ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Specs {domainSpecs.length > 0 ? `(${domainSpecs.length})` : ""}
          </button>
        </div>
      </div>

      {/* Playbooks Tab */}
      {activeTab === "playbooks" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Playbooks</h3>
            <button
              onClick={() => setShowCreatePlaybookModal(true)}
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
          </div>

          {domain.playbooks.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", background: "#f9fafb", borderRadius: 8 }}>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>No playbooks yet</p>
              <button
                onClick={() => setShowCreatePlaybookModal(true)}
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
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {domain.playbooks.map((playbook) => (
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
                      padding: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = "#4f46e5")}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{playbook.name}</span>
                        {statusBadge(playbook.status)}
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>v{playbook.version}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {playbook._count.items} items
                        {playbook.publishedAt && (
                          <> &bull; Published {new Date(playbook.publishedAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <span style={{ color: "#9ca3af" }}>&rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Callers Tab */}
      {activeTab === "callers" && (
        <div>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>
            Callers in this Domain
          </h3>

          {domain.callers.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", background: "#f9fafb", borderRadius: 8 }}>
              <p style={{ color: "#6b7280" }}>No callers assigned to this domain yet</p>
            </div>
          ) : (
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Name
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Contact
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Calls
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {domain.callers.map((caller) => (
                    <tr key={caller.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <Link href={`/callers/${caller.id}`} style={{ color: "#4f46e5", textDecoration: "none" }}>
                          {caller.name || <em style={{ color: "#9ca3af" }}>No name</em>}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#6b7280" }}>
                        {caller.email || caller.phone || caller.externalId || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 14 }}>{caller._count.calls}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                        {new Date(caller.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Specs Tab */}
      {activeTab === "specs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Analysis Specs in this Domain
            </h3>
            <Link
              href={`/analysis-specs?scope=DOMAIN`}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
                background: "#f3f4f6",
                color: "#374151",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              View All Specs →
            </Link>
          </div>

          {specsLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>
              Loading specs...
            </div>
          ) : domain.playbooks.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", background: "#f9fafb", borderRadius: 8 }}>
              <p style={{ color: "#6b7280" }}>Create a playbook first to add specs to this domain</p>
            </div>
          ) : domainSpecs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", background: "#f9fafb", borderRadius: 8 }}>
              <p style={{ color: "#6b7280" }}>No specs have been added to playbooks in this domain yet</p>
              <Link
                href={`/playbooks/${domain.playbooks[0]?.id}`}
                style={{ color: "#4f46e5", marginTop: 8, display: "inline-block" }}
              >
                Add specs to a playbook →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {domainSpecs.map((spec) => (
                <Link
                  key={spec.id}
                  href={`/analysis-specs?select=${spec.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = "#4f46e5")}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{spec.name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: spec.outputType === "MEASURE" ? "#eef2ff" : "#fffbeb",
                            color: spec.outputType === "MEASURE" ? "#4338ca" : "#92400e",
                            borderRadius: 4,
                          }}
                        >
                          {spec.outputType}
                        </span>
                        {!spec.isActive && (
                          <span style={{ fontSize: 10, padding: "2px 6px", background: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
                            inactive
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {spec.slug}
                        {spec.playbooks.length > 0 && (
                          <span style={{ marginLeft: 8 }}>
                            • in {spec.playbooks.join(", ")}
                          </span>
                        )}
                      </div>
                      {spec.sourceFeatureSet && (
                        <div style={{ fontSize: 11, color: "#059669", marginTop: 4 }}>
                          📦 Managed by {spec.sourceFeatureSet.name}
                        </div>
                      )}
                    </div>
                    <span style={{ color: "#9ca3af" }}>&rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Playbook Modal */}
      {showCreatePlaybookModal && (
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
          onClick={() => setShowCreatePlaybookModal(false)}
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
                onClick={() => setShowCreatePlaybookModal(false)}
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
                onClick={handleCreatePlaybook}
                disabled={creatingPlaybook}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: creatingPlaybook ? "not-allowed" : "pointer",
                  opacity: creatingPlaybook ? 0.7 : 1,
                }}
              >
                {creatingPlaybook ? "Creating..." : "Create & Edit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
