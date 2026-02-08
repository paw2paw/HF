"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FancySelect } from "@/components/shared/FancySelect";
import { PlaybookPill, CallerPill, StatusBadge } from "@/src/components/shared/EntityPill";
import { DraggableTabs } from "@/components/shared/DraggableTabs";

type DomainListItem = {
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
};

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
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  domain?: { id: string; name: string };
  _count?: { items: number };
};

type DomainDetail = {
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

const STATUSES = ["active", "inactive"] as const;

const statusColors: Record<string, { bg: string; text: string; icon: string; desc: string }> = {
  active: { bg: "#dcfce7", text: "#166534", icon: "✅", desc: "Currently active domains" },
  inactive: { bg: "#fee2e2", text: "#991b1b", icon: "⏸️", desc: "Inactive domains" },
};

// Map playbook status to StatusBadge status type
const playbookStatusMap: Record<string, "draft" | "active" | "archived"> = {
  DRAFT: "draft",
  PUBLISHED: "active",
  ARCHIVED: "archived",
};

export default function DomainsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  // List state
  const [domains, setDomains] = useState<DomainListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDomain, setNewDomain] = useState({ slug: "", name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "callers" | "playbooks">("name");

  // Detail state
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"callers" | "playbooks">("playbooks");
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: "", description: "" });
  const [allPlaybooks, setAllPlaybooks] = useState<Playbook[]>([]);
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);
  const [modalTab, setModalTab] = useState<"create" | "existing">("existing");
  const [movingPlaybookId, setMovingPlaybookId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const fetchDomains = () => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDomains(data.domains || []);
        else setError(data.error);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDomain(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    fetch(`/api/domains/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDomain(data.domain);
        } else {
          setDetailError(data.error);
        }
        setDetailLoading(false);
      })
      .catch((e) => {
        setDetailError(e.message);
        setDetailLoading(false);
      });
  }, [selectedId]);

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
        setShowCreate(false);
        setNewDomain({ slug: "", name: "", description: "" });
        fetchDomains();
        router.push(`/x/domains?id=${data.domain.id}`, { scroll: false });
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const selectDomain = (id: string) => {
    router.push(`/x/domains?id=${id}`, { scroll: false });
  };

  // Filter and sort domains
  const filteredAndSortedDomains = domains
    .filter((d) => {
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch =
          d.name.toLowerCase().includes(s) ||
          d.slug.toLowerCase().includes(s) ||
          d.description?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      if (selectedStatuses.size > 0) {
        const domainStatus = d.isActive ? "active" : "inactive";
        if (!selectedStatuses.has(domainStatus)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "callers":
          return b.callerCount - a.callerCount;
        case "playbooks":
          return b.playbookCount - a.playbookCount;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const statusBadge = (d: DomainListItem | DomainDetail) => {
    if (!d.isActive) {
      return (
        <span style={{ fontSize: 10, padding: "2px 6px", background: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
          Inactive
        </span>
      );
    }
    if (d.isDefault) {
      return (
        <span style={{ fontSize: 10, padding: "2px 6px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 4 }}>
          Default
        </span>
      );
    }
    return null;
  };

  const playbookStatusBadge = (status: string) => {
    return <StatusBadge status={playbookStatusMap[status] || "draft"} size="compact" />;
  };

  // Detail handlers
  const sortedPlaybooks = [...(domain?.playbooks || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const publishedPlaybooks = sortedPlaybooks.filter((p) => p.status === "PUBLISHED");

  const handleReorder = async (playbookId: string, direction: "up" | "down") => {
    const idx = sortedPlaybooks.findIndex((p) => p.id === playbookId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sortedPlaybooks.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const currentPlaybook = sortedPlaybooks[idx];
    const swapPlaybook = sortedPlaybooks[swapIdx];

    setReorderingId(playbookId);
    try {
      await Promise.all([
        fetch(`/api/playbooks/${currentPlaybook.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swapPlaybook.sortOrder }),
        }),
        fetch(`/api/playbooks/${swapPlaybook.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: currentPlaybook.sortOrder }),
        }),
      ]);
      // Refresh domain detail
      const res = await fetch(`/api/domains/${selectedId}`);
      const data = await res.json();
      if (data.ok) setDomain(data.domain);
    } catch (err: any) {
      alert("Error reordering: " + err.message);
    } finally {
      setReorderingId(null);
    }
  };

  const handleCreatePlaybook = async () => {
    if (!newPlaybook.name || !selectedId) {
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
          domainId: selectedId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/x/playbooks/${data.playbook.id}`);
      } else {
        alert("Failed to create playbook: " + data.error);
      }
    } catch (err: any) {
      alert("Error creating playbook: " + err.message);
    } finally {
      setCreatingPlaybook(false);
    }
  };

  const FilterPill = ({
    label,
    isActive,
    colors,
    onClick,
    icon,
    tooltip,
  }: {
    label: string;
    isActive: boolean;
    colors: { bg: string; text: string };
    onClick: () => void;
    icon?: string;
    tooltip?: string;
  }) => (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 600,
        border: isActive ? `1px solid ${colors.text}40` : "1px solid var(--border-default)",
        borderRadius: 5,
        cursor: "pointer",
        background: isActive ? colors.bg : "var(--surface-secondary)",
        color: isActive ? colors.text : "var(--text-muted)",
        transition: "all 0.15s",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );

  const ClearBtn = ({ onClick, show }: { onClick: () => void; show: boolean }) => (
    show ? (
      <button
        onClick={onClick}
        style={{
          padding: "0 4px",
          fontSize: 12,
          fontWeight: 400,
          border: "none",
          borderRadius: 3,
          cursor: "pointer",
          background: "transparent",
          color: "var(--text-placeholder)",
          lineHeight: 1,
        }}
        title="Clear filter"
      >
        ×
      </button>
    ) : null
  );

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Domains</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                width: 160,
                fontSize: 12,
              }}
            />
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: "6px 12px",
                background: "var(--button-primary-bg)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + New
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Filter by domain status">Status</span>
            <ClearBtn onClick={() => setSelectedStatuses(new Set())} show={selectedStatuses.size > 0} />
            <div style={{ display: "flex", gap: 4 }}>
              <FilterPill
                label="ACTIVE"
                icon={statusColors.active.icon}
                tooltip={statusColors.active.desc}
                isActive={selectedStatuses.has("active")}
                colors={statusColors.active}
                onClick={() => toggleStatus("active")}
              />
              <FilterPill
                label="INACTIVE"
                icon={statusColors.inactive.icon}
                tooltip={statusColors.inactive.desc}
                isActive={selectedStatuses.has("inactive")}
                colors={statusColors.inactive}
                onClick={() => toggleStatus("inactive")}
              />
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border-default)" }} />

          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Sort domains">Sort</span>
          <FancySelect
            value={sortBy}
            onChange={(v) => setSortBy(v as "name" | "callers" | "playbooks")}
            searchable={false}
            style={{ minWidth: 120 }}
            options={[
              { value: "name", label: "Name" },
              { value: "callers", label: "Callers" },
              { value: "playbooks", label: "Playbooks" },
            ]}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Master-Detail Layout */}
      <div style={{ display: "flex", gap: 16, minHeight: "calc(100vh - 220px)" }}>
        {/* List Panel */}
        <div style={{ width: 320, flexShrink: 0, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
          ) : filteredAndSortedDomains.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", background: "var(--surface-secondary)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
                {search || selectedStatuses.size > 0 ? "No domains match filters" : "No domains yet"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredAndSortedDomains.map((d) => (
                <div
                  key={d.id}
                  onClick={() => selectDomain(d.id)}
                  style={{
                    background: selectedId === d.id ? "var(--surface-selected)" : "var(--surface-primary)",
                    border: selectedId === d.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: 14,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{d.name}</h3>
                    {statusBadge(d)}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.4 }}>
                    {d.description || <em>No description</em>}
                  </p>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                    <span><strong>{d.callerCount || 0}</strong> callers</span>
                    <span><strong>{d.playbookCount || 0}</strong> playbooks</span>
                  </div>
                  {d.publishedPlaybook && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "6px 10px",
                        background: "#f0fdf4",
                        borderRadius: 5,
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: "#166534", fontWeight: 500 }}>Published:</span>{" "}
                      <span style={{ color: "#15803d" }}>
                        {d.publishedPlaybook.name} v{d.publishedPlaybook.version}
                      </span>
                    </div>
                  )}
                  {!d.publishedPlaybook && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "6px 10px",
                        background: "#fef3c7",
                        borderRadius: 5,
                        fontSize: 11,
                        color: "#92400e",
                      }}
                    >
                      No published playbook
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div style={{ flex: 1, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 20, overflowY: "auto" }}>
          {!selectedId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-placeholder)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
                <div style={{ fontSize: 14 }}>Select a domain to view details</div>
              </div>
            </div>
          ) : detailLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading domain...</div>
          ) : detailError || !domain ? (
            <div style={{ padding: 20, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
              {detailError || "Domain not found"}
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{domain.name}</h2>
                    {domain.isDefault && (
                      <span style={{ padding: "4px 8px", fontSize: 11, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4 }}>
                        Default
                      </span>
                    )}
                    {!domain.isActive && (
                      <span style={{ padding: "4px 8px", fontSize: 11, background: "#fee2e2", color: "#991b1b", borderRadius: 4 }}>
                        Inactive
                      </span>
                    )}
                  </div>
                  {domain.description && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>{domain.description}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{domain._count.callers}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Callers</div>
                </div>
                <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{domain._count.playbooks}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Playbooks</div>
                </div>
                <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>
                    {domain.playbooks.filter((p) => p.status === "PUBLISHED").length}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Published</div>
                </div>
              </div>

              {/* Tabs */}
              <DraggableTabs
                storageKey={`domain-detail-tabs-${domain.id}`}
                tabs={[
                  { id: "playbooks", label: `Playbooks (${domain.playbooks.length})` },
                  { id: "callers", label: `Callers (${domain._count.callers})` },
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as "callers" | "playbooks")}
                containerStyle={{ marginBottom: 24 }}
              />

              {/* Playbooks Tab */}
              {activeTab === "playbooks" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Playbooks</h3>
                    <button
                      onClick={() => {
                        setShowPlaybookModal(true);
                        setModalTab("existing");
                        setLoadingPlaybooks(true);
                        fetch("/api/playbooks")
                          .then((r) => r.json())
                          .then((data) => {
                            if (data.ok) setAllPlaybooks(data.playbooks || []);
                          })
                          .finally(() => setLoadingPlaybooks(false));
                      }}
                      style={{
                        padding: "8px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                        background: "var(--button-primary-bg)",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      + Add Playbook
                    </button>
                  </div>

                  {/* Stack Order Info */}
                  {publishedPlaybooks.length > 1 && (
                    <div style={{
                      padding: "10px 14px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      marginBottom: 16,
                      fontSize: 12,
                      color: "#1e40af",
                    }}>
                      <strong>Stack Order:</strong> {publishedPlaybooks.length} published playbooks will be stacked.
                      First playbook wins on spec conflicts. Use arrows to reorder.
                    </div>
                  )}

                  {sortedPlaybooks.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center", background: "var(--surface-secondary)", borderRadius: 8 }}>
                      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>No playbooks yet</p>
                      <button
                        onClick={() => {
                          setShowPlaybookModal(true);
                          setModalTab("existing");
                          setLoadingPlaybooks(true);
                          fetch("/api/playbooks")
                            .then((r) => r.json())
                            .then((data) => {
                              if (data.ok) setAllPlaybooks(data.playbooks || []);
                            })
                            .finally(() => setLoadingPlaybooks(false));
                        }}
                        style={{
                          padding: "8px 16px",
                          fontSize: 14,
                          fontWeight: 500,
                          background: "var(--button-primary-bg)",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Add First Playbook
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {sortedPlaybooks.map((playbook, idx) => {
                        const isPublished = playbook.status === "PUBLISHED";
                        const stackPosition = isPublished ? publishedPlaybooks.findIndex((p) => p.id === playbook.id) + 1 : null;

                        return (
                          <div
                            key={playbook.id}
                            style={{
                              background: "var(--surface-primary)",
                              border: isPublished ? "1px solid var(--status-success-border)" : "1px solid var(--border-default)",
                              borderRadius: 8,
                              padding: "12px 16px",
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            {/* Reorder buttons */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <button
                                onClick={(e) => { e.preventDefault(); handleReorder(playbook.id, "up"); }}
                                disabled={idx === 0 || reorderingId === playbook.id}
                                style={{
                                  width: 24,
                                  height: 20,
                                  padding: 0,
                                  border: "1px solid var(--border-strong)",
                                  borderRadius: 3,
                                  background: idx === 0 ? "var(--surface-tertiary)" : "var(--surface-primary)",
                                  color: idx === 0 ? "var(--text-muted)" : "var(--text-primary)",
                                  cursor: idx === 0 ? "not-allowed" : "pointer",
                                  fontSize: 10,
                                }}
                              >
                                ▲
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); handleReorder(playbook.id, "down"); }}
                                disabled={idx === sortedPlaybooks.length - 1 || reorderingId === playbook.id}
                                style={{
                                  width: 24,
                                  height: 20,
                                  padding: 0,
                                  border: "1px solid var(--border-strong)",
                                  borderRadius: 3,
                                  background: idx === sortedPlaybooks.length - 1 ? "var(--surface-tertiary)" : "var(--surface-primary)",
                                  color: idx === sortedPlaybooks.length - 1 ? "var(--text-muted)" : "var(--text-primary)",
                                  cursor: idx === sortedPlaybooks.length - 1 ? "not-allowed" : "pointer",
                                  fontSize: 10,
                                }}
                              >
                                ▼
                              </button>
                            </div>

                            {/* Stack position badge */}
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: isPublished ? "#dcfce7" : "#f3f4f6",
                              color: isPublished ? "#166534" : "#9ca3af",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>
                              {stackPosition ? `#${stackPosition}` : "—"}
                            </div>

                            {/* Playbook info */}
                            <Link
                              href={`/x/playbooks/${playbook.id}`}
                              style={{ flex: 1, textDecoration: "none", color: "inherit" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                                <PlaybookPill label={playbook.name} size="compact" />
                                {playbookStatusBadge(playbook.status)}
                                <span style={{ fontSize: 12, color: "var(--text-placeholder)" }}>v{playbook.version}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {playbook._count?.items || 0} specs
                                {playbook.publishedAt && (
                                  <> &bull; Published {new Date(playbook.publishedAt).toLocaleDateString()}</>
                                )}
                              </div>
                            </Link>

                            {/* Arrow */}
                            <Link href={`/x/playbooks/${playbook.id}`} style={{ color: "var(--text-placeholder)", textDecoration: "none" }}>
                              →
                            </Link>
                          </div>
                        );
                      })}
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
                    <div style={{ padding: 32, textAlign: "center", background: "var(--surface-secondary)", borderRadius: 8 }}>
                      <p style={{ color: "var(--text-muted)" }}>No callers assigned to this domain yet</p>
                    </div>
                  ) : (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-default)" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                              Name
                            </th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                              Contact
                            </th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                              Calls
                            </th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                              Created
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {domain.callers.map((caller) => (
                            <tr key={caller.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "12px 16px" }}>
                                <CallerPill
                                  label={caller.name || "No name"}
                                  href={`/x/callers/${caller.id}`}
                                  size="compact"
                                />
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--text-muted)" }}>
                                {caller.email || caller.phone || caller.externalId || "—"}
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 14 }}>{caller._count.calls}</td>
                              <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
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
            </>
          )}
        </div>
      </div>

      {/* Create Domain Modal */}
      {showCreate && (
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
          onClick={() => setShowCreate(false)}
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
                onClick={() => setShowCreate(false)}
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
      )}

      {/* Add Playbook Modal */}
      {showPlaybookModal && (
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
          onClick={() => setShowPlaybookModal(false)}
        >
          <div
            style={{
              background: "var(--surface-primary)",
              borderRadius: 12,
              width: 500,
              maxWidth: "90%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Tabs */}
            <div style={{ borderBottom: "1px solid var(--border-default)" }}>
              <div style={{ padding: "16px 20px 0 20px" }}>
                <h2 style={{ margin: "0 0 12px 0", fontSize: 18 }}>Add Playbook to {domain?.name}</h2>
              </div>
              <div style={{ display: "flex", gap: 0 }}>
                <button
                  onClick={() => setModalTab("existing")}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: modalTab === "existing" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    color: modalTab === "existing" ? "var(--accent-primary)" : "var(--text-muted)",
                    fontWeight: modalTab === "existing" ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Move Existing
                </button>
                <button
                  onClick={() => setModalTab("create")}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: modalTab === "create" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    color: modalTab === "create" ? "var(--accent-primary)" : "var(--text-muted)",
                    fontWeight: modalTab === "create" ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Create New
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {modalTab === "existing" ? (
                <div>
                  {loadingPlaybooks ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Loading playbooks...</div>
                  ) : (() => {
                    const otherPlaybooks = allPlaybooks.filter((pb) => pb.domain?.id !== selectedId);
                    return otherPlaybooks.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                        <p>No playbooks in other domains to move.</p>
                        <button
                          onClick={() => setModalTab("create")}
                          style={{
                            marginTop: 12,
                            padding: "8px 16px",
                            background: "var(--button-primary-bg)",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          Create New Instead
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {otherPlaybooks.map((pb) => (
                          <div
                            key={pb.id}
                            style={{
                              padding: 12,
                              border: "1px solid var(--border-default)",
                              borderRadius: 8,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                <span style={{ fontWeight: 500, fontSize: 14 }}>{pb.name}</span>
                                {playbookStatusBadge(pb.status)}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                From: {pb.domain?.name || "No domain"} &bull; {pb._count?.items || 0} specs
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                setMovingPlaybookId(pb.id);
                                try {
                                  const res = await fetch(`/api/playbooks/${pb.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ domainId: selectedId }),
                                  });
                                  const data = await res.json();
                                  if (data.ok) {
                                    setShowPlaybookModal(false);
                                    // Refresh domain detail
                                    const refreshRes = await fetch(`/api/domains/${selectedId}`);
                                    const refreshData = await refreshRes.json();
                                    if (refreshData.ok) setDomain(refreshData.domain);
                                  } else {
                                    alert("Failed to move playbook: " + data.error);
                                  }
                                } catch (err: any) {
                                  alert("Error: " + err.message);
                                } finally {
                                  setMovingPlaybookId(null);
                                }
                              }}
                              disabled={movingPlaybookId === pb.id}
                              style={{
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: movingPlaybookId === pb.id ? "#e5e7eb" : "#eef2ff",
                                color: movingPlaybookId === pb.id ? "#9ca3af" : "#4f46e5",
                                border: "none",
                                borderRadius: 6,
                                cursor: movingPlaybookId === pb.id ? "not-allowed" : "pointer",
                              }}
                            >
                              {movingPlaybookId === pb.id ? "Moving..." : "Move Here"}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div>
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
                        border: "1px solid var(--border-strong)",
                        borderRadius: 6,
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
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
                        border: "1px solid var(--border-strong)",
                        borderRadius: 6,
                        fontSize: 14,
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <button
                    onClick={handleCreatePlaybook}
                    disabled={creatingPlaybook || !newPlaybook.name}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      background: newPlaybook.name ? "#4f46e5" : "#e5e7eb",
                      color: newPlaybook.name ? "white" : "#9ca3af",
                      border: "none",
                      borderRadius: 6,
                      cursor: newPlaybook.name && !creatingPlaybook ? "pointer" : "not-allowed",
                    }}
                  >
                    {creatingPlaybook ? "Creating..." : "Create & Edit"}
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-default)", textAlign: "right" }}>
              <button
                onClick={() => setShowPlaybookModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
