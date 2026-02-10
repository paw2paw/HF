"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEntityContext } from "@/contexts/EntityContext";
import {
  TreeNode,
  ExplorerTreeNode,
  useTreeKeyboardNavigation,
  collectAllNodeIds,
} from "@/components/shared/ExplorerTree";
import { FancySelect } from "@/components/shared/FancySelect";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import { SpecPill, ParameterPill, DomainPill, StatusBadge } from "@/src/components/shared/EntityPill";
import { SpecRoleBadge, getSpecEditorRoute, requiresSpecialEditor } from "@/components/shared/SpecRoleBadge";

type Spec = {
  id: string;
  slug: string;
  name: string;
  scope: string;
  outputType: string;
  specRole: string;
  description: string | null;
};

type ScoringAnchor = {
  id: string;
  score: number;
  example: string | null;
  rationale: string | null;
  isGold: boolean;
};

type ActionParameter = {
  parameterId: string;
  name: string;
  definition: string | null;
  scaleType: string | null;
  interpretationHigh: string | null;
  interpretationLow: string | null;
  scoringAnchors: ScoringAnchor[];
  behaviorTargets?: Array<{
    id: string;
    parameterId: string;
    scope: string;
    targetValue: number;
    confidence: number;
    source: string;
    playbook?: { id: string; name: string } | null;
  }>;
};

type TriggerAction = {
  id: string;
  description: string | null;
  weight: number | null;
  sortOrder: number;
  parameterId: string | null;
  learnCategory: string | null;
  learnKeyPrefix: string | null;
  learnKeyHint: string | null;
  parameter: ActionParameter | null;
};

type Trigger = {
  id: string;
  name: string | null;
  given: string | null;
  when: string | null;
  then: string | null;
  sortOrder: number;
  actions: TriggerAction[];
};

type SpecDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: string;
  outputType: string;
  specRole: string | null;
  domain: string | null;
  config: Record<string, unknown> | null;
  promptTemplate: string | null;
  isActive: boolean;
  isLocked: boolean;
  lockedReason: string | null;
  isDeletable: boolean;
  priority: number;
  version: string | null;
  compiledAt: string | null;
  compiledSetId: string | null;
  createdAt: string;
  updatedAt: string;
  triggers?: Trigger[];
};

type FeatureSet = {
  id: string;
  featureId: string;
  name: string;
  description: string | null;
  version: string;
  specType: string;
  rawSpec: Record<string, unknown> | null;
  parameters: any[];
  constraints: any[];
  promptGuidance: any[];
  scoringSpec: Record<string, unknown> | null;
  definitions: Record<string, string> | null;
  thresholds: any[];
  parameterCount: number;
  constraintCount: number;
  definitionCount: number;
  isActive: boolean;
  activatedAt: string | null;
  validations: any[];
  createdAt: string;
  updatedAt: string;
};

const SCOPES = ["SYSTEM", "DOMAIN", "CALLER"] as const;
const TYPES = ["MEASURE", "LEARN", "ADAPT", "COMPOSE", "AGGREGATE", "REWARD"] as const;

const outputTypeColors: Record<string, { bg: string; text: string; icon: string; desc: string }> = {
  MEASURE: { bg: "#dcfce7", text: "#14532d", icon: "📊", desc: "Score caller behavior" },
  LEARN: { bg: "#ede9fe", text: "#4c1d95", icon: "💾", desc: "Extract memories/facts" },
  ADAPT: { bg: "#fef3c7", text: "#78350f", icon: "🎯", desc: "Compute behavior targets" },
  COMPOSE: { bg: "#fce7f3", text: "#9d174d", icon: "✍️", desc: "Build prompt sections" },
  AGGREGATE: { bg: "#e0e7ff", text: "#3730a3", icon: "📈", desc: "Combine data into profiles" },
  REWARD: { bg: "#fef9c3", text: "#854d0e", icon: "🏆", desc: "Compute reward signals" },
};

const scopeColors: Record<string, { bg: string; text: string; icon: string; desc: string }> = {
  SYSTEM: { bg: "#e5e7eb", text: "#1f2937", icon: "⚙️", desc: "Global specs for all callers" },
  DOMAIN: { bg: "#dbeafe", text: "#1e3a8a", icon: "🏢", desc: "Domain-specific specs" },
  CALLER: { bg: "#fce7f3", text: "#9d174d", icon: "👤", desc: "Per-caller learned specs" },
};

const roleColors: Record<string, { bg: string; text: string; label: string; icon: string; desc: string }> = {
  // New taxonomy
  ORCHESTRATE: { bg: "#dbeafe", text: "#1e40af", label: "Orchestrate", icon: "🎯", desc: "Flow/sequence control" },
  EXTRACT: { bg: "#dcfce7", text: "#166534", label: "Extract", icon: "🔍", desc: "Measurement/learning" },
  SYNTHESISE: { bg: "#fef3c7", text: "#92400e", label: "Synthesise", icon: "🧮", desc: "Combine/transform data" },
  CONSTRAIN: { bg: "#fee2e2", text: "#991b1b", label: "Constrain", icon: "📏", desc: "Bounds/guardrails" },
  IDENTITY: { bg: "#e0e7ff", text: "#4338ca", label: "Identity", icon: "👤", desc: "Agent personas" },
  CONTENT: { bg: "#fce7f3", text: "#be185d", label: "Content", icon: "📚", desc: "Curriculum" },
  VOICE: { bg: "#e0e7ff", text: "#4338ca", label: "Voice", icon: "🎙️", desc: "Voice guidance" },
  // Deprecated (backward compatibility) - grayed out
  MEASURE: { bg: "#f3f4f6", text: "#6b7280", label: "Measure (→Extract)", icon: "📊", desc: "DEPRECATED: Use EXTRACT" },
  ADAPT: { bg: "#f3f4f6", text: "#6b7280", label: "Adapt (→Synthesise)", icon: "🔄", desc: "DEPRECATED: Use SYNTHESISE" },
  REWARD: { bg: "#f3f4f6", text: "#6b7280", label: "Reward (→Synthesise)", icon: "⭐", desc: "DEPRECATED: Use SYNTHESISE" },
  GUARDRAIL: { bg: "#f3f4f6", text: "#6b7280", label: "Guardrail (→Constrain)", icon: "🛡️", desc: "DEPRECATED: Use CONSTRAIN" },
  BOOTSTRAP: { bg: "#f3f4f6", text: "#6b7280", label: "Bootstrap (→Orchestrate)", icon: "🔄", desc: "DEPRECATED: Use ORCHESTRATE" },
};

// =============================================================================
// UTILITY FUNCTIONS - Tree Navigation
// =============================================================================

/**
 * Find a node in the tree by ID
 */
function findNodeById(tree: TreeNode | null, targetId: string): TreeNode | null {
  if (!tree) return null;
  if (tree.id === targetId) return tree;

  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Get the path of parent node IDs from root to the target node
 * Returns an array of IDs that need to be expanded to show the target
 */
function getNodePath(tree: TreeNode | null, targetId: string, path: string[] = []): string[] | null {
  if (!tree) return null;
  if (tree.id === targetId) return path;

  if (tree.children) {
    for (const child of tree.children) {
      const result = getNodePath(child, targetId, [...path, tree.id]);
      if (result) return result;
    }
  }

  return null;
}

export default function SpecsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const highlightTriggerId = searchParams.get("trigger");
  const highlightActionId = searchParams.get("action");

  // List state
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Detail state
  const [spec, setSpec] = useState<SpecDetail | null>(null);
  const [featureSet, setFeatureSet] = useState<FeatureSet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recompiling, setRecompiling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable fields
  const [configText, setConfigText] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [specRole, setSpecRole] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Collapsible sections
  const [showRawSpec, setShowRawSpec] = useState(false);
  const [showParameters, setShowParameters] = useState(true);
  const [showPromptGuidance, setShowPromptGuidance] = useState(false);
  const [activeTab, setActiveTab] = useState<"derived" | "source">("derived");

  // Triggers tree state
  const [showTriggers, setShowTriggers] = useState(true);
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Explorer tree state
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [explorerTree, setExplorerTree] = useState<TreeNode | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedTreeNode, setSelectedTreeNode] = useState<TreeNode | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Unimported specs count (for sync badge)
  const [unimportedCount, setUnimportedCount] = useState<number>(0);

  const { pushEntity } = useEntityContext();

  // Toggle functions for triggers tree
  const toggleTrigger = useCallback((triggerId: string) => {
    setExpandedTriggers((prev) => {
      const next = new Set(prev);
      if (next.has(triggerId)) next.delete(triggerId);
      else next.add(triggerId);
      return next;
    });
  }, []);

  const toggleAction = useCallback((actionId: string) => {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  }, []);

  // Explorer tree functions
  const fetchExplorerTree = useCallback(async () => {
    if (explorerTree) return; // Already loaded
    setExplorerLoading(true);
    try {
      const res = await fetch("/api/specs/tree");
      const data = await res.json();
      if (data.ok && data.tree) {
        setExplorerTree(data.tree);
        // Auto-expand root and first level
        const toExpand = new Set<string>();
        toExpand.add(data.tree.id);
        data.tree.children?.forEach((child: TreeNode) => {
          toExpand.add(child.id);
        });
        setExpandedNodes(toExpand);
        setSelectedTreeNode(data.tree);
      }
    } catch (err) {
      console.error("Error fetching specs tree:", err);
    } finally {
      setExplorerLoading(false);
    }
  }, [explorerTree]);

  const toggleNodeExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAllNodes = useCallback(() => {
    if (!explorerTree) return;
    setExpandedNodes(collectAllNodeIds(explorerTree));
  }, [explorerTree]);

  const collapseAllNodes = useCallback(() => {
    if (!explorerTree) return;
    setExpandedNodes(new Set([explorerTree.id]));
  }, [explorerTree]);

  // Handle tree node selection - navigate to spec
  const handleTreeNodeSelect = useCallback(
    (node: TreeNode) => {
      setSelectedTreeNode(node);
      // Navigate to spec detail if it's a spec node
      if (node.type === "spec" && node.meta?.specId) {
        router.push(`/x/specs?id=${node.meta.specId}`, { scroll: false });
      }
    },
    [router]
  );

  // Handle tree node double-click - same as single click for specs
  const handleTreeDoubleClick = useCallback(
    (node: TreeNode) => {
      if (node.type === "spec" && node.meta?.specId) {
        router.push(`/x/specs?id=${node.meta.specId}`, { scroll: false });
      }
    },
    [router]
  );

  // Keyboard navigation for tree
  const { handleKeyDown: handleTreeKeyDown } = useTreeKeyboardNavigation({
    root: explorerTree,
    expandedNodes,
    selectedNode: selectedTreeNode,
    onToggleExpand: toggleNodeExpand,
    onSelectNode: handleTreeNodeSelect,
  });

  // Fetch tree when switching to tree view
  useEffect(() => {
    if (viewMode === "tree" && !explorerTree) {
      fetchExplorerTree();
    }
  }, [viewMode, explorerTree, fetchExplorerTree]);

  // Helper for score colors
  const getScoreColor = (score: number): string => {
    if (score >= 4) return "bg-green-100 text-green-700";
    if (score >= 3) return "bg-yellow-100 text-yellow-700";
    if (score >= 2) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  // Fetch list
  useEffect(() => {
    fetch(`/api/analysis-specs`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSpecs(data.specs || []);
        else setError(data.error);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Fetch unimported specs count for sync badge
  useEffect(() => {
    fetch("/api/admin/spec-sync")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.unseeded) {
          setUnimportedCount(data.unseeded.length);
        }
      })
      .catch(() => {
        // Silently fail - badge just won't show
      });
  }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSpec(null);
      setFeatureSet(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    setHasChanges(false);
    setSaveMessage(null);

    fetch(`/api/analysis-specs/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSpec(data.spec);
          setFeatureSet(data.featureSet);
          setConfigText(JSON.stringify(data.spec.config || {}, null, 2));
          setPromptTemplate(data.spec.promptTemplate || "");
          setSpecRole(data.spec.specRole || "");
          setActiveTab("derived");
          pushEntity({
            type: "spec",
            id: data.spec.id,
            label: data.spec.name,
            href: `/x/specs?id=${data.spec.id}`,
            data: {
              slug: data.spec.slug,
              scope: data.spec.scope,
              outputType: data.spec.outputType,
              specRole: data.spec.specRole,
              description: data.spec.description,
              domain: data.spec.domain,
            },
          });
        } else {
          setDetailError(data.error);
        }
        setDetailLoading(false);
      })
      .catch((e) => {
        setDetailError(e.message);
        setDetailLoading(false);
      });
  }, [selectedId, pushEntity]);

  // Sync tree selection with URL selectedId
  useEffect(() => {
    if (viewMode !== "tree" || !explorerTree || !selectedId) return;

    // Find the node in the tree that matches the selected spec ID
    const targetNode = findNodeById(explorerTree, selectedId);
    if (!targetNode) return;

    // Get the path of parent IDs that need to be expanded
    const pathToNode = getNodePath(explorerTree, selectedId);
    if (pathToNode) {
      // Expand all parent nodes
      setExpandedNodes((prev) => {
        const newExpanded = new Set(prev);
        pathToNode.forEach((id) => newExpanded.add(id));
        return newExpanded;
      });
    }

    // Select the target node in the tree
    setSelectedTreeNode(targetNode);
  }, [selectedId, explorerTree, viewMode]);

  // Auto-expand and scroll to highlighted trigger/action when coming from graph
  useEffect(() => {
    if (!spec?.triggers) return;

    // If we have a trigger or action to highlight, expand and scroll
    if (highlightTriggerId || highlightActionId) {
      setShowTriggers(true);

      // Find the trigger containing the highlighted action (if action is specified)
      if (highlightActionId) {
        for (const trigger of spec.triggers) {
          const action = trigger.actions.find((a) => a.id === highlightActionId);
          if (action) {
            // Expand both the trigger and the action
            setExpandedTriggers((prev) => new Set(prev).add(trigger.id));
            setExpandedActions((prev) => new Set(prev).add(highlightActionId));
            break;
          }
        }
      } else if (highlightTriggerId) {
        // Just expand the trigger
        setExpandedTriggers((prev) => new Set(prev).add(highlightTriggerId));
      }

      // Scroll to highlighted element after a brief delay for DOM to update
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [spec, highlightTriggerId, highlightActionId]);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const ROLES = Object.keys(roleColors);

  const filteredSpecs = specs.filter((s) => {
    if (selectedScopes.size > 0 && !selectedScopes.has(s.scope)) return false;
    if (selectedTypes.size > 0 && !selectedTypes.has(s.outputType)) return false;
    if (selectedRoles.size > 0 && !selectedRoles.has(s.specRole)) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const selectSpec = (id: string) => {
    // Check if this spec requires a special editor (ORCHESTRATE, SYNTHESISE, CONSTRAIN)
    const selectedSpec = specs.find(s => s.id === id);
    if (selectedSpec && requiresSpecialEditor(selectedSpec.specRole)) {
      // Redirect to special editor
      const editorRoute = getSpecEditorRoute(selectedSpec.slug, selectedSpec.specRole);
      router.push(editorRoute);
      return;
    }

    // Normal spec detail view
    router.push(`/x/specs?id=${id}`, { scroll: false });
  };

  // Detail handlers
  const handleConfigChange = useCallback((value: string) => {
    setConfigText(value);
    setHasChanges(true);
    try {
      JSON.parse(value);
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
  }, []);

  const handlePromptTemplateChange = useCallback((value: string) => {
    setPromptTemplate(value);
    setHasChanges(true);
  }, []);

  const handleSpecRoleChange = useCallback((value: string) => {
    setSpecRole(value);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!spec || configError) {
      setSaveMessage({ type: "error", text: "Fix JSON errors before saving" });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const parsedConfig = JSON.parse(configText);
      const res = await fetch(`/api/analysis-specs/${spec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: parsedConfig,
          promptTemplate: promptTemplate || null,
          specRole: specRole || null,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSpec(data.spec);
        setHasChanges(false);
        setSaveMessage({ type: "success", text: "Saved successfully" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRecompile = async () => {
    if (!spec) return;
    setRecompiling(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/analysis-specs/${spec.id}/recompile`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.ok) {
        setSpec(data.spec);
        setConfigText(JSON.stringify(data.spec.config || {}, null, 2));
        setPromptTemplate(data.spec.promptTemplate || "");
        setHasChanges(false);
        setSaveMessage({ type: "success", text: "Recompiled successfully from source spec" });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to recompile" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setRecompiling(false);
    }
  };

  const handleExportToSource = async () => {
    if (!spec) return;

    if (hasChanges) {
      const saveFirst = window.confirm(
        "You have unsaved changes. Save them first before exporting?\n\nClick OK to save & export, or Cancel to abort."
      );
      if (!saveFirst) return;
      await handleSave();
    }

    const confirmed = window.confirm(
      "This will:\n1. Write config parameters back to the .spec.json file on disk\n2. Re-seed the full pipeline (BDDFeatureSet → Parameters → Anchors → Triggers → Prompt Template)\n\nThe source file will be overwritten. Reversible via git only. Continue?"
    );
    if (!confirmed) return;

    setExporting(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/analysis-specs/${spec.id}/export-to-source`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.ok) {
        const r = data.seedResult;
        const details = r
          ? ` (${r.parametersCreated + r.parametersUpdated} params, ${r.anchorsCreated} anchors, ${r.triggersCreated} triggers)`
          : "";
        setSaveMessage({ type: "success", text: `Exported to ${data.filePath} & re-seeded${details}` });
        // Reload spec data
        const refreshRes = await fetch(`/api/analysis-specs/${spec.id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.ok) {
          setSpec(refreshData.spec);
          setFeatureSet(refreshData.featureSet);
          setConfigText(JSON.stringify(refreshData.spec.config || {}, null, 2));
          setPromptTemplate(refreshData.spec.promptTemplate || "");
          setHasChanges(false);
        }
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to export" });
      }
    } catch (e: any) {
      setSaveMessage({ type: "error", text: e.message });
    } finally {
      setExporting(false);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfigText(JSON.stringify(parsed, null, 2));
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
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
        color: isActive ? colors.text : "var(--text-placeholder)",
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

  const isMeasureSpec = spec?.outputType === "MEASURE";
  const isIdentityOrContent = spec?.specRole === "IDENTITY" || spec?.specRole === "CONTENT";
  const hasRichConfig = spec?.config && Object.keys(spec.config).length > 2;
  const hasPromptTemplate = spec?.promptTemplate && spec.promptTemplate.length > 100;

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
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Analysis Specs</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--input-border)",
                borderRadius: 6,
                width: 160,
                fontSize: 12,
              }}
            />
            <Link
              href="/x/specs/new"
              style={{
                padding: "6px 12px",
                background: "var(--accent-primary)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              + New Spec
            </Link>
            {unimportedCount > 0 && (
              <Link
                href="/x/admin/spec-sync"
                style={{
                  padding: "4px 10px",
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fcd34d",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
                title={`${unimportedCount} spec${unimportedCount === 1 ? "" : "s"} found in bdd-specs/ folder but not imported to database`}
              >
                <span
                  style={{
                    background: "#f59e0b",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {unimportedCount}
                </span>
                Sync
              </Link>
            )}
            <Link
              href="/x/spec-schema"
              style={{
                padding: "6px 12px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--input-border)",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Schema
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {/* Scope */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Filter by specification scope">Scope</span>
            <ClearBtn onClick={() => setSelectedScopes(new Set())} show={selectedScopes.size > 0} />
            <div style={{ display: "flex", gap: 4 }}>
              {SCOPES.map((scope) => {
                const config = scopeColors[scope];
                return (
                  <FilterPill
                    key={scope}
                    label={scope}
                    icon={config.icon}
                    tooltip={config.desc}
                    isActive={selectedScopes.has(scope)}
                    colors={config}
                    onClick={() => toggleScope(scope)}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border-default)" }} />

          {/* Type */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Filter by output type">Type</span>
            <ClearBtn onClick={() => setSelectedTypes(new Set())} show={selectedTypes.size > 0} />
            <div style={{ display: "flex", gap: 4 }}>
              {TYPES.map((type) => {
                const config = outputTypeColors[type];
                return (
                  <FilterPill
                    key={type}
                    label={type}
                    icon={config.icon}
                    tooltip={config.desc}
                    isActive={selectedTypes.has(type)}
                    colors={config}
                    onClick={() => toggleType(type)}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border-default)" }} />

          {/* Role */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }} title="Filter by spec role">Role</span>
            <ClearBtn onClick={() => setSelectedRoles(new Set())} show={selectedRoles.size > 0} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {ROLES.map((role) => {
                const config = roleColors[role as keyof typeof roleColors];
                const count = specs.filter(s => s.specRole === role).length;
                if (count === 0) return null;
                return (
                  <FilterPill
                    key={role}
                    label={String(count)}
                    icon={config.icon}
                    tooltip={`${config.label}: ${config.desc}`}
                    isActive={selectedRoles.has(role)}
                    colors={{ bg: config.bg, text: config.text }}
                    onClick={() => toggleRole(role)}
                  />
                );
              })}
            </div>
          </div>

          {/* Results count */}
          <span style={{ fontSize: 11, color: "var(--text-placeholder)", marginLeft: "auto", alignSelf: "center" }}>
            {filteredSpecs.length} of {specs.length}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Master-Detail Layout */}
      <div style={{ display: "flex", gap: 16, minHeight: "calc(100vh - 220px)" }}>
        {/* List/Tree Panel */}
        <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column" }}>
          {/* View Toggle Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "var(--surface-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px 8px 0 0",
              borderBottom: "none",
            }}
          >
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setViewMode("list")}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: viewMode === "list" ? "1px solid var(--accent-primary)" : "1px solid var(--input-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: viewMode === "list" ? "var(--surface-selected)" : "var(--surface-primary)",
                  color: viewMode === "list" ? "var(--accent-primary)" : "var(--text-muted)",
                }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("tree")}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: viewMode === "tree" ? "1px solid var(--accent-primary)" : "1px solid var(--input-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: viewMode === "tree" ? "var(--surface-selected)" : "var(--surface-primary)",
                  color: viewMode === "tree" ? "var(--accent-primary)" : "var(--text-muted)",
                }}
              >
                🌳 Tree
              </button>
            </div>
            {viewMode === "tree" && explorerTree && (
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={expandAllNodes}
                  style={{
                    padding: "2px 6px",
                    fontSize: 9,
                    fontWeight: 600,
                    border: "1px solid var(--input-border)",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: "var(--surface-primary)",
                    color: "var(--text-muted)",
                  }}
                  title="Expand All"
                >
                  [+]
                </button>
                <button
                  onClick={collapseAllNodes}
                  style={{
                    padding: "2px 6px",
                    fontSize: 9,
                    fontWeight: 600,
                    border: "1px solid var(--input-border)",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: "var(--surface-primary)",
                    color: "var(--text-muted)",
                  }}
                  title="Collapse All"
                >
                  [-]
                </button>
              </div>
            )}
            {viewMode === "list" && (
              <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
                {filteredSpecs.length} specs
              </span>
            )}
          </div>

          {/* Content Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "0 0 8px 8px",
              padding: viewMode === "tree" ? 8 : 0,
            }}
          >
            {viewMode === "list" ? (
              // List View
              <>
                {loading ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
                ) : filteredSpecs.length === 0 ? (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      background: "var(--surface-secondary)",
                      borderRadius: 12,
                      margin: 8,
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                      {search || selectedScopes.size > 0 || selectedTypes.size > 0 ? "No specs match filters" : "No specs yet"}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
                    {filteredSpecs.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => selectSpec(s.id)}
                        style={{
                          background: selectedId === s.id ? "var(--surface-selected)" : "var(--surface-primary)",
                          border: selectedId === s.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
                          borderRadius: 8,
                          padding: 12,
                          cursor: "pointer",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              background: scopeColors[s.scope]?.bg,
                              color: scopeColors[s.scope]?.text,
                              borderRadius: 4,
                            }}
                          >
                            {s.scope}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              background: outputTypeColors[s.outputType]?.bg || "#e5e7eb",
                              color: outputTypeColors[s.outputType]?.text || "#374151",
                              borderRadius: 4,
                            }}
                          >
                            {s.outputType}
                          </span>
                          {s.specRole && <SpecRoleBadge role={s.specRole} size="sm" />}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{s.slug}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Tree View
              <>
                {explorerLoading ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading tree...</div>
                ) : !explorerTree ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Failed to load tree</div>
                ) : (
                  <div
                    ref={treeContainerRef}
                    tabIndex={0}
                    onKeyDown={handleTreeKeyDown}
                    onFocus={() => {
                      if (!selectedTreeNode && explorerTree) {
                        setSelectedTreeNode(explorerTree);
                      }
                    }}
                    style={{ outline: "none", minHeight: "100%" }}
                  >
                    <ExplorerTreeNode
                      node={explorerTree}
                      depth={0}
                      expandedNodes={expandedNodes}
                      selectedNode={selectedTreeNode}
                      onToggle={toggleNodeExpand}
                      onSelect={handleTreeNodeSelect}
                      onDoubleClick={handleTreeDoubleClick}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div style={{ flex: 1, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 20, overflowY: "auto" }}>
          {!selectedId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-placeholder)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14 }}>Select a spec to view details</div>
              </div>
            </div>
          ) : detailLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading spec...</div>
          ) : detailError || !spec ? (
            <div style={{ padding: 20, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
              {detailError || "Spec not found"}
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{spec.name}</h2>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 4 }}>{spec.slug}</div>
              </div>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: scopeColors[spec.scope]?.bg,
                    color: scopeColors[spec.scope]?.text,
                  }}
                >
                  {spec.scope}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: outputTypeColors[spec.outputType]?.bg,
                    color: outputTypeColors[spec.outputType]?.text,
                  }}
                >
                  {spec.outputType}
                </span>
                {spec.specRole && roleColors[spec.specRole] && (
                  <span style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: roleColors[spec.specRole].bg,
                    color: roleColors[spec.specRole].text,
                  }}>
                    {roleColors[spec.specRole].icon} {roleColors[spec.specRole].label}
                  </span>
                )}
                {spec.domain && (
                  <DomainPill label={spec.domain} size="compact" />
                )}
                {featureSet && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#d1fae5", color: "#065f46" }}>
                    Has Source Spec
                  </span>
                )}
                {spec.isLocked && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c" }}>
                    Locked
                  </span>
                )}
                {spec.isDeletable === false && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                    🔒 Cannot Delete
                  </span>
                )}
                {!spec.isActive && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "var(--surface-secondary)", color: "var(--text-muted)" }}>
                    Inactive
                  </span>
                )}
                {/* View in Graph Button */}
                <Link
                  href={`/x/taxonomy-graph?focus=spec/${spec.slug}`}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--border-primary)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: "auto",
                  }}
                  title="View this spec in the taxonomy graph visualizer"
                >
                  🌌 Graph
                </Link>
              </div>

              {spec.description && (
                <div style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: "var(--text-secondary)" }}>
                  {spec.description}
                </div>
              )}

              {/* Data Flow Overview */}
              {featureSet && (
                <div style={{ background: "linear-gradient(to right, #eff6ff, var(--surface-selected))", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a8a", marginBottom: 8 }}>Data Flow</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: 4, fontFamily: "monospace" }}>
                      {featureSet.featureId}.spec.json
                    </span>
                    <span style={{ color: "#93c5fd" }}>→</span>
                    <span style={{ background: "#e9d5ff", color: "#6b21a8", padding: "3px 8px", borderRadius: 4 }}>
                      BDDFeatureSet
                    </span>
                    <span style={{ color: "#c4b5fd" }}>→</span>
                    <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "3px 8px", borderRadius: 4 }}>
                      AnalysisSpec
                    </span>
                    <span style={{ color: "var(--text-placeholder)", marginLeft: 8 }}>
                      ({featureSet.parameterCount} params, {featureSet.constraintCount} constraints)
                    </span>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <DraggableTabs
                storageKey={`spec-detail-tabs-${spec.id}`}
                tabs={[
                  { id: "derived", label: "Derived Output" },
                  ...(featureSet ? [{ id: "source", label: "Source Spec" }] : []),
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as "derived" | "source")}
                containerStyle={{ marginBottom: 20 }}
              />

              {activeTab === "derived" && (
                <>
                  {/* Spec Role Selector */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                      Spec Role
                    </label>
                    <FancySelect
                      value={specRole}
                      onChange={handleSpecRoleChange}
                      disabled={spec.isLocked}
                      searchable={false}
                      style={{ maxWidth: 300 }}
                      options={[
                        { value: "", label: "None" },
                        // New taxonomy
                        { value: "ORCHESTRATE", label: "🎯 ORCHESTRATE", subtitle: "Flow/sequence control" },
                        { value: "EXTRACT", label: "🔍 EXTRACT", subtitle: "Measurement/learning" },
                        { value: "SYNTHESISE", label: "🧮 SYNTHESISE", subtitle: "Combine/transform data" },
                        { value: "CONSTRAIN", label: "📏 CONSTRAIN", subtitle: "Bounds/guardrails" },
                        { value: "IDENTITY", label: "👤 IDENTITY", subtitle: "Agent personas" },
                        { value: "CONTENT", label: "📚 CONTENT", subtitle: "Curriculum" },
                        { value: "VOICE", label: "🎙️ VOICE", subtitle: "Voice guidance" },
                        // Deprecated (backward compatibility)
                        { value: "MEASURE", label: "📊 MEASURE (deprecated)", subtitle: "Use EXTRACT instead" },
                        { value: "ADAPT", label: "🔄 ADAPT (deprecated)", subtitle: "Use SYNTHESISE instead" },
                        { value: "REWARD", label: "⭐ REWARD (deprecated)", subtitle: "Use SYNTHESISE instead" },
                        { value: "GUARDRAIL", label: "🛡️ GUARDRAIL (deprecated)", subtitle: "Use CONSTRAIN instead" },
                        { value: "BOOTSTRAP", label: "🔄 BOOTSTRAP (deprecated)", subtitle: "Use ORCHESTRATE instead" },
                      ]}
                    />
                  </div>

                  {/* Prompt Template */}
                  {(isMeasureSpec || hasPromptTemplate) && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                          Compiled Prompt Template
                          {isMeasureSpec && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4 }}>
                              Primary output for MEASURE specs
                            </span>
                          )}
                        </label>
                        <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>
                          {promptTemplate.length.toLocaleString()} chars
                        </span>
                      </div>
                      <textarea
                        value={promptTemplate}
                        onChange={(e) => handlePromptTemplateChange(e.target.value)}
                        disabled={spec.isLocked}
                        rows={isMeasureSpec ? 16 : 8}
                        style={{
                          width: "100%",
                          fontFamily: "monospace",
                          fontSize: 11,
                          border: "1px solid var(--input-border)",
                          borderRadius: 8,
                          padding: 12,
                          background: spec.isLocked ? "var(--surface-disabled)" : "var(--surface-primary)",
                          resize: "vertical",
                        }}
                        placeholder="Compiled prompt template..."
                      />
                    </div>
                  )}

                  {/* Config Editor */}
                  {(!isMeasureSpec || hasRichConfig) && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                          Config (JSON)
                          {isIdentityOrContent && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: "#e0e7ff", color: "#3730a3", padding: "2px 6px", borderRadius: 4 }}>
                              Primary output for {spec.specRole} specs
                            </span>
                          )}
                        </label>
                        <button
                          onClick={formatJson}
                          style={{ fontSize: 11, color: "#4f46e5", background: "none", border: "none", cursor: "pointer" }}
                        >
                          Format JSON
                        </button>
                      </div>
                      <div style={{ position: "relative" }}>
                        <textarea
                          value={configText}
                          onChange={(e) => handleConfigChange(e.target.value)}
                          disabled={spec.isLocked}
                          rows={isIdentityOrContent ? 16 : 8}
                          style={{
                            width: "100%",
                            fontFamily: "monospace",
                            fontSize: 11,
                            border: configError ? "1px solid var(--status-error-border)" : "1px solid var(--border-default)",
                            borderRadius: 8,
                            padding: 12,
                            color: "var(--text-primary)",
                            background: configError ? "var(--status-error-bg)" : spec.isLocked ? "var(--surface-disabled)" : "var(--surface-primary)",
                            resize: "vertical",
                          }}
                          placeholder="{}"
                        />
                        {configError && (
                          <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, background: "var(--status-error-bg)", color: "var(--status-error-text)", fontSize: 11, padding: 8, borderRadius: 4 }}>
                            JSON Error: {configError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Save / Recompile Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={handleSave}
                      disabled={saving || spec.isLocked || !hasChanges}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        fontWeight: 500,
                        fontSize: 13,
                        border: "none",
                        cursor: saving || spec.isLocked || !hasChanges ? "not-allowed" : "pointer",
                        background: saving || spec.isLocked || !hasChanges ? "var(--surface-disabled)" : "var(--accent-primary)",
                        color: saving || spec.isLocked || !hasChanges ? "var(--text-placeholder)" : "#fff",
                      }}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    {featureSet && (
                      <button
                        onClick={handleRecompile}
                        disabled={recompiling || spec.isLocked}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          fontWeight: 500,
                          fontSize: 13,
                          border: "none",
                          cursor: recompiling || spec.isLocked ? "not-allowed" : "pointer",
                          background: recompiling || spec.isLocked ? "var(--surface-disabled)" : "#d97706",
                          color: recompiling || spec.isLocked ? "var(--text-placeholder)" : "#fff",
                        }}
                      >
                        {recompiling ? "Recompiling..." : "Recompile from Source"}
                      </button>
                    )}
                    {spec.compiledSetId && (
                      <button
                        onClick={handleExportToSource}
                        disabled={exporting || spec.isLocked}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          fontWeight: 500,
                          fontSize: 13,
                          border: "none",
                          cursor: exporting || spec.isLocked ? "not-allowed" : "pointer",
                          background: exporting || spec.isLocked ? "var(--surface-disabled)" : "#dc2626",
                          color: exporting || spec.isLocked ? "var(--text-placeholder)" : "#fff",
                        }}
                        title="Writes config parameters back to the .spec.json file on disk, then re-seeds the full pipeline"
                      >
                        {exporting ? "Writing & Re-seeding..." : "Write to Source & Re-seed"}
                      </button>
                    )}
                    {saveMessage && (
                      <span style={{ fontSize: 12, color: saveMessage.type === "success" ? "var(--status-success-text)" : "var(--status-error-text)" }}>
                        {saveMessage.text}
                      </span>
                    )}
                    {hasChanges && !saveMessage && (
                      <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>Unsaved changes</span>
                    )}
                  </div>

                  {/* Triggers Tree */}
                  {spec.triggers && spec.triggers.length > 0 && (
                    <div style={{ marginTop: 24, borderTop: "1px solid var(--border-default)", paddingTop: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <button
                          onClick={() => setShowTriggers(!showTriggers)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <span>{showTriggers ? "▼" : "▶"}</span>
                          Triggers ({spec.triggers.length})
                        </button>
                        {showTriggers && (
                          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                            <button
                              onClick={() => {
                                const allTriggerIds = new Set(spec.triggers!.map((t) => t.id));
                                const allActionIds = new Set(spec.triggers!.flatMap((t) => t.actions.map((a) => a.id)));
                                setExpandedTriggers(allTriggerIds);
                                setExpandedActions(allActionIds);
                              }}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "none",
                                fontSize: 11,
                                color: "var(--text-muted)",
                                background: "transparent",
                                cursor: "pointer",
                              }}
                            >
                              Expand All
                            </button>
                            <button
                              onClick={() => {
                                setExpandedTriggers(new Set());
                                setExpandedActions(new Set());
                              }}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "none",
                                fontSize: 11,
                                color: "var(--text-muted)",
                                background: "transparent",
                                cursor: "pointer",
                              }}
                            >
                              Collapse All
                            </button>
                          </div>
                        )}
                      </div>

                      {showTriggers && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {spec.triggers.map((trigger, tIdx) => {
                            const isHighlightedTrigger = trigger.id === highlightTriggerId;
                            const hasHighlightedAction = trigger.actions.some((a) => a.id === highlightActionId);

                            return (
                              <div
                                key={trigger.id}
                                ref={isHighlightedTrigger && !highlightActionId ? highlightedRef : undefined}
                                style={{
                                  border: isHighlightedTrigger ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)",
                                  borderRadius: 8,
                                  background: isHighlightedTrigger ? "var(--surface-selected)" : "var(--surface-primary)",
                                  transition: "border-color 0.3s, background-color 0.3s",
                                }}
                              >
                                <div
                                  onClick={() => toggleTrigger(trigger.id)}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>
                                      Trigger {tIdx + 1}: {trigger.name || "Unnamed"}
                                    </div>
                                    <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>
                                      {trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                  <span style={{ color: "var(--text-placeholder)" }}>
                                    {expandedTriggers.has(trigger.id) ? "▾" : "▸"}
                                  </span>
                                </div>

                                {expandedTriggers.has(trigger.id) && (
                                  <div style={{ borderTop: "1px solid var(--border-default)", padding: 12 }}>
                                    {/* Given/When/Then */}
                                    <div
                                      style={{
                                        marginBottom: 12,
                                        padding: 10,
                                        background: "var(--surface-secondary)",
                                        borderRadius: 6,
                                        fontFamily: "monospace",
                                        fontSize: 12,
                                      }}
                                    >
                                      {trigger.given && (
                                        <div style={{ marginBottom: 4 }}>
                                          <span style={{ fontWeight: 600, color: "#7c3aed" }}>Given</span>{" "}
                                          <span style={{ color: "var(--text-primary)" }}>{trigger.given}</span>
                                        </div>
                                      )}
                                      {trigger.when && (
                                        <div style={{ marginBottom: 4 }}>
                                          <span style={{ fontWeight: 600, color: "#2563eb" }}>When</span>{" "}
                                          <span style={{ color: "var(--text-primary)" }}>{trigger.when}</span>
                                        </div>
                                      )}
                                      {trigger.then && (
                                        <div>
                                          <span style={{ fontWeight: 600, color: "#16a34a" }}>Then</span>{" "}
                                          <span style={{ color: "var(--text-primary)" }}>{trigger.then}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {trigger.actions.map((action, aIdx) => {
                                        const isHighlightedAction = action.id === highlightActionId;

                                        return (
                                          <div
                                            key={action.id}
                                            ref={isHighlightedAction ? highlightedRef : undefined}
                                            style={{
                                              border: isHighlightedAction ? "2px solid var(--accent-secondary)" : "1px solid var(--border-default)",
                                              borderRadius: 6,
                                              background: isHighlightedAction ? "var(--surface-selected)" : "var(--surface-primary)",
                                              transition: "border-color 0.3s, background-color 0.3s",
                                            }}
                                          >
                                            <div
                                              onClick={() => toggleAction(action.id)}
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: 10,
                                                cursor: "pointer",
                                              }}
                                            >
                                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span
                                                  style={{
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    padding: "2px 6px",
                                                    borderRadius: 4,
                                                    background:
                                                      spec.outputType === "LEARN" ? "#fef3c7" : "#e0e7ff",
                                                    color:
                                                      spec.outputType === "LEARN" ? "#92400e" : "#3730a3",
                                                  }}
                                                >
                                                  {spec.outputType === "LEARN" ? "EXT" : "AC"}
                                                  {aIdx + 1}
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                                                  {action.description || "No description"}
                                                </span>
                                              </div>
                                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {spec.outputType === "MEASURE" && action.parameter && (
                                                  <ParameterPill
                                                    label={action.parameter.parameterId}
                                                    size="compact"
                                                    href={`/data-dictionary?search=${action.parameter.parameterId}`}
                                                  />
                                                )}
                                                {spec.outputType === "LEARN" && action.learnCategory && (
                                                  <span
                                                    style={{
                                                      fontSize: 10,
                                                      padding: "2px 6px",
                                                      borderRadius: 4,
                                                      background: "#fef3c7",
                                                      color: "#92400e",
                                                    }}
                                                  >
                                                    {action.learnCategory}
                                                  </span>
                                                )}
                                                <span style={{ color: "var(--text-placeholder)" }}>
                                                  {expandedActions.has(action.id) ? "▾" : "▸"}
                                                </span>
                                              </div>
                                            </div>

                                            {expandedActions.has(action.id) && (
                                              <div style={{ borderTop: "1px solid var(--border-default)", padding: 10 }}>
                                                {/* MEASURE: Show parameter + anchors */}
                                                {spec.outputType === "MEASURE" && action.parameter && (
                                                  <>
                                                    <div
                                                      style={{
                                                        marginBottom: 10,
                                                        padding: 8,
                                                        background: "#faf5ff",
                                                        borderRadius: 6,
                                                        fontSize: 12,
                                                      }}
                                                    >
                                                      <div style={{ fontWeight: 500, color: "#6b21a8" }}>
                                                        Parameter: {action.parameter.name}
                                                      </div>
                                                      {action.parameter.definition && (
                                                        <div style={{ marginTop: 4, color: "#7c3aed" }}>
                                                          {action.parameter.definition}
                                                        </div>
                                                      )}
                                                      <div
                                                        style={{
                                                          marginTop: 8,
                                                          display: "flex",
                                                          gap: 16,
                                                          fontSize: 11,
                                                        }}
                                                      >
                                                        {action.parameter.interpretationHigh && (
                                                          <div>
                                                            <span style={{ fontWeight: 500, color: "#16a34a" }}>
                                                              High:
                                                            </span>{" "}
                                                            <span style={{ color: "var(--text-secondary)" }}>
                                                              {action.parameter.interpretationHigh}
                                                            </span>
                                                          </div>
                                                        )}
                                                        {action.parameter.interpretationLow && (
                                                          <div>
                                                            <span style={{ fontWeight: 500, color: "#dc2626" }}>
                                                              Low:
                                                            </span>{" "}
                                                            <span style={{ color: "var(--text-secondary)" }}>
                                                              {action.parameter.interpretationLow}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Scoring Anchors */}
                                                    {action.parameter.scoringAnchors &&
                                                      action.parameter.scoringAnchors.length > 0 && (
                                                        <div>
                                                          <div
                                                            style={{
                                                              fontSize: 10,
                                                              fontWeight: 600,
                                                              textTransform: "uppercase",
                                                              color: "var(--text-muted)",
                                                              marginBottom: 6,
                                                            }}
                                                          >
                                                            Scoring Anchors
                                                          </div>
                                                          <div
                                                            style={{
                                                              display: "flex",
                                                              flexDirection: "column",
                                                              gap: 6,
                                                            }}
                                                          >
                                                            {action.parameter.scoringAnchors.map((anchor) => (
                                                              <div
                                                                key={anchor.id}
                                                                style={{
                                                                  padding: 8,
                                                                  background: "var(--surface-secondary)",
                                                                  borderRadius: 4,
                                                                  fontSize: 12,
                                                                }}
                                                              >
                                                                <div
                                                                  style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                  }}
                                                                >
                                                                  <span
                                                                    style={{
                                                                      fontSize: 11,
                                                                      fontWeight: 600,
                                                                      padding: "2px 6px",
                                                                      borderRadius: 4,
                                                                    }}
                                                                    className={getScoreColor(anchor.score)}
                                                                  >
                                                                    {anchor.score}
                                                                    {anchor.isGold && " ⭐"}
                                                                  </span>
                                                                  <span style={{ color: "var(--text-secondary)" }}>
                                                                    "{anchor.example}"
                                                                  </span>
                                                                </div>
                                                                {anchor.rationale && (
                                                                  <div
                                                                    style={{
                                                                      marginTop: 4,
                                                                      fontSize: 11,
                                                                      color: "var(--text-muted)",
                                                                    }}
                                                                  >
                                                                    {anchor.rationale}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      )}
                                                  </>
                                                )}

                                                {/* LEARN: Show learn config */}
                                                {spec.outputType === "LEARN" && (
                                                  <div
                                                    style={{
                                                      padding: 8,
                                                      background: "#fffbeb",
                                                      borderRadius: 6,
                                                      fontSize: 12,
                                                    }}
                                                  >
                                                    <div style={{ fontWeight: 500, color: "#92400e" }}>
                                                      Learns to: {action.learnCategory || "Not configured"}
                                                    </div>
                                                    {action.learnKeyPrefix && (
                                                      <div style={{ marginTop: 4, color: "#b45309" }}>
                                                        Key prefix:{" "}
                                                        <code
                                                          style={{
                                                            background: "#fef3c7",
                                                            padding: "1px 4px",
                                                            borderRadius: 3,
                                                          }}
                                                        >
                                                          {action.learnKeyPrefix}
                                                        </code>
                                                      </div>
                                                    )}
                                                    {action.learnKeyHint && (
                                                      <div style={{ marginTop: 4, color: "#b45309" }}>
                                                        Hint: {action.learnKeyHint}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {activeTab === "source" && featureSet && (
                <>
                  {/* Parameters */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowParameters(!showParameters)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      <span>{showParameters ? "▼" : "▶"}</span>
                      Parameters ({featureSet.parameterCount})
                    </button>
                    {showParameters && featureSet.parameters && featureSet.parameters.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {featureSet.parameters.map((param: any, idx: number) => (
                          <div key={param.id || idx} style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                              <div>
                                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{param.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{param.id}</div>
                              </div>
                              {param.targetRange && (
                                <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 4 }}>
                                  Target: {param.targetRange.min}-{param.targetRange.max}
                                </span>
                              )}
                            </div>
                            {param.definition && (
                              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>{param.definition}</p>
                            )}
                            {param.interpretationScale && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Interpretation Scale:</div>
                                <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                                  <span style={{ background: "#fef2f2", color: "#b91c1c", padding: "2px 8px", borderRadius: 4 }}>
                                    Low: {param.interpretationScale.low}
                                  </span>
                                  <span style={{ background: "#fefce8", color: "#a16207", padding: "2px 8px", borderRadius: 4 }}>
                                    Mid: {param.interpretationScale.mid}
                                  </span>
                                  <span style={{ background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: 4 }}>
                                    High: {param.interpretationScale.high}
                                  </span>
                                </div>
                              </div>
                            )}
                            {param.scoringAnchors && param.scoringAnchors.length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Scoring Anchors:</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, fontSize: 10 }}>
                                  {param.scoringAnchors.map((anchor: any, ai: number) => (
                                    <div key={ai} style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 4, padding: "4px 6px", textAlign: "center" }}>
                                      <div style={{ fontWeight: 600 }}>{anchor.score}</div>
                                      <div style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={anchor.label}>
                                        {anchor.label}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {showParameters && (!featureSet.parameters || featureSet.parameters.length === 0) && (
                      <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No parameters defined in source spec</p>
                    )}
                  </div>

                  {/* Prompt Guidance */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowPromptGuidance(!showPromptGuidance)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      <span>{showPromptGuidance ? "▼" : "▶"}</span>
                      Prompt Guidance ({featureSet.promptGuidance?.length || 0})
                    </button>
                    {showPromptGuidance && featureSet.promptGuidance && featureSet.promptGuidance.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {featureSet.promptGuidance.map((guidance: any, idx: number) => (
                          <div key={idx} style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 12 }}>
                            <div style={{ fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>{guidance.parameterId}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#16a34a", marginBottom: 4 }}>When High:</div>
                                <p style={{ color: "var(--text-secondary)", margin: 0 }}>{guidance.whenHigh}</p>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#dc2626", marginBottom: 4 }}>When Low:</div>
                                <p style={{ color: "var(--text-secondary)", margin: 0 }}>{guidance.whenLow}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Raw Spec JSON */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowRawSpec(!showRawSpec)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      <span>{showRawSpec ? "▼" : "▶"}</span>
                      Raw Spec JSON (Source)
                    </button>
                    {showRawSpec && featureSet.rawSpec && (
                      <pre style={{ background: "#1f2937", color: "#e5e7eb", fontSize: 11, fontFamily: "monospace", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 400 }}>
                        {JSON.stringify(featureSet.rawSpec, null, 2)}
                      </pre>
                    )}
                    {showRawSpec && !featureSet.rawSpec && (
                      <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No rawSpec stored</p>
                    )}
                  </div>

                  {/* Feature Set Metadata */}
                  <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 12 }}>BDDFeatureSet Metadata</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 12 }}>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Feature ID</div>
                        <div style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{featureSet.featureId}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Version</div>
                        <div style={{ color: "var(--text-primary)" }}>{featureSet.version}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Spec Type</div>
                        <div style={{ color: "var(--text-primary)" }}>{featureSet.specType}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Updated At</div>
                        <div style={{ color: "var(--text-primary)" }}>{new Date(featureSet.updatedAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Activated At</div>
                        <div style={{ color: "var(--text-primary)" }}>{featureSet.activatedAt ? new Date(featureSet.activatedAt).toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Status</div>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: featureSet.isActive ? "#dcfce7" : "#f3f4f6", color: featureSet.isActive ? "#166534" : "#6b7280" }}>
                          {featureSet.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* AnalysisSpec Metadata */}
              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 20, marginTop: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 12 }}>AnalysisSpec Metadata</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>ID</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-primary)" }}>{spec.id}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Priority</div>
                    <div style={{ color: "var(--text-primary)" }}>{spec.priority}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Version</div>
                    <div style={{ color: "var(--text-primary)" }}>{spec.version || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Compiled At</div>
                    <div style={{ color: "var(--text-primary)" }}>{spec.compiledAt ? new Date(spec.compiledAt).toLocaleString() : "Never"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Created</div>
                    <div style={{ color: "var(--text-primary)" }}>{new Date(spec.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Linked FeatureSet</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-primary)" }}>
                      {spec.compiledSetId ? spec.compiledSetId.slice(0, 8) + "..." : "None"}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
