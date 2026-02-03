"use client";

import { useState, useEffect, useCallback } from "react";
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
  specType: "SYSTEM" | "DOMAIN";
  outputType: "LEARN" | "MEASURE" | "ADAPT" | "COMPOSE";
  specRole: "IDENTITY" | "CONTENT" | "VOICE" | "MEASURE" | "ADAPT" | "REWARD";
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
  specType: "SYSTEM" | "DOMAIN";
  outputType: "LEARN" | "MEASURE" | "ADAPT" | "COMPOSE";
  specRole: "IDENTITY" | "CONTENT" | "VOICE" | "MEASURE" | "ADAPT" | "REWARD";
  domain: string | null;
  priority: number;
  isActive?: boolean;
  config?: Record<string, any> | null;
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

type Agent = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  scope: "SYSTEM" | "DOMAIN";
};

type Curriculum = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

type PlaybookSystemSpec = {
  id: string;
  specId: string;
  isEnabled: boolean;
  configOverride: any | null;
  spec: Spec;
};

type Playbook = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: string;
  publishedAt: string | null;
  domain: Domain;
  agent: Agent | null;
  curriculum: Curriculum | null;
  items: PlaybookItem[];
  systemSpecs: PlaybookSystemSpec[];
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

type PlaybookBuilderProps = {
  playbookId: string;
  routePrefix?: string;
};

export function PlaybookBuilder({ playbookId, routePrefix = "" }: PlaybookBuilderProps) {
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

  // Tabs state - Explorer is default
  const [activeTab, setActiveTab] = useState<"items" | "targets" | "explorer" | "slugs" | "parameters" | "triggers">("explorer");
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);

  // Parameters tab state
  type ParameterCategory = {
    category: string;
    icon: string;
    description: string;
    parameters: {
      id: string;
      parameterId: string;
      name: string;
      definition: string | null;
      scaleType: string;
      parameterType: string;
      interpretationHigh: string | null;
      interpretationLow: string | null;
      scoringAnchors: {
        id: string;
        score: number;
        example: string;
        rationale: string | null;
        positiveSignals: string[];
        negativeSignals: string[];
        isGold: boolean;
      }[];
      usedBySpecs: { specId: string; specSlug: string; specName: string }[];
    }[];
  };
  const [parametersData, setParametersData] = useState<{ categories: ParameterCategory[]; counts: { parameters: number; anchors: number; categories: number } } | null>(null);
  const [parametersLoading, setParametersLoading] = useState(false);
  const [expandedParamCategories, setExpandedParamCategories] = useState<Set<string>>(new Set());
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set());

  // Triggers tab state
  type TriggerCategory = {
    outputType: string;
    icon: string;
    description: string;
    specs: {
      specId: string;
      specSlug: string;
      specName: string;
      specType: string;
      outputType: string;
      triggers: {
        id: string;
        name: string | null;
        given: string;
        when: string;
        then: string;
        actions: {
          id: string;
          description: string;
          weight: number;
          parameterId: string | null;
          parameterName: string | null;
          learnCategory: string | null;
          learnKeyPrefix: string | null;
          learnKeyHint: string | null;
        }[];
      }[];
    }[];
  };
  const [triggersData, setTriggersData] = useState<{ categories: TriggerCategory[]; counts: { specs: number; triggers: number; actions: number; outputTypes: number } } | null>(null);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [expandedTriggerCategories, setExpandedTriggerCategories] = useState<Set<string>>(new Set());
  const [expandedTriggerSpecs, setExpandedTriggerSpecs] = useState<Set<string>>(new Set());
  const [expandedTriggerItems, setExpandedTriggerItems] = useState<Set<string>>(new Set());

  // Slugs tab state
  type SlugNode = {
    id: string;
    type: "category" | "spec" | "variable" | "value" | "produces";
    name: string;
    path?: string;
    value?: string | number | boolean | null;
    specId?: string;
    specSlug?: string;
    children?: SlugNode[];
    meta?: Record<string, any>;
  };
  const [slugsData, setSlugsData] = useState<{ tree: SlugNode[]; counts: Record<string, number> } | null>(null);
  const [slugsLoading, setSlugsLoading] = useState(false);
  const [expandedSlugNodes, setExpandedSlugNodes] = useState<Set<string>>(new Set());

  // Global filter for stats across tabs
  // Filter by specRole/category: IDENTITY, CONTENT, VOICE, MEASURE, LEARN, ADAPT
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const toggleFilter = (filter: string) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  const [targetsLoading, setTargetsLoading] = useState(false);
  const [pendingTargetChanges, setPendingTargetChanges] = useState<Map<string, number | null>>(new Map());
  const [savingTargets, setSavingTargets] = useState(false);
  const [compilingTargets, setCompilingTargets] = useState(false);
  const [creatingNewVersion, setCreatingNewVersion] = useState(false);

  // System specs toggle state
  const [systemSpecToggles, setSystemSpecToggles] = useState<Map<string, boolean>>(new Map());
  const [systemSpecOverrides, setSystemSpecOverrides] = useState<Map<string, Record<string, any> | null>>(new Map());
  const [systemSpecsHaveChanges, setSystemSpecsHaveChanges] = useState(false);
  const [savingSystemSpecs, setSavingSystemSpecs] = useState(false);
  const [needsRepublish, setNeedsRepublish] = useState(false);

  // Config override modal state
  const [configModalSpec, setConfigModalSpec] = useState<Spec | null>(null);

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

        // Initialize system spec toggles from playbook.systemSpecs
        // Default: all system specs are enabled unless explicitly disabled
        if (availableData.ok) {
          const toggleMap = new Map<string, boolean>();
          const playbookSystemSpecs = playbookData.playbook.systemSpecs || [];

          // Create a lookup for playbook's spec toggle state
          const playbookToggleLookup = new Map<string, boolean>();
          for (const pss of playbookSystemSpecs) {
            playbookToggleLookup.set(pss.specId, pss.isEnabled);
          }

          // For each available system spec, use playbook state if exists, else default to true
          for (const spec of availableData.systemSpecs || []) {
            const isEnabled = playbookToggleLookup.has(spec.id)
              ? playbookToggleLookup.get(spec.id)!
              : true; // Default to enabled
            toggleMap.set(spec.id, isEnabled);
          }

          setSystemSpecToggles(toggleMap);

          // Initialize config overrides from playbook.specs (PlaybookSpec records)
          const overrideMap = new Map<string, Record<string, any> | null>();
          const playbookSpecs = playbookData.playbook.specs || [];
          for (const pss of playbookSpecs) {
            if (pss.configOverride) {
              overrideMap.set(pss.specId, pss.configOverride);
            }
          }
          setSystemSpecOverrides(overrideMap);
          setSystemSpecsHaveChanges(false);
        }
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

  // Fetch slugs data when switching to slugs tab
  const fetchSlugs = useCallback(async () => {
    setSlugsLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/slugs`);
      const data = await res.json();
      if (data.ok) {
        setSlugsData({ tree: data.tree, counts: data.counts });
        // Auto-expand categories
        const toExpand = new Set<string>();
        data.tree.forEach((cat: SlugNode) => {
          toExpand.add(cat.id);
        });
        setExpandedSlugNodes(toExpand);
      }
    } catch (err: any) {
      console.error("Error fetching slugs:", err);
    } finally {
      setSlugsLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    if (activeTab === "slugs" && !slugsData) {
      fetchSlugs();
    }
  }, [activeTab, slugsData, fetchSlugs]);

  // Fetch parameters data when switching to parameters tab
  const fetchParameters = useCallback(async () => {
    setParametersLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/parameters`);
      const data = await res.json();
      if (data.ok) {
        setParametersData({ categories: data.categories, counts: data.counts });
        // Auto-expand all categories
        const toExpand = new Set<string>();
        data.categories.forEach((cat: ParameterCategory) => {
          toExpand.add(cat.category);
        });
        setExpandedParamCategories(toExpand);
      }
    } catch (err: any) {
      console.error("Error fetching parameters:", err);
    } finally {
      setParametersLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    if (activeTab === "parameters" && !parametersData) {
      fetchParameters();
    }
  }, [activeTab, parametersData, fetchParameters]);

  // Fetch triggers data when switching to triggers tab
  const fetchTriggers = useCallback(async () => {
    setTriggersLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/triggers`);
      const data = await res.json();
      if (data.ok) {
        setTriggersData({ categories: data.categories, counts: data.counts });
        // Auto-expand all categories
        const toExpand = new Set<string>();
        data.categories.forEach((cat: TriggerCategory) => {
          toExpand.add(cat.outputType);
        });
        setExpandedTriggerCategories(toExpand);
      }
    } catch (err: any) {
      console.error("Error fetching triggers:", err);
    } finally {
      setTriggersLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    if (activeTab === "triggers" && !triggersData) {
      fetchTriggers();
    }
  }, [activeTab, triggersData, fetchTriggers]);

  const toggleParamCategoryExpand = (category: string) => {
    setExpandedParamCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleParamExpand = (paramId: string) => {
    setExpandedParams((prev) => {
      const next = new Set(prev);
      if (next.has(paramId)) {
        next.delete(paramId);
      } else {
        next.add(paramId);
      }
      return next;
    });
  };

  const toggleTriggerCategoryExpand = (outputType: string) => {
    setExpandedTriggerCategories((prev) => {
      const next = new Set(prev);
      if (next.has(outputType)) {
        next.delete(outputType);
      } else {
        next.add(outputType);
      }
      return next;
    });
  };

  const toggleTriggerSpecExpand = (specId: string) => {
    setExpandedTriggerSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(specId)) {
        next.delete(specId);
      } else {
        next.add(specId);
      }
      return next;
    });
  };

  const toggleTriggerItemExpand = (triggerId: string) => {
    setExpandedTriggerItems((prev) => {
      const next = new Set(prev);
      if (next.has(triggerId)) {
        next.delete(triggerId);
      } else {
        next.add(triggerId);
      }
      return next;
    });
  };

  const toggleSlugNodeExpand = (id: string) => {
    setExpandedSlugNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  // Get flattened list of visible nodes for keyboard navigation
  const getVisibleNodes = useCallback((): TreeNode[] => {
    if (!explorerTree) return [];
    const result: TreeNode[] = [];
    const traverse = (node: TreeNode) => {
      result.push(node);
      if (node.children && expandedNodes.has(node.id)) {
        node.children.forEach(traverse);
      }
    };
    traverse(explorerTree);
    return result;
  }, [explorerTree, expandedNodes]);

  // Find parent node for a given node
  const findParentNode = useCallback((targetId: string, root: TreeNode | null): TreeNode | null => {
    if (!root) return null;
    const search = (node: TreeNode): TreeNode | null => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === targetId) return node;
          const found = search(child);
          if (found) return found;
        }
      }
      return null;
    };
    return search(root);
  }, []);

  // Keyboard navigation for tree
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedNode || !explorerTree) return;

    const visibleNodes = getVisibleNodes();
    const currentIndex = visibleNodes.findIndex(n => n.id === selectedNode.id);
    if (currentIndex === -1) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < visibleNodes.length - 1) {
          setSelectedNode(visibleNodes[currentIndex + 1]);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedNode(visibleNodes[currentIndex - 1]);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (selectedNode.children && selectedNode.children.length > 0) {
          if (!expandedNodes.has(selectedNode.id)) {
            // Expand the node
            toggleNodeExpand(selectedNode.id);
          } else {
            // Move to first child
            setSelectedNode(selectedNode.children[0]);
          }
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (selectedNode.children && selectedNode.children.length > 0 && expandedNodes.has(selectedNode.id)) {
          // Collapse the node
          toggleNodeExpand(selectedNode.id);
        } else {
          // Move to parent
          const parent = findParentNode(selectedNode.id, explorerTree);
          if (parent) {
            setSelectedNode(parent);
          }
        }
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (selectedNode.children && selectedNode.children.length > 0) {
          toggleNodeExpand(selectedNode.id);
        }
        break;
    }
  }, [selectedNode, explorerTree, expandedNodes, getVisibleNodes, findParentNode, toggleNodeExpand]);

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
        router.push(`${routePrefix}/playbooks/${data.playbook.id}`);
      } else {
        if (data.draftId) {
          if (confirm(`${data.error}\n\nWould you like to open the existing draft?`)) {
            router.push(`${routePrefix}/playbooks/${data.draftId}`);
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

  // Handler to toggle a system spec on/off
  const handleToggleSystemSpec = (specId: string) => {
    setSystemSpecToggles((prev) => {
      const newMap = new Map(prev);
      newMap.set(specId, !prev.get(specId));
      return newMap;
    });
    setSystemSpecsHaveChanges(true);
  };

  // Handler to open config override modal
  const handleOpenConfigModal = (spec: Spec) => {
    setConfigModalSpec(spec);
  };

  // Handler to close config override modal
  const handleCloseConfigModal = () => {
    setConfigModalSpec(null);
  };

  // Handler to save config override from modal
  const handleSaveConfigOverride = (specId: string, override: Record<string, any> | null) => {
    setSystemSpecOverrides((prev) => {
      const newMap = new Map(prev);
      if (override === null || Object.keys(override).length === 0) {
        newMap.delete(specId);
      } else {
        newMap.set(specId, override);
      }
      return newMap;
    });
    setSystemSpecsHaveChanges(true);
    handleCloseConfigModal();
  };

  // Helper: check if spec has any config overrides
  const hasConfigOverride = (specId: string): boolean => {
    const override = systemSpecOverrides.get(specId);
    return override !== null && override !== undefined && Object.keys(override).length > 0;
  };

  // Save system spec toggle changes (including config overrides)
  const handleSaveSystemSpecs = async () => {
    setSavingSystemSpecs(true);
    try {
      const systemSpecsPayload = Array.from(systemSpecToggles.entries()).map(
        ([specId, isEnabled]) => ({
          specId,
          isEnabled,
          configOverride: systemSpecOverrides.get(specId) || null,
        })
      );

      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specs: systemSpecsPayload }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybook(data.playbook);
        setSystemSpecsHaveChanges(false);
        // If playbook is published, mark as needing republish
        if (playbook?.status === "PUBLISHED") {
          setNeedsRepublish(true);
        }
      } else {
        alert("Failed to save system specs: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving system specs: " + err.message);
    } finally {
      setSavingSystemSpecs(false);
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
        setNeedsRepublish(false);
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

  // Republish after system spec changes
  const handleRepublish = async () => {
    if (!confirm("Republish this playbook with the updated system spec settings?")) {
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/publish`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.ok) {
        setPlaybook(data.playbook);
        setNeedsRepublish(false);
        alert("Playbook republished successfully with updated system specs!");
      } else {
        const errors = data.validationErrors?.map((e: any) => `- ${e.error}`).join("\n") || data.error;
        alert(`Failed to republish:\n${errors}`);
      }
    } catch (err: any) {
      alert("Error republishing: " + err.message);
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
        router.push(`${routePrefix}/playbooks`);
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
      // Note: System specs are managed via column 3 toggles, not as playbook items
      // Note: Caller specs are auto-generated by learning system
      const allSpecs = availableItems?.domainSpecs || [];
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
      LEARN: { bg: "#ede9fe", color: "#5b21b6" },
      MEASURE: { bg: "#dcfce7", color: "#166534" },
      ADAPT: { bg: "#fef3c7", color: "#92400e" },
      COMPOSE: { bg: "#fce7f3", color: "#be185d" },
    };
    const s = styles[outputType] || { bg: "#f3f4f6", color: "#6b7280" };
    return (
      <span style={{ fontSize: 9, padding: "2px 6px", background: s.bg, color: s.color, borderRadius: 4, fontWeight: 500 }}>
        {outputType}
      </span>
    );
  };

  const specRoleBadge = (specRole?: string) => {
    if (!specRole) return null;
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      // COMPOSE spec roles (for prompt assembly)
      IDENTITY: { bg: "#dbeafe", color: "#1e40af", label: "WHO" },
      CONTENT: { bg: "#d1fae5", color: "#065f46", label: "WHAT" },
      CONTEXT: { bg: "#fef3c7", color: "#92400e", label: "CALLER" },
      // Legacy (kept for migration)
      META: { bg: "#f3f4f6", color: "#6b7280", label: "META" },
    };
    const s = styles[specRole] || styles.META;
    return (
      <span style={{ fontSize: 8, padding: "1px 4px", background: s.bg, color: s.color, borderRadius: 3, fontWeight: 600 }}>
        {s.label}
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

  const specTypeBadge = (specType?: string) => {
    if (!specType) return null;
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      SYSTEM: { bg: "#f3f4f6", color: "#374151", label: "SYS" },
      DOMAIN: { bg: "#fce7f3", color: "#be185d", label: "DOM" },
    };
    const s = styles[specType] || styles.DOMAIN;
    return (
      <span style={{ fontSize: 8, padding: "1px 4px", background: s.bg, color: s.color, borderRadius: 3, fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

  // Derive pipeline phase from spec's outputType and specRole
  const getPhase = (item: PlaybookItem): "COMPOSE" | "OBSERVE" | "EVALUATE" => {
    if (item.promptTemplate) return "COMPOSE";
    if (!item.spec) return "COMPOSE";

    const { specRole, outputType } = item.spec;

    // COMPOSE specs define prompt sections (WHO/WHAT/CALLER)
    if (specRole === "IDENTITY" || specRole === "CONTENT" || specRole === "CONTEXT") return "COMPOSE";
    if (outputType === "COMPOSE") return "COMPOSE";

    // LEARN and MEASURE observe/extract data from calls
    if (outputType === "LEARN" || outputType === "MEASURE") return "OBSERVE";

    // ADAPT computes personalized targets
    if (outputType === "ADAPT") return "EVALUATE";

    return "OBSERVE"; // Default
  };

  // Filter out SYSTEM scope specs - they're managed via System Specs column
  const domainItems = items.filter(item => item.spec?.scope !== "SYSTEM");

  // Split domain items by column category (AGENT / CALLER / CONTENT)
  // Filters must be mutually exclusive to avoid duplicate keys

  // AGENT: Who the AI is (IDENTITY + VOICE specs)
  const agentItems = domainItems.filter(item =>
    item.spec?.specRole === "IDENTITY" || item.spec?.specRole === "VOICE"
  );

  // CONTENT: What the AI knows/teaches
  const contentItems = domainItems.filter(item => item.spec?.specRole === "CONTENT");

  // CALLER: Understanding the caller (everything else - MEASURE, ADAPT, REWARD, LEARN specs)
  // Exclude items already in AGENT or CONTENT to ensure no duplicates
  const agentItemIds = new Set(agentItems.map(i => i.id));
  const contentItemIds = new Set(contentItems.map(i => i.id));
  const callerItems = domainItems.filter(item =>
    !agentItemIds.has(item.id) &&
    !contentItemIds.has(item.id) &&
    (item.spec?.specRole === "MEASURE" ||
     item.spec?.specRole === "ADAPT" ||
     item.spec?.specRole === "REWARD" ||
     item.spec?.outputType === "LEARN" ||
     item.spec?.outputType === "MEASURE" ||
     item.spec?.outputType === "MEASURE_AGENT" ||
     item.spec?.outputType === "AGGREGATE")
  );

  // Available specs filtered by category for palette
  const availableAgentSpecs = availableItems?.domainSpecs.filter(s =>
    s.specRole === "IDENTITY" || s.specRole === "VOICE"
  ) || [];
  const availableCallerSpecs = availableItems?.domainSpecs.filter(s =>
    s.specRole === "MEASURE" ||
    s.specRole === "ADAPT" ||
    s.specRole === "REWARD" ||
    s.outputType === "LEARN" ||
    s.outputType === "MEASURE" ||
    s.outputType === "MEASURE_AGENT" ||
    s.outputType === "AGGREGATE"
  ) || [];
  const availableContentSpecs = availableItems?.domainSpecs.filter(s => s.specRole === "CONTENT") || [];

  // Legacy aliases for backward compatibility
  const identityItems = agentItems;
  const availableIdentitySpecs = availableAgentSpecs;

  // Group items by pipeline phase for display
  const groupedByPhase = domainItems.reduce((acc, item) => {
    const phase = getPhase(item);
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(item);
    return acc;
  }, {} as Record<string, PlaybookItem[]>);

  const phaseOrder = ["COMPOSE", "OBSERVE", "EVALUATE"] as const;
  const phaseConfig: Record<string, { label: string; icon: string; description: string; bg: string; border: string }> = {
    COMPOSE: {
      label: "Identity & Content",
      icon: "✍️",
      description: "WHO the agent is, WHAT it knows",
      bg: "#fdf4ff",
      border: "#e879f9"
    },
    OBSERVE: {
      label: "Observe",
      icon: "👁️",
      description: "Measure caller, extract memories, score agent",
      bg: "#f0fdf4",
      border: "#86efac"
    },
    EVALUATE: {
      label: "Evaluate",
      icon: "⚖️",
      description: "Compute targets, rewards, profiles",
      bg: "#fefce8",
      border: "#fde047"
    },
  };

  // Legacy: keep specType grouping for backward compatibility
  const groupedItems = items.reduce((acc, item) => {
    const specType = item.spec?.specType || "DOMAIN";
    if (!acc[specType]) acc[specType] = [];
    acc[specType].push(item);
    return acc;
  }, {} as Record<string, PlaybookItem[]>);

  const specTypeOrder = ["SYSTEM", "DOMAIN"];
  const specTypeLabels: Record<string, string> = {
    SYSTEM: "System (Always Run)",
    DOMAIN: "Domain (From Playbook)",
  };

  // Helper: Infer field type from value for config override modal
  const inferFieldType = (value: any): "boolean" | "number" | "string" | "object" | "array" => {
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object" && value !== null) return "object";
    return "string";
  };

  // ConfigField component - renders appropriate control based on type
  const ConfigField = ({
    fieldKey,
    defaultValue,
    currentValue,
    isOverridden,
    type,
    onChange,
    onReset,
  }: {
    fieldKey: string;
    defaultValue: any;
    currentValue: any;
    isOverridden: boolean;
    type: "boolean" | "number" | "string" | "object" | "array";
    onChange: (value: any) => void;
    onReset: () => void;
  }) => {
    const label = fieldKey
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase());

    return (
      <div style={{
        padding: 12,
        background: isOverridden ? "#fef3c7" : "#f9fafb",
        border: isOverridden ? "1px solid #fbbf24" : "1px solid #e5e7eb",
        borderRadius: 8,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>
              {label}
            </span>
            {isOverridden && (
              <span style={{
                fontSize: 9,
                padding: "2px 6px",
                background: "#fbbf24",
                color: "#78350f",
                borderRadius: 4,
                fontWeight: 600,
              }}>
                OVERRIDDEN
              </span>
            )}
          </div>
          {isOverridden && (
            <button
              onClick={onReset}
              style={{
                padding: "4px 8px",
                fontSize: 10,
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
              }}
              title={`Reset to default: ${JSON.stringify(defaultValue)}`}
            >
              Reset
            </button>
          )}
        </div>

        {type === "boolean" && (
          <button
            onClick={() => onChange(!currentValue)}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              border: "none",
              background: currentValue ? "#10b981" : "#d1d5db",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <span style={{
              position: "absolute",
              top: 3,
              left: currentValue ? 25 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "white",
              transition: "left 0.15s",
            }} />
          </button>
        )}

        {type === "number" && (
          <input
            type="number"
            value={currentValue}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
        )}

        {type === "string" && (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
        )}

        {(type === "object" || type === "array") && (
          <textarea
            value={JSON.stringify(currentValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Ignore invalid JSON while typing
              }
            }}
            rows={4}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
        )}

        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
          Default: {JSON.stringify(defaultValue)}
        </div>
      </div>
    );
  };

  // ConfigOverrideModal - modal for editing spec config overrides
  const ConfigOverrideModal = ({
    spec,
    currentOverride,
    onSave,
    onClose,
  }: {
    spec: Spec;
    currentOverride: Record<string, any> | null;
    onSave: (override: Record<string, any> | null) => void;
    onClose: () => void;
  }) => {
    const defaultConfig = (spec.config || {}) as Record<string, any>;
    const [localOverride, setLocalOverride] = useState<Record<string, any>>(
      currentOverride || {}
    );

    // Determine field types from default config
    const fields = Object.entries(defaultConfig).map(([key, defaultValue]) => ({
      key,
      defaultValue,
      overrideValue: localOverride[key],
      isOverridden: key in localOverride,
      type: inferFieldType(defaultValue),
    }));

    const handleFieldChange = (key: string, value: any) => {
      setLocalOverride((prev) => ({ ...prev, [key]: value }));
    };

    const handleResetField = (key: string) => {
      setLocalOverride((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    const handleResetAll = () => {
      setLocalOverride({});
    };

    const handleSave = () => {
      const cleanOverride = Object.keys(localOverride).length > 0 ? localOverride : null;
      onSave(cleanOverride);
    };

    const hasChanges = Object.keys(localOverride).length > 0;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "white",
            borderRadius: 12,
            maxWidth: 600,
            maxHeight: "80vh",
            width: "90%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                Configure: {spec.name}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                Override default config values for this playbook
              </p>
            </div>
            {hasChanges && (
              <button
                onClick={handleResetAll}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Reset All
              </button>
            )}
          </div>

          {/* Body - scrollable */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {fields.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
                This spec has no configurable options.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fields.map((field) => (
                  <ConfigField
                    key={field.key}
                    fieldKey={field.key}
                    defaultValue={field.defaultValue}
                    currentValue={field.overrideValue ?? field.defaultValue}
                    isOverridden={field.isOverridden}
                    type={field.type}
                    onChange={(v) => handleFieldChange(field.key, v)}
                    onReset={() => handleResetField(field.key)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: "16px 20px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Save Overrides
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={{ padding: 32 }}><p style={{ color: "#6b7280" }}>Loading playbook...</p></div>;
  }

  if (error || !playbook) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "#dc2626" }}>Error: {error || "Playbook not found"}</p>
        <Link href={`${routePrefix}/playbooks`} style={{ color: "#4f46e5" }}>Back to Playbooks</Link>
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

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 0, marginTop: 16, borderBottom: "1px solid #e5e7eb" }}>
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
          📋 Specs ({items.length})
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
          🎚️ Targets {targetsData ? `(${targetsData.counts.total})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("slugs")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: activeTab === "slugs" ? "white" : "transparent",
            color: activeTab === "slugs" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "slugs" ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          🔗 Slugs {slugsData ? `(${slugsData.counts.total})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("parameters")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: activeTab === "parameters" ? "white" : "transparent",
            color: activeTab === "parameters" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "parameters" ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          📊 Parameters {parametersData ? `(${parametersData.counts.parameters})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("triggers")}
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 500,
            background: activeTab === "triggers" ? "white" : "transparent",
            color: activeTab === "triggers" ? "#4f46e5" : "#6b7280",
            border: "none",
            borderBottom: activeTab === "triggers" ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            marginBottom: -1,
          }}
        >
          ⚡ Triggers {triggersData ? `(${triggersData.counts.triggers})` : ""}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "items" && (
      <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginTop: 24, height: "calc(100vh - 220px)" }}>
        {/* Column 1: System Specs (always run) */}
        <div style={{ height: "100%", overflowY: "auto" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚙️</span> System Specs
                {needsRepublish && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: 4,
                  }}>
                    Needs Republish
                  </span>
                )}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6b7280" }}>
                Platform-managed. Always runs.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {systemSpecsHaveChanges && (
                <button
                  onClick={handleSaveSystemSpecs}
                  disabled={savingSystemSpecs}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    background: "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: savingSystemSpecs ? "not-allowed" : "pointer",
                    opacity: savingSystemSpecs ? 0.7 : 1,
                  }}
                >
                  {savingSystemSpecs ? "Saving..." : "Save"}
                </button>
              )}
              {needsRepublish && !systemSpecsHaveChanges && (
                <button
                  onClick={handleRepublish}
                  disabled={publishing}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    background: "#f59e0b",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: publishing ? "not-allowed" : "pointer",
                    opacity: publishing ? 0.7 : 1,
                  }}
                >
                  {publishing ? "Republishing..." : "Republish"}
                </button>
              )}
            </div>
          </div>

          {availableItems?.systemSpecs && availableItems.systemSpecs.length > 0 ? (
            <div style={{
              padding: 12,
              background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
            }}>
              {/* Group specs by specRole (category) */}
              {(() => {
                const grouped = new Map<string, Spec[]>();
                for (const spec of availableItems.systemSpecs) {
                  const group = spec.specRole || "MEASURE";
                  if (!grouped.has(group)) grouped.set(group, []);
                  grouped.get(group)!.push(spec);
                }

                // Category order and labels
                const specRoleOrder = ["IDENTITY", "CONTENT", "VOICE", "MEASURE", "ADAPT", "CONSTRAIN", "REWARD", "META"];
                const specRoleLabels: Record<string, string> = {
                  IDENTITY: "🎭 WHO (Identity)",
                  CONTENT: "📚 WHAT (Content)",
                  VOICE: "🗣️ SPEECH (Voice)",
                  MEASURE: "📊 OBSERVE (Measure)",
                  ADAPT: "🎯 ADJUST (Adapt)",
                  CONSTRAIN: "🛡️ GUARD (Constrain)",
                  REWARD: "⭐ EVALUATE (Reward)",
                  META: "⚙️ META",
                };
                const sortedGroups = Array.from(grouped.entries()).sort(
                  (a, b) => specRoleOrder.indexOf(a[0]) - specRoleOrder.indexOf(b[0])
                );

                return sortedGroups.map(([specRole, specs]) => (
                  <div key={specRole} style={{ marginBottom: 12 }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#6b7280",
                      letterSpacing: "0.05em",
                      marginBottom: 6,
                      paddingBottom: 4,
                      borderBottom: "1px solid #d1d5db",
                    }}>
                      {specRoleLabels[specRole] || specRole} ({specs.filter(s => s.isActive !== false && systemSpecToggles.get(s.id)).length}/{specs.filter(s => s.isActive !== false).length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {specs.map((spec) => {
                        const isEnabled = systemSpecToggles.get(spec.id) ?? true;
                        const isGloballyActive = spec.isActive !== false;
                        const effectiveEnabled = isGloballyActive && isEnabled;
                        const specHasOverride = hasConfigOverride(spec.id);
                        const specHasConfig = spec.config && Object.keys(spec.config).length > 0;
                        return (
                          <div
                            key={spec.id}
                            style={{
                              padding: "10px 12px",
                              background: !isGloballyActive
                                ? "#fef2f2"
                                : specHasOverride
                                  ? "#fffbeb"
                                  : effectiveEnabled
                                    ? "white"
                                    : "#f9fafb",
                              border: !isGloballyActive
                                ? "1px solid #fecaca"
                                : specHasOverride
                                  ? "1px solid #fbbf24"
                                  : effectiveEnabled
                                    ? "1px solid #bbf7d0"
                                    : "1px solid #e5e7eb",
                              borderRadius: 8,
                              opacity: effectiveEnabled ? 1 : 0.6,
                              transition: "all 0.15s",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                                  {specRoleBadge(spec.specRole)}
                                  {!isGloballyActive && (
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: 600,
                                      padding: "1px 4px",
                                      background: "#dc2626",
                                      color: "white",
                                      borderRadius: 3,
                                      textTransform: "uppercase",
                                    }}>
                                      Inactive
                                    </span>
                                  )}
                                  <span style={{
                                    fontWeight: 600,
                                    fontSize: 12,
                                    color: !isGloballyActive ? "#991b1b" : effectiveEnabled ? "#166534" : "#6b7280",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}>
                                    {spec.name}
                                  </span>
                                </div>
                                {!isGloballyActive && (
                                  <div style={{
                                    fontSize: 10,
                                    color: "#991b1b",
                                    fontStyle: "italic",
                                    marginBottom: 2,
                                  }}>
                                    Globally deactivated
                                  </div>
                                )}
                                {spec.description && (
                                  <div style={{
                                    fontSize: 10,
                                    color: effectiveEnabled ? "#6b7280" : "#9ca3af",
                                    lineHeight: 1.3,
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                  }}>
                                    {spec.description}
                                  </div>
                                )}
                              </div>
                              {/* Config gear icon + Toggle switch */}
                              {isGloballyActive && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {/* Gear icon for config - only show if spec has config */}
                                  {specHasConfig && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenConfigModal(spec);
                                      }}
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        border: specHasOverride ? "2px solid #f59e0b" : "1px solid #d1d5db",
                                        background: specHasOverride ? "#fef3c7" : "white",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                      }}
                                      title={specHasOverride ? "Config overridden - click to edit" : "Configure spec settings"}
                                    >
                                      <span style={{ fontSize: 14 }}>⚙️</span>
                                    </button>
                                  )}

                                  {/* Toggle switch */}
                                  <button
                                    onClick={() => handleToggleSystemSpec(spec.id)}
                                    style={{
                                      width: 40,
                                      height: 22,
                                      borderRadius: 11,
                                      border: "none",
                                      background: isEnabled ? "#22c55e" : "#d1d5db",
                                      cursor: "pointer",
                                      position: "relative",
                                      transition: "background 0.15s",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <div style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: "50%",
                                      background: "white",
                                      position: "absolute",
                                      top: 2,
                                      left: isEnabled ? 20 : 2,
                                      transition: "left 0.15s",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                    }} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <p style={{ color: "#6b7280", fontSize: 12 }}>No system specs available</p>
            </div>
          )}
        </div>

        {/* Column 2: Agent Specs (WHO the AI is) */}
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤖</span> Agent Specs
                <span style={{ fontSize: 10, padding: "2px 6px", background: "#dbeafe", color: "#1e40af", borderRadius: 4, fontWeight: 500 }}>AGENT</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6b7280" }}>
                Who the AI is & how it speaks
              </p>
            </div>
          </div>

          {/* Mini palette for Agent specs */}
          {isEditable && availableAgentSpecs.length > 0 && (
            <div style={{ marginBottom: 12, padding: 8, background: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#0369a1", marginBottom: 6 }}>+ Add Agent Spec</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {availableIdentitySpecs.filter(s => !items.some(i => i.specId === s.id)).map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => addItemFromPalette("spec", spec.id)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {spec.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {agentItems.length === 0 ? (
            <div style={{
              padding: 32,
              textAlign: "center",
              background: "#f0f9ff",
              borderRadius: 8,
              border: "2px dashed #bae6fd",
            }}>
              <p style={{ color: "#0369a1", marginBottom: 4, fontWeight: 500 }}>No Agent Specs</p>
              <p style={{ fontSize: 12, color: "#6b7280" }}>
                {isEditable ? "Click specs above to define agent identity" : "No agent identity configured"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {agentItems.map((item) => {
                const index = items.indexOf(item);
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
                              border: isItemExpanded ? "2px solid #4f46e5" : "1px solid #bae6fd",
                              borderRadius: 8,
                              opacity: item.isEnabled ? 1 : 0.5,
                              transition: "all 0.15s",
                            }}
                          >
                  {/* Header - always visible */}
                  <div
                    onClick={() => item.spec && toggleItemExpanded(item.id, item.specId)}
                    style={{
                      padding: "10px 12px",
                      cursor: item.spec ? "pointer" : "default",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1 }}>
                      {/* Expand/collapse indicator for specs */}
                      {item.spec && (
                        <span style={{ color: "#9ca3af", fontSize: 11, minWidth: 16, marginTop: 1 }}>
                          {isItemExpanded ? "▼" : "▶"}
                        </span>
                      )}
                      {!item.spec && (
                        <span style={{ color: "#9ca3af", fontSize: 11, minWidth: 16 }}>
                          {index + 1}.
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                          {item.spec && (
                            <>
                              {specRoleBadge(item.spec.specRole)}
                              {item.spec.scope === "SYSTEM" && (
                                <span style={{ fontSize: 8, padding: "1px 4px", background: "#f3f4f6", color: "#6b7280", borderRadius: 3, fontWeight: 600 }}>
                                  ⚙️
                                </span>
                              )}
                              <span style={{ fontWeight: 600, fontSize: 12, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.spec.name}
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

        {/* Column 3: Caller Specs (Understanding the caller) */}
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>👤</span> Caller Specs
                <span style={{ fontSize: 10, padding: "2px 6px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontWeight: 500 }}>CALLER</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6b7280" }}>
                Understanding & adapting to the caller
              </p>
            </div>
          </div>

          {/* Mini palette for Caller specs */}
          {isEditable && availableCallerSpecs.length > 0 && (
            <div style={{ marginBottom: 12, padding: 8, background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>+ Add Caller Spec</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {availableCallerSpecs.filter(s => !items.some(i => i.specId === s.id)).map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => addItemFromPalette("spec", spec.id)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {spec.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {callerItems.length === 0 ? (
            <div style={{
              padding: 32,
              textAlign: "center",
              background: "#fffbeb",
              borderRadius: 8,
              border: "2px dashed #fde68a",
            }}>
              <p style={{ color: "#92400e", marginBottom: 4, fontWeight: 500 }}>No Caller Specs</p>
              <p style={{ fontSize: 12, color: "#6b7280" }}>
                {isEditable ? "Click specs above to add caller analysis" : "No caller analysis configured"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {callerItems.map((item) => {
                const isItemExpanded = expandedItems.has(item.id);
                const detail = item.specId ? specDetails.get(item.specId) : null;
                return (
                  <div
                    key={item.id}
                    style={{
                      background: "white",
                      border: isItemExpanded ? "2px solid #f59e0b" : "1px solid #fde68a",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: item.specId ? "pointer" : "default",
                        background: isItemExpanded ? "#fffbeb" : "transparent",
                      }}
                      onClick={() => item.specId && toggleItemExpanded(item.id, item.specId)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {item.spec && (
                          <>
                            {outputTypeBadge(item.spec.outputType)}
                            <span style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.spec.name}</span>
                            {item.spec.scope === "SYSTEM" && (
                              <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>⚙️</span>
                            )}
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isEditable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              background: "#fee2e2",
                              color: "#dc2626",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        )}
                        {item.specId && (
                          <span style={{ color: "#9ca3af", fontSize: 12 }}>
                            {isItemExpanded ? "▼" : "▶"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isItemExpanded && detail && (
                      <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 12 }}>
                        {detail.description && (
                          <p style={{ margin: "0 0 8px 0", color: "#6b7280" }}>{detail.description}</p>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "2px 6px", background: "#e5e7eb", borderRadius: 4, fontSize: 10 }}>
                            {detail.scope}
                          </span>
                          <span style={{ padding: "2px 6px", background: "#e5e7eb", borderRadius: 4, fontSize: 10 }}>
                            {detail.outputType}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 4: Content Specs (What the AI knows) */}
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📚</span> Content Specs
                <span style={{ fontSize: 10, padding: "2px 6px", background: "#d1fae5", color: "#065f46", borderRadius: 4, fontWeight: 500 }}>CONTENT</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#6b7280" }}>
                What the AI knows & teaches
              </p>
            </div>
          </div>

          {/* Mini palette for Content specs */}
          {isEditable && availableContentSpecs.length > 0 && (
            <div style={{ marginBottom: 12, padding: 8, background: "#ecfdf5", borderRadius: 8, border: "1px solid #a7f3d0" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#047857", marginBottom: 6 }}>+ Add Content Spec</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {availableContentSpecs.filter(s => !items.some(i => i.specId === s.id)).map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => addItemFromPalette("spec", spec.id)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {spec.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {contentItems.length === 0 ? (
            <div style={{
              padding: 32,
              textAlign: "center",
              background: "#ecfdf5",
              borderRadius: 8,
              border: "2px dashed #a7f3d0",
            }}>
              <p style={{ color: "#047857", marginBottom: 4, fontWeight: 500 }}>No Content Specs</p>
              <p style={{ fontSize: 12, color: "#6b7280" }}>
                {isEditable ? "Click specs above to add domain content analysis" : "No content analysis configured"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {contentItems.map((item) => {
                const index = items.indexOf(item);
                const isItemExpanded = expandedItems.has(item.id);
                const detail = item.specId ? specDetails.get(item.specId) : null;
                return (
                  <div
                    key={item.id}
                    style={{
                      background: "white",
                      border: isItemExpanded ? "2px solid #10b981" : "1px solid #a7f3d0",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: item.specId ? "pointer" : "default",
                        background: isItemExpanded ? "#ecfdf5" : "transparent",
                      }}
                      onClick={() => item.specId && toggleItemExpanded(item.id, item.specId)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {item.spec && (
                          <>
                            {outputTypeBadge(item.spec.outputType)}
                            <span style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.spec.name}</span>
                            {item.spec.scope === "SYSTEM" && (
                              <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>⚙️</span>
                            )}
                          </>
                        )}
                        {item.promptTemplate && (
                          <>
                            <span style={{ fontSize: 9, padding: "1px 4px", background: "#fef3c7", color: "#92400e", borderRadius: 3, fontWeight: 500 }}>
                              TEMPLATE
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.promptTemplate.name}</span>
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isEditable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              background: "#fee2e2",
                              color: "#dc2626",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        )}
                        {item.specId && (
                          <span style={{ color: "#9ca3af", fontSize: 12 }}>
                            {isItemExpanded ? "▼" : "▶"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isItemExpanded && detail && (
                      <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 12 }}>
                        {detail.description && (
                          <p style={{ margin: "0 0 8px 0", color: "#6b7280" }}>{detail.description}</p>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "2px 6px", background: "#e5e7eb", borderRadius: 4, fontSize: 10 }}>
                            {detail.scope}
                          </span>
                          <span style={{ padding: "2px 6px", background: "#e5e7eb", borderRadius: 4, fontSize: 10 }}>
                            {detail.outputType}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
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

              {/* Graphic Equalizer - Group by domainGroup */}
              {(() => {
                // Group parameters by domainGroup
                const groups: Record<string, typeof targetsData.parameters> = {};
                for (const param of targetsData.parameters) {
                  const group = param.domainGroup || "Other";
                  if (!groups[group]) groups[group] = [];
                  groups[group].push(param);
                }

                const groupColors: Record<string, { primary: string; glow: string }> = {
                  "Communication Style": { primary: "#a78bfa", glow: "#8b5cf6" },
                  "Engagement": { primary: "#34d399", glow: "#10b981" },
                  "Teaching": { primary: "#fbbf24", glow: "#f59e0b" },
                  "Adaptability": { primary: "#60a5fa", glow: "#3b82f6" },
                  "Other": { primary: "#9ca3af", glow: "#6b7280" },
                };

                // Gauge tick marks
                const ticks = [0, 25, 50, 75, 100];

                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                    {Object.entries(groups).map(([groupName, params]) => {
                      const colors = groupColors[groupName] || groupColors["Other"];
                      return (
                        <div
                          key={groupName}
                          style={{
                            background: "linear-gradient(180deg, #18181b 0%, #0f0f11 100%)",
                            borderRadius: 16,
                            padding: 20,
                            border: "1px solid #27272a",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
                          }}
                        >
                          {/* Group Header */}
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 16,
                            paddingBottom: 10,
                            borderBottom: `1px solid #27272a`,
                          }}>
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: colors.primary,
                              boxShadow: `0 0 8px ${colors.glow}`,
                            }} />
                            <span style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#e4e4e7",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}>
                              {groupName}
                            </span>
                          </div>

                          {/* Equalizer Faders */}
                          <div style={{ display: "flex", gap: 6 }}>
                            {params.map((param) => {
                              const hasPendingChange = pendingTargetChanges.has(param.parameterId);
                              const pendingValue = pendingTargetChanges.get(param.parameterId);
                              const hasPlaybookOverride = param.playbookValue !== null || (hasPendingChange && pendingValue !== null);
                              const displayValue = hasPendingChange
                                ? (pendingValue !== null && pendingValue !== undefined ? pendingValue : param.systemValue || 0.5)
                                : (param.playbookValue !== null ? param.playbookValue : param.systemValue || 0.5);

                              const activeColor = hasPendingChange ? "#fbbf24" : colors.primary;
                              const glowColor = hasPendingChange ? "#f59e0b" : colors.glow;

                              return (
                                <div
                                  key={param.parameterId}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    width: 56,
                                  }}
                                >
                                  {/* Value display */}
                                  <div style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: hasPendingChange ? "#fbbf24" : hasPlaybookOverride ? colors.primary : "#71717a",
                                    marginBottom: 6,
                                    fontFamily: "ui-monospace, monospace",
                                    textShadow: hasPlaybookOverride ? `0 0 8px ${glowColor}40` : "none",
                                  }}>
                                    {(displayValue * 100).toFixed(0)}
                                  </div>

                                  {/* Fader container with gauge */}
                                  <div style={{ display: "flex", gap: 4 }}>
                                    {/* Gauge ticks (left side) */}
                                    <div style={{
                                      display: "flex",
                                      flexDirection: "column-reverse",
                                      justifyContent: "space-between",
                                      height: 140,
                                      paddingTop: 2,
                                      paddingBottom: 2,
                                    }}>
                                      {ticks.map((tick) => (
                                        <div key={tick} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                          <span style={{
                                            fontSize: 7,
                                            color: "#52525b",
                                            width: 14,
                                            textAlign: "right",
                                            fontFamily: "ui-monospace, monospace",
                                          }}>
                                            {tick}
                                          </span>
                                          <div style={{
                                            width: 4,
                                            height: 1,
                                            background: tick === 50 ? "#52525b" : "#3f3f46",
                                          }} />
                                        </div>
                                      ))}
                                    </div>

                                    {/* Vertical fader track */}
                                    <div style={{
                                      position: "relative",
                                      width: 24,
                                      height: 140,
                                      background: "linear-gradient(180deg, #1f1f23 0%, #18181b 100%)",
                                      borderRadius: 4,
                                      border: "1px solid #27272a",
                                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                                      overflow: "hidden",
                                    }}>
                                      {/* Gauge lines inside track */}
                                      {ticks.map((tick) => (
                                        <div
                                          key={tick}
                                          style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: `${tick}%`,
                                            height: 1,
                                            background: tick === 50 ? "#3f3f46" : "#27272a",
                                          }}
                                        />
                                      ))}

                                      {/* Filled portion */}
                                      <div style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 2,
                                        right: 2,
                                        height: `${displayValue * 100}%`,
                                        background: hasPlaybookOverride
                                          ? `linear-gradient(180deg, ${activeColor} 0%, ${glowColor}99 100%)`
                                          : "linear-gradient(180deg, #52525b 0%, #3f3f46 100%)",
                                        borderRadius: "2px 2px 2px 2px",
                                        transition: "height 0.1s ease-out",
                                        boxShadow: hasPlaybookOverride ? `0 0 12px ${glowColor}60` : "none",
                                      }} />

                                      {/* LED segments overlay */}
                                      {[...Array(10)].map((_, i) => (
                                        <div
                                          key={i}
                                          style={{
                                            position: "absolute",
                                            left: 2,
                                            right: 2,
                                            bottom: `${i * 10 + 5}%`,
                                            height: 1,
                                            background: "#18181b",
                                            opacity: 0.5,
                                          }}
                                        />
                                      ))}

                                      {/* System default marker */}
                                      {param.systemValue !== null && param.playbookValue !== null && (
                                        <div style={{
                                          position: "absolute",
                                          left: -2,
                                          right: -2,
                                          bottom: `${param.systemValue * 100}%`,
                                          height: 2,
                                          background: "#71717a",
                                          borderRadius: 1,
                                        }} />
                                      )}

                                      {/* Slider input (invisible) */}
                                      {isEditable && (
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          step="5"
                                          value={displayValue * 100}
                                          onChange={(e) => handleTargetChange(param.parameterId, parseInt(e.target.value) / 100)}
                                          style={{
                                            position: "absolute",
                                            width: 140,
                                            height: 24,
                                            transform: "rotate(-90deg)",
                                            transformOrigin: "70px 70px",
                                            cursor: "pointer",
                                            opacity: 0,
                                            left: -58,
                                            top: 0,
                                          }}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Label */}
                                  <div style={{
                                    marginTop: 8,
                                    fontSize: 8,
                                    fontWeight: 500,
                                    color: hasPlaybookOverride ? "#a1a1aa" : "#71717a",
                                    textAlign: "center",
                                    maxWidth: 56,
                                    lineHeight: 1.2,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                  }}>
                                    {param.name.replace("BEH-", "").replace(/-/g, " ")}
                                  </div>

                                  {/* Override indicator */}
                                  {hasPlaybookOverride && isEditable && (
                                    <button
                                      onClick={() => handleTargetChange(param.parameterId, null)}
                                      style={{
                                        marginTop: 4,
                                        fontSize: 8,
                                        padding: "2px 4px",
                                        background: "#27272a",
                                        border: "none",
                                        color: "#71717a",
                                        borderRadius: 2,
                                        cursor: "pointer",
                                      }}
                                      title="Reset to system default"
                                    >
                                      ↺
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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
                      title="Expand all nodes in the tree"
                    >
                      + Expand All
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
                      title="Collapse all nodes in the tree"
                    >
                      − Collapse All
                    </button>
                  </div>
                </div>
                {/* Tree Content */}
                <div
                  tabIndex={0}
                  onKeyDown={handleTreeKeyDown}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: 8,
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    // Auto-select root if nothing selected
                    if (!selectedNode && explorerTree) {
                      setSelectedNode(explorerTree);
                    }
                  }}
                >
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

      {/* Slugs Tab */}
      {activeTab === "slugs" && (
        <div style={{ marginTop: 24 }}>
          {slugsLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Loading template variables...
            </div>
          ) : !slugsData ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Failed to load slugs data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}>
                <button
                  onClick={() => setActiveFilter(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: activeFilter === null ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    background: activeFilter === null ? "#eef2ff" : "white",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "#4f46e5" : "#111827" }}>{slugsData.counts.total}</div>
                </button>
                {[
                  { key: "IDENTITY", label: "🎭 Identity", count: slugsData.counts.identity },
                  { key: "CONTENT", label: "📖 Content", count: slugsData.counts.content },
                  { key: "VOICE", label: "🎙️ Voice", count: slugsData.counts.voice },
                  { key: "MEASURE", label: "📊 Measure", count: slugsData.counts.measure },
                  { key: "LEARN", label: "🧠 Learn", count: slugsData.counts.learn },
                  { key: "ADAPT", label: "🔄 Adapt", count: slugsData.counts.adapt },
                ].map(stat => (
                  <button
                    key={stat.key}
                    onClick={() => toggleFilter(stat.key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === stat.key ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                      background: activeFilter === stat.key ? "#eef2ff" : "white",
                      cursor: stat.count > 0 ? "pointer" : "default",
                      opacity: stat.count > 0 ? 1 : 0.5,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                    disabled={stat.count === 0}
                  >
                    <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>{stat.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === stat.key ? "#4f46e5" : "#111827" }}>{stat.count}</div>
                  </button>
                ))}
              </div>

              {/* Tree View */}
              <div style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {slugsData.tree
                  .filter(category => !activeFilter || category.id.toUpperCase() === activeFilter)
                  .map((category) => (
                  <SlugTreeCategory
                    key={category.id}
                    category={category}
                    expanded={expandedSlugNodes.has(category.id)}
                    expandedNodes={expandedSlugNodes}
                    onToggle={toggleSlugNodeExpand}
                    routePrefix={routePrefix}
                  />
                ))}
                {slugsData.tree.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>
                    No specs configured for this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parameters Tab */}
      {activeTab === "parameters" && (
        <div style={{ marginTop: 24 }}>
          {parametersLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Loading parameters...
            </div>
          ) : !parametersData ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Failed to load parameters data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}>
                <button
                  onClick={() => setActiveFilter(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: activeFilter === null ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    background: activeFilter === null ? "#eef2ff" : "white",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "#4f46e5" : "#111827" }}>{parametersData.counts.parameters}</div>
                </button>
                {parametersData.categories.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => toggleFilter(cat.category)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === cat.category ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                      background: activeFilter === cat.category ? "#eef2ff" : "white",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>{cat.icon} {cat.category}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === cat.category ? "#4f46e5" : "#111827" }}>{cat.parameters.length}</div>
                  </button>
                ))}
              </div>

              {/* Categories */}
              <div style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {parametersData.categories
                  .filter(category => !activeFilter || activeFilter === category.category)
                  .map((category) => (
                  <div key={category.category}>
                    {/* Category Header */}
                    <div
                      onClick={() => toggleParamCategoryExpand(category.category)}
                      style={{
                        padding: "12px 16px",
                        background: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{category.icon}</span>
                      <span style={{ fontWeight: 600 }}>{category.category}</span>
                      <span style={{ color: "#6b7280", fontSize: 12 }}>({category.parameters.length})</span>
                      <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
                        {expandedParamCategories.has(category.category) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Category Content */}
                    {expandedParamCategories.has(category.category) && (
                      <div style={{ padding: "8px 0" }}>
                        {category.parameters.map((param) => (
                          <div key={param.parameterId}>
                            {/* Parameter Header */}
                            <div
                              onClick={() => toggleParamExpand(param.parameterId)}
                              style={{
                                padding: "8px 16px 8px 32px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                borderBottom: "1px solid #f3f4f6",
                              }}
                            >
                              <span style={{
                                fontSize: 11,
                                fontFamily: "monospace",
                                color: "#4f46e5",
                                background: "#eef2ff",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}>
                                {param.parameterId}
                              </span>
                              <span style={{ fontWeight: 500 }}>{param.name}</span>
                              {param.scoringAnchors.length > 0 && (
                                <span style={{ color: "#6b7280", fontSize: 11 }}>
                                  {param.scoringAnchors.length} anchors
                                </span>
                              )}
                              <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 11 }}>
                                {expandedParams.has(param.parameterId) ? "▼" : "▶"}
                              </span>
                            </div>
                            {/* Parameter Details */}
                            {expandedParams.has(param.parameterId) && (
                              <div style={{ padding: "8px 16px 16px 48px", background: "#fafafa" }}>
                                {param.definition && (
                                  <div style={{ marginBottom: 8, color: "#4b5563", fontSize: 13 }}>
                                    {param.definition}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12 }}>
                                  <div>
                                    <span style={{ color: "#6b7280" }}>Scale:</span>{" "}
                                    <span style={{ fontWeight: 500 }}>{param.scaleType}</span>
                                  </div>
                                  <div>
                                    <span style={{ color: "#6b7280" }}>Type:</span>{" "}
                                    <span style={{ fontWeight: 500 }}>{param.parameterType}</span>
                                  </div>
                                </div>
                                {(param.interpretationHigh || param.interpretationLow) && (
                                  <div style={{ marginBottom: 12, fontSize: 12 }}>
                                    {param.interpretationHigh && (
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#16a34a" }}>↑ High:</span>{" "}
                                        <span style={{ color: "#4b5563" }}>{param.interpretationHigh}</span>
                                      </div>
                                    )}
                                    {param.interpretationLow && (
                                      <div>
                                        <span style={{ color: "#dc2626" }}>↓ Low:</span>{" "}
                                        <span style={{ color: "#4b5563" }}>{param.interpretationLow}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Scoring Anchors */}
                                {param.scoringAnchors.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
                                      Scoring Anchors
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {param.scoringAnchors.map((anchor) => (
                                        <div
                                          key={anchor.id}
                                          style={{
                                            padding: "8px 12px",
                                            background: "white",
                                            borderRadius: 6,
                                            border: anchor.isGold ? "2px solid #fbbf24" : "1px solid #e5e7eb",
                                          }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <span style={{
                                              fontWeight: 700,
                                              fontSize: 14,
                                              color: anchor.score >= 0.7 ? "#16a34a" : anchor.score <= 0.3 ? "#dc2626" : "#ca8a04",
                                            }}>
                                              {anchor.score.toFixed(1)}
                                            </span>
                                            {anchor.isGold && (
                                              <span style={{ fontSize: 11, color: "#b45309", background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>
                                                Gold
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ fontSize: 12, color: "#374151", marginBottom: 4, fontStyle: "italic" }}>
                                            &ldquo;{anchor.example}&rdquo;
                                          </div>
                                          {anchor.rationale && (
                                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                                              {anchor.rationale}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Used by Specs */}
                                {param.usedBySpecs.length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Used by:</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {param.usedBySpecs.map((spec) => (
                                        <span
                                          key={spec.specId}
                                          style={{
                                            fontSize: 10,
                                            background: "#f0fdf4",
                                            color: "#16a34a",
                                            padding: "2px 6px",
                                            borderRadius: 3,
                                            border: "1px solid #bbf7d0",
                                          }}
                                        >
                                          {spec.specSlug}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {parametersData.categories.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>
                    No parameters found in this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Triggers Tab */}
      {activeTab === "triggers" && (
        <div style={{ marginTop: 24 }}>
          {triggersLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Loading triggers...
            </div>
          ) : !triggersData ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
              Failed to load triggers data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}>
                <button
                  onClick={() => setActiveFilter(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: activeFilter === null ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                    background: activeFilter === null ? "#eef2ff" : "white",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "#4f46e5" : "#111827" }}>{triggersData.counts.triggers}</div>
                </button>
                {triggersData.categories.map(cat => (
                  <button
                    key={cat.outputType}
                    onClick={() => toggleFilter(cat.outputType)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === cat.outputType ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                      background: activeFilter === cat.outputType ? "#eef2ff" : "white",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>{cat.icon} {cat.outputType}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === cat.outputType ? "#4f46e5" : "#111827" }}>{cat.specs.reduce((sum, s) => sum + s.triggers.length, 0)}</div>
                  </button>
                ))}
              </div>

              {/* Categories by Output Type */}
              <div style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {triggersData.categories
                  .filter(category => !activeFilter || activeFilter === category.outputType)
                  .map((category) => (
                  <div key={category.outputType}>
                    {/* Output Type Header */}
                    <div
                      onClick={() => toggleTriggerCategoryExpand(category.outputType)}
                      style={{
                        padding: "12px 16px",
                        background: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{category.icon}</span>
                      <span style={{ fontWeight: 600 }}>{category.outputType}</span>
                      <span style={{ color: "#6b7280", fontSize: 12 }}>({category.specs.length} specs)</span>
                      <span style={{ marginLeft: 8, color: "#9ca3af", fontSize: 11, fontStyle: "italic" }}>
                        {category.description}
                      </span>
                      <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
                        {expandedTriggerCategories.has(category.outputType) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Specs in this category */}
                    {expandedTriggerCategories.has(category.outputType) && (
                      <div style={{ padding: "8px 0" }}>
                        {category.specs.map((spec) => (
                          <div key={spec.specId}>
                            {/* Spec Header */}
                            <div
                              onClick={() => toggleTriggerSpecExpand(spec.specId)}
                              style={{
                                padding: "8px 16px 8px 32px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                borderBottom: "1px solid #f3f4f6",
                              }}
                            >
                              <span style={{
                                fontSize: 10,
                                fontFamily: "monospace",
                                color: "#16a34a",
                                background: "#f0fdf4",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}>
                                {spec.specSlug}
                              </span>
                              <span style={{ fontWeight: 500 }}>{spec.specName}</span>
                              <span style={{ color: "#6b7280", fontSize: 11 }}>
                                {spec.triggers.length} trigger{spec.triggers.length !== 1 ? "s" : ""}
                              </span>
                              <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 11 }}>
                                {expandedTriggerSpecs.has(spec.specId) ? "▼" : "▶"}
                              </span>
                            </div>
                            {/* Triggers for this spec */}
                            {expandedTriggerSpecs.has(spec.specId) && (
                              <div style={{ padding: "8px 16px 8px 48px" }}>
                                {spec.triggers.map((trigger, triggerIdx) => (
                                  <div
                                    key={trigger.id}
                                    style={{
                                      marginBottom: 12,
                                      padding: 12,
                                      background: "#fefce8",
                                      borderRadius: 6,
                                      border: "1px solid #fde047",
                                    }}
                                  >
                                    {/* Trigger Header */}
                                    <div
                                      onClick={() => toggleTriggerItemExpand(trigger.id)}
                                      style={{ cursor: "pointer", marginBottom: 8 }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14 }}>⚡</span>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                                          {trigger.name || `Trigger ${triggerIdx + 1}`}
                                        </span>
                                        <span style={{ color: "#6b7280", fontSize: 11 }}>
                                          ({trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""})
                                        </span>
                                        <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 10 }}>
                                          {expandedTriggerItems.has(trigger.id) ? "▼" : "▶"}
                                        </span>
                                      </div>
                                      {/* Given/When/Then */}
                                      <div style={{ fontSize: 12, color: "#4b5563" }}>
                                        <div><span style={{ color: "#7c3aed", fontWeight: 500 }}>Given:</span> {trigger.given}</div>
                                        <div><span style={{ color: "#ca8a04", fontWeight: 500 }}>When:</span> {trigger.when}</div>
                                        <div><span style={{ color: "#16a34a", fontWeight: 500 }}>Then:</span> {trigger.then}</div>
                                      </div>
                                    </div>
                                    {/* Actions */}
                                    {expandedTriggerItems.has(trigger.id) && trigger.actions.length > 0 && (
                                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #fde047" }}>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                                          Actions
                                        </div>
                                        {trigger.actions.map((action) => (
                                          <div
                                            key={action.id}
                                            style={{
                                              padding: "6px 10px",
                                              background: "white",
                                              borderRadius: 4,
                                              marginBottom: 4,
                                              fontSize: 12,
                                              border: "1px solid #e5e7eb",
                                            }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                              <span>▶️</span>
                                              <span style={{ flex: 1 }}>{action.description}</span>
                                              <span style={{
                                                fontSize: 10,
                                                color: "#6b7280",
                                                background: "#f3f4f6",
                                                padding: "1px 4px",
                                                borderRadius: 2,
                                              }}>
                                                w:{action.weight.toFixed(1)}
                                              </span>
                                            </div>
                                            {action.parameterId && (
                                              <div style={{ marginLeft: 24, fontSize: 11, color: "#4f46e5" }}>
                                                → {action.parameterName || action.parameterId}
                                              </div>
                                            )}
                                            {action.learnCategory && (
                                              <div style={{ marginLeft: 24, fontSize: 11, color: "#7c3aed" }}>
                                                → Learn: {action.learnCategory}
                                                {action.learnKeyPrefix && ` (prefix: ${action.learnKeyPrefix})`}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {triggersData.categories.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>
                    No triggers found in this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Config Override Modal */}
      {configModalSpec && (
        <ConfigOverrideModal
          spec={configModalSpec}
          currentOverride={systemSpecOverrides.get(configModalSpec.id) || null}
          onSave={(override) => handleSaveConfigOverride(configModalSpec.id, override)}
          onClose={handleCloseConfigModal}
        />
      )}
    </div>
  );
}

// Explorer Tree Node Component
const nodeIcons: Record<string, string> = {
  playbook: "📚",
  group: "📁",
  "output-group": "📂",
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
  "template-content": "📜",
  block: "🧱",
  info: "ℹ️",
  "learn-config": "🧠",
  "config-item": "•",
  instruction: "📋",
};

const nodeColors: Record<string, { bg: string; border: string; text: string; selectedBg: string }> = {
  playbook: { bg: "#f3e8ff", border: "#c084fc", text: "#7c3aed", selectedBg: "#ede9fe" },
  group: { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb", selectedBg: "#dbeafe" },
  "output-group": { bg: "#f1f5f9", border: "#94a3b8", text: "#475569", selectedBg: "#e2e8f0" },
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
  "template-content": { bg: "#fefce8", border: "#facc15", text: "#a16207", selectedBg: "#fef9c3" },
  block: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", selectedBg: "#fef3c7" },
  info: { bg: "#f0f9ff", border: "#7dd3fc", text: "#0284c7", selectedBg: "#e0f2fe" },
  "learn-config": { bg: "#fdf4ff", border: "#e879f9", text: "#a21caf", selectedBg: "#fae8ff" },
  "config-item": { bg: "#f9fafb", border: "#d1d5db", text: "#4b5563", selectedBg: "#f3f4f6" },
  instruction: { bg: "#ecfdf5", border: "#6ee7b7", text: "#047857", selectedBg: "#d1fae5" },
};

function ExplorerTreeNode({
  node,
  depth,
  expandedNodes,
  selectedNode,
  onToggle,
  onSelect,
  isLast = false,
  parentLines = [],
}: {
  node: TreeNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedNode: TreeNode | null;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  isLast?: boolean;
  parentLines?: boolean[];
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;
  const icon = nodeIcons[node.type] || "📄";
  const colors = nodeColors[node.type] || nodeColors.config;

  // Windows Explorer style [+]/[-] toggle box
  const ToggleBox = () => {
    if (!hasChildren) {
      return <span style={{ width: 16, height: 16, display: "inline-block" }} />;
    }
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onToggle(node.id);
        }}
        style={{
          width: 16,
          height: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #9ca3af",
          borderRadius: 2,
          background: "#fff",
          fontSize: 12,
          fontWeight: 700,
          color: "#6b7280",
          cursor: "pointer",
          flexShrink: 0,
          lineHeight: 1,
          fontFamily: "monospace",
        }}
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? "−" : "+"}
      </span>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Tree connector lines */}
      {depth > 0 && (
        <>
          {/* Vertical lines from parent levels */}
          {parentLines.map((showLine, i) => (
            showLine && (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: i * 20 + 8,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "#d1d5db",
                }}
              />
            )
          ))}
          {/* Horizontal connector to this node */}
          <div
            style={{
              position: "absolute",
              left: (depth - 1) * 20 + 8,
              top: 14,
              width: 12,
              height: 1,
              background: "#d1d5db",
            }}
          />
          {/* Vertical line segment for this level (if not last) */}
          {!isLast && (
            <div
              style={{
                position: "absolute",
                left: (depth - 1) * 20 + 8,
                top: 0,
                bottom: 0,
                width: 1,
                background: "#d1d5db",
              }}
            />
          )}
          {/* Vertical line to horizontal for this node */}
          <div
            style={{
              position: "absolute",
              left: (depth - 1) * 20 + 8,
              top: 0,
              height: 15,
              width: 1,
              background: "#d1d5db",
            }}
          />
        </>
      )}

      <div
        data-node-id={node.id}
        onClick={() => {
          onSelect(node);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          marginLeft: depth * 20,
          borderRadius: 4,
          cursor: "pointer",
          background: isSelected ? colors.selectedBg : "transparent",
          border: isSelected ? `1px solid ${colors.border}` : "1px solid transparent",
          transition: "background 0.1s",
          position: "relative",
        }}
        ref={(el) => {
          // Scroll into view when selected
          if (isSelected && el) {
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Windows-style [+]/[-] Toggle Box */}
        <ToggleBox />

        {/* Node Icon */}
        <span style={{ flexShrink: 0, fontSize: 14 }}>{icon}</span>

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

        {/* Child Count Badge */}
        {hasChildren && (
          <span style={{
            fontSize: 10,
            color: "#6b7280",
            background: "#e5e7eb",
            padding: "1px 5px",
            borderRadius: 8,
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
          {node.children!.map((child, index) => (
            <ExplorerTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              selectedNode={selectedNode}
              onToggle={onToggle}
              onSelect={onSelect}
              isLast={index === node.children!.length - 1}
              parentLines={[...parentLines, !isLast]}
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
                .filter(([k, v]) => v !== null && v !== undefined && k !== "fullTemplate" && k !== "fullDescription" && k !== "fullText")
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

        {/* Full Template Content (for template-content nodes) */}
        {node.type === "template-content" && node.meta?.fullTemplate && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Full Template ({node.meta.length} chars)
            </h3>
            <pre style={{
              margin: 0,
              padding: 16,
              background: "#1f2937",
              color: "#f3f4f6",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
              overflow: "auto",
              maxHeight: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {node.meta.fullTemplate}
            </pre>
          </div>
        )}

        {/* Full Description (for info nodes) */}
        {node.type === "info" && node.meta?.fullDescription && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Full Description
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "#f0f9ff",
              borderRadius: 8,
              border: "1px solid #7dd3fc",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#0c4a6e",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullDescription}
            </p>
          </div>
        )}

        {/* Instruction Content (for instruction nodes) */}
        {node.type === "instruction" && node.meta?.fullText && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Instruction
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "#ecfdf5",
              borderRadius: 8,
              border: "1px solid #6ee7b7",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#065f46",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullText}
            </p>
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

// Slug Tree Components for the Slugs tab
type SlugNodeType = {
  id: string;
  type: "category" | "spec" | "variable" | "value" | "produces";
  name: string;
  path?: string;
  value?: string | number | boolean | null;
  specId?: string;
  specSlug?: string;
  children?: SlugNodeType[];
  meta?: Record<string, any>;
};

const slugCategoryIcons: Record<string, string> = {
  IDENTITY: "🎭",
  CONTENT: "📖",
  VOICE: "🎙️",
  MEASURE: "📊",
  LEARN: "🧠",
  ADAPT: "🔄",
};

const slugCategoryColors: Record<string, { bg: string; border: string; headerBg: string }> = {
  IDENTITY: { bg: "#eff6ff", border: "#93c5fd", headerBg: "#dbeafe" },
  CONTENT: { bg: "#f0fdf4", border: "#86efac", headerBg: "#dcfdf5" },
  VOICE: { bg: "#fffbeb", border: "#fcd34d", headerBg: "#fef3c7" },
  MEASURE: { bg: "#ecfdf5", border: "#6ee7b7", headerBg: "#d1fae5" },
  LEARN: { bg: "#fdf4ff", border: "#e879f9", headerBg: "#fae8ff" },
  ADAPT: { bg: "#fef3c7", border: "#fcd34d", headerBg: "#fef9c3" },
};

function SlugTreeCategory({
  category,
  expanded,
  expandedNodes,
  onToggle,
  routePrefix,
}: {
  category: SlugNodeType;
  expanded: boolean;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  routePrefix: string;
}) {
  const icon = slugCategoryIcons[category.name] || "📋";
  const colors = slugCategoryColors[category.name] || { bg: "#f9fafb", border: "#e5e7eb", headerBg: "#f3f4f6" };

  return (
    <div style={{ borderBottom: "1px solid #e5e7eb" }}>
      {/* Category Header */}
      <div
        onClick={() => onToggle(category.id)}
        style={{
          padding: "14px 16px",
          background: colors.headerBg,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {expanded ? "▼" : "▶"}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{category.name}</span>
        <span style={{
          fontSize: 11,
          padding: "2px 8px",
          background: "white",
          borderRadius: 10,
          color: "#6b7280",
        }}>
          {category.children?.length || 0} specs
        </span>
        {category.meta?.description && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>{category.meta.description}</span>
        )}
      </div>

      {/* Category Content */}
      {expanded && category.children && category.children.length > 0 && (
        <div style={{ background: colors.bg, padding: "8px 16px 16px 16px" }}>
          {category.children.map((spec) => (
            <SlugTreeSpec
              key={spec.id}
              spec={spec}
              expanded={expandedNodes.has(spec.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlugTreeSpec({
  spec,
  expanded,
  expandedNodes,
  onToggle,
  routePrefix,
}: {
  spec: SlugNodeType;
  expanded: boolean;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  routePrefix: string;
}) {
  const hasChildren = spec.children && spec.children.length > 0;

  return (
    <div style={{
      marginTop: 8,
      background: "white",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      overflow: "hidden",
    }}>
      {/* Spec Header */}
      <div
        onClick={() => hasChildren && onToggle(spec.id)}
        style={{
          padding: "10px 14px",
          cursor: hasChildren ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: expanded ? "#f9fafb" : "white",
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 10, color: "#9ca3af", width: 12 }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <span style={{ fontSize: 14 }}>📋</span>
        <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{spec.name}</span>
        {spec.specSlug && (
          <Link
            href={`${routePrefix}/analysis-specs?search=${spec.specSlug}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              padding: "2px 6px",
              background: "#f3f4f6",
              borderRadius: 4,
              color: "#4f46e5",
              textDecoration: "none",
            }}
          >
            {spec.specSlug}
          </Link>
        )}
        {spec.meta?.scope && (
          <span style={{
            fontSize: 9,
            padding: "2px 6px",
            background: spec.meta.scope === "SYSTEM" ? "#dbeafe" : "#f0fdf4",
            color: spec.meta.scope === "SYSTEM" ? "#1e40af" : "#166534",
            borderRadius: 4,
          }}>
            {spec.meta.scope}
          </span>
        )}
      </div>

      {/* Spec Variables */}
      {expanded && spec.children && spec.children.length > 0 && (
        <div style={{ padding: "0 14px 14px 40px" }}>
          {spec.children.map((node) => (
            <SlugTreeNodeComponent
              key={node.id}
              node={node}
              depth={0}
              expanded={expandedNodes.has(node.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlugTreeNodeComponent({
  node,
  depth,
  expanded,
  expandedNodes,
  onToggle,
  routePrefix,
}: {
  node: SlugNodeType;
  depth: number;
  expanded: boolean;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  routePrefix: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isProduces = node.type === "produces";

  // Truncate value for display
  const displayValue = (() => {
    if (node.value === undefined || node.value === null) return null;
    const str = String(node.value);
    return str.length > 60 ? str.substring(0, 60) + "..." : str;
  })();

  return (
    <div style={{ marginTop: depth === 0 ? 8 : 4 }}>
      <div
        onClick={() => hasChildren && onToggle(node.id)}
        style={{
          padding: "6px 10px",
          paddingLeft: 10 + depth * 16,
          cursor: hasChildren ? "pointer" : "default",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          background: isProduces ? "#fef3c7" : (depth % 2 === 0 ? "#fafafa" : "white"),
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 9, color: "#9ca3af", marginTop: 3 }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 9 }} />}

        {isProduces ? (
          <>
            <span style={{ color: "#92400e", fontWeight: 500 }}>→ {node.name}:</span>
            <span style={{ color: "#6b7280", fontSize: 10 }}>{node.meta?.outputType}</span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: "monospace", color: "#4f46e5" }}>
              {node.path || node.name}
            </span>
            {displayValue !== null && (
              <span style={{
                flex: 1,
                color: "#374151",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                → {displayValue}
              </span>
            )}
            {node.meta?.isArray && (
              <span style={{
                fontSize: 10,
                padding: "1px 5px",
                background: "#e0e7ff",
                color: "#4338ca",
                borderRadius: 3,
              }}>
                [{node.meta.count}]
              </span>
            )}
            {node.meta?.linkTo && (
              <Link
                href={node.meta.linkTo}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: 10,
                  color: "#4f46e5",
                  textDecoration: "none",
                }}
              >
                →
              </Link>
            )}
          </>
        )}
      </div>

      {/* Children */}
      {expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <SlugTreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expandedNodes.has(child.id)}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              routePrefix={routePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}
