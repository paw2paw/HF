"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

// Tree node type for Explorer tab
interface TreeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  children?: TreeNode[];
}

type ScoringAnchor = {
  id: string;
  score: number;
  example: string;
  rationale: string | null;
  positiveSignals: string[];
  negativeSignals: string[];
  isGold: boolean;
};

type ParameterInfo = {
  parameterId: string;
  name: string;
  definition?: string;
  scaleType: string;
  interpretationHigh?: string;
  interpretationLow?: string;
  scoringAnchors: ScoringAnchor[];
};

type AnalysisAction = {
  id: string;
  description: string;
  weight: number;
  parameterId: string | null;
  parameter: ParameterInfo | null;
  learnCategory: string | null;
  learnKeyPrefix: string | null;
  learnKeyHint: string | null;
};

type AnalysisTrigger = {
  id: string;
  name: string | null;
  given: string;
  when: string;
  then: string;
  actions: AnalysisAction[];
};

type SpecDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: "CALLER" | "DOMAIN" | "SYSTEM";
  outputType: "MEASURE" | "LEARN" | "ADAPT" | "MEASURE_AGENT";
  domain: string | null;
  priority: number;
  isActive: boolean;
  version: string;
  promptTemplate?: string | null;
  triggers?: AnalysisTrigger[];
  _count?: { triggers: number };
};

type Spec = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: "CALLER" | "DOMAIN" | "SYSTEM";
  outputType: "MEASURE" | "LEARN" | "ADAPT" | "MEASURE_AGENT";
  domain: string | null;
  priority: number;
  _count?: { triggers: number };
};

type PromptTemplateItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version?: string;
};

type PlaybookItem = {
  id: string;
  itemType: "SPEC" | "PROMPT_TEMPLATE";
  specId: string | null;
  promptTemplateId: string | null;
  spec: Spec | null;
  promptTemplate: PromptTemplateItem | null;
  isEnabled: boolean;
  sortOrder: number;
};

type Domain = {
  id: string;
  slug: string;
  name: string;
};

type Playbook = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
  publishedAt: string | null;
  domain: Domain;
  items: PlaybookItem[];
  _count: { items: number };
};

type AvailableItems = {
  callerSpecs: Spec[]; // Deprecated - always empty, kept for API compatibility
  domainSpecs: Spec[];
  systemSpecs: Spec[];
  promptTemplates: PromptTemplateItem[];
};

type BehaviorParameter = {
  parameterId: string;
  name: string;
  definition: string | null;
  domainGroup: string | null;
  systemValue: number | null;
  systemSource: string | null;
  playbookValue: number | null;
  playbookTargetId: string | null;
  effectiveValue: number;
  effectiveScope: string;
};

type TargetsData = {
  parameters: BehaviorParameter[];
  counts: {
    total: number;
    withPlaybookOverride: number;
    withSystemDefault: number;
  };
};

export default function PlaybookBuilderPage({
  params,
}: {
  params: Promise<{ playbookId: string }>;
}) {
  const { playbookId } = use(params);
  const router = useRouter();

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [availableItems, setAvailableItems] = useState<AvailableItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [items, setItems] = useState<PlaybookItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedPalette, setExpandedPalette] = useState<string>("domainSpecs");

  // Targets tab state
  const [activeTab, setActiveTab] = useState<"items" | "targets" | "explorer">("items");
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [pendingTargetChanges, setPendingTargetChanges] = useState<Map<string, number | null>>(new Map());
  const [savingTargets, setSavingTargets] = useState(false);
  const [compilingTargets, setCompilingTargets] = useState(false);
  const [creatingNewVersion, setCreatingNewVersion] = useState(false);

  // Explorer tab state
  const [explorerTree, setExplorerTree] = useState<TreeNode | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // Playbook items expanded state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [specDetails, setSpecDetails] = useState<Map<string, SpecDetail>>(new Map());
  const [loadingSpecId, setLoadingSpecId] = useState<string | null>(null);
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [playbookRes, availableRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch("/api/playbooks/available-items"),
      ]);

      const playbookData = await playbookRes.json();
      const availableData = await availableRes.json();

      if (playbookData.ok) {
        setPlaybook(playbookData.playbook);
        setItems(playbookData.playbook.items);
      } else {
        setError(playbookData.error);
      }

      if (availableData.ok) {
        setAvailableItems(availableData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch targets when switching to targets tab
  const fetchTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/targets`);
      const data = await res.json();
      if (data.ok) {
        setTargetsData(data);
        setPendingTargetChanges(new Map());
      }
    } catch (err: any) {
      console.error("Error fetching targets:", err);
    } finally {
      setTargetsLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    if (activeTab === "targets" && !targetsData) {
      fetchTargets();
    }
  }, [activeTab, targetsData, fetchTargets]);

  // Fetch explorer tree when switching to explorer tab
  const fetchExplorerTree = useCallback(async () => {
    setExplorerLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/tree`);
      const data = await res.json();
      if (data.ok) {
        setExplorerTree(data.tree);
        // Auto-expand first two levels and select root
        const toExpand = new Set<string>();
        if (data.tree) {
          toExpand.add(data.tree.id);
          data.tree.children?.forEach((child: TreeNode) => {
            toExpand.add(child.id);
          });
          setSelectedNode(data.tree);
        }
        setExpandedNodes(toExpand);
      }
    } catch (err: any) {
      console.error("Error fetching explorer tree:", err);
    } finally {
      setExplorerLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    if (activeTab === "explorer" && !explorerTree) {
      fetchExplorerTree();
    }
  }, [activeTab, explorerTree, fetchExplorerTree]);

  const toggleNodeExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllNodes = () => {
    if (!explorerTree) return;
    const allIds = new Set<string>();
    const collectIds = (node: TreeNode) => {
      allIds.add(node.id);
      node.children?.forEach(collectIds);
    };
    collectIds(explorerTree);
    setExpandedNodes(allIds);
  };

  const collapseAllNodes = () => {
    if (!explorerTree) return;
    setExpandedNodes(new Set([explorerTree.id]));
  };

  // Fetch spec details when expanding an item
  const fetchSpecDetail = useCallback(async (specId: string) => {
    if (specDetails.has(specId)) return; // Already loaded
    setLoadingSpecId(specId);
    try {
      const res = await fetch(`/api/analysis-specs/${specId}`);
      const data = await res.json();
      if (data.ok && data.spec) {
        setSpecDetails((prev) => new Map(prev).set(specId, data.spec));
      }
    } catch (err: any) {
      console.error("Error fetching spec detail:", err);
    } finally {
      setLoadingSpecId(null);
    }
  }, [specDetails]);

  const toggleItemExpanded = (itemId: string, specId: string | null) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        // Fetch spec details if expanding and have a spec
        if (specId) {
          fetchSpecDetail(specId);
        }
      }
      return next;
    });
  };

  const toggleTriggerExpanded = (triggerId: string) => {
    setExpandedTriggers((prev) => {
      const next = new Set(prev);
      if (next.has(triggerId)) {
        next.delete(triggerId);
      } else {
        next.add(triggerId);
      }
      return next;
    });
  };

  const toggleActionExpanded = (actionId: string) => {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const handleTargetChange = (parameterId: string, value: number | null) => {
    const newChanges = new Map(pendingTargetChanges);
    newChanges.set(parameterId, value);
    setPendingTargetChanges(newChanges);
  };

  const handleSaveTargets = async () => {
    if (pendingTargetChanges.size === 0) return;

    setSavingTargets(true);
    try {
      const targets = Array.from(pendingTargetChanges.entries()).map(([parameterId, targetValue]) => ({
        parameterId,
        targetValue,
      }));

      const res = await fetch(`/api/playbooks/${playbookId}/targets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });

      const data = await res.json();
      if (data.ok) {
        // Refresh targets data
        await fetchTargets();
      } else {
        alert("Failed to save targets: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving targets: " + err.message);
    } finally {
      setSavingTargets(false);
    }
  };

  const handleCompileTargets = async () => {
    // Save first if there are unsaved changes
    if (hasChanges) {
      await handleSave();
    }

    setCompilingTargets(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/compile-targets`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.ok) {
        // Refresh targets data and switch to targets tab
        setTargetsData(null); // Force refetch
        setActiveTab("targets");
        await fetchTargets();
        alert(`Compiled targets: ${data.compiled} new, ${data.skipped} existing`);
      } else {
        alert("Failed to compile targets: " + data.error);
      }
    } catch (err: any) {
      alert("Error compiling targets: " + err.message);
    } finally {
      setCompilingTargets(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!confirm("Create a new draft version from this published playbook?")) {
      return;
    }

    setCreatingNewVersion(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/new-version`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.ok) {
        // Navigate to the new draft
        router.push(`/playbooks/${data.playbook.id}`);
      } else {
        if (data.draftId) {
          if (confirm(`${data.error}\n\nWould you like to open the existing draft?`)) {
            router.push(`/playbooks/${data.draftId}`);
          }
        } else {
          alert("Failed to create new version: " + data.error);
        }
      }
    } catch (err: any) {
      alert("Error creating new version: " + err.message);
    } finally {
      setCreatingNewVersion(false);
    }
  };

  const getEffectiveValue = (param: BehaviorParameter): number => {
    if (pendingTargetChanges.has(param.parameterId)) {
      const pending = pendingTargetChanges.get(param.parameterId);
      if (pending !== null && pending !== undefined) return pending;
      // If pending is null (reset), fall back to system
      return param.systemValue ?? 0.5;
    }
    return param.effectiveValue;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item, idx) => ({
            itemType: item.itemType,
            specId: item.specId,
            promptTemplateId: item.promptTemplateId,
            isEnabled: item.isEnabled,
            sortOrder: idx,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybook(data.playbook);
        setItems(data.playbook.items);
        setHasChanges(false);
      } else {
        alert("Failed to save: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("Publish this playbook? This will archive any currently published playbook for this domain.")) {
      return;
    }

    // Save first if there are changes
    if (hasChanges) {
      await handleSave();
    }

    setPublishing(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/publish`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.ok) {
        setPlaybook(data.playbook);
        alert(`Playbook published successfully!\n\nStats:\n- ${data.stats.measureSpecCount} MEASURE specs\n- ${data.stats.learnSpecCount} LEARN specs\n- ${data.stats.adaptSpecCount} ADAPT specs\n- ${data.stats.parameterCount} unique parameters`);
      } else {
        const errors = data.validationErrors?.map((e: any) => `- ${e.error}`).join("\n") || data.error;
        alert(`Failed to publish:\n${errors}`);
      }
    } catch (err: any) {
      alert("Error publishing: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this playbook? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/playbooks");
      } else {
        alert("Failed to delete: " + data.error);
      }
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (draggedItem?.startsWith("palette-")) {
      // Dropping from palette - format is "palette-{type}-{uuid}"
      // Need to handle UUID which contains dashes
      const parts = draggedItem.split("-");
      const type = parts[1]; // "spec" or "template"
      const id = parts.slice(2).join("-"); // Rejoin the UUID parts
      addItemFromPalette(type, id, targetIndex);
    } else if (draggedItem) {
      // Reordering existing items
      const currentIndex = items.findIndex((item) => item.id === draggedItem);
      if (currentIndex !== -1 && currentIndex !== targetIndex) {
        const newItems = [...items];
        const [removed] = newItems.splice(currentIndex, 1);
        newItems.splice(targetIndex, 0, removed);
        setItems(newItems);
        setHasChanges(true);
      }
    }

    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const addItemFromPalette = (type: string, id: string, index?: number) => {
    if (playbook?.status === "PUBLISHED") return;

    let newItem: PlaybookItem;

    if (type === "spec") {
      // Note: callerSpecs excluded - they are auto-generated by learning system
      const allSpecs = [
        ...(availableItems?.domainSpecs || []),
        ...(availableItems?.systemSpecs || []),
      ];
      const spec = allSpecs.find((s) => s.id === id);
      if (!spec) return;

      // Check if already added
      if (items.some((item) => item.specId === id)) {
        alert("This spec is already in the playbook");
        return;
      }

      newItem = {
        id: `temp-${Date.now()}`,
        itemType: "SPEC",
        specId: id,
        promptTemplateId: null,
        spec: spec,
        promptTemplate: null,
        isEnabled: true,
        sortOrder: index ?? items.length,
      };
    } else if (type === "template") {
      const template = availableItems?.promptTemplates.find((t) => t.id === id);
      if (!template) return;

      // Check if already added
      if (items.some((item) => item.promptTemplateId === id)) {
        alert("This template is already in the playbook");
        return;
      }

      newItem = {
        id: `temp-${Date.now()}`,
        itemType: "PROMPT_TEMPLATE",
        specId: null,
        promptTemplateId: id,
        spec: null,
        promptTemplate: template,
        isEnabled: true,
        sortOrder: index ?? items.length,
      };
    } else {
      return;
    }

    const newItems = [...items];
    newItems.splice(index ?? items.length, 0, newItem);
    setItems(newItems);
    setHasChanges(true);
  };

  const removeItem = (itemId: string) => {
    if (playbook?.status === "PUBLISHED") return;
    setItems(items.filter((item) => item.id !== itemId));
    setHasChanges(true);
  };

  const toggleItemEnabled = (itemId: string) => {
    if (playbook?.status === "PUBLISHED") return;
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, isEnabled: !item.isEnabled } : item
      )
    );
    setHasChanges(true);
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
      <span style={{ fontSize: 9, padding: "2px 6px", background: s.bg, color: s.color, borderRadius: 4, fontWeight: 500 }}>
        {outputType}
      </span>
    );
  };

  const scopeBadge = (scope: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      CALLER: { bg: "#dbeafe", color: "#1d4ed8" }, // Kept for display only (auto-generated)
      DOMAIN: { bg: "#fce7f3", color: "#be185d" },
      SYSTEM: { bg: "#f3f4f6", color: "#374151" },
    };
    const s = styles[scope] || styles.SYSTEM;
    return (
      <span style={{ fontSize: 8, padding: "1px 4px", background: s.bg, color: s.color, borderRadius: 3, fontWeight: 500 }}>
        {scope}
      </span>
    );
  };

  if (loading) {
    return <div style={{ padding: 32 }}><p style={{ color: "#6b7280" }}>Loading playbook...</p></div>;
  }

  if (error || !playbook) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "#dc2626" }}>Error: {error || "Playbook not found"}</p>
        <Link href="/playbooks" style={{ color: "#4f46e5" }}>Back to Playbooks</Link>
      </div>
    );
  }

  const isEditable = playbook.status === "DRAFT";

  return (
    <div style={{ padding: 32 }}>
      <SourcePageHeader
        title={playbook.name}
        description={`${playbook.domain.name} — v${playbook.version}`}
        dataNodeId="playbooks"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                background: playbook.status === "PUBLISHED" ? "#dcfce7" : playbook.status === "DRAFT" ? "#fef3c7" : "#f3f4f6",
                color: playbook.status === "PUBLISHED" ? "#166534" : playbook.status === "DRAFT" ? "#92400e" : "#6b7280",
                borderRadius: 6,
              }}
            >
              {playbook.status}
            </span>
            {isEditable && (
              <>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    background: "white",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: hasChanges ? "#4f46e5" : "#e5e7eb",
                    color: hasChanges ? "white" : "#9ca3af",
                    border: "none",
                    borderRadius: 6,
                    cursor: hasChanges && !saving ? "pointer" : "not-allowed",
                  }}
                >
                  {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
                </button>
                <button
                  onClick={handleCompileTargets}
                  disabled={compilingTargets || items.length === 0}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "#7c3aed",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: compilingTargets || items.length === 0 ? "not-allowed" : "pointer",
                    opacity: items.length === 0 ? 0.5 : 1,
                  }}
                >
                  {compilingTargets ? "Compiling..." : "Compile Targets"}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || items.length === 0}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: publishing || items.length === 0 ? "not-allowed" : "pointer",
                    opacity: items.length === 0 ? 0.5 : 1,
                  }}
                >
                  {publishing ? "Publishing..." : "Publish"}
                </button>
              </>
            )}
            {playbook.status === "PUBLISHED" && (
              <button
                onClick={handleCreateNewVersion}
                disabled={creatingNewVersion}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: creatingNewVersion ? "not-allowed" : "pointer",
                }}
              >
                {creatingNewVersion ? "Creating..." : "Edit (New Version)"}
              </button>
            )}
          </div>
        }
      />

      {/* System Specs Info Banner */}
      <div style={{
        marginTop: 24,
        padding: "12px 16px",
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <div>
          <div style={{ fontWeight: 600, color: "#166534", fontSize: 13 }}>
            System Layer Always Runs
          </div>
          <div style={{ fontSize: 12, color: "#15803d" }}>
            Memory extraction, OCEAN personality, and session deltas run automatically for every call.
            This playbook configures domain-specific behavior targets.
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 0, marginTop: 16, borderBottom: "1px solid #e5e7eb" }}>
        <button
          onClick={() => setActiveTab("items")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: activeTab === "items" ? "white" : "transparent",
            color: activeTab === "items" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "items" ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          📋 Custom Specs ({items.length})
        </button>
        <button
          onClick={() => setActiveTab("targets")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: activeTab === "targets" ? "white" : "transparent",
            color: activeTab === "targets" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "targets" ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          ⚙️ Behavior Targets {targetsData ? `(${targetsData.counts.total})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("explorer")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: activeTab === "explorer" ? "white" : "transparent",
            color: activeTab === "explorer" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "explorer" ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          🌳 Explorer
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "items" && (
      <>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginTop: 24, height: "calc(100vh - 250px)" }}>
        {/* Left: Palette */}
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: 16, height: "100%", overflowY: "auto" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, position: "sticky", top: 0, background: "#f9fafb", paddingBottom: 8 }}>
            Available Items
          </h3>

          {/* Note: Caller Specs removed - they are auto-generated by the learning system */}

          {/* Domain Specs */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setExpandedPalette(expandedPalette === "domainSpecs" ? "" : "domainSpecs")}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#fce7f3",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#be185d",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Domain Specs ({availableItems?.domainSpecs.length || 0})</span>
              <span>{expandedPalette === "domainSpecs" ? "−" : "+"}</span>
            </button>
            {expandedPalette === "domainSpecs" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {availableItems?.domainSpecs.map((spec) => (
                  <div
                    key={spec.id}
                    draggable={isEditable}
                    onDragStart={(e) => handleDragStart(e, `palette-spec-${spec.id}`)}
                    onClick={() => isEditable && addItemFromPalette("spec", spec.id)}
                    style={{
                      padding: "8px 10px",
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: isEditable ? "grab" : "default",
                      opacity: items.some((i) => i.specId === spec.id) ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
                      {outputTypeBadge(spec.outputType)}
                      <span style={{ fontWeight: 500 }}>{spec.name}</span>
                    </div>
                  </div>
                ))}
                {(!availableItems?.domainSpecs.length) && (
                  <p style={{ fontSize: 11, color: "#9ca3af", padding: 8 }}>No domain specs available</p>
                )}
              </div>
            )}
          </div>

          {/* System Specs */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setExpandedPalette(expandedPalette === "systemSpecs" ? "" : "systemSpecs")}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#f3f4f6",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>System Specs ({availableItems?.systemSpecs.length || 0})</span>
              <span>{expandedPalette === "systemSpecs" ? "−" : "+"}</span>
            </button>
            {expandedPalette === "systemSpecs" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {availableItems?.systemSpecs.map((spec) => (
                  <div
                    key={spec.id}
                    draggable={isEditable}
                    onDragStart={(e) => handleDragStart(e, `palette-spec-${spec.id}`)}
                    onClick={() => isEditable && addItemFromPalette("spec", spec.id)}
                    style={{
                      padding: "8px 10px",
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: isEditable ? "grab" : "default",
                      opacity: items.some((i) => i.specId === spec.id) ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
                      {outputTypeBadge(spec.outputType)}
                      <span style={{ fontWeight: 500 }}>{spec.name}</span>
                    </div>
                  </div>
                ))}
                {(!availableItems?.systemSpecs.length) && (
                  <p style={{ fontSize: 11, color: "#9ca3af", padding: 8 }}>No system specs available</p>
                )}
              </div>
            )}
          </div>

          {/* Prompt Templates */}
          <div>
            <button
              onClick={() => setExpandedPalette(expandedPalette === "templates" ? "" : "templates")}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#fef3c7",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#92400e",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Prompt Templates ({availableItems?.promptTemplates.length || 0})</span>
              <span>{expandedPalette === "templates" ? "−" : "+"}</span>
            </button>
            {expandedPalette === "templates" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {availableItems?.promptTemplates.map((template) => (
                  <div
                    key={template.id}
                    draggable={isEditable}
                    onDragStart={(e) => handleDragStart(e, `palette-template-${template.id}`)}
                    onClick={() => isEditable && addItemFromPalette("template", template.id)}
                    style={{
                      padding: "8px 10px",
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: isEditable ? "grab" : "default",
                      opacity: items.some((i) => i.promptTemplateId === template.id) ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 9, padding: "1px 4px", background: "#fef3c7", color: "#92400e", borderRadius: 3, fontWeight: 500 }}>
                        TEMPLATE
                      </span>
                      <span style={{ fontWeight: 500 }}>{template.name}</span>
                    </div>
                  </div>
                ))}
                {(!availableItems?.promptTemplates.length) && (
                  <p style={{ fontSize: 11, color: "#9ca3af", padding: 8 }}>No templates available</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Playbook Items */}
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", paddingBottom: 8, zIndex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Playbook Items ({items.length})
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Execution order: top → bottom
            </p>
          </div>

          {items.length === 0 ? (
            <div
              onDragOver={(e) => handleDragOver(e, 0)}
              onDrop={(e) => handleDrop(e, 0)}
              style={{
                padding: 48,
                textAlign: "center",
                background: dragOverIndex === 0 ? "#e0e7ff" : "#f9fafb",
                borderRadius: 8,
                border: "2px dashed #d1d5db",
                transition: "background 0.15s",
              }}
            >
              <p style={{ color: "#6b7280", marginBottom: 8 }}>
                {isEditable ? "Drag specs and templates here to build your playbook" : "This playbook has no items"}
              </p>
              {isEditable && (
                <p style={{ fontSize: 12, color: "#9ca3af" }}>
                  Or click items in the palette to add them
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item, index) => {
                const isItemExpanded = expandedItems.has(item.id);
                const detail = item.specId ? specDetails.get(item.specId) : null;
                const isLoading = loadingSpecId === item.specId;

                return (
                <div
                  key={item.id}
                  draggable={isEditable && !isItemExpanded}
                  onDragStart={(e) => !isItemExpanded && handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{
                    background: dragOverIndex === index ? "#e0e7ff" : isItemExpanded ? "#f8fafc" : "white",
                    border: isItemExpanded ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    borderRadius: 8,
                    opacity: item.isEnabled ? 1 : 0.5,
                    transition: "all 0.15s",
                  }}
                >
                  {/* Header - always visible */}
                  <div
                    onClick={() => item.spec && toggleItemExpanded(item.id, item.specId)}
                    style={{
                      padding: 16,
                      cursor: item.spec ? "pointer" : "default",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                      {/* Expand/collapse indicator for specs */}
                      {item.spec && (
                        <span style={{ color: "#9ca3af", fontSize: 12, minWidth: 20, marginTop: 2 }}>
                          {isItemExpanded ? "▼" : "▶"}
                        </span>
                      )}
                      {!item.spec && (
                        <span style={{ color: "#9ca3af", fontSize: 12, minWidth: 20 }}>
                          {index + 1}.
                        </span>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          {item.spec && (
                            <>
                              {scopeBadge(item.spec.scope)}
                              {outputTypeBadge(item.spec.outputType)}
                              <span style={{ fontWeight: 600, color: "#1f2937" }}>
                                {item.spec.name}
                              </span>
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                                {item.spec._count?.triggers || 0} triggers
                              </span>
                            </>
                          )}
                          {item.promptTemplate && (
                            <>
                              <span style={{ fontSize: 9, padding: "2px 6px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontWeight: 500 }}>
                                TEMPLATE
                              </span>
                              <Link
                                href={`/prompt-templates?selected=${item.promptTemplate.id}`}
                                style={{ fontWeight: 600, color: "#1f2937", textDecoration: "none" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.promptTemplate.name}
                                <span style={{ marginLeft: 4, fontSize: 10, color: "#9ca3af" }}>→</span>
                              </Link>
                            </>
                          )}
                        </div>
                        {item.spec?.description && (
                          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                            {item.spec.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Actions - stop propagation to prevent expand/collapse */}
                    <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      {item.spec && (
                        <Link
                          href={`/analysis-specs?scope=${item.spec.scope}&select=${item.spec.id}`}
                          style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            background: "#f3f4f6",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            color: "#4b5563",
                            textDecoration: "none",
                          }}
                        >
                          Edit →
                        </Link>
                      )}
                      {isEditable && (
                        <>
                          <button
                            onClick={() => toggleItemEnabled(item.id)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              background: "white",
                              border: "1px solid #d1d5db",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            {item.isEnabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isItemExpanded && item.spec && (
                    <div style={{ borderTop: "1px solid #e5e7eb", padding: 16, background: "white", borderRadius: "0 0 6px 6px" }}>
                      {isLoading ? (
                        <div style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                          Loading spec details...
                        </div>
                      ) : detail?.triggers && detail.triggers.length > 0 ? (
                        <div>
                          {/* Triggers header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                              Triggers ({detail.triggers.length})
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => {
                                  const allTriggerIds = new Set(detail.triggers!.map(t => t.id));
                                  const allActionIds = new Set(detail.triggers!.flatMap(t => t.actions.map(a => a.id)));
                                  setExpandedTriggers(prev => new Set([...prev, ...allTriggerIds]));
                                  setExpandedActions(prev => new Set([...prev, ...allActionIds]));
                                }}
                                style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 10, color: "#6b7280", background: "#f3f4f6", cursor: "pointer" }}
                              >
                                Expand All
                              </button>
                              <button
                                onClick={() => {
                                  const triggerIds = detail.triggers!.map(t => t.id);
                                  const actionIds = detail.triggers!.flatMap(t => t.actions.map(a => a.id));
                                  setExpandedTriggers(prev => {
                                    const next = new Set(prev);
                                    triggerIds.forEach(id => next.delete(id));
                                    return next;
                                  });
                                  setExpandedActions(prev => {
                                    const next = new Set(prev);
                                    actionIds.forEach(id => next.delete(id));
                                    return next;
                                  });
                                }}
                                style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 10, color: "#6b7280", background: "#f3f4f6", cursor: "pointer" }}
                              >
                                Collapse All
                              </button>
                            </div>
                          </div>

                          {/* Triggers list */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {detail.triggers.map((trigger, tIdx) => (
                              <div key={trigger.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, background: "#fafafa" }}>
                                {/* Trigger header */}
                                <div
                                  onClick={() => toggleTriggerExpanded(trigger.id)}
                                  style={{ padding: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>
                                      Trigger {tIdx + 1}: {trigger.name || "Unnamed"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                      {trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                  <span style={{ color: "#9ca3af", fontSize: 12 }}>
                                    {expandedTriggers.has(trigger.id) ? "▼" : "▶"}
                                  </span>
                                </div>

                                {/* Trigger expanded content */}
                                {expandedTriggers.has(trigger.id) && (
                                  <div style={{ borderTop: "1px solid #e5e7eb", padding: 12 }}>
                                    {/* Given/When/Then */}
                                    <div style={{ marginBottom: 12, padding: 10, background: "#f9fafb", borderRadius: 6, fontFamily: "monospace", fontSize: 12 }}>
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: "#7c3aed" }}>Given</span>{" "}
                                        <span style={{ color: "#1f2937" }}>{trigger.given}</span>
                                      </div>
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: "#2563eb" }}>When</span>{" "}
                                        <span style={{ color: "#1f2937" }}>{trigger.when}</span>
                                      </div>
                                      <div>
                                        <span style={{ fontWeight: 600, color: "#16a34a" }}>Then</span>{" "}
                                        <span style={{ color: "#1f2937" }}>{trigger.then}</span>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {trigger.actions.map((action, aIdx) => (
                                        <div key={action.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, background: "white" }}>
                                          {/* Action header */}
                                          <div
                                            onClick={() => toggleActionExpanded(action.id)}
                                            style={{ padding: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                              <span style={{
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                                fontSize: 10,
                                                fontWeight: 500,
                                                background: detail.outputType === "LEARN" ? "#fef3c7" : "#e0e7ff",
                                                color: detail.outputType === "LEARN" ? "#d97706" : "#4f46e5",
                                              }}>
                                                {detail.outputType === "LEARN" ? "EXT" : "AC"}{aIdx + 1}
                                              </span>
                                              <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
                                                {action.description}
                                              </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                              {action.parameter && (
                                                <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3e8ff", color: "#7c3aed", borderRadius: 4 }}>
                                                  {action.parameter.parameterId}
                                                </span>
                                              )}
                                              {action.learnCategory && (
                                                <span style={{ fontSize: 10, padding: "2px 6px", background: "#fef3c7", color: "#d97706", borderRadius: 4 }}>
                                                  {action.learnCategory}
                                                </span>
                                              )}
                                              <span style={{ color: "#9ca3af", fontSize: 10 }}>
                                                {expandedActions.has(action.id) ? "▼" : "▶"}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Action expanded content */}
                                          {expandedActions.has(action.id) && (
                                            <div style={{ borderTop: "1px solid #f3f4f6", padding: 10 }}>
                                              {/* MEASURE: Show parameter + anchors */}
                                              {detail.outputType === "MEASURE" && action.parameter && (
                                                <>
                                                  <div style={{ marginBottom: 8, padding: 8, background: "#f3e8ff", borderRadius: 6, fontSize: 12 }}>
                                                    <div style={{ fontWeight: 500, color: "#7c3aed" }}>
                                                      Parameter: {action.parameter.name}
                                                    </div>
                                                    {action.parameter.definition && (
                                                      <div style={{ marginTop: 4, color: "#6b7280" }}>
                                                        {action.parameter.definition}
                                                      </div>
                                                    )}
                                                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
                                                      {action.parameter.interpretationHigh && (
                                                        <div>
                                                          <span style={{ fontWeight: 500, color: "#16a34a" }}>High:</span>{" "}
                                                          <span style={{ color: "#6b7280" }}>{action.parameter.interpretationHigh}</span>
                                                        </div>
                                                      )}
                                                      {action.parameter.interpretationLow && (
                                                        <div>
                                                          <span style={{ fontWeight: 500, color: "#dc2626" }}>Low:</span>{" "}
                                                          <span style={{ color: "#6b7280" }}>{action.parameter.interpretationLow}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Scoring Anchors */}
                                                  {action.parameter.scoringAnchors && action.parameter.scoringAnchors.length > 0 && (
                                                    <div>
                                                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
                                                        Scoring Anchors ({action.parameter.scoringAnchors.length})
                                                      </div>
                                                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        {action.parameter.scoringAnchors.map((anchor) => (
                                                          <div key={anchor.id} style={{ padding: 8, background: "#f9fafb", borderRadius: 4, fontSize: 11 }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                              <span style={{
                                                                padding: "2px 6px",
                                                                borderRadius: 4,
                                                                fontWeight: 600,
                                                                fontSize: 10,
                                                                background: anchor.score >= 0.7 ? "#dcfce7" : anchor.score <= 0.3 ? "#fee2e2" : "#fef3c7",
                                                                color: anchor.score >= 0.7 ? "#16a34a" : anchor.score <= 0.3 ? "#dc2626" : "#d97706",
                                                              }}>
                                                                {(anchor.score * 100).toFixed(0)}%{anchor.isGold && " ⭐"}
                                                              </span>
                                                              <span style={{ color: "#374151", fontStyle: "italic" }}>"{anchor.example}"</span>
                                                            </div>
                                                            {anchor.rationale && (
                                                              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 10 }}>
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
                                              {detail.outputType === "LEARN" && (
                                                <div style={{ padding: 8, background: "#fffbeb", borderRadius: 6, fontSize: 12 }}>
                                                  <div style={{ fontWeight: 500, color: "#d97706" }}>
                                                    Learns to: {action.learnCategory || "Not configured"}
                                                  </div>
                                                  {action.learnKeyPrefix && (
                                                    <div style={{ marginTop: 4, color: "#b45309" }}>
                                                      Key prefix: <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>{action.learnKeyPrefix}</code>
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
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: 16, color: "#9ca3af", fontSize: 13 }}>
                          No triggers configured for this spec.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
              })}
              {/* Drop zone at end */}
              {isEditable && (
                <div
                  onDragOver={(e) => handleDragOver(e, items.length)}
                  onDrop={(e) => handleDrop(e, items.length)}
                  style={{
                    padding: 16,
                    textAlign: "center",
                    background: dragOverIndex === items.length ? "#e0e7ff" : "transparent",
                    borderRadius: 8,
                    border: "2px dashed #e5e7eb",
                    color: "#9ca3af",
                    fontSize: 12,
                    transition: "background 0.15s",
                  }}
                >
                  Drop here to add at end
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Specs Section - Always Runs */}
      {availableItems?.systemSpecs && availableItems.systemSpecs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
            border: "1px solid #bbf7d0",
            borderRadius: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>🔄</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#166534" }}>
                  System Specs (Always Run)
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#15803d" }}>
                  These specs run automatically for every call, regardless of playbook configuration.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {availableItems.systemSpecs.map((spec) => (
                <Link
                  key={spec.id}
                  href={`/analysis-specs?scope=SYSTEM&select=${spec.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "white",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#22c55e";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(34, 197, 94, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#bbf7d0";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      {outputTypeBadge(spec.outputType)}
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>{spec.name}</span>
                    </div>
                    {spec.description && (
                      <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
                        {spec.description}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 10, color: "#9ca3af" }}>
                      {spec._count?.triggers || 0} triggers • Click to view details →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Targets Tab */}
      {activeTab === "targets" && (
        <div style={{ marginTop: 24 }}>
          {targetsLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Loading behavior targets...
            </div>
          ) : !targetsData || targetsData.parameters.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
              <p style={{ color: "#374151", marginBottom: 8, fontWeight: 500, fontSize: 16 }}>
                Configure Behavior Dimensions
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                Behavior dimensions control how the agent communicates with callers in this domain.
              </p>
              {isEditable && (
                <button
                  onClick={handleCompileTargets}
                  disabled={compilingTargets}
                  style={{
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "#7c3aed",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: compilingTargets ? "not-allowed" : "pointer",
                  }}
                >
                  {compilingTargets ? "Loading..." : "Load Behavior Dimensions"}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Targets header with save button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#111827" }}>
                    Behavior Dimensions
                  </h3>
                  <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#6b7280" }}>
                    Adjust sliders to configure agent behavior for the {playbook.domain.name} domain.
                    <span style={{ marginLeft: 8, color: "#9ca3af" }}>
                      {targetsData.counts.withPlaybookOverride} customized, {targetsData.counts.withSystemDefault} using defaults
                    </span>
                  </p>
                </div>
                {isEditable && pendingTargetChanges.size > 0 && (
                  <button
                    onClick={handleSaveTargets}
                    disabled={savingTargets}
                    style={{
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 500,
                      background: "#4f46e5",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: savingTargets ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingTargets ? "Saving..." : `Save ${pendingTargetChanges.size} Changes`}
                  </button>
                )}
              </div>

              {/* Behavior Dimension Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 16 }}>
                {targetsData.parameters.map((param) => {
                  const effectiveValue = getEffectiveValue(param);
                  const hasPendingChange = pendingTargetChanges.has(param.parameterId);
                  const pendingValue = pendingTargetChanges.get(param.parameterId);
                  const hasPlaybookOverride = param.playbookValue !== null || (hasPendingChange && pendingValue !== null);

                  return (
                    <div
                      key={param.parameterId}
                      style={{
                        background: hasPendingChange ? "#fffbeb" : "white",
                        border: hasPendingChange ? "2px solid #fbbf24" : hasPlaybookOverride ? "1px solid #818cf8" : "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 20,
                        transition: "all 0.15s",
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
                            {param.name}
                          </div>
                          {param.definition && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>
                              {param.definition}
                            </div>
                          )}
                        </div>
                        {param.domainGroup && (
                          <span style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            background: "#f3f4f6",
                            color: "#6b7280",
                            borderRadius: 4,
                            fontWeight: 500,
                          }}>
                            {param.domainGroup}
                          </span>
                        )}
                      </div>

                      {/* Slider + Value */}
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          {/* Low label */}
                          <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 28 }}>Low</span>

                          {/* Slider */}
                          {isEditable ? (
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={
                                hasPendingChange
                                  ? (pendingValue !== null && pendingValue !== undefined ? pendingValue * 100 : param.systemValue ? param.systemValue * 100 : 50)
                                  : (param.playbookValue !== null ? param.playbookValue * 100 : param.systemValue ? param.systemValue * 100 : 50)
                              }
                              onChange={(e) => handleTargetChange(param.parameterId, parseInt(e.target.value) / 100)}
                              style={{
                                flex: 1,
                                height: 8,
                                cursor: "pointer",
                                accentColor: hasPlaybookOverride ? "#4f46e5" : "#9ca3af",
                              }}
                            />
                          ) : (
                            <div style={{
                              flex: 1,
                              height: 8,
                              background: "#e5e7eb",
                              borderRadius: 4,
                              position: "relative",
                            }}>
                              <div style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                height: "100%",
                                width: `${effectiveValue * 100}%`,
                                background: hasPlaybookOverride ? "#4f46e5" : "#9ca3af",
                                borderRadius: 4,
                              }} />
                            </div>
                          )}

                          {/* High label */}
                          <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 32 }}>High</span>

                          {/* Value badge */}
                          <div style={{
                            minWidth: 60,
                            padding: "6px 10px",
                            background: hasPlaybookOverride ? "#eef2ff" : "#f3f4f6",
                            borderRadius: 6,
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: 14,
                            color: hasPlaybookOverride ? "#4f46e5" : "#374151",
                          }}>
                            {(effectiveValue * 100).toFixed(0)}%
                          </div>
                        </div>

                        {/* Footer: System vs Playbook indicator */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>
                            System default: {param.systemValue !== null ? `${(param.systemValue * 100).toFixed(0)}%` : "—"}
                          </div>
                          {isEditable && hasPlaybookOverride && (
                            <button
                              onClick={() => handleTargetChange(param.parameterId, null)}
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                background: "transparent",
                                border: "1px solid #e5e7eb",
                                color: "#6b7280",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              Reset to default
                            </button>
                          )}
                          {!hasPlaybookOverride && (
                            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>
                              ✓ Using system default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info box */}
              <div style={{
                marginTop: 24,
                padding: 16,
                background: "#faf5ff",
                border: "1px solid #e9d5ff",
                borderRadius: 8,
                fontSize: 13,
                color: "#7c3aed",
              }}>
                <strong>Target Cascade:</strong> SYSTEM → PLAYBOOK → SEGMENT → CALLER.
                Playbook targets override system defaults. As the reward loop learns caller preferences, individual caller targets will be created automatically.
              </div>
            </>
          )}
        </div>
      )}

      {/* Explorer Tab */}
      {activeTab === "explorer" && (
        <div style={{ marginTop: 24 }}>
          {explorerLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Loading playbook tree...
            </div>
          ) : !explorerTree ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Failed to load playbook structure
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24, height: "calc(100vh - 300px)" }}>
              {/* Left Panel: File Explorer Tree */}
              <div style={{
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}>
                {/* Tree Header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e7eb",
                  background: "white",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>Playbook Structure</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={expandAllNodes}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        background: "#e0e7ff",
                        color: "#4338ca",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Expand
                    </button>
                    <button
                      onClick={collapseAllNodes}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        background: "#f3f4f6",
                        color: "#6b7280",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Collapse
                    </button>
                  </div>
                </div>
                {/* Tree Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                  <ExplorerTreeNode
                    node={explorerTree}
                    depth={0}
                    expandedNodes={expandedNodes}
                    selectedNode={selectedNode}
                    onToggle={toggleNodeExpand}
                    onSelect={setSelectedNode}
                  />
                </div>
              </div>

              {/* Right Panel: Detail View */}
              <div style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}>
                {selectedNode ? (
                  <NodeDetailPanel node={selectedNode} />
                ) : (
                  <div style={{
                    padding: 48,
                    textAlign: "center",
                    color: "#9ca3af",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}>
                    <span style={{ fontSize: 48, marginBottom: 16 }}>🌳</span>
                    <p style={{ fontSize: 14 }}>Select an item from the tree to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Explorer Tree Node Component
const nodeIcons: Record<string, string> = {
  playbook: "📚",
  group: "📁",
  spec: "📋",
  trigger: "⚡",
  action: "▶️",
  parameter: "📐",
  "anchor-group": "📍",
  anchor: "🎚️",
  "target-group": "🎯",
  target: "🎯",
  config: "⚙️",
  scoring: "📊",
  thresholds: "📏",
  slug: "🏷️",
  "param-ref": "🔗",
  template: "📝",
  block: "🧱",
};

const nodeColors: Record<string, { bg: string; border: string; text: string; selectedBg: string }> = {
  playbook: { bg: "#f3e8ff", border: "#c084fc", text: "#7c3aed", selectedBg: "#ede9fe" },
  group: { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb", selectedBg: "#dbeafe" },
  spec: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", selectedBg: "#dcfce7" },
  trigger: { bg: "#fef9c3", border: "#fde047", text: "#ca8a04", selectedBg: "#fef08a" },
  action: { bg: "#ffedd5", border: "#fdba74", text: "#ea580c", selectedBg: "#fed7aa" },
  parameter: { bg: "#eef2ff", border: "#a5b4fc", text: "#4f46e5", selectedBg: "#e0e7ff" },
  "anchor-group": { bg: "#fdf2f8", border: "#f9a8d4", text: "#db2777", selectedBg: "#fce7f3" },
  anchor: { bg: "#fdf2f8", border: "#f9a8d4", text: "#be185d", selectedBg: "#fce7f3" },
  "target-group": { bg: "#f0fdfa", border: "#5eead4", text: "#0d9488", selectedBg: "#ccfbf1" },
  target: { bg: "#f0fdfa", border: "#5eead4", text: "#0f766e", selectedBg: "#ccfbf1" },
  config: { bg: "#f9fafb", border: "#d1d5db", text: "#6b7280", selectedBg: "#f3f4f6" },
  template: { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", selectedBg: "#fef3c7" },
  block: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", selectedBg: "#fef3c7" },
};

function ExplorerTreeNode({
  node,
  depth,
  expandedNodes,
  selectedNode,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedNode: TreeNode | null;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;
  const icon = nodeIcons[node.type] || "📄";
  const colors = nodeColors[node.type] || nodeColors.config;

  return (
    <div>
      <div
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          marginLeft: depth * 16,
          borderRadius: 6,
          cursor: "pointer",
          background: isSelected ? colors.selectedBg : "transparent",
          border: isSelected ? `1px solid ${colors.border}` : "1px solid transparent",
          transition: "all 0.1s",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Expand/Collapse Icon */}
        <span style={{
          width: 14,
          fontSize: 10,
          color: "#9ca3af",
          flexShrink: 0,
          textAlign: "center",
        }}>
          {hasChildren ? (isExpanded ? "▼" : "▶") : ""}
        </span>

        {/* Node Icon */}
        <span style={{ flexShrink: 0 }}>{icon}</span>

        {/* Node Name */}
        <span style={{
          fontSize: 12,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? colors.text : "#374151",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {node.name}
        </span>

        {/* Child Count */}
        {hasChildren && (
          <span style={{
            fontSize: 10,
            color: "#9ca3af",
            marginLeft: "auto",
            flexShrink: 0,
          }}>
            {node.children!.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <ExplorerTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              selectedNode={selectedNode}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Node Detail Panel Component
function NodeDetailPanel({ node }: { node: TreeNode }) {
  const icon = nodeIcons[node.type] || "📄";
  const colors = nodeColors[node.type] || nodeColors.config;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid #e5e7eb",
        background: colors.bg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>{icon}</span>
          <div>
            <span style={{
              fontSize: 10,
              textTransform: "uppercase",
              color: colors.text,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}>
              {node.type}
            </span>
            <h2 style={{
              margin: "4px 0 0 0",
              fontSize: 18,
              fontWeight: 600,
              color: "#111827",
            }}>
              {node.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {/* Description */}
        {node.description && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Description
            </h3>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {node.description}
            </p>
          </div>
        )}

        {/* Metadata */}
        {node.meta && Object.keys(node.meta).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Properties
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}>
              {Object.entries(node.meta)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      padding: "10px 12px",
                      background: "#f9fafb",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}>
                      {key}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: "#111827",
                      fontWeight: 500,
                      wordBreak: "break-word",
                    }}>
                      {typeof value === "boolean"
                        ? (value ? "✓ Yes" : "✗ No")
                        : typeof value === "number"
                        ? value.toLocaleString()
                        : Array.isArray(value)
                        ? value.join(", ")
                        : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)
                      }
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Children Summary */}
        {node.children && node.children.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Contains ({node.children.length} items)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {node.children.slice(0, 10).map((child) => {
                const childIcon = nodeIcons[child.type] || "📄";
                const childColors = nodeColors[child.type] || nodeColors.config;
                return (
                  <div
                    key={child.id}
                    style={{
                      padding: "10px 12px",
                      background: childColors.bg,
                      borderRadius: 6,
                      border: `1px solid ${childColors.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span>{childIcon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: childColors.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {child.name}
                      </div>
                      {child.description && (
                        <div style={{
                          fontSize: 11,
                          color: "#6b7280",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {child.description}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      background: "white",
                      borderRadius: 4,
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}>
                      {child.type}
                    </span>
                  </div>
                );
              })}
              {node.children.length > 10 && (
                <div style={{
                  padding: 12,
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: 12,
                  background: "#f9fafb",
                  borderRadius: 6,
                }}>
                  ...and {node.children.length - 10} more items
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
