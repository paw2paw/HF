"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FancySelect } from "@/components/shared/FancySelect";
import { EntityPill, DomainPill, PlaybookPill, SpecPill, StatusBadge } from "@/src/components/shared/EntityPill";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

type Domain = {
  id: string;
  slug: string;
  name: string;
};

type PlaybookListItem = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
  domain: Domain;
  _count: { items: number };
};

type PlaybookItem = {
  id: string;
  itemType: string;
  isEnabled: boolean;
  sortOrder: number;
  spec: {
    id: string;
    slug: string;
    name: string;
    scope: string;
    outputType: string;
    specRole: string | null;
  } | null;
  promptTemplate: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type PlaybookDetail = {
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
  parentVersion: { id: string; name: string; version: string } | null;
  _count: { items: number };
};

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const statusColors: Record<string, { bg: string; text: string; icon: string; desc: string }> = {
  DRAFT: { bg: "#fef3c7", text: "#92400e", icon: "📝", desc: "Work in progress" },
  PUBLISHED: { bg: "#dcfce7", text: "#166534", icon: "✅", desc: "Active and in use" },
  ARCHIVED: { bg: "#f3f4f6", text: "#6b7280", icon: "📦", desc: "No longer active" },
};

// Map playbook status to StatusBadge status type
const playbookStatusMap: Record<string, "draft" | "active" | "archived"> = {
  DRAFT: "draft",
  PUBLISHED: "active",
  ARCHIVED: "archived",
};

const outputTypeColors: Record<string, { bg: string; text: string }> = {
  LEARN: { bg: "#ede9fe", text: "#4c1d95" },
  MEASURE: { bg: "#dcfce7", text: "#14532d" },
  ADAPT: { bg: "#fef3c7", text: "#78350f" },
  COMPOSE: { bg: "#fce7f3", text: "#9d174d" },
  AGGREGATE: { bg: "#e0e7ff", text: "#3730a3" },
  REWARD: { bg: "#fef9c3", text: "#854d0e" },
};

export default function PlaybooksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  // List state
  const [playbooks, setPlaybooks] = useState<PlaybookListItem[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: "", description: "", domainId: "" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState("");

  // Detail state
  const [playbook, setPlaybook] = useState<PlaybookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchPlaybooks = () => {
    Promise.all([
      fetch("/api/playbooks").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ])
      .then(([pb, dom]) => {
        if (pb.ok) setPlaybooks(pb.playbooks || []);
        if (dom.ok) setDomains(dom.domains || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setPlaybook(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    fetch(`/api/playbooks/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPlaybook(data.playbook);
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
    if (!newPlaybook.name || !newPlaybook.domainId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlaybook),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybooks([...playbooks, data.playbook]);
        setShowCreate(false);
        setNewPlaybook({ name: "", description: "", domainId: "" });
        router.push(`/x/playbooks?id=${data.playbook.id}`, { scroll: false });
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async () => {
    if (!playbook) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/playbooks/${playbook.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setPlaybook(data.playbook);
        fetchPlaybooks(); // Refresh list
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!playbook) return;
    if (!confirm("Archive this playbook? It will no longer be available to callers.")) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/playbooks/${playbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybook({ ...playbook, status: "ARCHIVED" });
        fetchPlaybooks();
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!playbook) return;
    if (!confirm("Delete this playbook? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/playbooks/${playbook.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        router.push("/x/playbooks", { scroll: false });
        fetchPlaybooks();
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
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

  const selectPlaybook = (id: string) => {
    router.push(`/x/playbooks?id=${id}`, { scroll: false });
  };

  // Filter playbooks
  const filteredPlaybooks = playbooks.filter((pb) => {
    if (search) {
      const s = search.toLowerCase();
      const matchesSearch = pb.name.toLowerCase().includes(s) || pb.description?.toLowerCase().includes(s);
      if (!matchesSearch) return false;
    }
    if (selectedStatuses.size > 0 && !selectedStatuses.has(pb.status)) return false;
    if (selectedDomain && selectedDomain !== pb.domain.id) return false;
    return true;
  });

  // Group by domain
  const groupedByDomain = filteredPlaybooks.reduce(
    (acc, pb) => {
      const domainName = pb.domain.name;
      if (!acc[domainName]) acc[domainName] = [];
      acc[domainName].push(pb);
      return acc;
    },
    {} as Record<string, PlaybookListItem[]>
  );

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

  // Group items by scope for detail view
  const groupedItems = playbook?.items.reduce(
    (acc, item) => {
      if (!item.spec) return acc;
      const scope = item.spec.scope || "OTHER";
      if (!acc[scope]) acc[scope] = [];
      acc[scope].push(item);
      return acc;
    },
    {} as Record<string, PlaybookItem[]>
  );

  return (
    <div>
      <AdvancedBanner />
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
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Playbooks</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: "6px 12px",
                background: "var(--button-primary-bg)",
                color: "var(--surface-primary)",
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
          {/* Search */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search playbooks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px",
                paddingRight: search ? 28 : 12,
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                width: 180,
                fontSize: 13,
                background: "var(--surface-primary)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  color: "var(--text-muted)",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            )}
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border-default)" }} />

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Filter by playbook status">Status</span>
            <ClearBtn onClick={() => setSelectedStatuses(new Set())} show={selectedStatuses.size > 0} />
            <div style={{ display: "flex", gap: 4 }}>
              {STATUSES.map((status) => {
                const config = statusColors[status];
                return (
                  <FilterPill
                    key={status}
                    label={status}
                    icon={config.icon}
                    tooltip={config.desc}
                    isActive={selectedStatuses.has(status)}
                    colors={config}
                    onClick={() => toggleStatus(status)}
                  />
                );
              })}
            </div>
          </div>

          {/* Domain */}
          {domains.length > 0 && (
            <>
              <div style={{ width: 1, height: 24, background: "var(--border-default)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Filter by domain">Domain</span>
                <FancySelect
                  value={selectedDomain}
                  onChange={setSelectedDomain}
                  placeholder="All domains"
                  clearable
                  options={domains.map((d) => ({ value: d.id, label: d.name }))}
                  style={{ width: 180 }}
                />
              </div>
            </>
          )}

          {/* Results count */}
          <span style={{ fontSize: 11, color: "var(--text-placeholder)", marginLeft: "auto", alignSelf: "center" }}>
            {filteredPlaybooks.length} of {playbooks.length}
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 16,
            background: "var(--status-error-bg)",
            color: "var(--status-error-text)",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* Master-Detail Layout */}
      <div style={{ display: "flex", gap: 16, minHeight: "calc(100vh - 220px)" }}>
        {/* List Panel */}
        <div style={{ width: 340, flexShrink: 0, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
          ) : filteredPlaybooks.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                background: "var(--background)",
                borderRadius: 12,
                border: "1px solid var(--border-default)",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
                {search || selectedStatuses.size > 0 || selectedDomain
                  ? "No playbooks match filters"
                  : "No playbooks yet"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(groupedByDomain)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([domainName, playbooksInDomain]) => (
                  <div key={domainName}>
                    <h2
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {domainName} ({playbooksInDomain.length})
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {playbooksInDomain.map((pb) => (
                        <div
                          key={pb.id}
                          onClick={() => selectPlaybook(pb.id)}
                          style={{
                            background: selectedId === pb.id ? "var(--surface-selected)" : "var(--surface-primary)",
                            border: selectedId === pb.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                            borderRadius: 8,
                            padding: 12,
                            cursor: "pointer",
                            transition: "border-color 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                            <StatusBadge status={playbookStatusMap[pb.status]} size="compact" />
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 500,
                                padding: "2px 6px",
                                background: "var(--surface-secondary)",
                                color: "var(--text-muted)",
                                borderRadius: 4,
                              }}
                            >
                              v{pb.version}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                            {pb.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{pb._count.items} specs</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div
          style={{
            flex: 1,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: 20,
            overflowY: "auto",
          }}
        >
          {!selectedId ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
                <div style={{ fontSize: 14 }}>Select a playbook to view details</div>
              </div>
            </div>
          ) : detailLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading playbook...</div>
          ) : detailError || !playbook ? (
            <div style={{ padding: 20, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
              {detailError || "Playbook not found"}
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      {playbook.name}
                    </h2>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {playbook.domain.name} &bull; v{playbook.version}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link
                      href={`/x/taxonomy-graph?focus=playbook:${playbook.id}&depth=6`}
                      style={{
                        padding: "8px 12px",
                        background: "var(--surface-secondary)",
                        color: "var(--text-secondary)",
                        borderRadius: 6,
                        textDecoration: "none",
                        fontWeight: 500,
                        fontSize: 13,
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title="View in taxonomy graph"
                    >
                      🌌
                    </Link>
                    <Link
                      href={`/x/playbooks/${playbook.id}`}
                      style={{
                        padding: "8px 16px",
                        background: "var(--button-primary-bg)",
                        color: "white",
                        borderRadius: 6,
                        textDecoration: "none",
                        fontWeight: 500,
                        fontSize: 13,
                      }}
                    >
                      Open Editor
                    </Link>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, alignItems: "center" }}>
                <StatusBadge status={playbookStatusMap[playbook.status]} />
                <DomainPill label={playbook.domain.name} href={`/x/domains?id=${playbook.domain.id}`} size="compact" />
                {playbook.parentVersion && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "var(--surface-secondary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Based on: {playbook.parentVersion.name} v{playbook.parentVersion.version}
                  </span>
                )}
              </div>

              {/* Description */}
              {playbook.description && (
                <div
                  style={{
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 20,
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  {playbook.description}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{playbook.items.length}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Specs</div>
                </div>
                <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>
                    {playbook.items.filter((i) => i.isEnabled).length}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Enabled</div>
                </div>
                {Object.keys(groupedItems || {}).length > 0 && (
                  <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>{Object.keys(groupedItems || {}).length}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Scopes</div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>Actions</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {playbook.status === "DRAFT" && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      style={{
                        padding: "8px 16px",
                        background: "#16a34a",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: publishing ? "not-allowed" : "pointer",
                        opacity: publishing ? 0.7 : 1,
                      }}
                    >
                      {publishing ? "Publishing..." : "Publish"}
                    </button>
                  )}
                  {playbook.status !== "ARCHIVED" && (
                    <button
                      onClick={handleArchive}
                      disabled={archiving}
                      style={{
                        padding: "8px 16px",
                        background: "var(--surface-secondary)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 6,
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: archiving ? "not-allowed" : "pointer",
                        opacity: archiving ? 0.7 : 1,
                      }}
                    >
                      {archiving ? "Archiving..." : "Archive"}
                    </button>
                  )}
                  {playbook.status === "DRAFT" && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        padding: "8px 16px",
                        background: "var(--status-error-bg)",
                        color: "var(--status-error-text)",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: deleting ? "not-allowed" : "pointer",
                        opacity: deleting ? 0.7 : 1,
                      }}
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>

              {/* Specs Preview */}
              {groupedItems && Object.keys(groupedItems).length > 0 && (
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12 }}>
                    Specs by Scope
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {Object.entries(groupedItems)
                      .sort(([a], [b]) => {
                        const order = ["SYSTEM", "DOMAIN", "CALLER"];
                        return order.indexOf(a) - order.indexOf(b);
                      })
                      .map(([scope, items]) => (
                        <div key={scope}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              marginBottom: 8,
                              textTransform: "uppercase",
                            }}
                          >
                            {scope} ({items.length})
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                              gap: 8,
                            }}
                          >
                            {items.slice(0, 6).map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  padding: 10,
                                  background: item.isEnabled ? "var(--surface-secondary)" : "var(--status-error-bg)",
                                  borderRadius: 6,
                                  border: "1px solid var(--border-default)",
                                  opacity: item.isEnabled ? 1 : 0.6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "var(--text-primary)",
                                    marginBottom: 4,
                                  }}
                                >
                                  {item.spec?.name}
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {item.spec?.outputType && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        padding: "1px 4px",
                                        borderRadius: 3,
                                        background: outputTypeColors[item.spec.outputType]?.bg || "#e5e7eb",
                                        color: outputTypeColors[item.spec.outputType]?.text || "#374151",
                                      }}
                                    >
                                      {item.spec.outputType}
                                    </span>
                                  )}
                                  {!item.isEnabled && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        padding: "1px 4px",
                                        borderRadius: 3,
                                        background: "var(--status-error-bg)",
                                        color: "var(--status-error-text)",
                                      }}
                                    >
                                      DISABLED
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {items.length > 6 && (
                              <div
                                style={{
                                  padding: 10,
                                  background: "var(--surface-secondary)",
                                  borderRadius: 6,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--text-muted)",
                                  fontSize: 12,
                                }}
                              >
                                +{items.length - 6} more
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 20, marginTop: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginBottom: 12 }}>Metadata</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>ID</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-primary)" }}>
                      {playbook.id}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Created</div>
                    <div style={{ color: "var(--text-primary)" }}>
                      {new Date(playbook.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Updated</div>
                    <div style={{ color: "var(--text-primary)" }}>
                      {new Date(playbook.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {playbook.publishedAt && (
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Published</div>
                      <div style={{ color: "var(--text-primary)" }}>
                        {new Date(playbook.publishedAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Modal */}
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
            style={{ background: "var(--modal-bg)", borderRadius: 12, padding: 24, width: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 18 }}>New Playbook</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Domain</label>
              <FancySelect
                value={newPlaybook.domainId}
                onChange={(v) => setNewPlaybook({ ...newPlaybook, domainId: v })}
                placeholder="Select domain..."
                options={domains.map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Name</label>
              <input
                type="text"
                value={newPlaybook.name}
                onChange={(e) => setNewPlaybook({ ...newPlaybook, name: e.target.value })}
                style={{ width: "100%", padding: 10, border: "1px solid var(--input-border)", borderRadius: 6 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: "8px 16px",
                  background: "var(--surface-secondary)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newPlaybook.name || !newPlaybook.domainId}
                style={{
                  padding: "8px 16px",
                  background: "var(--button-primary-bg)",
                  color: "var(--surface-primary)",
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
    </div>
  );
}
