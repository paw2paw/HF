"use client";

import "./data-management.css";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AIModelsManager } from "@/components/shared/AIModelsManager";
import { SpecSyncDetailModal } from "@/components/shared/SpecSyncDetailModal";
import { useTerminology } from "@/contexts/TerminologyContext";
import { useTaskPoll } from "@/hooks/useTaskPoll";
import {
  ENTITY_DEPENDENCY_TREE,
  resolveDeleteSet,
  getCascadedTables,
  isDeletable,
} from "@/lib/demo-reset/entity-config";

// ─── Types ───────────────────────────────────────────────────────────

type OperationStatus = "idle" | "running" | "success" | "error";

type OperationResult = {
  message?: string;
  details?: any;
  error?: string;
};

type Operation = {
  id: string;
  title: string;
  description: string;
  icon: string;
  warning: string;
  endpoint: string;
  method?: "GET" | "POST";
  requiresMode?: boolean;
};

type PlaybookOption = {
  id: string;
  name: string;
  description: string;
  domain: {
    slug: string;
    name: string;
    description: string;
  };
  status: string;
  specCount: number;
  behaviorTargetCount: number;
  identitySpecs: string[];
  contentSpecs: string[];
  requiredSpecs: string[];
  optionalSpecs: string[];
  systemDomains: string[];
};

type EntityCount = {
  name: string;
  layer: number | "skip";
  count: number;
};

type SnapshotInfo = {
  name: string;
  fileSize: number;
  metadata: {
    name: string;
    description?: string;
    createdAt: string;
    withLearners: boolean;
    totalRows: number;
  };
};

type SortField = "name" | "count" | "layer";
type SortDir = "asc" | "desc";
type FilterMode = "all" | "runtime" | "config";

// ─── Entity Definitions ──────────────────────────────────────────────

interface EntityDef {
  name: string;
  label: string;
  category: "runtime" | "config";
  layer: 0 | 1 | 2 | 3 | "skip";
  parent?: string;
  viewPath?: string;
}

const ENTITIES: EntityDef[] = [
  // ── Runtime — Layer 3 ──
  { name: "Caller", label: "Callers", category: "runtime", layer: 3, viewPath: "/x/callers" },
  { name: "CallerIdentity", label: "Caller Identities", category: "runtime", layer: 3, parent: "Caller" },
  { name: "CallerPlaybook", label: "Caller Enrollments", category: "runtime", layer: 3, parent: "Caller" },
  { name: "CallerAttribute", label: "Caller Attributes", category: "runtime", layer: 3, parent: "Caller" },
  { name: "CohortGroup", label: "Cohort Groups", category: "runtime", layer: 3, viewPath: "/x/cohorts" },
  { name: "CallerCohortMembership", label: "Cohort Members", category: "runtime", layer: 3, parent: "CohortGroup" },
  { name: "CohortPlaybook", label: "Cohort Courses", category: "runtime", layer: 3, parent: "CohortGroup" },
  { name: "Call", label: "Calls", category: "runtime", layer: 3, parent: "Caller" },
  { name: "CallMessage", label: "Call Messages", category: "runtime", layer: 3, parent: "Call" },
  { name: "CallScore", label: "Call Scores", category: "runtime", layer: 3, parent: "Call" },
  { name: "CallAction", label: "Call Actions", category: "runtime", layer: 3, parent: "Call" },
  { name: "CallerMemory", label: "Caller Memories", category: "runtime", layer: 3, parent: "Caller" },
  { name: "CallerPersonality", label: "Personalities", category: "runtime", layer: 3, parent: "Caller" },
  { name: "PersonalityObservation", label: "Personality Obs.", category: "runtime", layer: 3, parent: "CallerPersonality" },
  { name: "Goal", label: "Goals", category: "runtime", layer: 3, parent: "Caller", viewPath: "/x/courses" },
  { name: "ComposedPrompt", label: "Composed Prompts", category: "runtime", layer: 3, parent: "Caller" },
  { name: "OnboardingSession", label: "Onboarding Sessions", category: "runtime", layer: 3, parent: "Caller" },
  { name: "BehaviorMeasurement", label: "Measurements", category: "runtime", layer: 3, parent: "Call" },
  { name: "ConversationArtifact", label: "Artifacts", category: "runtime", layer: 3, parent: "Call" },

  // ── Runtime — Skipped (derived/temporal) ──
  { name: "CallerMemorySummary", label: "Memory Summaries", category: "runtime", layer: "skip", parent: "Caller" },
  { name: "CallerPersonalityProfile", label: "Personality Profiles", category: "runtime", layer: "skip", parent: "Caller" },
  { name: "CallerTarget", label: "Caller Targets", category: "runtime", layer: "skip", parent: "Caller" },
  { name: "CallTarget", label: "Call Targets", category: "runtime", layer: "skip", parent: "Call" },
  { name: "CallerModuleProgress", label: "Module Progress", category: "runtime", layer: "skip", parent: "Caller" },
  { name: "PipelineRun", label: "Pipeline Runs", category: "runtime", layer: "skip", viewPath: "/x/pipeline" },
  { name: "PipelineStep", label: "Pipeline Steps", category: "runtime", layer: "skip", parent: "PipelineRun" },
  { name: "PromptSlugSelection", label: "Slug Selections", category: "runtime", layer: "skip", parent: "Call" },
  { name: "RewardScore", label: "Reward Scores", category: "runtime", layer: "skip", parent: "Call" },
  { name: "UsageEvent", label: "Usage Events", category: "runtime", layer: "skip", viewPath: "/x/metering" },
  { name: "UsageRollup", label: "Usage Rollups", category: "runtime", layer: "skip" },
  { name: "AuditLog", label: "Audit Logs", category: "runtime", layer: "skip", viewPath: "/x/logs" },
  { name: "VectorEmbedding", label: "Vector Embeddings", category: "runtime", layer: "skip" },
  { name: "FailedCall", label: "Failed Calls", category: "runtime", layer: "skip" },
  { name: "ProcessedFile", label: "Processed Files", category: "runtime", layer: "skip" },
  { name: "Invite", label: "Invites", category: "runtime", layer: "skip" },
  { name: "ExcludedCaller", label: "Excluded Callers", category: "runtime", layer: "skip" },
  { name: "Message", label: "Messages", category: "runtime", layer: "skip" },
  { name: "Ticket", label: "Tickets", category: "runtime", layer: "skip", viewPath: "/x/tickets" },
  { name: "TicketComment", label: "Ticket Comments", category: "runtime", layer: "skip", parent: "Ticket" },
  { name: "UserTask", label: "User Tasks", category: "runtime", layer: "skip", viewPath: "/x/jobs" },
  { name: "InboundMessage", label: "Inbound Messages", category: "runtime", layer: "skip", parent: "Call" },
  { name: "AgentInstance", label: "Agent Instances", category: "runtime", layer: "skip" },
  { name: "AgentRun", label: "Agent Runs", category: "runtime", layer: "skip" },
  { name: "BDDUpload", label: "BDD Uploads", category: "runtime", layer: "skip" },

  // ── Config — Layer 0 ──
  { name: "User", label: "Users", category: "config", layer: 0, viewPath: "/x/users" },
  { name: "SystemSetting", label: "System Settings", category: "config", layer: 0, viewPath: "/x/settings" },
  { name: "AIConfig", label: "AI Config", category: "config", layer: 0, viewPath: "/x/ai-config" },
  { name: "AIModel", label: "AI Models", category: "config", layer: 0 },
  { name: "InstitutionType", label: "Institution Types", category: "config", layer: 0 },
  { name: "ChannelConfig", label: "Channel Config", category: "config", layer: 0 },

  // ── Config — Layer 1 ──
  { name: "AnalysisSpec", label: "Specs", category: "config", layer: 1, viewPath: "/x/specs" },
  { name: "AnalysisTrigger", label: "Triggers", category: "config", layer: 1 },
  { name: "AnalysisAction", label: "Actions", category: "config", layer: 1 },
  { name: "AnalysisProfile", label: "Profiles", category: "config", layer: 1 },
  { name: "AnalysisProfileParameter", label: "Profile Params", category: "config", layer: 1 },
  { name: "Parameter", label: "Parameters", category: "config", layer: 1 },
  { name: "Tag", label: "Tags", category: "config", layer: 1 },
  { name: "ParameterTag", label: "Parameter Tags", category: "config", layer: 1 },
  { name: "ParameterScoringAnchor", label: "Scoring Anchors", category: "config", layer: 1 },
  { name: "ParameterKnowledgeLink", label: "Knowledge Links", category: "config", layer: 1 },
  { name: "BDDFeatureSet", label: "BDD Feature Sets", category: "config", layer: 1 },
  { name: "PromptTemplate", label: "Prompt Templates", category: "config", layer: 1 },
  { name: "PromptBlock", label: "Prompt Blocks", category: "config", layer: 1 },
  { name: "PromptSlug", label: "Prompt Slugs", category: "config", layer: 1 },
  { name: "PromptSlugParameter", label: "Slug Params", category: "config", layer: 1 },
  { name: "PromptSlugRange", label: "Slug Ranges", category: "config", layer: 1 },

  // ── Config — Layer 2 ──
  { name: "Institution", label: "Institutions", category: "config", layer: 2, viewPath: "/x/institutions" },
  { name: "Domain", label: "Domains", category: "config", layer: 2, viewPath: "/x/domains" },
  { name: "Segment", label: "Segments", category: "config", layer: 2 },
  { name: "Playbook", label: "Courses", category: "config", layer: 2, viewPath: "/x/courses" },
  { name: "PlaybookItem", label: "Course Items", category: "config", layer: 2 },
  { name: "PlaybookSubject", label: "Course Subjects", category: "config", layer: 2 },
  { name: "Subject", label: "Subjects", category: "config", layer: 2, viewPath: "/x/subjects" },
  { name: "SubjectSource", label: "Subject Sources", category: "config", layer: 2 },
  { name: "SubjectDomain", label: "Subject Domains", category: "config", layer: 2 },
  { name: "SubjectMedia", label: "Subject Media", category: "config", layer: 2 },
  { name: "Curriculum", label: "Curricula", category: "config", layer: 2 },
  { name: "KnowledgeDoc", label: "Knowledge Docs", category: "config", layer: 2 },
  { name: "KnowledgeChunk", label: "Knowledge Chunks", category: "config", layer: 2 },
  { name: "ContentSource", label: "Content Sources", category: "config", layer: 2, viewPath: "/x/content-sources" },
  { name: "ContentAssertion", label: "Assertions", category: "config", layer: 2 },
  { name: "ContentQuestion", label: "Questions", category: "config", layer: 2 },
  { name: "ContentVocabulary", label: "Vocabulary", category: "config", layer: 2 },
  { name: "BehaviorTarget", label: "Behavior Targets", category: "config", layer: 2 },
];

const ENTITY_MAP = new Map(ENTITIES.map((e) => [e.name, e]));

// ─── Operations (existing) ───────────────────────────────────────────

const OPERATIONS: Operation[] = [
  {
    id: "sync-parameters",
    title: "Sync Missing Parameters",
    description: "Scans all active specs for parameter references in triggers/actions. Creates Parameter records for any missing parameters that specs reference but don't exist in database.",
    icon: "🔧",
    warning: "This will create Parameter records for any parameters that specs reference but don't exist in the database. Safe to run anytime - only creates missing parameters, never modifies existing ones.",
    endpoint: "/api/admin/sync-parameters",
    method: "POST",
  },
  {
    id: "transcripts",
    title: "Import Transcripts from Raw",
    description: "Scans HF_KB_PATH/sources/transcripts/raw for .json and .txt files. Creates Callers (by phone) and Calls. Updates caller names if better data is found.",
    icon: "📞",
    warning: "Choose whether to REPLACE all existing callers/calls (fresh start) or KEEP existing data (skip duplicates). Run 'Sync All BDD Specs' first for proper domain assignment.",
    endpoint: "/api/x/seed-transcripts",
    method: "POST",
    requiresMode: true,
  },
  {
    id: "cleanup",
    title: "Cleanup Orphaned Callers",
    description: "Deletes callers that have 0 calls. These are typically created during failed imports or testing.",
    icon: "🧹",
    warning: "This will permanently delete all Caller records that have no associated Calls. This is safe and recommended after imports.",
    endpoint: "/api/x/cleanup-callers",
    method: "POST",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Main Component ──────────────────────────────────────────────────

export default function DataManagementPage() {
  const { terms, plural, lower } = useTerminology();

  // ── Existing state ──
  const [stats, setStats] = useState<{
    domains: number;
    playbooks: number;
    specs: number;
    callers: number;
    calls: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [operationStatus, setOperationStatus] = useState<Record<string, OperationStatus>>({
    "sync-specs": "idle",
    "create-domains": "idle",
    "sync-parameters": "idle",
    transcripts: "idle",
    cleanup: "idle",
  });
  const [operationResults, setOperationResults] = useState<Record<string, OperationResult>>({});
  const [showModal, setShowModal] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"replace" | "keep" | null>(null);
  const [showAIModels, setShowAIModels] = useState(false);
  const [showSpecSyncModal, setShowSpecSyncModal] = useState(false);
  const [availablePlaybooks, setAvailablePlaybooks] = useState<PlaybookOption[]>([]);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<Set<string>>(new Set());
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    totalFiles: number;
    syncedFiles: number;
    unsyncedFiles: number;
  } | null>(null);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);

  // ── New: Snapshots & Data State ──
  const [showDataState, setShowDataState] = useState(true);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [entityCounts, setEntityCounts] = useState<EntityCount[]>([]);
  const [entityTotals, setEntityTotals] = useState({ runtime: 0, config: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Snapshot form
  const [showNewSnapshot, setShowNewSnapshot] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [newSnapshotWithLearners, setNewSnapshotWithLearners] = useState(false);
  const [snapshotTaskId, setSnapshotTaskId] = useState<string | null>(null);
  const [snapshotProgress, setSnapshotProgress] = useState<string | null>(null);

  // Datagrid state
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Delete/reset state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<OperationStatus>("idle");
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  // ── Load data ──
  useEffect(() => {
    loadStats();
    loadAvailablePlaybooks();
    loadSyncStatus();
    loadSnapshots();
    loadEntityCounts();
  }, []);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/x/data-management/stats");
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function loadAvailablePlaybooks() {
    setLoadingPlaybooks(true);
    try {
      const res = await fetch("/api/x/create-domains");
      const data = await res.json();
      if (data.ok) setAvailablePlaybooks(data.playbooks);
    } catch (e) {
      console.error("Failed to load available playbooks:", e);
    } finally {
      setLoadingPlaybooks(false);
    }
  }

  async function loadSyncStatus() {
    setLoadingSyncStatus(true);
    try {
      const res = await fetch("/api/admin/spec-sync");
      const data = await res.json();
      if (data.ok) {
        setSyncStatus({
          totalFiles: data.totalFiles,
          syncedFiles: data.syncedFiles,
          unsyncedFiles: data.unsyncedFiles,
        });
      }
    } catch (e) {
      console.error("Failed to load sync status:", e);
    } finally {
      setLoadingSyncStatus(false);
    }
  }

  async function loadSnapshots() {
    setLoadingSnapshots(true);
    try {
      const res = await fetch("/api/snapshots");
      const data = await res.json();
      if (data.ok) setSnapshots(data.snapshots);
    } catch {
      setSnapshots([]);
    } finally {
      setLoadingSnapshots(false);
    }
  }

  async function loadEntityCounts() {
    setLoadingCounts(true);
    try {
      const res = await fetch("/api/admin/entity-counts");
      const data = await res.json();
      if (data.ok) {
        setEntityCounts(data.entities);
        setEntityTotals(data.totals);
      }
    } catch (e) {
      console.error("Failed to load entity counts:", e);
    } finally {
      setLoadingCounts(false);
    }
  }

  // ── Snapshot actions ──

  async function handleTakeSnapshot() {
    if (!newSnapshotName.trim()) return;
    setSnapshotProgress("Starting snapshot...");
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSnapshotName.trim(),
          withLearners: newSnapshotWithLearners,
        }),
      });
      const data = await res.json();
      if (data.ok && data.taskId) {
        setSnapshotTaskId(data.taskId);
        setShowNewSnapshot(false);
        setNewSnapshotName("");
      } else {
        setSnapshotProgress(`Error: ${data.error || "Failed to start"}`);
      }
    } catch (err: any) {
      setSnapshotProgress(`Error: ${err.message}`);
    }
  }

  async function handleRestoreSnapshot(name: string) {
    setSnapshotProgress(`Restoring "${name}"...`);
    try {
      const res = await fetch(`/api/snapshots/${encodeURIComponent(name)}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok && data.taskId) {
        setSnapshotTaskId(data.taskId);
      } else {
        setSnapshotProgress(`Error: ${data.error || "Failed to start"}`);
      }
    } catch (err: any) {
      setSnapshotProgress(`Error: ${err.message}`);
    }
  }

  async function handleDeleteSnapshot(name: string) {
    try {
      await fetch(`/api/snapshots/${encodeURIComponent(name)}`, { method: "DELETE" });
      await loadSnapshots();
    } catch {
      // Ignore
    }
  }

  // ── Task polling for snapshot operations ──
  useTaskPoll({
    taskId: snapshotTaskId,
    onProgress: (task) => {
      const ctx = task.context || {};
      const step = task.currentStep || 0;
      const total = task.totalSteps || 0;
      setSnapshotProgress(
        ctx.phase
          ? `${ctx.phase} (${step}/${total})...`
          : `Processing (${step}/${total})...`
      );
    },
    onComplete: () => {
      setSnapshotTaskId(null);
      setSnapshotProgress(null);
      loadSnapshots();
      loadEntityCounts();
      loadStats();
    },
    onError: (msg) => {
      setSnapshotTaskId(null);
      setSnapshotProgress(`Error: ${msg}`);
    },
  });

  // ── Entity selection with cascades ──

  const resolvedSelection = useMemo(() => {
    return resolveDeleteSet(Array.from(selectedEntities));
  }, [selectedEntities]);

  const cascadedEntities = useMemo(() => {
    return new Set(getCascadedTables(Array.from(selectedEntities), resolvedSelection));
  }, [selectedEntities, resolvedSelection]);

  const selectedRowCount = useMemo(() => {
    return resolvedSelection.reduce((sum, name) => {
      const ec = entityCounts.find((e) => e.name === name);
      return sum + (ec?.count ?? 0);
    }, 0);
  }, [resolvedSelection, entityCounts]);

  const toggleEntity = useCallback((name: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        // Also remove children that were explicitly selected
        const children = ENTITY_DEPENDENCY_TREE[name];
        if (children) children.forEach((c) => next.delete(c));
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // ── Filter & sort entities ──

  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const ec of entityCounts) m.set(ec.name, ec.count);
    return m;
  }, [entityCounts]);

  const filteredEntities = useMemo(() => {
    let list = [...ENTITIES];

    if (filterMode === "runtime") list = list.filter((e) => e.category === "runtime");
    else if (filterMode === "config") list = list.filter((e) => e.category === "config");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.label.localeCompare(b.label);
      } else if (sortField === "count") {
        cmp = (countMap.get(a.name) ?? 0) - (countMap.get(b.name) ?? 0);
      } else if (sortField === "layer") {
        const la = a.layer === "skip" ? 99 : a.layer;
        const lb = b.layer === "skip" ? 99 : b.layer;
        cmp = la - lb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [filterMode, searchQuery, sortField, sortDir, countMap]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // ── Delete actions ──

  async function executeSelectiveDelete() {
    setShowDeleteModal(false);
    setDeleteStatus("running");
    setDeleteResult(null);
    try {
      const res = await fetch("/api/admin/demo-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: resolvedSelection }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeleteStatus("success");
        setDeleteResult(
          `Deleted ${formatNumber(data.result.totalRowsDeleted)} rows from ${data.result.tablesDeleted.length} tables`
        );
        setSelectedEntities(new Set());
        loadEntityCounts();
        loadStats();
      } else {
        setDeleteStatus("error");
        setDeleteResult(data.error || "Delete failed");
      }
    } catch (err: any) {
      setDeleteStatus("error");
      setDeleteResult(err.message || "Network error");
    }
  }

  async function executeQuickReset() {
    setShowResetModal(false);
    setResetConfirmText("");
    setDeleteStatus("running");
    setDeleteResult(null);
    try {
      const res = await fetch("/api/admin/demo-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reseedMetering: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeleteStatus("success");
        const msg = data.result.meteringSeeded
          ? `Reset complete. ${formatNumber(data.result.totalRowsDeleted)} rows deleted. Metering re-seeded with ${formatNumber(data.result.meteringSeeded.eventsCreated)} events.`
          : `Reset complete. ${formatNumber(data.result.totalRowsDeleted)} rows deleted.`;
        setDeleteResult(msg);
        setSelectedEntities(new Set());
        loadEntityCounts();
        loadStats();
      } else {
        setDeleteStatus("error");
        setDeleteResult(data.error || "Reset failed");
      }
    } catch (err: any) {
      setDeleteStatus("error");
      setDeleteResult(err.message || "Network error");
    }
  }

  // ── Existing operations ──

  async function executeSyncSpecs() {
    setShowModal(null);
    setOperationStatus((prev) => ({ ...prev, "sync-specs": "running" }));
    setOperationResults((prev) => ({ ...prev, "sync-specs": {} }));
    try {
      const res = await fetch("/api/admin/spec-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, "sync-specs": "success" }));
        setOperationResults((prev) => ({ ...prev, "sync-specs": { message: data.message, details: data } }));
        loadStats();
        loadSyncStatus();
        loadEntityCounts();
      } else {
        setOperationStatus((prev) => ({ ...prev, "sync-specs": "error" }));
        setOperationResults((prev) => ({ ...prev, "sync-specs": { error: data.error || "Sync failed" } }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, "sync-specs": "error" }));
      setOperationResults((prev) => ({ ...prev, "sync-specs": { error: e.message || "Network error" } }));
    }
  }

  async function executeCreateDomains() {
    setShowModal(null);
    setOperationStatus((prev) => ({ ...prev, "create-domains": "running" }));
    setOperationResults((prev) => ({ ...prev, "create-domains": {} }));
    try {
      const res = await fetch("/api/x/create-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookIds: Array.from(selectedPlaybooks) }),
      });
      const data = await res.json();
      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, "create-domains": "success" }));
        setOperationResults((prev) => ({ ...prev, "create-domains": { message: data.message, details: data } }));
        loadStats();
        loadEntityCounts();
        setSelectedPlaybooks(new Set());
      } else {
        setOperationStatus((prev) => ({ ...prev, "create-domains": "error" }));
        setOperationResults((prev) => ({ ...prev, "create-domains": { error: data.error || "Create failed" } }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, "create-domains": "error" }));
      setOperationResults((prev) => ({ ...prev, "create-domains": { error: e.message || "Network error" } }));
    }
  }

  async function executeOperation(op: Operation, mode?: "replace" | "keep") {
    setShowModal(null);
    setSelectedMode(null);
    setOperationStatus((prev) => ({ ...prev, [op.id]: "running" }));
    setOperationResults((prev) => ({ ...prev, [op.id]: {} }));
    try {
      const body = mode ? JSON.stringify({ mode }) : undefined;
      const res = await fetch(op.endpoint, {
        method: op.method || "POST",
        headers: { "Content-Type": "application/json" },
        ...(body && { body }),
      });
      const data = await res.json();
      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, [op.id]: "success" }));
        setOperationResults((prev) => ({ ...prev, [op.id]: { message: data.message, details: data } }));
        loadStats();
        loadEntityCounts();
      } else {
        setOperationStatus((prev) => ({ ...prev, [op.id]: "error" }));
        setOperationResults((prev) => ({ ...prev, [op.id]: { error: data.error || "Operation failed" } }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, [op.id]: "error" }));
      setOperationResults((prev) => ({ ...prev, [op.id]: { error: e.message || "Network error" } }));
    }
  }

  // ── Runtime entity counts for footer ──
  const runtimeWithData = ENTITIES
    .filter((e) => e.category === "runtime")
    .filter((e) => (countMap.get(e.name) ?? 0) > 0);

  return (
    <div>
      {/* Header */}
      <div className="dm-header">
        <h1 className="hf-page-title dm-title-row">
          <span className="dm-title-icon">🌱</span>
          Data Management
        </h1>
        <p className="dm-subtitle">
          Manage snapshots, entity data, and system initialization
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Snapshots & Data State
          ═══════════════════════════════════════════════════════════ */}
      <div className="dm-collapsible">
        <div
          className="dm-collapsible-header"
          onClick={() => setShowDataState(!showDataState)}
        >
          <div className="dm-collapsible-left">
            <span className="dm-collapsible-icon">📸</span>
            <div>
              <div className="dm-collapsible-title">Snapshots & Data State</div>
              <div className="dm-collapsible-desc">
                {formatNumber(entityTotals.runtime)} runtime rows &middot;{" "}
                {formatNumber(entityTotals.config)} config rows &middot;{" "}
                {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <span className="dm-collapsible-chevron">
            {showDataState ? "▼" : "▶"}
          </span>
        </div>

        {showDataState && (
          <div className="dm-collapsible-body">
            {/* ── Snapshot Strip ── */}
            <div className="dm-snapshot-strip">
              {loadingSnapshots ? (
                <span className="dm-snapshot-empty">Loading snapshots...</span>
              ) : snapshots.length === 0 ? (
                <span className="dm-snapshot-empty">No snapshots yet</span>
              ) : (
                snapshots.map((s) => (
                  <div key={s.name} className="dm-snapshot-chip">
                    <span className="dm-snapshot-chip-name">{s.name}</span>
                    <span className="dm-snapshot-chip-meta">
                      {formatBytes(s.fileSize)} &middot; {formatDate(s.metadata.createdAt)}
                      {s.metadata.withLearners ? " +learners" : ""}
                    </span>
                    <button
                      className="dm-snapshot-chip-btn dm-snapshot-chip-btn-restore"
                      onClick={() => handleRestoreSnapshot(s.name)}
                      title="Restore this snapshot"
                    >
                      Restore
                    </button>
                    <button
                      className="dm-snapshot-chip-btn dm-snapshot-chip-btn-delete"
                      onClick={() => handleDeleteSnapshot(s.name)}
                      title="Delete this snapshot"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              {showNewSnapshot ? (
                <div className="dm-snapshot-new-form">
                  <input
                    className="dm-snapshot-new-input"
                    placeholder="snapshot-name"
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleTakeSnapshot()}
                    autoFocus
                  />
                  <label className="dm-grid-filter-chip" title="Include learner data">
                    <input
                      type="checkbox"
                      checked={newSnapshotWithLearners}
                      onChange={(e) => setNewSnapshotWithLearners(e.target.checked)}
                      style={{ marginRight: 4 }}
                    />
                    +Learners
                  </label>
                  <button
                    className="dm-btn dm-btn-primary"
                    onClick={handleTakeSnapshot}
                    disabled={!newSnapshotName.trim()}
                    style={{ padding: "5px 12px", fontSize: 12 }}
                  >
                    Save
                  </button>
                  <button
                    className="dm-snapshot-chip-btn"
                    onClick={() => { setShowNewSnapshot(false); setNewSnapshotName(""); }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  className="dm-grid-filter-chip"
                  onClick={() => setShowNewSnapshot(true)}
                  disabled={!!snapshotTaskId}
                >
                  + New Snapshot
                </button>
              )}

              <button
                className="dm-btn dm-btn-destructive"
                onClick={() => setShowResetModal(true)}
                disabled={deleteStatus === "running"}
                style={{ padding: "5px 12px", fontSize: 12, marginLeft: "auto" }}
              >
                ⚡ Quick Reset
              </button>
            </div>

            {/* ── Progress / Status Banners ── */}
            {snapshotProgress && (
              <div className="dm-status-banner dm-status-banner-running" style={{ marginBottom: 12 }}>
                ⏳ {snapshotProgress}
              </div>
            )}
            {deleteStatus === "running" && (
              <div className="dm-status-banner dm-status-banner-running" style={{ marginBottom: 12 }}>
                ⏳ Deleting data...
              </div>
            )}
            {deleteStatus === "success" && deleteResult && (
              <div className="dm-status-banner dm-status-banner-success" style={{ marginBottom: 12 }}>
                ✅ {deleteResult}
              </div>
            )}
            {deleteStatus === "error" && deleteResult && (
              <div className="dm-status-banner dm-status-banner-error" style={{ marginBottom: 12 }}>
                ❌ {deleteResult}
              </div>
            )}

            {/* ── Datagrid Controls ── */}
            <div className="dm-grid-controls">
              <div className="dm-grid-filters">
                {(["all", "runtime", "config"] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`dm-grid-filter-chip${filterMode === mode ? " dm-grid-filter-chip-active" : ""}`}
                    onClick={() => setFilterMode(mode)}
                  >
                    {mode === "all" ? "All" : mode === "runtime" ? "Runtime" : "Config"}
                  </button>
                ))}
              </div>
              <input
                className="dm-grid-search"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* ── Entity Table ── */}
            {loadingCounts ? (
              <div className="dm-stats-loading">Loading entity counts...</div>
            ) : (
              <>
                <table className="dm-grid-table">
                  <thead>
                    <tr>
                      <th className="dm-grid-th-checkbox"></th>
                      <th onClick={() => handleSort("name")}>
                        Entity
                        <SortArrow field="name" current={sortField} dir={sortDir} />
                      </th>
                      <th>Category</th>
                      <th onClick={() => handleSort("layer")}>
                        Layer
                        <SortArrow field="layer" current={sortField} dir={sortDir} />
                      </th>
                      <th className="dm-grid-th-count" onClick={() => handleSort("count")}>
                        Count
                        <SortArrow field="count" current={sortField} dir={sortDir} />
                      </th>
                      <th className="dm-grid-th-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntities.map((entity) => {
                      const count = countMap.get(entity.name) ?? 0;
                      const isSelected = selectedEntities.has(entity.name);
                      const isCascaded = cascadedEntities.has(entity.name);
                      const isChecked = isSelected || isCascaded;
                      const canDelete = isDeletable(entity.name);
                      const isChild = !!entity.parent;

                      return (
                        <tr
                          key={entity.name}
                          className={`dm-grid-row${entity.category === "config" ? " dm-grid-row-config" : ""}`}
                        >
                          <td>
                            {canDelete ? (
                              <input
                                type="checkbox"
                                className="dm-grid-checkbox"
                                checked={isChecked}
                                disabled={isCascaded}
                                onChange={() => toggleEntity(entity.name)}
                              />
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td className={isChild ? "dm-grid-entity-child" : ""}>
                            <span className="dm-grid-entity-name">{entity.label}</span>
                            {isCascaded && <span className="dm-grid-auto-tag">(auto)</span>}
                          </td>
                          <td>
                            <span className={`dm-grid-badge dm-grid-badge-${entity.category}`}>
                              {entity.category}
                            </span>
                          </td>
                          <td>
                            <span className="dm-grid-layer">
                              {entity.layer === "skip" ? "skip" : `L${entity.layer}`}
                            </span>
                          </td>
                          <td className={`dm-grid-count${count === 0 ? " dm-grid-count-zero" : ""}`}>
                            {formatNumber(count)}
                          </td>
                          <td>
                            {entity.viewPath && (
                              <Link href={entity.viewPath} className="dm-grid-view-link">
                                View
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="dm-grid-footer">
                  <span className="dm-grid-footer-runtime">
                    Runtime: {formatNumber(entityTotals.runtime)} rows across {runtimeWithData.length} tables
                  </span>
                  <span className="dm-grid-footer-config">
                    Config: {formatNumber(entityTotals.config)} rows (protected)
                  </span>
                </div>

                {/* Bulk Toolbar */}
                {resolvedSelection.length > 0 && (
                  <div className="dm-grid-toolbar">
                    <span className="dm-grid-toolbar-info">
                      <span className="dm-grid-toolbar-count">{resolvedSelection.length}</span>{" "}
                      table{resolvedSelection.length !== 1 ? "s" : ""} selected ({formatNumber(selectedRowCount)} rows)
                    </span>
                    <div className="dm-btn-row">
                      <button
                        className="dm-btn dm-btn-secondary"
                        onClick={() => setSelectedEntities(new Set())}
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        Clear
                      </button>
                      <button
                        className="dm-btn dm-btn-destructive"
                        onClick={() => setShowDeleteModal(true)}
                        disabled={deleteStatus === "running"}
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Current Stats (existing)
          ═══════════════════════════════════════════════════════════ */}
      <div className="dm-stats-section">
        <div className="dm-stats-header">
          <h2 className="dm-stats-title">Current Database State</h2>
          <p className="dm-stats-desc">Current counts of key entities in your system</p>
        </div>
        {loadingStats ? (
          <div className="dm-stats-loading">Loading...</div>
        ) : stats ? (
          <div className="dm-stats-grid">
            <StatItem label="Institutions" value={stats.domains} icon="🌐" />
            <StatItem label={plural("playbook")} value={stats.playbooks} icon="📚" />
            <StatItem label="Specs" value={stats.specs} icon="📐" />
            <StatItem label="Callers" value={stats.callers} icon="👥" />
            <StatItem label="Calls" value={stats.calls} icon="📞" />
          </div>
        ) : (
          <div className="dm-stats-error">Failed to load stats</div>
        )}
      </div>

      {/* Manage AI Models Section */}
      <div className="dm-collapsible">
        <div className="dm-collapsible-header" onClick={() => setShowAIModels(!showAIModels)}>
          <div className="dm-collapsible-left">
            <span className="dm-collapsible-icon">🤖</span>
            <div>
              <div className="dm-collapsible-title">Manage AI Models</div>
              <div className="dm-collapsible-desc">Add, edit, or disable AI models available for pipeline operations</div>
            </div>
          </div>
          <span className="dm-collapsible-chevron">{showAIModels ? "▼" : "▶"}</span>
        </div>
        {showAIModels && (
          <div className="dm-collapsible-body">
            <AIModelsManager showHeader={false} />
          </div>
        )}
      </div>

      {/* Recommended Order Notice */}
      <div className="dm-info-banner">
        <div className="dm-info-banner-title">
          <span className="dm-info-banner-icon">💡</span>
          Recommended Execution Order
        </div>
        <ol className="dm-info-banner-list">
          <li><strong>Sync All BDD Specs</strong> - Import all spec files from /docs-archive/bdd-specs directory</li>
          <li><strong>Create Domains & {plural("playbook")}</strong> - Select and create domains with {lower("playbook")}s and behavior targets</li>
          <li><strong>Import Transcripts</strong> - Create callers and calls from raw transcripts</li>
        </ol>
      </div>

      {/* Operation Cards */}
      <div className="dm-ops-stack">
        <SyncSpecsCard
          status={operationStatus["sync-specs"]}
          result={operationResults["sync-specs"]}
          syncStatus={syncStatus}
          loadingSyncStatus={loadingSyncStatus}
          onExecute={() => setShowModal("sync-specs")}
          onViewDetails={() => setShowSpecSyncModal(true)}
        />
        <CreateDomainsCard
          status={operationStatus["create-domains"]}
          result={operationResults["create-domains"]}
          availablePlaybooks={availablePlaybooks}
          selectedPlaybooks={selectedPlaybooks}
          onTogglePlaybook={(id) => {
            const newSelection = new Set(selectedPlaybooks);
            if (newSelection.has(id)) newSelection.delete(id);
            else newSelection.add(id);
            setSelectedPlaybooks(newSelection);
          }}
          onExecute={() => { if (selectedPlaybooks.size > 0) setShowModal("create-domains"); }}
          loadingPlaybooks={loadingPlaybooks}
        />
        {OPERATIONS.map((op) => (
          <OperationCard
            key={op.id}
            operation={op}
            status={operationStatus[op.id]}
            result={operationResults[op.id]}
            onExecute={(mode) => {
              if (op.requiresMode && mode) { setSelectedMode(mode); setShowModal(op.id); }
              else if (!op.requiresMode) setShowModal(op.id);
            }}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Modals
          ═══════════════════════════════════════════════════════════ */}

      {showDeleteModal && (
        <ConfirmationModal
          title="Delete Selected Data"
          icon="🗑️"
          warning={`This will permanently delete ${formatNumber(selectedRowCount)} rows from ${resolvedSelection.length} tables. This cannot be undone.`}
          details={
            <div className="dm-modal-details">
              <strong>Tables to clear:</strong>
              <ul>
                {resolvedSelection.map((t) => {
                  const def = ENTITY_MAP.get(t);
                  const count = countMap.get(t) ?? 0;
                  return (
                    <li key={t}>
                      {def?.label || t} ({formatNumber(count)} rows)
                      {cascadedEntities.has(t) ? " (auto-cascade)" : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          }
          destructive
          onConfirm={executeSelectiveDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showResetModal && (
        <div className="dm-modal-overlay" onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}>
          <div className="dm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dm-modal-icon">⚡</div>
            <div className="dm-modal-title">Quick Reset — All Runtime Data</div>
            <div className="dm-modal-warning dm-modal-warning-destructive">
              This will delete ALL runtime data (callers, calls, memories, measurements, logs, usage events, etc.)
              and re-seed the metering dashboard with 30 days of demo data.
              <br /><br />
              Config data (specs, domains, courses, content) will NOT be affected.
              <br /><br />
              <strong>Type RESET to confirm:</strong>
              <input
                className="dm-reset-confirm-input"
                placeholder="Type RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>
            <div className="dm-modal-actions">
              <button className="dm-modal-btn-cancel" onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}>
                Cancel
              </button>
              <button
                className="dm-modal-btn-confirm dm-modal-btn-confirm-destructive"
                onClick={executeQuickReset}
                disabled={resetConfirmText !== "RESET"}
              >
                Reset All Runtime Data
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal === "sync-specs" && (
        <ConfirmationModal
          title="Sync All BDD Specs"
          icon="📦"
          warning="This will read all .spec.json files from /docs-archive/bdd-specs directory and create/update Parameters, AnalysisSpecs, Anchors, and PromptSlugs in the database."
          onConfirm={executeSyncSpecs}
          onCancel={() => setShowModal(null)}
        />
      )}

      {showModal === "create-domains" && (
        <ConfirmationModal
          title={`Create ${selectedPlaybooks.size} ${terms.playbook}(s)`}
          icon="🎯"
          warning={`This will create ${selectedPlaybooks.size} ${terms.domain.toLowerCase()}(s) and ${lower("playbook")}(s) with all required specs. Existing domains with the same slugs will be deleted first.`}
          details={
            <div className="dm-modal-details">
              <strong>Selected {lower("playbook")}s:</strong>
              <ul>
                {Array.from(selectedPlaybooks).map((id) => {
                  const pb = availablePlaybooks.find((p) => p.id === id);
                  return pb ? <li key={id}>{pb.name} → {pb.domain.name}</li> : null;
                })}
              </ul>
            </div>
          }
          onConfirm={executeCreateDomains}
          onCancel={() => setShowModal(null)}
        />
      )}

      {showModal && OPERATIONS.find((op) => op.id === showModal) && (
        <ConfirmationModal
          title={OPERATIONS.find((op) => op.id === showModal)!.title}
          icon={OPERATIONS.find((op) => op.id === showModal)!.icon}
          warning={
            selectedMode === "replace"
              ? "⚠️ DESTRUCTIVE: This will DELETE all existing Callers and Calls, then import fresh. This cannot be undone."
              : OPERATIONS.find((op) => op.id === showModal)!.warning
          }
          destructive={selectedMode === "replace"}
          onConfirm={() => executeOperation(OPERATIONS.find((op) => op.id === showModal)!, selectedMode || undefined)}
          onCancel={() => { setShowModal(null); setSelectedMode(null); }}
        />
      )}

      {showSpecSyncModal && (
        <SpecSyncDetailModal
          onClose={() => setShowSpecSyncModal(false)}
          onSyncComplete={() => { loadStats(); loadSyncStatus(); loadEntityCounts(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────

function SortArrow({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <span className="dm-grid-sort-arrow"> ↕</span>;
  return (
    <span className="dm-grid-sort-arrow dm-grid-sort-arrow-active">
      {dir === "asc" ? " ↑" : " ↓"}
    </span>
  );
}

function StatItem({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="dm-stat-card">
      <div className="dm-stat-icon">{icon}</div>
      <div className="dm-stat-value">{value}</div>
      <div className="dm-stat-label">{label}</div>
    </div>
  );
}

function SyncSpecsCard({
  status, result, syncStatus, loadingSyncStatus, onExecute, onViewDetails,
}: {
  status: OperationStatus;
  result?: OperationResult;
  syncStatus: { totalFiles: number; syncedFiles: number; unsyncedFiles: number } | null;
  loadingSyncStatus: boolean;
  onExecute: () => void;
  onViewDetails: () => void;
}) {
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";
  const cardClass = `dm-op-card${isSuccess ? " dm-op-card-success" : isError ? " dm-op-card-error" : ""}`;

  return (
    <div className={cardClass}>
      <div className="dm-op-row">
        <div className="dm-op-icon">📦</div>
        <div className="dm-op-body">
          <div className="dm-op-title-row">
            <div className="dm-op-title">Sync All BDD Specs</div>
            {!loadingSyncStatus && syncStatus && (
              <div className="dm-pills">
                <span className="dm-pill dm-pill-success">{syncStatus.syncedFiles} synced</span>
                {syncStatus.unsyncedFiles > 0 && (
                  <span className="dm-pill dm-pill-warning">{syncStatus.unsyncedFiles} unsynced</span>
                )}
              </div>
            )}
          </div>
          <div className="dm-op-desc">
            Reads all .spec.json files from /docs-archive/bdd-specs directory and creates/updates Parameters, AnalysisSpecs, Anchors, and PromptSlugs.
          </div>
          {isRunning && <div className="dm-status-banner dm-status-banner-running">⏳ Syncing specs...</div>}
          {isSuccess && result?.message && <div className="dm-status-banner dm-status-banner-success">✅ {result.message}</div>}
          {isError && result?.error && <div className="dm-status-banner dm-status-banner-error">❌ {result.error}</div>}
          <div className="dm-btn-row">
            <button onClick={onExecute} disabled={isRunning} className="dm-btn dm-btn-primary">
              {isRunning ? "Syncing..." : "Sync All Specs"}
            </button>
            <button onClick={onViewDetails} disabled={isRunning} className="dm-btn dm-btn-secondary">View Details</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateDomainsCard({
  status, result, availablePlaybooks, selectedPlaybooks, onTogglePlaybook, onExecute, loadingPlaybooks,
}: {
  status: OperationStatus;
  result?: OperationResult;
  availablePlaybooks: PlaybookOption[];
  selectedPlaybooks: Set<string>;
  onTogglePlaybook: (id: string) => void;
  onExecute: () => void;
  loadingPlaybooks: boolean;
}) {
  const { terms, plural, lower } = useTerminology();
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";
  const cardClass = `dm-op-card${isSuccess ? " dm-op-card-success" : isError ? " dm-op-card-error" : ""}`;

  return (
    <div className={cardClass}>
      <div className="dm-op-row">
        <div className="dm-op-icon">🎯</div>
        <div className="dm-op-body">
          <div className="dm-op-title-mb">Create Domains & {plural("playbook")}</div>
          <div className="dm-op-desc">
            Select {lower("playbook")}s to create with their domains, behavior targets, and all required specs.
          </div>
          {isRunning && <div className="dm-status-banner dm-status-banner-running">⏳ Creating domains and {lower("playbook")}s...</div>}
          {isSuccess && result?.message && <div className="dm-status-banner dm-status-banner-success">✅ {result.message}</div>}
          {isError && result?.error && <div className="dm-status-banner dm-status-banner-error">❌ {result.error}</div>}
          {loadingPlaybooks ? (
            <div className="dm-pb-loading">Loading available {lower("playbook")}s...</div>
          ) : (
            <div className="dm-pb-section">
              <div className="dm-pb-label">Select {lower("playbook")}s to create:</div>
              <div className="dm-pb-grid">
                {availablePlaybooks.map((pb) => (
                  <PlaybookCheckbox key={pb.id} playbook={pb} isSelected={selectedPlaybooks.has(pb.id)} onToggle={() => onTogglePlaybook(pb.id)} />
                ))}
              </div>
            </div>
          )}
          <div className="dm-btn-row-center">
            <button onClick={onExecute} disabled={isRunning || selectedPlaybooks.size === 0} className="dm-btn dm-btn-primary">
              {isRunning ? "Creating..." : selectedPlaybooks.size === 0 ? `Select ${plural("playbook")}` : `Create ${selectedPlaybooks.size} ${terms.playbook}(s)`}
            </button>
            {selectedPlaybooks.size > 0 && (
              <span className="dm-pb-selected-count">{selectedPlaybooks.size} {lower("playbook")}(s) selected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaybookCheckbox({ playbook, isSelected, onToggle }: { playbook: PlaybookOption; isSelected: boolean; onToggle: () => void }) {
  return (
    <label className={`dm-pb-checkbox${isSelected ? " dm-pb-checkbox-selected" : ""}`}>
      <input type="checkbox" checked={isSelected} onChange={onToggle} className="dm-pb-input" />
      <div className="dm-pb-content">
        <div className="dm-pb-name">{playbook.name}</div>
        <div className="dm-pb-desc">{playbook.description}</div>
        <div className="dm-pb-meta">
          <strong>Domain:</strong> {playbook.domain.name} • <strong>Specs:</strong> ~{playbook.specCount} • <strong>Targets:</strong> {playbook.behaviorTargetCount}
        </div>
      </div>
    </label>
  );
}

function OperationCard({ operation, status, result, onExecute }: { operation: Operation; status: OperationStatus; result?: OperationResult; onExecute: (mode?: "replace" | "keep") => void }) {
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";
  const cardClass = `dm-op-card${isSuccess ? " dm-op-card-success" : isError ? " dm-op-card-error" : ""}`;

  return (
    <div className={cardClass}>
      <div className="dm-op-row">
        <div className="dm-op-icon">{operation.icon}</div>
        <div className="dm-op-body">
          <div className="dm-op-title-mb">{operation.title}</div>
          <div className="dm-op-desc">{operation.description}</div>
          {isRunning && <div className="dm-status-banner dm-status-banner-running">⏳ Running operation...</div>}
          {isSuccess && result?.message && <div className="dm-status-banner dm-status-banner-success">✅ {result.message}</div>}
          {isError && result?.error && <div className="dm-status-banner dm-status-banner-error">❌ {result.error}</div>}
          {operation.requiresMode ? (
            <div className="dm-btn-row">
              <button onClick={() => onExecute("replace")} disabled={isRunning} className="dm-btn dm-btn-destructive">🗑️ Replace ALL</button>
              <button onClick={() => onExecute("keep")} disabled={isRunning} className="dm-btn dm-btn-success">📥 Keep ALL (Skip Duplicates)</button>
            </div>
          ) : (
            <button onClick={() => onExecute()} disabled={isRunning} className="dm-btn dm-btn-primary">
              {isRunning ? "Running..." : `Run ${operation.title}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ title, icon, warning, details, destructive, onConfirm, onCancel }: {
  title: string; icon: string; warning: string; details?: React.ReactNode; destructive?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="dm-modal-overlay" onClick={onCancel}>
      <div className="dm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="dm-modal-icon">{icon}</div>
        <div className="dm-modal-title">{title}</div>
        <div className={`dm-modal-warning ${destructive ? "dm-modal-warning-destructive" : "dm-modal-warning-default"}`}>
          {warning}
          {details}
        </div>
        <div className="dm-modal-actions">
          <button onClick={onCancel} className="dm-modal-btn-cancel">Cancel</button>
          <button
            onClick={onConfirm}
            className={`dm-modal-btn-confirm ${destructive ? "dm-modal-btn-confirm-destructive" : "dm-modal-btn-confirm-default"}`}
          >
            Yes, Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
