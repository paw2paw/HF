"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FancySelect } from "@/components/shared/FancySelect";
import { PlaybookPill, CallerPill, StatusBadge } from "@/src/components/shared/EntityPill";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import { UnifiedAssistantPanel } from "@/components/shared/UnifiedAssistantPanel";
import { useAssistant, useAssistantKeyboardShortcut } from "@/hooks/useAssistant";
import { ReadinessBadge } from "@/components/shared/ReadinessBadge";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { BookOpen, Users, FileText, Rocket } from "lucide-react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import { SortableList } from "@/components/shared/SortableList";
import type { DomainListItem, DomainDetail } from "./components/types";
import { statusColors, playbookStatusMap, TrustBadge, DocTypeBadge } from "./components/constants";
import { CreateDomainModal } from "./components/CreateDomainModal";
import { AddPlaybookModal } from "./components/AddPlaybookModal";
import { PromptPreviewModal } from "./components/PromptPreviewModal";
import { OnboardingTabContent } from "./components/OnboardingTab";

export default function DomainsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  // List state
  const [domains, setDomains] = useState<DomainListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "callers" | "playbooks">("name");

  // Detail state
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"callers" | "playbooks" | "content" | "onboarding">("playbooks");
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);

  // Delete domain state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Remove playbook state
  const [removingPlaybookId, setRemovingPlaybookId] = useState<string | null>(null);
  const [showRemovePlaybookConfirm, setShowRemovePlaybookConfirm] = useState<string | null>(null);

  // AI Assistant
  const assistant = useAssistant({
    defaultTab: "chat",
    layout: "popout",
    enabledTabs: ["chat", "data"],
  });
  useAssistantKeyboardShortcut(assistant.toggle);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Prompt preview
  const [showPromptPreview, setShowPromptPreview] = useState(false);

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

  const handleDeleteDomain = async () => {
    if (!domain) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/domains/${domain.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setShowDeleteConfirm(false);
        setDomain(null);
        router.push("/x/domains", { scroll: false });
        fetchDomains();
      } else {
        setDeleteError(data.error);
      }
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRemovePlaybook = async (playbookId: string) => {
    if (!domain) return;
    setRemovingPlaybookId(playbookId);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        // Refresh domain detail
        const refreshRes = await fetch(`/api/domains/${domain.id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.ok) setDomain(refreshData.domain);
        fetchDomains();
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert("Error removing playbook: " + e.message);
    } finally {
      setRemovingPlaybookId(null);
      setShowRemovePlaybookConfirm(null);
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

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const currentPlaybook = sortedPlaybooks[fromIndex];
    const swapPlaybook = sortedPlaybooks[toIndex];
    if (!currentPlaybook || !swapPlaybook) return;

    setReorderingId(currentPlaybook.id);
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
        border: isActive ? `1px solid color-mix(in srgb, ${colors.text} 25%, transparent)` : "1px solid var(--border-default)",
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Domains</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
            <button
              onClick={() => {
                if (domain) {
                  assistant.openWithDomain(domain);
                } else {
                  assistant.open(undefined, { page: "/x/domains" });
                }
              }}
              style={{
                padding: "6px 12px",
                background: "rgba(139, 92, 246, 0.1)",
                color: "#8b5cf6",
                border: "1px solid rgba(139, 92, 246, 0.2)",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 12,
                cursor: "pointer",
              }}
              title="Ask AI Assistant (Cmd+Shift+K)"
            >
              ✨ Ask AI
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
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

          <div style={{ width: 1, height: 24, background: "var(--border-default)" }} />

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
      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
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
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", alignItems: "center" }}>
                    <span><strong>{d.callerCount || 0}</strong> callers</span>
                    <span><strong>{d.playbookCount || 0}</strong> playbooks</span>
                    <ReadinessBadge domainId={d.id} size="compact" />
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
                    <EditableTitle
                      value={domain.name}
                      as="h2"
                      onSave={async (newName) => {
                        const res = await fetch(`/api/domains/${domain.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newName }),
                        });
                        const data = await res.json();
                        if (!data.ok) throw new Error(data.error);
                        setDomain((prev) => prev ? { ...prev, name: newName } : prev);
                        fetchDomains();
                      }}
                    />
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
                    <ReadinessBadge domainId={domain.id} onScaffold={fetchDomains} />
                  </div>
                  {domain.description && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>{domain.description}</p>
                  )}
                </div>
                {!domain.isDefault && (
                  <button
                    onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      background: "transparent",
                      color: "#dc2626",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Delete Domain
                  </button>
                )}
              </div>

              {/* Delete Confirmation */}
              {showDeleteConfirm && (
                <div style={{
                  padding: 16,
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: 8,
                  marginBottom: 16,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#991b1b", marginBottom: 8 }}>
                    Delete &ldquo;{domain.name}&rdquo;?
                  </div>
                  {domain._count.callers > 0 ? (
                    <div>
                      <p style={{ fontSize: 13, color: "#991b1b", margin: "0 0 8px 0" }}>
                        Cannot delete this domain — it has {domain._count.callers} caller{domain._count.callers !== 1 ? "s" : ""} assigned.
                        Reassign callers to another domain first.
                      </p>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        style={{
                          padding: "6px 14px",
                          fontSize: 12,
                          fontWeight: 500,
                          background: "var(--surface-primary)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 13, color: "#7f1d1d", margin: "0 0 12px 0" }}>
                        This will deactivate the domain{domain._count.playbooks > 0 ? ` and its ${domain._count.playbooks} playbook${domain._count.playbooks !== 1 ? "s" : ""} will become orphaned` : ""}.
                        This action cannot be easily undone.
                      </p>
                      {deleteError && (
                        <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 8px 0" }}>{deleteError}</p>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleDeleteDomain}
                          disabled={deleting}
                          style={{
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#dc2626",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: deleting ? "not-allowed" : "pointer",
                            opacity: deleting ? 0.7 : 1,
                          }}
                        >
                          {deleting ? "Deleting..." : "Yes, Delete"}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={deleting}
                          style={{
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 500,
                            background: "var(--surface-primary)",
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
                  )}
                </div>
              )}

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
                <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{domain._count.subjects ?? 0}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Subjects</div>
                </div>
              </div>

              {/* Tabs */}
              <DraggableTabs
                storageKey={`domain-detail-tabs-${domain.id}`}
                tabs={[
                  { id: "playbooks", label: "Playbooks", icon: <BookOpen size={14} />, count: domain.playbooks.length },
                  { id: "callers", label: "Callers", icon: <Users size={14} />, count: domain._count.callers },
                  { id: "content", label: "Content", icon: <FileText size={14} />, count: domain._count.subjects ?? 0 },
                  { id: "onboarding", label: "Onboarding", icon: <Rocket size={14} /> },
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as "callers" | "playbooks" | "content" | "onboarding")}
                containerStyle={{ marginBottom: 24 }}
              />

              {/* Playbooks Tab */}
              {activeTab === "playbooks" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Playbooks</h3>
                    <button
                      onClick={() => setShowPlaybookModal(true)}
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
                        onClick={() => setShowPlaybookModal(true)}
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
                    <SortableList
                      items={sortedPlaybooks}
                      getItemId={(p) => p.id}
                      onReorder={handleReorder}
                      onRemove={(index) => {
                        const playbook = sortedPlaybooks[index];
                        if (playbook) setShowRemovePlaybookConfirm(playbook.id);
                      }}
                      disabled={!!reorderingId}
                      renderCard={(playbook) => {
                        const isPublished = playbook.status === "PUBLISHED";
                        const stackPosition = isPublished ? publishedPlaybooks.findIndex((p) => p.id === playbook.id) + 1 : null;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }} onClick={(e) => e.stopPropagation()}>
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
                                {(playbook._count?.enrollments ?? 0) > 0 && (
                                  <> &bull; {playbook._count!.enrollments} enrolled</>
                                )}
                                {playbook.publishedAt && (
                                  <> &bull; Published {new Date(playbook.publishedAt).toLocaleDateString()}</>
                                )}
                              </div>
                            </Link>

                            {/* Remove confirm (inline) */}
                            {showRemovePlaybookConfirm === playbook.id && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color: "#991b1b", whiteSpace: "nowrap" }}>
                                  {isPublished ? "Archive first" : "Remove?"}
                                </span>
                                {!isPublished && (
                                  <button
                                    onClick={(e) => { e.preventDefault(); handleRemovePlaybook(playbook.id); }}
                                    disabled={removingPlaybookId === playbook.id}
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background: "#dc2626",
                                      color: "white",
                                      border: "none",
                                      borderRadius: 4,
                                      cursor: removingPlaybookId === playbook.id ? "not-allowed" : "pointer",
                                      opacity: removingPlaybookId === playbook.id ? 0.7 : 1,
                                    }}
                                  >
                                    {removingPlaybookId === playbook.id ? "..." : "Yes"}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.preventDefault(); setShowRemovePlaybookConfirm(null); }}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    background: "var(--surface-secondary)",
                                    color: "var(--text-muted)",
                                    border: "1px solid var(--border-default)",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  No
                                </button>
                              </div>
                            )}

                            <Link href={`/x/playbooks/${playbook.id}`} style={{ color: "var(--text-placeholder)", textDecoration: "none", flexShrink: 0 }}>
                              →
                            </Link>
                          </div>
                        );
                      }}
                    />
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

              {/* Content Tab */}
              {activeTab === "content" && (
                <div>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>Subjects & Content Sources</h3>
                  {(!domain.subjects || domain.subjects.length === 0) ? (
                    <div style={{
                      padding: 32,
                      textAlign: "center",
                      background: "var(--surface-secondary)",
                      borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>
                        No subjects linked to this domain yet.
                      </div>
                      <Link
                        href="/x/subjects"
                        style={{
                          color: "var(--accent-primary)",
                          fontSize: 14,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        Go to Subjects to link one →
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {domain.subjects.map((sd) => {
                        const subj = sd.subject;
                        const totalAssertions = subj.sources.reduce(
                          (sum, ss) => sum + ss.source._count.assertions, 0
                        );
                        return (
                          <div
                            key={subj.id}
                            style={{
                              border: "1px solid var(--border-default)",
                              borderRadius: 8,
                              overflow: "hidden",
                            }}
                          >
                            {/* Subject header */}
                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "12px 16px",
                              background: "var(--surface-secondary)",
                            }}>
                              <div>
                                <Link
                                  href={`/x/subjects?id=${subj.id}`}
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                    textDecoration: "none",
                                  }}
                                >
                                  {subj.name}
                                </Link>
                                {subj.qualificationRef && (
                                  <span style={{
                                    marginLeft: 8,
                                    fontSize: 11,
                                    color: "var(--text-muted)",
                                    fontFamily: "monospace",
                                  }}>
                                    {subj.qualificationRef}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                                <span>{subj._count.sources} source{subj._count.sources !== 1 ? "s" : ""} / {totalAssertions} assertion{totalAssertions !== 1 ? "s" : ""}</span>
                                <Link
                                  href={`/x/content-wizard?subjectId=${subj.id}&domainId=${domain.id}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "2px 8px",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "var(--accent-primary)",
                                    background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                                    borderRadius: 4,
                                    textDecoration: "none",
                                  }}
                                >
                                  Add Content
                                </Link>
                                <Link
                                  href={`/x/domains/${domain.id}/extraction`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "2px 8px",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "#8b5cf6",
                                    background: "#ede9fe",
                                    borderRadius: 4,
                                    textDecoration: "none",
                                  }}
                                >
                                  Extraction Config
                                </Link>
                              </div>
                            </div>
                            {/* Sources list */}
                            {subj.sources.length > 0 ? (
                              <div style={{ padding: "8px 16px" }}>
                                {subj.sources.map((ss, idx) => (
                                  <div
                                    key={ss.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 12,
                                      padding: "8px 0",
                                      borderTop: idx > 0 ? "1px solid var(--border-subtle)" : "none",
                                    }}
                                  >
                                    <span style={{ color: "var(--text-muted)", fontSize: 14, width: 20 }}>
                                      {idx === subj.sources.length - 1 ? "└" : "├"}
                                    </span>
                                    {ss.tags?.length > 0 && (
                                      <span style={{
                                        display: "inline-block",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: "var(--text-muted)",
                                        background: "var(--surface-tertiary)",
                                        textTransform: "uppercase",
                                      }}>
                                        {ss.tags[0]}
                                      </span>
                                    )}
                                    <DocTypeBadge type={ss.source.documentType} />
                                    <Link
                                      href={`/x/content-sources?highlight=${ss.source.id}`}
                                      style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1, textDecoration: "none" }}
                                    >
                                      {ss.source.name}
                                    </Link>
                                    <TrustBadge level={ss.source.trustLevel} />
                                    <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 80, textAlign: "right" }}>
                                      {ss.source._count.assertions} assertion{ss.source._count.assertions !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                                No sources linked to this subject
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Onboarding Tab */}
              {activeTab === "onboarding" && (
                <OnboardingTabContent
                  domain={domain}
                  onDomainRefresh={() => {
                    fetch(`/api/domains/${domain.id}`)
                      .then((r) => r.json())
                      .then((data) => { if (data.ok) setDomain(data.domain); });
                  }}
                  onPreviewPrompt={() => setShowPromptPreview(true)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Domain Modal */}
      <CreateDomainModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setShowCreate(false);
          fetchDomains();
          router.push(`/x/domains?id=${id}`, { scroll: false });
        }}
        onError={(msg) => setError(msg)}
      />
      {/* Add Playbook Modal */}
      {domain && (
        <AddPlaybookModal
          domainId={domain.id}
          domainName={domain.name}
          open={showPlaybookModal}
          onClose={() => setShowPlaybookModal(false)}
          onPlaybookAdded={() => {
            setShowPlaybookModal(false);
            fetch(`/api/domains/${domain.id}`)
              .then((r) => r.json())
              .then((data) => { if (data.ok) setDomain(data.domain); });
            fetchDomains();
          }}
        />
      )}
      {/* Prompt Preview Modal */}
      {domain && (
        <PromptPreviewModal
          domainId={domain.id}
          domainName={domain.name}
          open={showPromptPreview}
          onClose={() => setShowPromptPreview(false)}
        />
      )}
      {/* AI Assistant */}
      <UnifiedAssistantPanel
        visible={assistant.isOpen}
        onClose={assistant.close}
        context={assistant.context}
        location={assistant.location}
        {...assistant.options}
      />
    </div>
  );
}
