"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FancySelect } from "@/components/shared/FancySelect";
import { PlaybookPill, CallerPill, StatusBadge } from "@/src/components/shared/EntityPill";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import { UnifiedAssistantPanel } from "@/components/shared/UnifiedAssistantPanel";
import { useAssistant, useAssistantKeyboardShortcut } from "@/hooks/useAssistant";
import { ReadinessBadge } from "@/components/shared/ReadinessBadge";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { BookOpen, Users, FileText, Rocket, Layers } from "lucide-react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

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

type SubjectSourceItem = {
  id: string;
  tags: string[];
  sortOrder: number;
  source: {
    id: string;
    slug: string;
    name: string;
    trustLevel: string;
    documentType?: string;
    _count: { assertions: number };
  };
};

type SubjectItem = {
  subject: {
    id: string;
    slug: string;
    name: string;
    qualificationRef?: string | null;
    sources: SubjectSourceItem[];
    _count: { sources: number };
  };
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
  subjects?: SubjectItem[];
  onboardingWelcome?: string | null;
  onboardingIdentitySpec?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  onboardingFlowPhases?: any;
  onboardingDefaultTargets?: any;
  _count: {
    callers: number;
    playbooks: number;
    subjects?: number;
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

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)" },
  { value: "EXPERT_CURATED", label: "L2 Expert", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)" },
  { value: "AI_ASSISTED", label: "L1 AI", color: "var(--trust-l1-text)", bg: "var(--trust-l1-bg)" },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "var(--trust-l0-text)", bg: "var(--trust-l0-bg)" },
];

function TrustBadge({ level }: { level: string }) {
  const config = TRUST_LEVELS.find((t) => t.value === level) || TRUST_LEVELS[5];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}

const DOC_TYPES: Record<string, { label: string; color: string }> = {
  CURRICULUM: { label: "Curriculum", color: "#4338CA" },
  TEXTBOOK: { label: "Textbook", color: "#059669" },
  WORKSHEET: { label: "Worksheet", color: "#D97706" },
  EXAMPLE: { label: "Example", color: "#7C3AED" },
  ASSESSMENT: { label: "Assessment", color: "#DC2626" },
  REFERENCE: { label: "Reference", color: "#6B7280" },
};

function DocTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const cfg = DOC_TYPES[type] || { label: type, color: "#6B7280" };
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 600,
      color: cfg.color,
      backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
    }}>
      {cfg.label}
    </span>
  );
}

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
  const [activeTab, setActiveTab] = useState<"callers" | "playbooks" | "content" | "onboarding">("playbooks");
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [creatingPlaybook, setCreatingPlaybook] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: "", description: "" });
  const [allPlaybooks, setAllPlaybooks] = useState<Playbook[]>([]);
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);
  const [modalTab, setModalTab] = useState<"create" | "existing">("existing");
  const [movingPlaybookId, setMovingPlaybookId] = useState<string | null>(null);

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

  // Keyboard shortcut for assistant
  useAssistantKeyboardShortcut(assistant.toggle);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Onboarding editing state
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    welcomeMessage: "",
    identitySpecId: "",
    flowPhases: "",
    defaultTargets: "",
  });
  const [flowPhasesMode, setFlowPhasesMode] = useState<"visual" | "json">("visual");
  const [defaultTargetsMode, setDefaultTargetsMode] = useState<"visual" | "json">("visual");
  const [structuredPhases, setStructuredPhases] = useState<Array<{
    phase: string;
    duration: string;
    goals: string[];
    content?: Array<{ mediaId: string; instruction?: string }>;
  }>>([]);
  const [domainMedia, setDomainMedia] = useState<Array<{ id: string; title: string | null; fileName: string; mimeType: string }>>([]);
  const [structuredTargets, setStructuredTargets] = useState<Record<string, { value: number; confidence: number }>>({});
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingSaveError, setOnboardingSaveError] = useState<string | null>(null);
  const [onboardingSaveSuccess, setOnboardingSaveSuccess] = useState(false);
  const [availableSpecs, setAvailableSpecs] = useState<Array<{ id: string; slug: string; name: string }>>([]);

  // Prompt preview state
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false);
  const [promptPreviewData, setPromptPreviewData] = useState<{
    promptSummary: string;
    voicePrompt: string;
    llmPrompt: any;
    metadata: any;
    createdPreviewCaller: boolean;
  } | null>(null);
  const [promptPreviewError, setPromptPreviewError] = useState<string | null>(null);
  const [promptPreviewTab, setPromptPreviewTab] = useState<"summary" | "voice" | "json">("summary");

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

  // Fetch onboarding data when Onboarding tab is selected
  useEffect(() => {
    if (activeTab === "onboarding" && domain) {
      fetch(`/api/domains/${domain.id}/onboarding`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            // Merge onboarding-specific data into domain
            setDomain((prev) => prev ? { ...prev, ...data.domain } : data.domain);
          }
        })
        .catch((err) => {
          console.error("Error fetching onboarding data:", err);
        });
    }
  }, [activeTab, domain?.id]);

  // Fetch available identity specs for onboarding tab
  useEffect(() => {
    if (activeTab === "onboarding" && availableSpecs.length === 0) {
      fetch("/api/specs?role=IDENTITY")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setAvailableSpecs(data.specs || []);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, availableSpecs.length]);

  // Fetch domain media for onboarding phase content picker
  useEffect(() => {
    if (editingOnboarding && domain) {
      const subjectIds = ((domain as any).subjects || []).map((s: any) => s.subject?.id || s.subjectId);
      const validIds = subjectIds.filter(Boolean);
      if (validIds.length === 0) { setDomainMedia([]); return; }
      Promise.all(
        validIds.map((sid: string) =>
          fetch(`/api/subjects/${sid}/media`).then((r) => r.json())
        )
      ).then((results) => {
        const allMedia: Array<{ id: string; title: string | null; fileName: string; mimeType: string }> = [];
        const seen = new Set<string>();
        for (const result of results) {
          for (const item of result.media || []) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              allMedia.push({ id: item.id, title: item.title, fileName: item.fileName, mimeType: item.mimeType });
            }
          }
        }
        setDomainMedia(allMedia);
      }).catch(() => setDomainMedia([]));
    }
  }, [editingOnboarding, domain?.id]);

  // Populate form when entering edit mode - fetch onboarding data to get identity spec
  useEffect(() => {
    if (editingOnboarding && domain) {
      // Fetch full onboarding config including identity spec relation
      fetch(`/api/domains/${domain.id}/onboarding`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            const onboardingData = data.domain;
            const flowPhasesJson = onboardingData.onboardingFlowPhases ? JSON.stringify(onboardingData.onboardingFlowPhases, null, 2) : "";
            const defaultTargetsJson = onboardingData.onboardingDefaultTargets ? JSON.stringify(onboardingData.onboardingDefaultTargets, null, 2) : "";

            setOnboardingForm({
              welcomeMessage: onboardingData.onboardingWelcome || "",
              identitySpecId: onboardingData.onboardingIdentitySpecId || "",
              flowPhases: flowPhasesJson,
              defaultTargets: defaultTargetsJson,
            });

            // Parse structured data
            if (onboardingData.onboardingFlowPhases?.phases) {
              setStructuredPhases(onboardingData.onboardingFlowPhases.phases);
            } else {
              setStructuredPhases([]);
            }

            if (onboardingData.onboardingDefaultTargets) {
              setStructuredTargets(onboardingData.onboardingDefaultTargets);
            } else {
              setStructuredTargets({});
            }
          }
        })
        .catch((err) => {
          console.error("Error fetching onboarding config:", err);
          // Fallback to existing domain data if fetch fails
          const flowPhasesJson = domain.onboardingFlowPhases ? JSON.stringify(domain.onboardingFlowPhases, null, 2) : "";
          const defaultTargetsJson = domain.onboardingDefaultTargets ? JSON.stringify(domain.onboardingDefaultTargets, null, 2) : "";

          setOnboardingForm({
            welcomeMessage: domain.onboardingWelcome || "",
            identitySpecId: "",
            flowPhases: flowPhasesJson,
            defaultTargets: defaultTargetsJson,
          });
        });
    }
  }, [editingOnboarding, domain?.id]);

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

  const handleSaveOnboarding = async () => {
    if (!domain) return;

    setSavingOnboarding(true);
    setOnboardingSaveError(null);
    setOnboardingSaveSuccess(false);

    try {
      // Parse JSON fields or use structured data
      let flowPhases = null;
      let defaultTargets = null;

      if (flowPhasesMode === "visual") {
        // Use structured phases
        if (structuredPhases.length > 0) {
          flowPhases = { phases: structuredPhases };
        }
      } else {
        // Parse JSON
        if (onboardingForm.flowPhases.trim()) {
          try {
            flowPhases = JSON.parse(onboardingForm.flowPhases);
          } catch (e) {
            throw new Error("Invalid JSON in Flow Phases");
          }
        }
      }

      if (defaultTargetsMode === "visual") {
        // Use structured targets
        if (Object.keys(structuredTargets).length > 0) {
          defaultTargets = structuredTargets;
        }
      } else {
        // Parse JSON
        if (onboardingForm.defaultTargets.trim()) {
          try {
            defaultTargets = JSON.parse(onboardingForm.defaultTargets);
          } catch (e) {
            throw new Error("Invalid JSON in Default Targets");
          }
        }
      }

      const res = await fetch(`/api/domains/${domain.id}/onboarding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingWelcome: onboardingForm.welcomeMessage || null,
          onboardingIdentitySpecId: onboardingForm.identitySpecId || null,
          onboardingFlowPhases: flowPhases,
          onboardingDefaultTargets: defaultTargets,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to save onboarding configuration");
      }

      // Refresh domain data - use onboarding endpoint to get full data including identity spec
      const refreshRes = await fetch(`/api/domains/${domain.id}/onboarding`);
      const refreshData = await refreshRes.json();
      if (refreshData.ok) {
        // Update domain with onboarding data
        setDomain((prev) => prev ? { ...prev, ...refreshData.domain } : refreshData.domain);
      }

      setOnboardingSaveSuccess(true);
      setEditingOnboarding(false);

      // Clear success message after 3 seconds
      setTimeout(() => setOnboardingSaveSuccess(false), 3000);
    } catch (e: any) {
      setOnboardingSaveError(e.message || "Failed to save");
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handlePreviewPrompt = async () => {
    if (!domain) return;
    setPromptPreviewLoading(true);
    setPromptPreviewError(null);
    setShowPromptPreview(true);
    setPromptPreviewTab("summary");

    try {
      const res = await fetch(`/api/domains/${domain.id}/preview-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to generate preview");
      setPromptPreviewData(data);
    } catch (e: any) {
      setPromptPreviewError(e.message || "Failed to generate preview");
    } finally {
      setPromptPreviewLoading(false);
    }
  };

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

                            {/* Remove + Arrow */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {showRemovePlaybookConfirm === playbook.id ? (
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
                              ) : (
                                <button
                                  onClick={(e) => { e.preventDefault(); setShowRemovePlaybookConfirm(playbook.id); }}
                                  title="Remove playbook from domain"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    padding: 0,
                                    background: "transparent",
                                    color: "var(--text-placeholder)",
                                    border: "1px solid transparent",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#fef2f2";
                                    e.currentTarget.style.color = "#dc2626";
                                    e.currentTarget.style.borderColor = "#fca5a5";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.color = "var(--text-placeholder)";
                                    e.currentTarget.style.borderColor = "transparent";
                                  }}
                                >
                                  ×
                                </button>
                              )}
                              <Link href={`/x/playbooks/${playbook.id}`} style={{ color: "var(--text-placeholder)", textDecoration: "none" }}>
                                →
                              </Link>
                            </div>
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
                                      borderTop: idx > 0 ? "1px solid var(--border-secondary)" : "none",
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
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                        First-Call Onboarding Configuration
                      </h3>
                      <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
                        Customize the onboarding experience for new callers in this domain
                      </p>
                    </div>
                    {!editingOnboarding && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handlePreviewPrompt}
                          disabled={promptPreviewLoading}
                          style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            background: "transparent",
                            color: "var(--accent-primary)",
                            border: "1px solid var(--accent-primary)",
                            borderRadius: 6,
                            cursor: promptPreviewLoading ? "wait" : "pointer",
                            opacity: promptPreviewLoading ? 0.6 : 1,
                          }}
                        >
                          {promptPreviewLoading ? "Composing..." : "Preview First Prompt"}
                        </button>
                        <button
                          onClick={() => setEditingOnboarding(true)}
                          style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            background: "var(--accent-primary)",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Edit Configuration
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Success Message */}
                  {onboardingSaveSuccess && (
                    <div style={{
                      padding: 12,
                      marginBottom: 16,
                      background: "#dcfce7",
                      color: "#166534",
                      borderRadius: 8,
                      fontSize: 14,
                    }}>
                      ✅ Onboarding configuration saved successfully
                    </div>
                  )}

                  {/* Error Message */}
                  {onboardingSaveError && (
                    <div style={{
                      padding: 12,
                      marginBottom: 16,
                      background: "var(--status-error-bg)",
                      color: "var(--status-error-text)",
                      borderRadius: 8,
                      fontSize: 14,
                    }}>
                      {onboardingSaveError}
                    </div>
                  )}

                  {editingOnboarding ? (
                    /* Edit Mode */
                    <div style={{
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      padding: 20,
                    }}>
                      {/* Welcome Message */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                          Welcome Message
                        </label>
                        <textarea
                          value={onboardingForm.welcomeMessage}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, welcomeMessage: e.target.value })}
                          placeholder="Enter the welcome message for first-time callers..."
                          style={{
                            width: "100%",
                            minHeight: 120,
                            padding: 12,
                            fontSize: 14,
                            border: "2px solid var(--border-default)",
                            borderRadius: 6,
                            fontFamily: "inherit",
                            resize: "vertical",
                          }}
                        />
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          This message is shown to new callers on their first call
                        </div>
                      </div>

                      {/* Identity Spec */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                          Identity Spec
                        </label>
                        <select
                          value={onboardingForm.identitySpecId}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, identitySpecId: e.target.value })}
                          style={{
                            width: "100%",
                            padding: 12,
                            fontSize: 14,
                            border: "2px solid var(--border-default)",
                            borderRadius: 6,
                            background: "var(--surface-primary)",
                          }}
                        >
                          <option value="">Use default identity spec</option>
                          {availableSpecs.map((spec) => (
                            <option key={spec.id} value={spec.id}>
                              {spec.name} ({spec.slug})
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          Which identity/persona spec to use for onboarding
                        </div>
                      </div>

                      {/* Flow Phases */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <label style={{ fontSize: 14, fontWeight: 600 }}>
                            Flow Phases
                          </label>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => setFlowPhasesMode("visual")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: flowPhasesMode === "visual" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: flowPhasesMode === "visual" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              Visual
                            </button>
                            <button
                              onClick={() => setFlowPhasesMode("json")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: flowPhasesMode === "json" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: flowPhasesMode === "json" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              JSON
                            </button>
                          </div>
                        </div>

                        {flowPhasesMode === "visual" ? (
                          /* Visual Editor */
                          <div>
                            {structuredPhases.map((phase, index) => (
                              <div
                                key={index}
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  marginBottom: 12,
                                  padding: 16,
                                  background: "var(--surface-primary)",
                                  border: "2px solid var(--border-default)",
                                  borderRadius: 8,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                }}
                              >
                                {/* Drag Handle & Reorder */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
                                  <button
                                    onClick={() => {
                                      if (index === 0) return;
                                      const newPhases = [...structuredPhases];
                                      [newPhases[index - 1], newPhases[index]] = [newPhases[index], newPhases[index - 1]];
                                      setStructuredPhases(newPhases);
                                    }}
                                    disabled={index === 0}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      padding: 0,
                                      fontSize: 14,
                                      background: index === 0 ? "var(--surface-tertiary)" : "var(--surface-secondary)",
                                      border: "1px solid var(--border-default)",
                                      borderRadius: 4,
                                      cursor: index === 0 ? "not-allowed" : "pointer",
                                      opacity: index === 0 ? 0.3 : 1,
                                    }}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (index === structuredPhases.length - 1) return;
                                      const newPhases = [...structuredPhases];
                                      [newPhases[index], newPhases[index + 1]] = [newPhases[index + 1], newPhases[index]];
                                      setStructuredPhases(newPhases);
                                    }}
                                    disabled={index === structuredPhases.length - 1}
                                    style={{
                                      width: 24,
                                      height: 24,
                                      padding: 0,
                                      fontSize: 14,
                                      background: index === structuredPhases.length - 1 ? "var(--surface-tertiary)" : "var(--surface-secondary)",
                                      border: "1px solid var(--border-default)",
                                      borderRadius: 4,
                                      cursor: index === structuredPhases.length - 1 ? "not-allowed" : "pointer",
                                      opacity: index === structuredPhases.length - 1 ? 0.3 : 1,
                                    }}
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                </div>

                                {/* Phase Content */}
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{
                                        width: 28,
                                        height: 28,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "var(--accent-primary)",
                                        color: "white",
                                        borderRadius: "50%",
                                        fontSize: 13,
                                        fontWeight: 600,
                                      }}>
                                        {index + 1}
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                                        Phase {index + 1}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newPhases = structuredPhases.filter((_, i) => i !== index);
                                        setStructuredPhases(newPhases);
                                      }}
                                      style={{
                                        padding: "4px 12px",
                                        fontSize: 11,
                                        fontWeight: 500,
                                        background: "var(--status-error-bg)",
                                        color: "var(--status-error-text)",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                      }}
                                    >
                                      × Remove
                                    </button>
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 10, marginBottom: 10 }}>
                                    <div>
                                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                        Phase Name
                                      </label>
                                      <input
                                        type="text"
                                        value={phase.phase}
                                        onChange={(e) => {
                                          const newPhases = [...structuredPhases];
                                          newPhases[index].phase = e.target.value;
                                          setStructuredPhases(newPhases);
                                        }}
                                        placeholder="e.g., welcome, orient, discover"
                                        style={{
                                          width: "100%",
                                          padding: 10,
                                          fontSize: 14,
                                          border: "2px solid var(--border-default)",
                                          borderRadius: 6,
                                          background: "var(--surface-secondary)",
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                        Duration
                                      </label>
                                      <input
                                        type="text"
                                        value={phase.duration}
                                        onChange={(e) => {
                                          const newPhases = [...structuredPhases];
                                          newPhases[index].duration = e.target.value;
                                          setStructuredPhases(newPhases);
                                        }}
                                        placeholder="e.g., 2min"
                                        style={{
                                          width: "100%",
                                          padding: 10,
                                          fontSize: 14,
                                          border: "2px solid var(--border-default)",
                                          borderRadius: 6,
                                          background: "var(--surface-secondary)",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                      Goals (one per line)
                                    </label>
                                    <textarea
                                      value={phase.goals.join("\n")}
                                      onChange={(e) => {
                                        const newPhases = [...structuredPhases];
                                        newPhases[index].goals = e.target.value.split("\n").filter(g => g.trim());
                                        setStructuredPhases(newPhases);
                                      }}
                                      placeholder="Enter goals for this phase..."
                                      style={{
                                        width: "100%",
                                        minHeight: 80,
                                        padding: 10,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        border: "2px solid var(--border-default)",
                                        borderRadius: 6,
                                        background: "var(--surface-secondary)",
                                        resize: "vertical",
                                      }}
                                    />
                                  </div>

                                  {/* Phase Content — media to share during this phase */}
                                  <div style={{ marginTop: 10 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                      Content to Share
                                    </label>
                                    {(phase.content || []).map((ref, ci) => {
                                      const media = domainMedia.find(m => m.id === ref.mediaId);
                                      return (
                                        <div key={ci} style={{
                                          display: "flex", gap: 8, alignItems: "center", marginBottom: 6,
                                          padding: "6px 8px", background: "var(--surface-tertiary)", borderRadius: 6,
                                          border: "1px solid var(--border-default)",
                                        }}>
                                          <span style={{ fontSize: 14 }}>
                                            {media?.mimeType?.startsWith("image/") ? "🖼️" : media?.mimeType === "application/pdf" ? "📄" : media?.mimeType?.startsWith("audio/") ? "🔊" : "📎"}
                                          </span>
                                          <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {media?.title || media?.fileName || ref.mediaId}
                                          </span>
                                          <input
                                            type="text"
                                            value={ref.instruction || ""}
                                            onChange={(e) => {
                                              const newPhases = [...structuredPhases];
                                              const contentArr = [...(newPhases[index].content || [])];
                                              contentArr[ci] = { ...contentArr[ci], instruction: e.target.value };
                                              newPhases[index].content = contentArr;
                                              setStructuredPhases(newPhases);
                                            }}
                                            placeholder="Instruction (e.g. Share at start of phase)"
                                            style={{
                                              flex: 2, padding: "4px 8px", fontSize: 12,
                                              border: "1px solid var(--border-default)", borderRadius: 4,
                                              background: "var(--surface-secondary)",
                                            }}
                                          />
                                          <button
                                            onClick={() => {
                                              const newPhases = [...structuredPhases];
                                              newPhases[index].content = (newPhases[index].content || []).filter((_, i) => i !== ci);
                                              setStructuredPhases(newPhases);
                                            }}
                                            style={{
                                              padding: "2px 8px", fontSize: 11, color: "var(--status-error-text)",
                                              background: "var(--status-error-bg)", border: "none", borderRadius: 4, cursor: "pointer",
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      );
                                    })}
                                    {domainMedia.length > 0 ? (
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          const newPhases = [...structuredPhases];
                                          const existing = newPhases[index].content || [];
                                          if (existing.some(c => c.mediaId === e.target.value)) return;
                                          newPhases[index].content = [...existing, { mediaId: e.target.value }];
                                          setStructuredPhases(newPhases);
                                        }}
                                        style={{
                                          width: "100%", padding: "6px 8px", fontSize: 12,
                                          border: "1px dashed var(--border-default)", borderRadius: 4,
                                          background: "var(--surface-secondary)", color: "var(--text-secondary)",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <option value="">+ Attach media to this phase...</option>
                                        {domainMedia
                                          .filter(m => !(phase.content || []).some(c => c.mediaId === m.id))
                                          .map(m => (
                                            <option key={m.id} value={m.id}>
                                              {m.title || m.fileName} ({m.mimeType.split("/")[1]})
                                            </option>
                                          ))
                                        }
                                      </select>
                                    ) : (
                                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                                        No media uploaded to this domain&apos;s subjects yet
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                setStructuredPhases([...structuredPhases, { phase: "", duration: "", goals: [] }]);
                              }}
                              style={{
                                width: "100%",
                                padding: 10,
                                fontSize: 14,
                                fontWeight: 500,
                                background: "var(--surface-secondary)",
                                color: "var(--text-primary)",
                                border: "1px dashed var(--border-default)",
                                borderRadius: 6,
                                cursor: "pointer",
                              }}
                            >
                              + Add Phase
                            </button>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                              Define the onboarding flow phases (leave empty to use defaults)
                            </div>
                          </div>
                        ) : (
                          /* JSON Editor */
                          <div>
                            <textarea
                              value={onboardingForm.flowPhases}
                              onChange={(e) => setOnboardingForm({ ...onboardingForm, flowPhases: e.target.value })}
                              placeholder='{"phases": [{"phase": "welcome", "duration": "2min", "goals": ["..."]}]}'
                              style={{
                                width: "100%",
                                minHeight: 200,
                                padding: 12,
                                fontSize: 13,
                                fontFamily: "monospace",
                                border: "2px solid var(--border-default)",
                                borderRadius: 6,
                                resize: "vertical",
                              }}
                            />
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                              Define the onboarding flow phases in JSON format
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Default Targets */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <label style={{ fontSize: 14, fontWeight: 600 }}>
                            Default Behavior Targets
                          </label>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => setDefaultTargetsMode("visual")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: defaultTargetsMode === "visual" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: defaultTargetsMode === "visual" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              Visual
                            </button>
                            <button
                              onClick={() => setDefaultTargetsMode("json")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: defaultTargetsMode === "json" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: defaultTargetsMode === "json" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              JSON
                            </button>
                          </div>
                        </div>

                        {defaultTargetsMode === "visual" ? (
                          /* Visual Editor with Vertical Sliders */
                          <div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                              {Object.entries(structuredTargets).map(([paramId, target]) => (
                              <div
                                key={paramId}
                                style={{
                                  padding: 16,
                                  background: "var(--surface-primary)",
                                  border: "2px solid var(--border-default)",
                                  borderRadius: 8,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                {/* Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
                                    {paramId}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newTargets = { ...structuredTargets };
                                      delete newTargets[paramId];
                                      setStructuredTargets(newTargets);
                                    }}
                                    style={{
                                      padding: "2px 8px",
                                      fontSize: 10,
                                      fontWeight: 500,
                                      background: "var(--status-error-bg)",
                                      color: "var(--status-error-text)",
                                      border: "none",
                                      borderRadius: 4,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>

                                {/* Vertical Sliders Container */}
                                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", gap: 20, flex: 1 }}>
                                  {/* Value Slider */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                      Value
                                    </label>
                                    <span style={{
                                      fontSize: 15,
                                      fontWeight: 700,
                                      color: "var(--accent-primary)",
                                      fontFamily: "monospace",
                                      marginBottom: 8,
                                      minHeight: 20,
                                    }}>
                                      {target.value.toFixed(2)}
                                    </span>

                                    {/* Vertical Slider Wrapper */}
                                    <div style={{ position: "relative", height: 180, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                      {/* Scale markers */}
                                      <div style={{ position: "absolute", right: -24, top: -6, fontSize: 9, color: "var(--text-muted)" }}>1.0</div>
                                      <div style={{ position: "absolute", right: -24, top: 84, fontSize: 9, color: "var(--text-muted)" }}>0.5</div>
                                      <div style={{ position: "absolute", right: -24, bottom: -6, fontSize: 9, color: "var(--text-muted)" }}>0.0</div>

                                      {/* Vertical range input */}
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={target.value}
                                        onChange={(e) => {
                                          const newTargets = { ...structuredTargets };
                                          newTargets[paramId].value = parseFloat(e.target.value);
                                          setStructuredTargets(newTargets);
                                        }}
                                        style={{
                                          WebkitAppearance: "slider-vertical",
                                          width: 6,
                                          height: 180,
                                          borderRadius: 3,
                                          background: `linear-gradient(to top, var(--accent-primary) 0%, var(--accent-primary) ${target.value * 100}%, var(--surface-tertiary) ${target.value * 100}%, var(--surface-tertiary) 100%)`,
                                          outline: "none",
                                          cursor: "pointer",
                                          writingMode: "vertical-lr" as React.CSSProperties["writingMode"],
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Confidence Slider */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                      Confidence
                                    </label>
                                    <span style={{
                                      fontSize: 15,
                                      fontWeight: 700,
                                      color: "var(--accent-primary)",
                                      fontFamily: "monospace",
                                      marginBottom: 8,
                                      minHeight: 20,
                                    }}>
                                      {target.confidence.toFixed(2)}
                                    </span>

                                    {/* Vertical Slider Wrapper */}
                                    <div style={{ position: "relative", height: 180, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                      {/* Scale markers */}
                                      <div style={{ position: "absolute", left: -24, top: -6, fontSize: 9, color: "var(--text-muted)" }}>1.0</div>
                                      <div style={{ position: "absolute", left: -24, top: 84, fontSize: 9, color: "var(--text-muted)" }}>0.5</div>
                                      <div style={{ position: "absolute", left: -24, bottom: -6, fontSize: 9, color: "var(--text-muted)" }}>0.0</div>

                                      {/* Vertical range input */}
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={target.confidence}
                                        onChange={(e) => {
                                          const newTargets = { ...structuredTargets };
                                          newTargets[paramId].confidence = parseFloat(e.target.value);
                                          setStructuredTargets(newTargets);
                                        }}
                                        style={{
                                          WebkitAppearance: "slider-vertical",
                                          width: 6,
                                          height: 180,
                                          borderRadius: 3,
                                          background: `linear-gradient(to top, var(--accent-primary) 0%, var(--accent-primary) ${target.confidence * 100}%, var(--surface-tertiary) ${target.confidence * 100}%, var(--surface-tertiary) 100%)`,
                                          outline: "none",
                                          cursor: "pointer",
                                          writingMode: "vertical-lr" as React.CSSProperties["writingMode"],
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add Parameter Section */}
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                type="text"
                                id="newParamId"
                                placeholder="Parameter ID (e.g., warmth)"
                                style={{
                                  flex: 1,
                                  padding: 10,
                                  fontSize: 14,
                                  border: "1px solid var(--border-default)",
                                  borderRadius: 6,
                                }}
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById("newParamId") as HTMLInputElement;
                                  const paramId = input.value.trim();
                                  if (paramId && !structuredTargets[paramId]) {
                                    setStructuredTargets({
                                      ...structuredTargets,
                                      [paramId]: { value: 0.5, confidence: 0.3 },
                                    });
                                    input.value = "";
                                  }
                                }}
                                style={{
                                  padding: "10px 20px",
                                  fontSize: 14,
                                  fontWeight: 500,
                                  background: "var(--accent-primary)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                }}
                              >
                                Add Parameter
                              </button>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                              Default behavior parameter values for first-time callers (leave empty to use defaults)
                            </div>
                          </div>
                          </div>
                        ) : (
                          /* JSON Editor */
                          <div>
                            <textarea
                              value={onboardingForm.defaultTargets}
                              onChange={(e) => setOnboardingForm({ ...onboardingForm, defaultTargets: e.target.value })}
                              placeholder='{"warmth": {"value": 0.7, "confidence": 0.3}, ...}'
                              style={{
                                width: "100%",
                                minHeight: 200,
                                padding: 12,
                                fontSize: 13,
                                fontFamily: "monospace",
                                border: "2px solid var(--border-default)",
                                borderRadius: 6,
                                resize: "vertical",
                              }}
                            />
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                              Default behavior parameter values in JSON format
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => {
                            setEditingOnboarding(false);
                            setOnboardingSaveError(null);
                          }}
                          disabled={savingOnboarding}
                          style={{
                            padding: "10px 20px",
                            fontSize: 14,
                            fontWeight: 500,
                            background: "var(--surface-secondary)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 6,
                            cursor: savingOnboarding ? "not-allowed" : "pointer",
                            opacity: savingOnboarding ? 0.5 : 1,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveOnboarding}
                          disabled={savingOnboarding}
                          style={{
                            padding: "10px 24px",
                            fontSize: 14,
                            fontWeight: 600,
                            background: savingOnboarding ? "#d1d5db" : "var(--accent-primary)",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: savingOnboarding ? "not-allowed" : "pointer",
                          }}
                        >
                          {savingOnboarding ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>

                  {/* Quick Stats - Dashboard Style */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16,
                    marginBottom: 24,
                  }}>
                    {/* Identity Spec Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingIdentitySpec ? "#10b981" : "#ef4444"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingIdentitySpec ? "👤" : "⚠️"}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: domain.onboardingIdentitySpec ? "#10b981" : "#ef4444",
                        textAlign: "center",
                        marginBottom: 4,
                      }}>
                        {domain.onboardingIdentitySpec?.name || "Not Set"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Identity Spec
                      </div>
                      {domain.onboardingIdentitySpec && (
                        <Link
                          href={`/x/layers?overlayId=${domain.onboardingIdentitySpec.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 8,
                            padding: "3px 10px",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#6366f1",
                            background: "#e0e7ff",
                            borderRadius: 4,
                            textDecoration: "none",
                            transition: "opacity 0.15s",
                          }}
                        >
                          <Layers style={{ width: 12, height: 12 }} />
                          View Layers
                        </Link>
                      )}
                    </div>

                    {/* Welcome Message Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingWelcome ? "#10b981" : "#d1d5db"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingWelcome ? "✅" : "💬"}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: domain.onboardingWelcome ? "#10b981" : "var(--text-muted)",
                        textAlign: "center",
                        marginBottom: 4,
                      }}>
                        {domain.onboardingWelcome ? "Configured" : "Default"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Welcome Message
                      </div>
                    </div>

                    {/* Flow Phases Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingFlowPhases ? "#10b981" : "#d1d5db"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingFlowPhases ? "🔄" : "⏭️"}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: domain.onboardingFlowPhases ? "var(--button-primary-bg)" : "var(--text-muted)",
                        lineHeight: 1,
                        marginBottom: 4,
                      }}>
                        {domain.onboardingFlowPhases ?
                          (domain.onboardingFlowPhases as any).phases?.length || 0 :
                          "0"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Flow Phases
                      </div>
                    </div>

                    {/* Default Targets Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingDefaultTargets ? "#10b981" : "#d1d5db"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingDefaultTargets ? "🎯" : "⚙️"}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: domain.onboardingDefaultTargets ? "var(--button-primary-bg)" : "var(--text-muted)",
                        lineHeight: 1,
                        marginBottom: 4,
                      }}>
                        {domain.onboardingDefaultTargets ?
                          Object.keys(domain.onboardingDefaultTargets as object).length :
                          "0"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Default Targets
                      </div>
                    </div>
                  </div>

                  {/* Welcome Message Preview */}
                  {domain.onboardingWelcome && (
                    <div style={{
                      padding: 16,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      marginBottom: 20,
                    }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600 }}>
                        Welcome Message Preview
                      </h4>
                      <div style={{
                        padding: 16,
                        background: "var(--surface-tertiary)",
                        borderRadius: 6,
                        fontSize: 14,
                        lineHeight: 1.6,
                        fontStyle: "italic",
                      }}>
                        "{domain.onboardingWelcome}"
                      </div>
                    </div>
                  )}

                  {/* Flow Phases Visual */}
                  {domain.onboardingFlowPhases && (domain.onboardingFlowPhases as any).phases && (
                    <div style={{
                      padding: 20,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                      marginBottom: 20,
                    }}>
                      <h4 style={{
                        margin: "0 0 16px 0",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}>
                        <span style={{ fontSize: 20 }}>🔄</span>
                        Onboarding Flow Phases
                      </h4>
                      <div style={{
                        display: "flex",
                        gap: 16,
                        overflowX: "auto",
                        paddingBottom: 8,
                      }}>
                        {((domain.onboardingFlowPhases as any).phases || []).map((phase: any, idx: number) => (
                          <div key={idx} style={{
                            minWidth: 220,
                            padding: 20,
                            background: "var(--surface-primary)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 12,
                            position: "relative",
                            transition: "all 0.2s",
                          }}
                          className="phase-card">
                            <div style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              background: "var(--button-primary-bg)",
                              color: "white",
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}>
                              {idx + 1}
                            </div>
                            <div style={{
                              fontSize: 16,
                              fontWeight: 700,
                              marginBottom: 12,
                              marginTop: 8,
                              color: "var(--button-primary-bg)",
                              textTransform: "capitalize",
                            }}>
                              {phase.phase}
                            </div>
                            <div style={{
                              fontSize: 13,
                              color: "var(--text-muted)",
                              marginBottom: 16,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 10px",
                              background: "var(--surface-secondary)",
                              borderRadius: 6,
                              fontWeight: 500,
                            }}>
                              <span>⏱️</span>
                              <span>{phase.duration}</span>
                            </div>
                            {phase.goals && phase.goals.length > 0 && (
                              <div>
                                <div style={{
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                  marginBottom: 8,
                                  fontWeight: 700,
                                  letterSpacing: "0.5px",
                                  textTransform: "uppercase",
                                }}>
                                  Goals
                                </div>
                                <ul style={{
                                  margin: 0,
                                  paddingLeft: 18,
                                  fontSize: 13,
                                  lineHeight: 1.6,
                                  color: "var(--text-secondary)",
                                }}>
                                  {phase.goals.map((goal: string, gIdx: number) => (
                                    <li key={gIdx} style={{ marginBottom: 4 }}>{goal}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {phase.content && phase.content.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <div style={{
                                  fontSize: 10, color: "var(--text-muted)", marginBottom: 6,
                                  fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                                }}>
                                  Content
                                </div>
                                {phase.content.map((ref: any, cIdx: number) => (
                                  <div key={cIdx} style={{
                                    fontSize: 12, padding: "4px 8px", background: "var(--surface-tertiary)",
                                    borderRadius: 4, marginBottom: 4, display: "flex", alignItems: "center", gap: 6,
                                  }}>
                                    <span>📎</span>
                                    <span style={{ fontWeight: 500 }}>{ref.instruction || "Media attached"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default Targets Visual */}
                  {domain.onboardingDefaultTargets && Object.keys(domain.onboardingDefaultTargets as object).length > 0 && (
                    <div style={{
                      padding: 16,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                    }}>
                      <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>
                        Default Parameter Targets
                      </h4>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 12,
                      }}>
                        {Object.entries(domain.onboardingDefaultTargets as object).map(([param, data]: [string, any]) => {
                          const value = data.value ?? data;
                          const confidence = data.confidence ?? null;
                          const normalizedValue = typeof value === 'number' ? value : 0;
                          const percentage = Math.round(normalizedValue * 100);

                          return (
                            <div key={param} style={{
                              padding: 12,
                              background: "var(--surface-secondary)",
                              border: "1px solid var(--border-default)",
                              borderRadius: 6,
                            }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 8,
                                color: "var(--text-primary)",
                                textTransform: "capitalize",
                              }}>
                                {param.replace(/_/g, " ")}
                              </div>
                              <div style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 6,
                                marginBottom: 8,
                              }}>
                                <div style={{
                                  fontSize: 24,
                                  fontWeight: 700,
                                  color: "var(--accent-primary)",
                                }}>
                                  {percentage}%
                                </div>
                                <div style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                }}>
                                  ({normalizedValue.toFixed(2)})
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div style={{
                                width: "100%",
                                height: 4,
                                background: "var(--surface-tertiary)",
                                borderRadius: 2,
                                overflow: "hidden",
                                marginBottom: confidence !== null ? 8 : 0,
                              }}>
                                <div style={{
                                  width: `${percentage}%`,
                                  height: "100%",
                                  background: "var(--accent-primary)",
                                  transition: "width 0.3s ease",
                                }} />
                              </div>
                              {confidence !== null && (
                                <div style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}>
                                  <span>Confidence:</span>
                                  <span style={{ fontWeight: 600 }}>
                                    {Math.round(confidence * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hover Styles for Onboarding Cards */}
                  <style>{`
                    .phase-card:hover {
                      border-color: var(--button-primary-bg) !important;
                      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
                      transform: translateY(-2px);
                    }
                  `}</style>
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

      {/* Prompt Preview Modal */}
      {showPromptPreview && (
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
          onClick={() => setShowPromptPreview(false)}
        >
          <div
            style={{
              background: "var(--surface-primary)",
              borderRadius: 12,
              width: 900,
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  Prompt Preview &mdash; {domain?.name}
                </h2>
                <button
                  onClick={() => setShowPromptPreview(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: "4px 8px",
                  }}
                >
                  &times;
                </button>
              </div>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, marginTop: 12 }}>
                {(["summary", "voice", "json"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPromptPreviewTab(tab)}
                    style={{
                      flex: 1,
                      padding: "8px 16px",
                      background: "none",
                      border: "none",
                      borderBottom: promptPreviewTab === tab
                        ? "2px solid var(--accent-primary)"
                        : "2px solid transparent",
                      color: promptPreviewTab === tab
                        ? "var(--accent-primary)"
                        : "var(--text-muted)",
                      fontWeight: promptPreviewTab === tab ? 600 : 400,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {tab === "summary" ? "Full Summary" : tab === "voice" ? "Voice Prompt" : "Raw JSON"}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {promptPreviewLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  Composing first-call prompt...
                </div>
              ) : promptPreviewError ? (
                <div style={{
                  padding: 16,
                  background: "var(--status-error-bg)",
                  color: "var(--status-error-text)",
                  borderRadius: 8,
                  fontSize: 14,
                }}>
                  {promptPreviewError}
                </div>
              ) : promptPreviewData ? (
                <>
                  {/* Metadata bar */}
                  <div style={{
                    marginBottom: 16,
                    padding: 12,
                    background: "var(--surface-secondary)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {promptPreviewData.metadata.sectionsActivated.length}
                    </strong>{" "}sections activated,{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {promptPreviewData.metadata.sectionsSkipped.length}
                    </strong>{" "}skipped
                    {promptPreviewData.metadata.identitySpec && (
                      <> &middot; Identity: <strong style={{ color: "var(--text-primary)" }}>{promptPreviewData.metadata.identitySpec}</strong></>
                    )}
                    {promptPreviewData.metadata.contentSpec && (
                      <> &middot; Content: <strong style={{ color: "var(--text-primary)" }}>{promptPreviewData.metadata.contentSpec}</strong></>
                    )}
                    {promptPreviewData.metadata.playbooksUsed.length > 0 && (
                      <> &middot; Playbooks: {promptPreviewData.metadata.playbooksUsed.join(", ")}</>
                    )}
                    <> &middot; {promptPreviewData.metadata.loadTimeMs}ms load, {promptPreviewData.metadata.transformTimeMs}ms transform</>
                    {promptPreviewData.createdPreviewCaller && (
                      <div style={{ marginTop: 4, fontStyle: "italic" }}>
                        Note: Created a preview caller (no existing callers in this domain)
                      </div>
                    )}
                  </div>

                  {/* Tab content */}
                  {promptPreviewTab === "summary" && (
                    <pre style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "inherit",
                      fontSize: 13,
                      lineHeight: 1.6,
                      margin: 0,
                      color: "var(--text-primary)",
                    }}>
                      {promptPreviewData.promptSummary}
                    </pre>
                  )}
                  {promptPreviewTab === "voice" && (
                    <pre style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 12,
                      lineHeight: 1.5,
                      margin: 0,
                      padding: 16,
                      background: "var(--surface-secondary)",
                      borderRadius: 8,
                      color: "var(--text-primary)",
                    }}>
                      {promptPreviewData.voicePrompt}
                    </pre>
                  )}
                  {promptPreviewTab === "json" && (
                    <pre style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 11,
                      lineHeight: 1.4,
                      margin: 0,
                      padding: 16,
                      background: "var(--surface-secondary)",
                      borderRadius: 8,
                      color: "var(--text-primary)",
                    }}>
                      {JSON.stringify(promptPreviewData.llmPrompt, null, 2)}
                    </pre>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <button
                onClick={() => {
                  const text =
                    promptPreviewTab === "json"
                      ? JSON.stringify(promptPreviewData?.llmPrompt, null, 2)
                      : promptPreviewTab === "voice"
                        ? promptPreviewData?.voicePrompt || ""
                        : promptPreviewData?.promptSummary || "";
                  navigator.clipboard.writeText(text).catch(() => {});
                }}
                disabled={!promptPreviewData}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  cursor: promptPreviewData ? "pointer" : "not-allowed",
                  opacity: promptPreviewData ? 1 : 0.5,
                }}
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowPromptPreview(false)}
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
                Close
              </button>
            </div>
          </div>
        </div>
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
