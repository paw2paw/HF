"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { VerticalSlider, SliderGroup } from "@/components/shared/VerticalSlider";
import { DraggableTabs, TabDefinition } from "@/components/shared/DraggableTabs";
import { useEntityContext } from "@/contexts/EntityContext";
import { TreeNode, nodeIcons, nodeColors } from "@/components/shared/ExplorerTree";
import { SpecRoleBadge } from "@/components/shared/SpecRoleBadge";
import { ClipboardList, Layers, Target, GitBranch, Settings, Zap, Orbit } from "lucide-react";

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
  outputType: "LEARN" | "MEASURE" | "ADAPT" | "COMPOSE" | "MEASURE_AGENT" | "AGGREGATE" | "REWARD" | "SUPERVISE";
  specRole: "ORCHESTRATE" | "EXTRACT" | "SYNTHESISE" | "CONSTRAIN" | "IDENTITY" | "CONTENT" | "VOICE" | "MEASURE" | "ADAPT" | "REWARD" | "GUARDRAIL" | "BOOTSTRAP";
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
  outputType: "LEARN" | "MEASURE" | "ADAPT" | "COMPOSE" | "MEASURE_AGENT" | "AGGREGATE" | "REWARD" | "SUPERVISE";
  specRole: "ORCHESTRATE" | "EXTRACT" | "SYNTHESISE" | "CONSTRAIN" | "IDENTITY" | "CONTENT" | "VOICE" | "MEASURE" | "ADAPT" | "REWARD" | "GUARDRAIL" | "BOOTSTRAP";
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
  const { pushEntity } = useEntityContext();

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

  // Tabs state - Explorer (unified tree+toggles view) is default
  // TODO: Consider removing "grid" tab once unified Explorer view is proven sufficient
  const [activeTab, setActiveTab] = useState<"grid" | "targets" | "explorer" | "slugs" | "parameters" | "triggers" | "visualizer">("grid");
  const [targetsData, setTargetsData] = useState<TargetsData | null>(null);
  const [specSearch, setSpecSearch] = useState("");
  const [expandedAddPanels, setExpandedAddPanels] = useState<Set<"agent" | "caller" | "content">>(new Set());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showSystemInColumns, setShowSystemInColumns] = useState<Record<string, boolean>>({ agent: true, caller: true, content: true });
  const [systemColumnCollapsed, setSystemColumnCollapsed] = useState(false);

  const toggleAddPanel = (column: "agent" | "caller" | "content") => {
    setExpandedAddPanels(prev => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  };

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
      sourceFeatureSet?: { id: string; featureId: string; name: string; version: string } | null;
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
  // Filter by specRole/category: ORCHESTRATE, EXTRACT, SYNTHESISE, CONSTRAIN, IDENTITY, CONTENT, VOICE
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [parameterSearch, setParameterSearch] = useState("");

  const toggleFilter = (filter: string) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  const [targetsLoading, setTargetsLoading] = useState(false);
  const [pendingTargetChanges, setPendingTargetChanges] = useState<Map<string, number | null>>(new Map());
  const [savingTargets, setSavingTargets] = useState(false);
  const [showTargetsSaveConfirm, setShowTargetsSaveConfirm] = useState(false);
  const [compilingTargets, setCompilingTargets] = useState(false);

  // Behavior Pills state
  interface BehaviorPillParam {
    parameterId: string;
    atFull: number;
    atZero: number;
  }
  interface BehaviorPill {
    id: string;
    label: string;
    description: string;
    intensity: number;
    source: "intent" | "domain-context";
    parameters: BehaviorPillParam[];
  }
  interface PillState {
    pill: BehaviorPill;
    active: boolean;
    intensity: number;
    lastModified: number;
  }
  const [intentText, setIntentText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [pillStates, setPillStates] = useState<PillState[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAdvancedSliders, setShowAdvancedSliders] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Playbook config settings (memory, learning, AI, thresholds)
  interface PlaybookConfigSettings {
    // Memory Settings
    memoryMinConfidence: number;
    memoryMaxCount: number;
    memoryDecayHalfLife: number;
    // Learning Rate Settings
    learningRate: number;
    learningTolerance: number;
    learningMinConfidence: number;
    learningMaxConfidence: number;
    // AI Settings
    aiTemperature: number;
    // Target Bounds
    targetClampMin: number;
    targetClampMax: number;
    // Threshold Sensitivity
    thresholdHigh: number;
    thresholdLow: number;
  }

  const defaultConfigSettings: PlaybookConfigSettings = {
    memoryMinConfidence: 0.5,
    memoryMaxCount: 20,
    memoryDecayHalfLife: 7,
    learningRate: 0.1,
    learningTolerance: 0.15,
    learningMinConfidence: 0.1,
    learningMaxConfidence: 0.95,
    aiTemperature: 0.3,
    targetClampMin: 0.2,
    targetClampMax: 0.8,
    thresholdHigh: 0.65,
    thresholdLow: 0.35,
  };

  const [configSettings, setConfigSettings] = useState<PlaybookConfigSettings>(defaultConfigSettings);
  const [pendingConfigChanges, setPendingConfigChanges] = useState<Partial<PlaybookConfigSettings>>({});

  const handleConfigChange = (key: keyof PlaybookConfigSettings, value: number) => {
    setPendingConfigChanges(prev => ({ ...prev, [key]: value }));
  };

  const getConfigValue = (key: keyof PlaybookConfigSettings): number => {
    return pendingConfigChanges[key] ?? configSettings[key];
  };

  const isConfigModified = (key: keyof PlaybookConfigSettings): boolean => {
    return key in pendingConfigChanges && pendingConfigChanges[key] !== configSettings[key];
  };

  const resetConfigSetting = (key: keyof PlaybookConfigSettings) => {
    setPendingConfigChanges(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetAllConfigSettings = () => {
    setPendingConfigChanges({});
  };

  const pendingConfigCount = Object.keys(pendingConfigChanges).filter(
    key => pendingConfigChanges[key as keyof PlaybookConfigSettings] !== configSettings[key as keyof PlaybookConfigSettings]
  ).length;
  const [creatingNewVersion, setCreatingNewVersion] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

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

      // Debug logging for troubleshooting
      console.log("[PlaybookBuilder] Fetched playbook:", playbookData.ok, "items:", playbookData.playbook?.items?.length);
      console.log("[PlaybookBuilder] Fetched available:", availableData.ok, "systemSpecs:", availableData.systemSpecs?.length);

      if (playbookData.ok) {
        setPlaybook(playbookData.playbook);
        setItems(playbookData.playbook.items);

        // Register with entity context for AI Chat
        pushEntity({
          type: "playbook",
          id: playbookData.playbook.id,
          label: playbookData.playbook.name,
          href: `${routePrefix}/playbooks/${playbookData.playbook.id}`,
          data: {
            status: playbookData.playbook.status,
            version: playbookData.playbook.version,
            domainId: playbookData.playbook.domainId,
            description: playbookData.playbook.description,
            itemCount: playbookData.playbook.items?.length || 0,
          },
        });

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

          // Initialize config overrides from the same systemSpecs array
          const overrideMap = new Map<string, Record<string, any> | null>();
          for (const pss of playbookSystemSpecs) {
            if (pss.configOverride) {
              overrideMap.set(pss.specId, pss.configOverride);
            }
          }
          setSystemSpecOverrides(overrideMap);
          setSystemSpecsHaveChanges(false);
        }

        // Initialize config settings (memory, learning, AI, thresholds) from playbook.configSettings
        if (playbookData.playbook.configSettings) {
          setConfigSettings({ ...defaultConfigSettings, ...playbookData.playbook.configSettings });
        } else {
          setConfigSettings(defaultConfigSettings);
        }
        setPendingConfigChanges({});
      } else {
        setError(playbookData.error);
      }

      if (availableData.ok) {
        console.log("[PlaybookBuilder] Setting availableItems with", availableData.systemSpecs?.length, "system specs");
        setAvailableItems(availableData);
      } else {
        console.error("[PlaybookBuilder] availableData not ok:", availableData.error);
      }
    } catch (err: any) {
      console.error("[PlaybookBuilder] fetchData error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [playbookId, pushEntity, routePrefix]);

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
      console.log("[PlaybookBuilder] Tree API response:", data.ok, "tree:", !!data.tree, "stats:", data.stats);
      if (!data.ok) {
        console.error("[PlaybookBuilder] Tree API error:", data.error);
      }
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

  // Resolve active pills into pendingTargetChanges
  const resolvePillsToTargets = useCallback((currentPills: PillState[]) => {
    const activePills = currentPills
      .filter((p) => p.active)
      .sort((a, b) => a.lastModified - b.lastModified);

    const resolved = new Map<string, number | null>();
    for (const ps of activePills) {
      for (const param of ps.pill.parameters) {
        const value = param.atZero + (param.atFull - param.atZero) * ps.intensity;
        resolved.set(param.parameterId, Math.max(0, Math.min(1, value)));
      }
    }
    setPendingTargetChanges(resolved);
  }, []);

  // Toggle a pill on/off
  const handlePillToggle = (pillId: string) => {
    setPillStates((prev) => {
      const next = prev.map((ps) =>
        ps.pill.id === pillId
          ? { ...ps, active: !ps.active, lastModified: Date.now() }
          : ps
      );
      resolvePillsToTargets(next);
      return next;
    });
  };

  // Adjust a pill's intensity
  const handlePillIntensity = (pillId: string, intensity: number) => {
    setPillStates((prev) => {
      const next = prev.map((ps) =>
        ps.pill.id === pillId
          ? { ...ps, intensity, lastModified: Date.now() }
          : ps
      );
      resolvePillsToTargets(next);
      return next;
    });
  };

  // Submit intent to suggest endpoint
  const handleSuggestPills = async (mode: "initial" | "more" = "initial") => {
    if (!intentText.trim() || !playbookId) return;

    if (mode === "initial") {
      setSuggesting(true);
      setSuggestError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const existingPillIds = pillStates.map((ps) => ps.pill.id);
      const res = await fetch(`/api/playbooks/${playbookId}/targets/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: intentText.trim(),
          mode,
          existingPillIds: mode === "more" ? existingPillIds : [],
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setSuggestError(data.error || "Failed to generate suggestions");
        return;
      }

      const newPills: PillState[] = (data.pills || []).map((pill: BehaviorPill) => ({
        pill,
        active: mode === "initial", // intent pills ON, extras OFF
        intensity: pill.intensity,
        lastModified: Date.now(),
      }));

      if (mode === "initial") {
        setPillStates(newPills);
        resolvePillsToTargets(newPills);
      } else {
        setPillStates((prev) => {
          const combined = [...prev, ...newPills];
          resolvePillsToTargets(combined);
          return combined;
        });
      }
    } catch (err: any) {
      setSuggestError(err.message || "Network error");
    } finally {
      setSuggesting(false);
      setLoadingMore(false);
    }
  };

  const handleSaveTargets = async (confirmed = false) => {
    if (pendingTargetChanges.size === 0) return;

    // If playbook is published and user hasn't confirmed, show confirmation modal
    if (playbook?.status === "PUBLISHED" && !confirmed) {
      setShowTargetsSaveConfirm(true);
      return;
    }

    setSavingTargets(true);
    setShowTargetsSaveConfirm(false);

    try {
      // Auto-unpublish if needed (switches to DRAFT so API accepts the save)
      if (playbook?.status === "PUBLISHED") {
        await autoUnpublish();
      }

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
        setPendingTargetChanges(new Map());
      } else {
        alert("Failed to save targets: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving targets: " + err.message);
    } finally {
      setSavingTargets(false);
    }
  };

  // Save config settings (memory, learning, AI, thresholds)
  const [savingConfigSettings, setSavingConfigSettings] = useState(false);

  const handleSaveConfigSettings = async () => {
    if (pendingConfigCount === 0) return;

    setSavingConfigSettings(true);
    try {
      // Auto-unpublish if needed
      if (playbook?.status === "PUBLISHED") {
        await autoUnpublish();
      }

      // Merge pending changes into current settings
      const newSettings = { ...configSettings, ...pendingConfigChanges };

      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configSettings: newSettings }),
      });

      const data = await res.json();
      if (data.ok) {
        setConfigSettings(newSettings);
        setPendingConfigChanges({});
        setPlaybook(data.playbook);
      } else {
        alert("Failed to save config settings: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving config settings: " + err.message);
    } finally {
      setSavingConfigSettings(false);
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
    if (!confirm("Clone this playbook as a new draft?")) {
      return;
    }

    setCreatingNewVersion(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/new-version`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.ok) {
        // Navigate to the new clone
        router.push(`${routePrefix}/playbooks/${data.playbook.id}`);
      } else {
        alert("Failed to clone playbook: " + data.error);
      }
    } catch (err: any) {
      alert("Error cloning playbook: " + err.message);
    } finally {
      setCreatingNewVersion(false);
    }
  };


  // Silent auto-unpublish when user edits a published playbook
  const autoUnpublish = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const data = await res.json();
      if (data.ok) {
        setPlaybook(prev => prev ? { ...prev, status: "DRAFT" } : prev);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };
  const handleUnpublish = async () => {
    if (!confirm("Unpublish this playbook? It will be removed from the active stack and reverted to DRAFT status.")) {
      return;
    }

    setUnpublishing(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const data = await res.json();

      if (data.ok) {
        // Refresh to show updated status
        fetchData();
      } else {
        alert("Failed to unpublish: " + data.error);
      }
    } catch (err: any) {
      alert("Error unpublishing: " + err.message);
    } finally {
      setUnpublishing(false);
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

  const addItemFromPalette = async (type: string, id: string, index?: number) => {
    // Auto-unpublish if editing a published playbook
    if (playbook?.status === "PUBLISHED") {
      await autoUnpublish();
    }

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

  const removeItem = async (itemId: string) => {
    // Auto-unpublish if editing a published playbook
    if (playbook?.status === "PUBLISHED") {
      await autoUnpublish();
    }
    setItems(items.filter((item) => item.id !== itemId));
    setHasChanges(true);
  };

  const toggleItemEnabled = async (itemId: string) => {
    // Auto-unpublish if editing a published playbook
    if (playbook?.status === "PUBLISHED") {
      await autoUnpublish();
    }
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, isEnabled: !item.isEnabled } : item
      )
    );
    setHasChanges(true);
  };

  const outputTypeBadge = (outputType: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      LEARN: { bg: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" },
      MEASURE: { bg: "var(--status-success-bg)", color: "var(--status-success-text)" },
      MEASURE_AGENT: { bg: "var(--status-success-bg)", color: "var(--status-success-text)" },
      ADAPT: { bg: "var(--status-warning-bg)", color: "var(--status-warning-text)" },
      AGGREGATE: { bg: "var(--badge-blue-bg)", color: "var(--badge-blue-text)" },
      COMPOSE: { bg: "var(--badge-pink-bg)", color: "var(--badge-pink-text)" },
      REWARD: { bg: "var(--badge-yellow-bg)", color: "var(--badge-yellow-text)" },
      SUPERVISE: { bg: "var(--status-error-bg)", color: "var(--status-error-text)" },
    };
    const s = styles[outputType] || { bg: "var(--surface-secondary)", color: "var(--text-muted)" };
    return (
      <span style={{ fontSize: 9, padding: "2px 6px", background: s.bg, color: s.color, borderRadius: 4, fontWeight: 500 }}>
        {outputType}
      </span>
    );
  };

  // Removed old specRoleBadge - now using SpecRoleBadge component from @/components/shared/SpecRoleBadge

  const scopeBadge = (scope: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      CALLER: { bg: "var(--badge-blue-bg)", color: "var(--status-info-text)" }, // Kept for display only (auto-generated)
      DOMAIN: { bg: "var(--badge-pink-bg)", color: "var(--badge-pink-text)" },
      SYSTEM: { bg: "var(--surface-secondary)", color: "var(--text-secondary)" },
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
      SYSTEM: { bg: "var(--surface-secondary)", color: "var(--text-secondary)", label: "SYS" },
      DOMAIN: { bg: "var(--badge-pink-bg)", color: "var(--badge-pink-text)", label: "DOM" },
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
    if (specRole === "IDENTITY" || specRole === "CONTENT") return "COMPOSE";
    if (outputType === "COMPOSE") return "COMPOSE";

    // LEARN and MEASURE observe/extract data from calls
    if (outputType === "LEARN" || outputType === "MEASURE" || outputType === "MEASURE_AGENT" || outputType === "AGGREGATE") return "OBSERVE";

    // ADAPT, REWARD, SUPERVISE evaluate and adjust
    if (outputType === "ADAPT" || outputType === "REWARD" || outputType === "SUPERVISE") return "EVALUATE";

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

  // CALLER: Understanding the caller (EXTRACT, SYNTHESISE, CONSTRAIN specs + old deprecated roles)
  // Exclude items already in AGENT or CONTENT to ensure no duplicates
  const agentItemIds = new Set(agentItems.map(i => i.id));
  const contentItemIds = new Set(contentItems.map(i => i.id));
  const callerItems = domainItems.filter(item =>
    !agentItemIds.has(item.id) &&
    !contentItemIds.has(item.id) &&
    (item.spec?.specRole === "EXTRACT" ||
     item.spec?.specRole === "SYNTHESISE" ||
     item.spec?.specRole === "CONSTRAIN" ||
     item.spec?.specRole === "MEASURE" ||  // deprecated
     item.spec?.specRole === "ADAPT" ||     // deprecated
     item.spec?.specRole === "REWARD" ||    // deprecated
     item.spec?.specRole === "GUARDRAIL" || // deprecated
     item.spec?.outputType === "LEARN" ||
     item.spec?.outputType === "MEASURE" ||
     item.spec?.outputType === "MEASURE_AGENT" ||
     item.spec?.outputType === "AGGREGATE" ||
     item.spec?.outputType === "REWARD" ||
     item.spec?.outputType === "SUPERVISE" ||
     item.spec?.outputType === "COMPOSE")
  );

  // Helper to filter specs by search term
  const matchesSpecSearch = (spec: { name: string; slug: string; description?: string | null }) => {
    if (!specSearch) return true;
    const term = specSearch.toLowerCase();
    return (
      spec.name.toLowerCase().includes(term) ||
      spec.slug.toLowerCase().includes(term) ||
      (spec.description?.toLowerCase().includes(term) ?? false)
    );
  };

  // Available specs filtered by category for palette
  const availableAgentSpecs = availableItems?.domainSpecs.filter(s =>
    s.specRole === "IDENTITY" || s.specRole === "VOICE"
  ) || [];
  const availableCallerSpecs = availableItems?.domainSpecs.filter(s =>
    s.specRole === "EXTRACT" ||
    s.specRole === "SYNTHESISE" ||
    s.specRole === "CONSTRAIN" ||
    s.specRole === "MEASURE" ||      // deprecated
    s.specRole === "ADAPT" ||        // deprecated
    s.specRole === "REWARD" ||       // deprecated
    s.specRole === "GUARDRAIL" ||    // deprecated
    s.outputType === "LEARN" ||
    s.outputType === "MEASURE" ||
    s.outputType === "MEASURE_AGENT" ||
    s.outputType === "AGGREGATE" ||
    s.outputType === "REWARD" ||
    s.outputType === "SUPERVISE" ||
    s.outputType === "COMPOSE"
  ) || [];
  const availableContentSpecs = availableItems?.domainSpecs.filter(s => s.specRole === "CONTENT") || [];

  // Enabled system specs that belong in each column (read-only references)
  const systemAgentSpecs = (availableItems?.systemSpecs || []).filter(s =>
    (s.specRole === "IDENTITY" || s.specRole === "VOICE") && systemSpecToggles.get(s.id) !== false
  );
  const systemCallerSpecs = (availableItems?.systemSpecs || []).filter(s =>
    (s.specRole === "EXTRACT" || s.specRole === "SYNTHESISE" || s.specRole === "CONSTRAIN" ||
     s.specRole === "MEASURE" || s.specRole === "ADAPT" || s.specRole === "REWARD" || s.specRole === "GUARDRAIL" ||  // deprecated
     s.outputType === "LEARN" || s.outputType === "MEASURE" || s.outputType === "MEASURE_AGENT" || s.outputType === "AGGREGATE" ||
     s.outputType === "REWARD" || s.outputType === "SUPERVISE") && systemSpecToggles.get(s.id) !== false
  );
  const systemContentSpecs = (availableItems?.systemSpecs || []).filter(s =>
    s.specRole === "CONTENT" && systemSpecToggles.get(s.id) !== false
  );

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
      bg: "var(--badge-purple-bg)",
      border: "var(--badge-purple-text)"
    },
    OBSERVE: {
      label: "Observe",
      icon: "👁️",
      description: "Measure caller, extract memories, score agent",
      bg: "var(--status-success-bg)",
      border: "var(--status-success-border)"
    },
    EVALUATE: {
      label: "Evaluate",
      icon: "⚖️",
      description: "Compute targets, rewards, profiles",
      bg: "var(--status-warning-bg)",
      border: "var(--status-warning-border)"
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
        background: isOverridden ? "var(--status-warning-bg)" : "var(--background)",
        border: isOverridden ? "1px solid var(--status-warning-border)" : "1px solid var(--border-default)",
        borderRadius: 8,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {label}
            </span>
            {isOverridden && (
              <span style={{
                fontSize: 9,
                padding: "2px 6px",
                background: "var(--status-warning-border)",
                color: "var(--status-warning-text)",
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
                background: "var(--surface-primary)",
                border: "1px solid var(--input-border)",
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
              background: currentValue ? "var(--status-success-text)" : "var(--button-disabled-bg)",
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
              background: "var(--surface-primary)",
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
              border: "1px solid var(--input-border)",
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
              border: "1px solid var(--input-border)",
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
              border: "1px solid var(--input-border)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
        )}

        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
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
            background: "var(--surface-primary)",
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
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                Configure: {spec.name}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Override default config values for this playbook
              </p>
            </div>
            {hasChanges && (
              <button
                onClick={handleResetAll}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--input-border)",
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
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
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
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                background: "var(--surface-primary)",
                border: "1px solid var(--input-border)",
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
                background: "var(--button-primary-bg)",
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
    return <div style={{ padding: 32 }}><p style={{ color: "var(--text-muted)" }}>Loading playbook...</p></div>;
  }

  if (error || !playbook) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "var(--status-error-text)" }}>Error: {error || "Playbook not found"}</p>
        <Link href={`${routePrefix}/playbooks`} style={{ color: "var(--button-primary-bg)" }}>Back to Playbooks</Link>
      </div>
    );
  }

  // Always allow editing - auto-unpublish happens on first edit
  const isEditable = true;

  // Check for any unsaved changes across all sections
  const hasUnsavedChanges = pendingTargetChanges.size > 0 || pendingConfigCount > 0 || hasChanges;

  return (
    <div style={{ padding: 32, position: "relative" }}>
      {/* Subtle amber overlay when there are unsaved changes */}
      {hasUnsavedChanges && (
        <>
          {/* Background tint */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "linear-gradient(180deg, rgba(251, 191, 36, 0.02) 0%, rgba(245, 158, 11, 0.04) 100%)",
              pointerEvents: "none",
              zIndex: 0,
              transition: "opacity 0.3s ease-in-out",
            }}
          />
          {/* Top edge glow */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.6) 50%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 9999,
              boxShadow: "0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(245, 158, 11, 0.15)",
            }}
          />
        </>
      )}
      <SourcePageHeader
        title={
          <EditableTitle
            value={playbook.name}
            as="h1"
            disabled={playbook.status === "PUBLISHED"}
            onSave={async (newName) => {
              const res = await fetch(`/api/playbooks/${playbookId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
              });
              const data = await res.json();
              if (!data.ok) throw new Error(data.error);
              setPlaybook((prev: any) => prev ? { ...prev, name: newName } : prev);
            }}
          />
        }
        description={`${playbook.domain.name} — v${playbook.version}`}
        dataNodeId="playbooks"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                background: playbook.status === "PUBLISHED" ? "var(--status-success-bg)" : playbook.status === "DRAFT" ? "var(--status-warning-bg)" : "var(--surface-secondary)",
                color: playbook.status === "PUBLISHED" ? "var(--status-success-text)" : playbook.status === "DRAFT" ? "var(--status-warning-text)" : "var(--text-muted)",
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
                    background: "var(--surface-primary)",
                    color: "var(--status-error-text)",
                    border: "1px solid var(--status-error-border)",
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
                    background: hasChanges ? "var(--button-primary-bg)" : "var(--border-default)",
                    color: hasChanges ? "white" : "var(--text-placeholder)",
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
                    background: "var(--badge-purple-text)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: compilingTargets || items.length === 0 ? "not-allowed" : "pointer",
                    opacity: items.length === 0 ? 0.5 : 1,
                  }}
                >
                  {compilingTargets ? "Compiling..." : "Compile Targets"}
                </button>
                {/* Only show Publish when in DRAFT - for PUBLISHED, user edits first (auto-unpublishes) */}
                {playbook.status === "DRAFT" && (
                  <button
                    onClick={handlePublish}
                    disabled={publishing || items.length === 0}
                    style={{
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      background: "var(--status-success-text)",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: publishing || items.length === 0 ? "not-allowed" : "pointer",
                      opacity: items.length === 0 ? 0.5 : 1,
                    }}
                  >
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Unpublished changes banner */}
      {playbook.status === "DRAFT" && playbook.publishedAt && (
        <div style={{
          padding: "12px 16px",
          background: "var(--status-warning-bg)",
          border: "1px solid var(--status-warning-border)",
          borderRadius: 8,
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ color: "var(--status-warning-text)", fontWeight: 500 }}>
            ⚠️ Unpublished changes. Callers are using the last published version.
          </span>
          <button
            onClick={handlePublish}
            disabled={publishing}
            style={{
              padding: "8px 16px",
              background: "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: publishing ? "not-allowed" : "pointer",
              fontWeight: 500,
            }}
          >
            {publishing ? "Publishing..." : "Publish Now"}
          </button>
        </div>
      )}

      {/* Tab Navigation - Draggable with localStorage persistence */}
      {/* TODO [AUTH]: Tab order is stored in localStorage. Migrate to user preferences API when auth is added. */}
      <DraggableTabs
        storageKey="playbook-builder-tabs"
        tabs={[
          { id: "grid", label: "Specs", icon: <ClipboardList size={14} />, count: items.length, title: "4-column grid view of all specs" },
          { id: "explorer", label: "Explorer", icon: <Layers size={14} />, title: "Browse specs with tree navigation and inline toggles" },
          { id: "targets", label: "Targets", icon: <Target size={14} />, count: targetsData?.counts.total ?? null, title: "Configure playbook targets and thresholds" },
          { id: "slugs", label: "Slugs", icon: <GitBranch size={14} />, count: slugsData?.counts.total ?? null, title: "URL slug mappings for playbook routing" },
          { id: "parameters", label: "Parameters", icon: <Settings size={14} />, count: parametersData?.counts.parameters ?? null, title: "Parameter definitions and configuration" },
          { id: "triggers", label: "Triggers", icon: <Zap size={14} />, count: triggersData?.counts.triggers ?? null, title: "Trigger configurations and rules" },
          { id: "visualizer", label: "Visualizer", icon: <Orbit size={14} />, title: "Interactive graph visualization of playbook structure" },
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        containerStyle={{ marginTop: 16 }}
      />

      {/* Tab Content */}
      {activeTab === "grid" && (
      <>
      {/* Spec Search */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
          <input
            type="text"
            placeholder="Search specs..."
            value={specSearch}
            onChange={(e) => setSpecSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              border: "1px solid var(--input-border)",
              borderRadius: 8,
              fontSize: 13,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
            }}
          />
          {specSearch && (
            <button
              onClick={() => setSpecSearch("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "var(--surface-secondary)",
                border: "none",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 11,
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: systemColumnCollapsed ? "40px 1fr 1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 16, marginTop: 8, height: "calc(100vh - 270px)" }}>
        {/* Column 1: System Specs (always run) */}
        <div style={{ height: "100%", overflowY: "auto", ...(systemColumnCollapsed ? { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 } : {}) }}>
          {systemColumnCollapsed ? (
            <button
              onClick={() => setSystemColumnCollapsed(false)}
              title="Expand System Specs"
              style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                padding: "12px 4px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "0.05em",
              }}
            >
              ⚙️ System
            </button>
          ) : (
          <>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-primary)", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚙️</span> System Specs
                {needsRepublish && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    background: "var(--status-warning-bg)",
                    color: "var(--status-warning-text)",
                    borderRadius: 4,
                  }}>
                    Needs Republish
                  </span>
                )}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
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
                    background: "var(--status-success-text)",
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
                    background: "var(--status-warning-text)",
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
              <button
                onClick={() => setSystemColumnCollapsed(true)}
                title="Collapse System Specs column"
                style={{
                  padding: "4px 8px",
                  fontSize: 14,
                  background: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  lineHeight: 1,
                }}
              >
                ‹
              </button>
            </div>
          </div>

          {availableItems?.systemSpecs && availableItems.systemSpecs.length > 0 ? (
            <div style={{
              padding: 12,
              background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
              border: "1px solid var(--status-success-border)",
              borderRadius: 12,
            }}>
              {/* Group specs by specRole (category) */}
              {(() => {
                const filteredSystemSpecs = availableItems.systemSpecs.filter(matchesSpecSearch);
                const grouped = new Map<string, Spec[]>();
                for (const spec of filteredSystemSpecs) {
                  const group = spec.specRole || "MEASURE";
                  if (!grouped.has(group)) grouped.set(group, []);
                  grouped.get(group)!.push(spec);
                }

                // Category order and labels (new + deprecated roles)
                const specRoleOrder = ["ORCHESTRATE", "IDENTITY", "CONTENT", "VOICE", "EXTRACT", "SYNTHESISE", "CONSTRAIN", "MEASURE", "ADAPT", "GUARDRAIL", "REWARD", "BOOTSTRAP"];
                const specRoleLabels: Record<string, string> = {
                  // New taxonomy
                  ORCHESTRATE: "🎯 ORCHESTRATE (Flow Control)",
                  EXTRACT: "🔍 EXTRACT (Measurement)",
                  SYNTHESISE: "🧮 SYNTHESISE (Transform)",
                  CONSTRAIN: "📏 CONSTRAIN (Guardrails)",
                  IDENTITY: "👤 IDENTITY (Who)",
                  CONTENT: "📚 CONTENT (Curriculum)",
                  VOICE: "🎙️ VOICE (Speech)",
                  // Deprecated (backward compatibility)
                  MEASURE: "📊 MEASURE (deprecated → EXTRACT)",
                  ADAPT: "🎯 ADAPT (deprecated → SYNTHESISE)",
                  REWARD: "⭐ REWARD (deprecated → SYNTHESISE)",
                  GUARDRAIL: "🛡️ GUARDRAIL (deprecated → CONSTRAIN)",
                  BOOTSTRAP: "🔄 BOOTSTRAP (deprecated → ORCHESTRATE)",
                };
                const sortedGroups = Array.from(grouped.entries()).sort(
                  (a, b) => specRoleOrder.indexOf(a[0]) - specRoleOrder.indexOf(b[0])
                );

                if (filteredSystemSpecs.length === 0 && specSearch) {
                  return (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                      No matching specs
                    </div>
                  );
                }

                return sortedGroups.map(([specRole, specs]) => (
                  <div key={specRole} style={{ marginBottom: 12 }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      letterSpacing: "0.05em",
                      marginBottom: 6,
                      paddingBottom: 4,
                      borderBottom: "1px solid var(--input-border)",
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
                                ? "var(--status-error-bg)"
                                : specHasOverride
                                  ? "var(--status-warning-bg)"
                                  : effectiveEnabled
                                    ? "var(--surface-primary)"
                                    : "var(--background)",
                              border: !isGloballyActive
                                ? "1px solid var(--status-error-border)"
                                : specHasOverride
                                  ? "1px solid var(--status-warning-border)"
                                  : effectiveEnabled
                                    ? "1px solid var(--status-success-border)"
                                    : "1px solid var(--border-default)",
                              borderRadius: 8,
                              opacity: effectiveEnabled ? 1 : 0.6,
                              transition: "all 0.15s",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                                  <SpecRoleBadge role={spec.specRole} size="sm" showIcon={false} />
                                  {!isGloballyActive && (
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: 600,
                                      padding: "1px 4px",
                                      background: "var(--button-destructive-bg)",
                                      color: "white",
                                      borderRadius: 3,
                                      textTransform: "uppercase",
                                    }}>
                                      Inactive
                                    </span>
                                  )}
                                  <Link
                                    href={`${routePrefix}/specs/${spec.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 12,
                                      color: !isGloballyActive ? "var(--status-error-text)" : effectiveEnabled ? "var(--status-success-text)" : "var(--text-muted)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      textDecoration: "none",
                                    }}
                                  >
                                    {spec.name}
                                  </Link>
                                </div>
                                {!isGloballyActive && (
                                  <div style={{
                                    fontSize: 10,
                                    color: "var(--status-error-text)",
                                    fontStyle: "italic",
                                    marginBottom: 2,
                                  }}>
                                    Globally deactivated
                                  </div>
                                )}
                                {spec.description && (
                                  <div style={{
                                    fontSize: 10,
                                    color: effectiveEnabled ? "var(--text-muted)" : "var(--text-placeholder)",
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
                                        border: specHasOverride ? "2px solid var(--status-warning-text)" : "1px solid var(--input-border)",
                                        background: specHasOverride ? "var(--status-warning-bg)" : "var(--surface-primary)",
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
                                      background: isEnabled ? "var(--status-success-text)" : "var(--button-disabled-bg)",
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
                                      background: "var(--surface-primary)",
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
            <div style={{ padding: 24, textAlign: "center", background: "var(--background)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No system specs available</p>
            </div>
          )}
          </>
          )}
        </div>

        {/* Column 2: Agent Specs (WHO the AI is) */}
        {(() => {
          const filteredSystemAgentSpecs = systemAgentSpecs.filter(matchesSpecSearch);
          const filteredAgentItems = agentItems.filter(item => item.spec && matchesSpecSearch(item.spec));
          return (
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-primary)", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤖</span> Agent Specs
                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--badge-blue-bg)", color: "var(--status-info-text)", borderRadius: 4, fontWeight: 500 }}>AGENT</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                Who the AI is & how it speaks
              </p>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {filteredSystemAgentSpecs.length > 0 && (
                <button
                  onClick={() => setShowSystemInColumns(prev => ({ ...prev, agent: !prev.agent }))}
                  style={{
                    padding: "2px 6px",
                    fontSize: 10,
                    borderRadius: 4,
                    border: "1px solid var(--border-default)",
                    background: showSystemInColumns.agent ? "var(--surface-secondary)" : "var(--surface-primary)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title={showSystemInColumns.agent ? "Hide system specs" : "Show system specs"}
                >
                  ⚙️ {showSystemInColumns.agent ? "Hide" : "Show"}
                </button>
              )}
              {isEditable && availableAgentSpecs.filter(s => !items.some(i => i.specId === s.id)).length > 0 && (
                <button
                  onClick={() => toggleAddPanel("agent")}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid var(--status-info-border)",
                    background: expandedAddPanels.has("agent") ? "var(--status-info-bg)" : "var(--surface-primary)",
                    color: "var(--status-info-text)",
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  title="Add spec"
                >
                  {expandedAddPanels.has("agent") ? "−" : "+"}
                </button>
              )}
            </div>
          </div>

          {/* Collapsible add panel for Agent specs */}
          {isEditable && expandedAddPanels.has("agent") && (
            <div style={{ marginBottom: 12, padding: 10, background: "var(--status-info-bg)", borderRadius: 8, border: "1px solid var(--status-info-border)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--status-info-text)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Add Spec</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {availableAgentSpecs.filter(s => !items.some(i => i.specId === s.id)).map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => {
                      addItemFromPalette("spec", spec.id);
                      toggleAddPanel("agent");
                    }}
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{spec.name}</div>
                      {spec.description && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {spec.description.length > 60 ? spec.description.slice(0, 60) + "..." : spec.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* System IDENTITY/VOICE specs shown as read-only references */}
          {showSystemInColumns.agent && filteredSystemAgentSpecs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: filteredAgentItems.length > 0 ? 8 : 0 }}>
              {filteredSystemAgentSpecs.map((spec) => (
                <div
                  key={spec.id}
                  style={{
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    opacity: 0.85,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }} title="System spec">⚙️</span>
                    <SpecRoleBadge role={spec.specRole} size="sm" showIcon={false} />
                    <Link href={`${routePrefix}/specs/${spec.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1, textDecoration: "none" }}>{spec.name}</Link>
                  </div>
                  {spec.description && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.3 }}>
                      {spec.description.length > 80 ? spec.description.slice(0, 80) + "..." : spec.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredAgentItems.length === 0 && (!showSystemInColumns.agent || filteredSystemAgentSpecs.length === 0) ? (
            <div style={{
              padding: 32,
              textAlign: "center",
              background: "var(--status-info-bg)",
              borderRadius: 8,
              border: "2px dashed var(--status-info-border)",
            }}>
              <p style={{ color: "var(--status-info-text)", marginBottom: 4, fontWeight: 500 }}>{specSearch ? "No matching specs" : "No Agent Specs"}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {specSearch ? "Try a different search term" : isEditable ? "Click specs above to define agent identity" : "No agent identity configured"}
              </p>
            </div>
          ) : filteredAgentItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredAgentItems.map((item) => {
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
                            onMouseEnter={() => setHoveredItemId(item.id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                            style={{
                              position: "relative",
                              background: dragOverIndex === index ? "var(--status-info-bg)" : isItemExpanded ? "var(--surface-secondary)" : "var(--surface-primary)",
                              border: isItemExpanded ? "2px solid var(--button-primary-bg)" : "1px solid var(--status-info-border)",
                              borderRadius: 8,
                              opacity: item.isEnabled ? 1 : 0.5,
                              transition: "all 0.15s",
                            }}
                          >
                            {/* Hover-reveal delete button */}
                            {isEditable && hoveredItemId === item.id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                style={{
                                  position: "absolute",
                                  top: 6,
                                  right: 6,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  border: "none",
                                  background: "var(--status-error-bg)",
                                  color: "var(--status-error-text)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  zIndex: 5,
                                }}
                                title="Remove from playbook"
                              >
                                ×
                              </button>
                            )}
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
                        <span style={{ color: "var(--text-placeholder)", fontSize: 11, minWidth: 16, marginTop: 1 }}>
                          {isItemExpanded ? "▼" : "▶"}
                        </span>
                      )}
                      {!item.spec && (
                        <span style={{ color: "var(--text-placeholder)", fontSize: 11, minWidth: 16 }}>
                          {index + 1}.
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                          {item.spec && (
                            <>
                              <SpecRoleBadge role={item.spec.specRole} size="sm" showIcon={false} />
                              {item.spec.scope === "SYSTEM" && (
                                <span style={{ fontSize: 8, padding: "1px 4px", background: "var(--surface-secondary)", color: "var(--text-muted)", borderRadius: 3, fontWeight: 600 }}>
                                  ⚙️
                                </span>
                              )}
                              <Link
                                href={`${routePrefix}/specs/${item.specId}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
                              >
                                {item.spec.name}
                              </Link>
                            </>
                          )}
                          {item.promptTemplate && (
                            <>
                              <span style={{ fontSize: 9, padding: "2px 6px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", borderRadius: 4, fontWeight: 500 }}>
                                TEMPLATE
                              </span>
                              <Link
                                href={`/prompt-templates?selected=${item.promptTemplate.id}`}
                                style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.promptTemplate.name}
                                <span style={{ marginLeft: 4, fontSize: 10, color: "var(--text-placeholder)" }}>→</span>
                              </Link>
                            </>
                          )}
                        </div>
                        {item.spec?.description && (
                          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
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
                            background: "var(--surface-secondary)",
                            border: "1px solid var(--input-border)",
                            borderRadius: 4,
                            color: "var(--text-secondary)",
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
                              background: "var(--surface-primary)",
                              border: "1px solid var(--input-border)",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                          >
                            {item.isEnabled ? "Disable" : "Enable"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isItemExpanded && item.spec && (
                    <div style={{ borderTop: "1px solid var(--border-default)", padding: 16, background: "var(--surface-primary)", borderRadius: "0 0 6px 6px" }}>
                      {isLoading ? (
                        <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                          Loading spec details...
                        </div>
                      ) : detail?.triggers && detail.triggers.length > 0 ? (
                        <div>
                          {/* Triggers header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
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
                                style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 10, color: "var(--text-muted)", background: "var(--surface-secondary)", cursor: "pointer" }}
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
                                style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 10, color: "var(--text-muted)", background: "var(--surface-secondary)", cursor: "pointer" }}
                              >
                                Collapse All
                              </button>
                            </div>
                          </div>

                          {/* Triggers list */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {detail.triggers.map((trigger, tIdx) => (
                              <div key={trigger.id} style={{ border: "1px solid var(--border-default)", borderRadius: 6, background: "var(--background)" }}>
                                {/* Trigger header */}
                                <div
                                  onClick={() => toggleTriggerExpanded(trigger.id)}
                                  style={{ padding: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text-secondary)" }}>
                                      Trigger {tIdx + 1}: {trigger.name || "Unnamed"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                      {trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                  <span style={{ color: "var(--text-placeholder)", fontSize: 12 }}>
                                    {expandedTriggers.has(trigger.id) ? "▼" : "▶"}
                                  </span>
                                </div>

                                {/* Trigger expanded content */}
                                {expandedTriggers.has(trigger.id) && (
                                  <div style={{ borderTop: "1px solid var(--border-default)", padding: 12 }}>
                                    {/* Given/When/Then */}
                                    <div style={{ marginBottom: 12, padding: 10, background: "var(--background)", borderRadius: 6, fontFamily: "monospace", fontSize: 12 }}>
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: "var(--badge-purple-text)" }}>Given</span>{" "}
                                        <span style={{ color: "var(--text-primary)" }}>{trigger.given}</span>
                                      </div>
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: "var(--status-info-text)" }}>When</span>{" "}
                                        <span style={{ color: "var(--text-primary)" }}>{trigger.when}</span>
                                      </div>
                                      <div>
                                        <span style={{ fontWeight: 600, color: "var(--status-success-text)" }}>Then</span>{" "}
                                        <span style={{ color: "var(--text-primary)" }}>{trigger.then}</span>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {trigger.actions.map((action, aIdx) => (
                                        <div key={action.id} style={{ border: "1px solid var(--border-default)", borderRadius: 6, background: "var(--surface-primary)" }}>
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
                                                background: detail.outputType === "LEARN" ? "var(--status-warning-bg)" : "var(--status-info-bg)",
                                                color: detail.outputType === "LEARN" ? "var(--status-warning-text)" : "var(--button-primary-bg)",
                                              }}>
                                                {detail.outputType === "LEARN" ? "EXT" : "AC"}{aIdx + 1}
                                              </span>
                                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                                                {action.description}
                                              </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                              {action.parameter && (
                                                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", borderRadius: 4 }}>
                                                  {action.parameter.parameterId}
                                                </span>
                                              )}
                                              {action.learnCategory && (
                                                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", borderRadius: 4 }}>
                                                  {action.learnCategory}
                                                </span>
                                              )}
                                              <span style={{ color: "var(--text-placeholder)", fontSize: 10 }}>
                                                {expandedActions.has(action.id) ? "▼" : "▶"}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Action expanded content */}
                                          {expandedActions.has(action.id) && (
                                            <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 10 }}>
                                              {/* MEASURE: Show parameter + anchors */}
                                              {detail.outputType === "MEASURE" && action.parameter && (
                                                <>
                                                  <div style={{ marginBottom: 8, padding: 8, background: "var(--badge-purple-bg)", borderRadius: 6, fontSize: 12 }}>
                                                    <div style={{ fontWeight: 500, color: "var(--badge-purple-text)" }}>
                                                      Parameter: {action.parameter.name}
                                                    </div>
                                                    {action.parameter.definition && (
                                                      <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
                                                        {action.parameter.definition}
                                                      </div>
                                                    )}
                                                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
                                                      {action.parameter.interpretationHigh && (
                                                        <div>
                                                          <span style={{ fontWeight: 500, color: "var(--status-success-text)" }}>High:</span>{" "}
                                                          <span style={{ color: "var(--text-muted)" }}>{action.parameter.interpretationHigh}</span>
                                                        </div>
                                                      )}
                                                      {action.parameter.interpretationLow && (
                                                        <div>
                                                          <span style={{ fontWeight: 500, color: "var(--status-error-text)" }}>Low:</span>{" "}
                                                          <span style={{ color: "var(--text-muted)" }}>{action.parameter.interpretationLow}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Scoring Anchors */}
                                                  {action.parameter.scoringAnchors && action.parameter.scoringAnchors.length > 0 && (
                                                    <div>
                                                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                                                        Scoring Anchors ({action.parameter.scoringAnchors.length})
                                                      </div>
                                                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        {action.parameter.scoringAnchors.map((anchor) => (
                                                          <div key={anchor.id} style={{ padding: 8, background: "var(--background)", borderRadius: 4, fontSize: 11 }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                              <span style={{
                                                                padding: "2px 6px",
                                                                borderRadius: 4,
                                                                fontWeight: 600,
                                                                fontSize: 10,
                                                                background: anchor.score >= 0.7 ? "var(--status-success-bg)" : anchor.score <= 0.3 ? "var(--status-error-bg)" : "var(--status-warning-bg)",
                                                                color: anchor.score >= 0.7 ? "var(--status-success-text)" : anchor.score <= 0.3 ? "var(--status-error-text)" : "var(--status-warning-text)",
                                                              }}>
                                                                {(anchor.score * 100).toFixed(0)}%{anchor.isGold && " ⭐"}
                                                              </span>
                                                              <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>"{anchor.example}"</span>
                                                            </div>
                                                            {anchor.rationale && (
                                                              <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 10 }}>
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
                                                <div style={{ padding: 8, background: "var(--status-warning-bg)", borderRadius: 6, fontSize: 12 }}>
                                                  <div style={{ fontWeight: 500, color: "var(--status-warning-text)" }}>
                                                    Learns to: {action.learnCategory || "Not configured"}
                                                  </div>
                                                  {action.learnKeyPrefix && (
                                                    <div style={{ marginTop: 4, color: "var(--status-warning-text)" }}>
                                                      Key prefix: <code style={{ background: "var(--status-warning-bg)", padding: "1px 4px", borderRadius: 3 }}>{action.learnKeyPrefix}</code>
                                                    </div>
                                                  )}
                                                  {action.learnKeyHint && (
                                                    <div style={{ marginTop: 4, color: "var(--status-warning-text)" }}>
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
                        <div style={{ textAlign: "center", padding: 16, color: "var(--text-placeholder)", fontSize: 13 }}>
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
                    background: dragOverIndex === items.length ? "var(--status-info-bg)" : "transparent",
                    borderRadius: 8,
                    border: "2px dashed var(--border-default)",
                    color: "var(--text-placeholder)",
                    fontSize: 12,
                    transition: "background 0.15s",
                  }}
                >
                  Drop here to add at end
                </div>
              )}
            </div>
          ) : null}
        </div>
          );
        })()}

        {/* Column 3: Caller Specs (Understanding the caller) */}
        {(() => {
          const filteredSystemCallerSpecs = systemCallerSpecs.filter(matchesSpecSearch);
          const filteredCallerItems = callerItems.filter(item => item.spec && matchesSpecSearch(item.spec));
          return (
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-primary)", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>👤</span> Caller Specs
                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", borderRadius: 4, fontWeight: 500 }}>CALLER</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                Understanding & adapting to the caller
              </p>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {filteredSystemCallerSpecs.length > 0 && (
                <button
                  onClick={() => setShowSystemInColumns(prev => ({ ...prev, caller: !prev.caller }))}
                  style={{
                    padding: "2px 6px",
                    fontSize: 10,
                    borderRadius: 4,
                    border: "1px solid var(--border-default)",
                    background: showSystemInColumns.caller ? "var(--surface-secondary)" : "var(--surface-primary)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title={showSystemInColumns.caller ? "Hide system specs" : "Show system specs"}
                >
                  ⚙️ {showSystemInColumns.caller ? "Hide" : "Show"}
                </button>
              )}
              {isEditable && availableCallerSpecs.filter(s => !items.some(i => i.specId === s.id)).length > 0 && (
                <button
                  onClick={() => toggleAddPanel("caller")}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid var(--status-warning-border)",
                    background: expandedAddPanels.has("caller") ? "var(--status-warning-bg)" : "var(--surface-primary)",
                    color: "var(--status-warning-text)",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
                title="Add spec"
              >
                {expandedAddPanels.has("caller") ? "−" : "+"}
              </button>
            )}
            </div>
          </div>

          {/* Collapsible add panel for Caller specs */}
          {isEditable && expandedAddPanels.has("caller") && (
            <div style={{ marginBottom: 12, padding: 10, background: "var(--status-warning-bg)", borderRadius: 8, border: "1px solid var(--status-warning-border)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Add Spec</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {availableCallerSpecs.filter(s => !items.some(i => i.specId === s.id)).map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => {
                      addItemFromPalette("spec", spec.id);
                      toggleAddPanel("caller");
                    }}
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{spec.name}</div>
                      {spec.description && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {spec.description.length > 60 ? spec.description.slice(0, 60) + "..." : spec.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* System CALLER specs shown as read-only references */}
          {showSystemInColumns.caller && filteredSystemCallerSpecs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: filteredCallerItems.length > 0 ? 8 : 0 }}>
              {filteredSystemCallerSpecs.map((spec) => (
                <div
                  key={spec.id}
                  style={{
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    opacity: 0.85,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }} title="System spec">⚙️</span>
                    {outputTypeBadge(spec.outputType)}
                    <Link href={`${routePrefix}/specs?id=${spec.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1, textDecoration: "none" }}>{spec.name}</Link>
                  </div>
                  {spec.description && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.3 }}>
                      {spec.description.length > 80 ? spec.description.slice(0, 80) + "..." : spec.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredCallerItems.length === 0 && (!showSystemInColumns.caller || filteredSystemCallerSpecs.length === 0) ? (
            <div style={{
              padding: 32,
              textAlign: "center",
              background: "var(--status-warning-bg)",
              borderRadius: 8,
              border: "2px dashed var(--status-warning-border)",
            }}>
              <p style={{ color: "var(--status-warning-text)", marginBottom: 4, fontWeight: 500 }}>{specSearch ? "No matching specs" : "No Caller Specs"}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {specSearch ? "Try a different search term" : isEditable ? "Click specs above to add caller analysis" : "No caller analysis configured"}
              </p>
            </div>
          ) : filteredCallerItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredCallerItems.map((item) => {
                const isItemExpanded = expandedItems.has(item.id);
                const detail = item.specId ? specDetails.get(item.specId) : null;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    style={{
                      position: "relative",
                      background: "var(--surface-primary)",
                      border: isItemExpanded ? "2px solid var(--status-warning-text)" : "1px solid var(--status-warning-border)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {/* Hover-reveal delete button */}
                    {isEditable && hoveredItemId === item.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: "none",
                          background: "var(--status-error-bg)",
                          color: "var(--status-error-text)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 5,
                        }}
                        title="Remove from playbook"
                      >
                        ×
                      </button>
                    )}
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: item.specId ? "pointer" : "default",
                        background: isItemExpanded ? "var(--status-warning-bg)" : "transparent",
                      }}
                      onClick={() => item.specId && toggleItemExpanded(item.id, item.specId)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {item.spec && (
                          <>
                            {outputTypeBadge(item.spec.outputType)}
                            <Link
                              href={`${routePrefix}/specs/${item.specId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
                            >{item.spec.name}</Link>
                            {item.spec.scope === "SYSTEM" && (
                              <span style={{ fontSize: 11, color: "var(--text-placeholder)", flexShrink: 0 }}>⚙️</span>
                            )}
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {item.specId && (
                          <span style={{ color: "var(--text-placeholder)", fontSize: 12 }}>
                            {isItemExpanded ? "▼" : "▶"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isItemExpanded && detail && (
                      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-default)", background: "var(--background)", fontSize: 12 }}>
                        {detail.description && (
                          <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)" }}>{detail.description}</p>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "2px 6px", background: "var(--border-default)", borderRadius: 4, fontSize: 10 }}>
                            {detail.scope}
                          </span>
                          <span style={{ padding: "2px 6px", background: "var(--border-default)", borderRadius: 4, fontSize: 10 }}>
                            {detail.outputType}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
          );
        })()}

        {/* Column 4: Content Specs (What the AI knows) */}
        {(() => {
          const filteredSystemContentSpecs = systemContentSpecs.filter(matchesSpecSearch);
          const filteredContentItems = contentItems.filter(item => item.spec && matchesSpecSearch(item.spec));
          return (
        <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-primary)", paddingBottom: 8, zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📚</span> Content Specs
                <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--status-success-bg)", color: "var(--status-success-text)", borderRadius: 4, fontWeight: 500 }}>CONTENT</span>
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                What the AI knows & teaches
              </p>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {filteredSystemContentSpecs.length > 0 && (
                <button
                  onClick={() => setShowSystemInColumns(prev => ({ ...prev, content: !prev.content }))}
                  style={{
                    padding: "2px 6px",
                    fontSize: 10,
                    borderRadius: 4,
                    border: "1px solid var(--border-default)",
                    background: showSystemInColumns.content ? "var(--surface-secondary)" : "var(--surface-primary)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title={showSystemInColumns.content ? "Hide system specs" : "Show system specs"}
                >
                  ⚙️ {showSystemInColumns.content ? "Hide" : "Show"}
                </button>
              )}
              {isEditable && availableContentSpecs.filter(s => !items.some(i => i.specId === s.id)).length > 0 && (
                <button
                  onClick={() => toggleAddPanel("content")}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "1px solid var(--status-success-border)",
                    background: expandedAddPanels.has("content") ? "var(--status-success-bg)" : "var(--surface-primary)",
                    color: "var(--status-success-text)",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
                title="Add spec"
              >
                {expandedAddPanels.has("content") ? "−" : "+"}
              </button>
            )}
            </div>
          </div>

          {/* Collapsible add panel for Content specs */}
          {isEditable && expandedAddPanels.has("content") && (
            <div style={{ marginBottom: 12, padding: 10, background: "var(--status-success-bg)", borderRadius: 8, border: "1px solid var(--status-success-border)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--status-success-text)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Add Spec</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {availableContentSpecs.filter(s => !items.some(i => i.specId === s.id)).map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => {
                      addItemFromPalette("spec", spec.id);
                      toggleAddPanel("content");
                    }}
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{spec.name}</div>
                      {spec.description && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {spec.description.length > 60 ? spec.description.slice(0, 60) + "..." : spec.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* System CONTENT specs shown as read-only references */}
          {showSystemInColumns.content && filteredSystemContentSpecs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: filteredContentItems.length > 0 ? 8 : 0 }}>
              {filteredSystemContentSpecs.map((spec) => (
                <div
                  key={spec.id}
                  style={{
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    opacity: 0.85,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }} title="System spec">⚙️</span>
                    <SpecRoleBadge role={spec.specRole} size="sm" showIcon={false} />
                    <Link href={`${routePrefix}/specs/${spec.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1, textDecoration: "none" }}>{spec.name}</Link>
                  </div>
                  {spec.description && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0", lineHeight: 1.3 }}>
                      {spec.description.length > 80 ? spec.description.slice(0, 80) + "..." : spec.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredContentItems.length === 0 && (!showSystemInColumns.content || filteredSystemContentSpecs.length === 0) ? (
            <div style={{
              padding: 32,
              textAlign: "center",
              background: "var(--status-success-bg)",
              borderRadius: 8,
              border: "2px dashed var(--status-success-border)",
            }}>
              <p style={{ color: "var(--status-success-text)", marginBottom: 4, fontWeight: 500 }}>{specSearch ? "No matching specs" : "No Content Specs"}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {specSearch ? "Try a different search term" : isEditable ? "Click specs above to add domain content analysis" : "No content analysis configured"}
              </p>
            </div>
          ) : filteredContentItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredContentItems.map((item) => {
                const index = items.indexOf(item);
                const isItemExpanded = expandedItems.has(item.id);
                const detail = item.specId ? specDetails.get(item.specId) : null;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    style={{
                      position: "relative",
                      background: "var(--surface-primary)",
                      border: isItemExpanded ? "2px solid var(--status-success-text)" : "1px solid var(--status-success-border)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {/* Hover-reveal delete button */}
                    {isEditable && hoveredItemId === item.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: "none",
                          background: "var(--status-error-bg)",
                          color: "var(--status-error-text)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 5,
                        }}
                        title="Remove from playbook"
                      >
                        ×
                      </button>
                    )}
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: item.specId ? "pointer" : "default",
                        background: isItemExpanded ? "var(--status-success-bg)" : "transparent",
                      }}
                      onClick={() => item.specId && toggleItemExpanded(item.id, item.specId)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {item.spec && (
                          <>
                            {outputTypeBadge(item.spec.outputType)}
                            <Link
                              href={`${routePrefix}/specs/${item.specId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
                            >{item.spec.name}</Link>
                            {item.spec.scope === "SYSTEM" && (
                              <span style={{ fontSize: 11, color: "var(--text-placeholder)", flexShrink: 0 }}>⚙️</span>
                            )}
                          </>
                        )}
                        {item.promptTemplate && (
                          <>
                            <span style={{ fontSize: 9, padding: "1px 4px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", borderRadius: 3, fontWeight: 500 }}>
                              TEMPLATE
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.promptTemplate.name}</span>
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {item.specId && (
                          <span style={{ color: "var(--text-placeholder)", fontSize: 12 }}>
                            {isItemExpanded ? "▼" : "▶"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isItemExpanded && detail && (
                      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-default)", background: "var(--background)", fontSize: 12 }}>
                        {detail.description && (
                          <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)" }}>{detail.description}</p>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "2px 6px", background: "var(--border-default)", borderRadius: 4, fontSize: 10 }}>
                            {detail.scope}
                          </span>
                          <span style={{ padding: "2px 6px", background: "var(--border-default)", borderRadius: 4, fontSize: 10 }}>
                            {detail.outputType}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
          );
        })()}
      </div>
      </>
      )}

      {/* Targets Tab */}
      {activeTab === "targets" && (
        <div style={{ marginTop: 24 }}>
          {targetsLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading behavior targets...
            </div>
          ) : !targetsData || targetsData.parameters.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", background: "var(--background)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
              <p style={{ color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500, fontSize: 16 }}>
                Configure Behavior Dimensions
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
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
                    background: "var(--badge-purple-text)",
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
              {/* Draft mode notice for published playbooks with pending changes */}
              {playbook?.status === "PUBLISHED" && pendingTargetChanges.size > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: "var(--status-warning-bg)",
                  borderRadius: 8,
                  marginBottom: 16,
                  border: "1px solid var(--status-warning-text)",
                }}>
                  <span style={{ fontSize: 16 }}>✏️</span>
                  <span style={{ fontSize: 13, color: "var(--status-warning-text)", fontWeight: 500 }}>
                    Editing a published playbook — saving will switch to draft mode
                  </span>
                </div>
              )}

              {/* Targets header with save button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                    Behavior Dimensions
                  </h3>
                  <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                    Adjust sliders to configure agent behavior for the {playbook.domain.name} domain.
                    <span style={{ marginLeft: 8, color: "var(--text-placeholder)" }}>
                      {targetsData.counts.withPlaybookOverride} customized, {targetsData.counts.withSystemDefault} using defaults
                    </span>
                  </p>
                </div>
                {isEditable && pendingTargetChanges.size > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => setPendingTargetChanges(new Map())}
                      style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        background: "var(--surface-secondary)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      title="Discard all unsaved changes"
                    >
                      <span>↺</span>
                      <span>Reset All</span>
                    </button>
                    <button
                      onClick={() => handleSaveTargets()}
                      disabled={savingTargets}
                      style={{
                        padding: "10px 20px",
                        fontSize: 14,
                        fontWeight: 500,
                        background: "var(--button-primary-bg)",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: savingTargets ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingTargets ? "Saving..." : `Save ${pendingTargetChanges.size} Changes`}
                    </button>
                  </div>
                )}
              </div>

              {/* Published playbook save confirmation modal */}
              {showTargetsSaveConfirm && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                  }}
                  onClick={() => setShowTargetsSaveConfirm(false)}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: "var(--surface-primary)",
                      borderRadius: 16,
                      padding: 32,
                      maxWidth: 480,
                      width: "90%",
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "var(--status-warning-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                      }}>
                        ⚠️
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                          Modify Published Playbook?
                        </h3>
                        <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                          This playbook is currently active
                        </p>
                      </div>
                    </div>

                    <div style={{
                      background: "var(--surface-secondary)",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 24,
                    }}>
                      <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        Saving these changes will <strong style={{ color: "var(--text-primary)" }}>switch the playbook to draft mode</strong>.
                        The updated behavior targets will apply to <strong style={{ color: "var(--text-primary)" }}>all future prompt runs</strong> once you republish.
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => setShowTargetsSaveConfirm(false)}
                        style={{
                          padding: "10px 20px",
                          fontSize: 14,
                          fontWeight: 500,
                          background: "var(--surface-secondary)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveTargets(true)}
                        disabled={savingTargets}
                        style={{
                          padding: "10px 20px",
                          fontSize: 14,
                          fontWeight: 500,
                          background: "var(--status-warning-text)",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: savingTargets ? "not-allowed" : "pointer",
                        }}
                      >
                        {savingTargets ? "Saving..." : "Save & Switch to Draft"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Intent Bar ─────────────────────── */}
              {isEditable && (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={intentText}
                      onChange={(e) => setIntentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && intentText.trim() && !suggesting) {
                          handleSuggestPills("initial");
                        }
                      }}
                      placeholder="Describe the style... e.g. &quot;warm, patient, exam-focused&quot;"
                      disabled={suggesting}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        fontSize: 14,
                        background: "var(--surface-secondary)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 8,
                        color: "var(--text-primary)",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                    />
                    <button
                      onClick={() => handleSuggestPills("initial")}
                      disabled={!intentText.trim() || suggesting}
                      style={{
                        padding: "10px 16px",
                        fontSize: 14,
                        fontWeight: 500,
                        background:
                          !intentText.trim() || suggesting
                            ? "var(--surface-secondary)"
                            : "var(--accent-primary)",
                        color:
                          !intentText.trim() || suggesting
                            ? "var(--text-muted)"
                            : "white",
                        border: "none",
                        borderRadius: 8,
                        cursor:
                          !intentText.trim() || suggesting
                            ? "not-allowed"
                            : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {suggesting ? (
                        <>
                          <span
                            style={{
                              display: "inline-block",
                              width: 14,
                              height: 14,
                              border: "2px solid currentColor",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              animation: "spin 0.6s linear infinite",
                            }}
                          />
                          Thinking...
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 16 }}>✨</span>
                          Apply
                        </>
                      )}
                    </button>
                  </div>
                  {suggestError && (
                    <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "var(--status-error-text)" }}>
                      {suggestError}
                    </p>
                  )}
                </div>
              )}

              {/* ── Behavior Pills ─────────────────── */}
              {pillStates.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    {pillStates.map((ps) => {
                      const paramCount = ps.pill.parameters.length;
                      return (
                        <div
                          key={ps.pill.id}
                          style={{
                            background: ps.active
                              ? "var(--surface-primary)"
                              : "var(--surface-secondary)",
                            border: ps.active
                              ? "1px solid var(--accent-primary)"
                              : "1px solid var(--border-default)",
                            borderRadius: 12,
                            padding: "12px 16px",
                            minWidth: 160,
                            maxWidth: 220,
                            opacity: ps.active ? 1 : 0.55,
                            transition: "all 0.2s",
                          }}
                        >
                          {/* Toggle + Label */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={ps.active}
                              onChange={() => handlePillToggle(ps.pill.id)}
                              style={{
                                accentColor: "var(--accent-primary)",
                                width: 16,
                                height: 16,
                                cursor: "pointer",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: ps.active
                                  ? "var(--text-primary)"
                                  : "var(--text-muted)",
                              }}
                              title={ps.pill.description}
                            >
                              {ps.pill.label}
                            </span>
                          </div>

                          {/* Intensity slider */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={Math.round(ps.intensity * 100)}
                              onChange={(e) =>
                                handlePillIntensity(
                                  ps.pill.id,
                                  Number(e.target.value) / 100
                                )
                              }
                              disabled={!ps.active || !isEditable}
                              style={{
                                flex: 1,
                                accentColor: "var(--accent-primary)",
                                cursor: ps.active ? "pointer" : "default",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: ps.active
                                  ? "var(--text-secondary)"
                                  : "var(--text-muted)",
                                fontFamily: "ui-monospace, monospace",
                                minWidth: 28,
                                textAlign: "right",
                              }}
                            >
                              {Math.round(ps.intensity * 100)}
                            </span>
                          </div>

                          {/* Param count + source badge */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {paramCount} param{paramCount !== 1 ? "s" : ""}
                            </span>
                            {ps.pill.source === "domain-context" && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "var(--badge-blue-bg)",
                                  color: "var(--badge-blue-text)",
                                  fontWeight: 500,
                                }}
                              >
                                suggested
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* + More button */}
                  <button
                    onClick={() => handleSuggestPills("more")}
                    disabled={loadingMore || suggesting}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      background: "transparent",
                      color: "var(--accent-primary)",
                      border: "1px dashed var(--border-default)",
                      borderRadius: 8,
                      cursor: loadingMore ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-primary)";
                      e.currentTarget.style.background = "color-mix(in srgb, var(--accent-primary) 8%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <span
                          style={{
                            display: "inline-block",
                            width: 12,
                            height: 12,
                            border: "2px solid currentColor",
                            borderTopColor: "transparent",
                            borderRadius: "50%",
                            animation: "spin 0.6s linear infinite",
                          }}
                        />
                        Loading...
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        More suggestions for {playbook.domain.name}...
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── Advanced Sliders Toggle ──────────── */}
              {pillStates.length > 0 && (
                <button
                  onClick={() => setShowAdvancedSliders(!showAdvancedSliders)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 0",
                    marginBottom: 12,
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      transform: showAdvancedSliders ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s",
                      display: "inline-block",
                    }}
                  >
                    ▸
                  </span>
                  Show individual sliders (advanced)
                </button>
              )}

              {/* Graphic Equalizer - Group by domainGroup */}
              {(pillStates.length === 0 || showAdvancedSliders) && (() => {
                // Group parameters by domainGroup
                const groups: Record<string, typeof targetsData.parameters> = {};
                for (const param of targetsData.parameters) {
                  const group = param.domainGroup || "other";
                  if (!groups[group]) groups[group] = [];
                  groups[group].push(param);
                }

                // Dynamic color generation based on group name (NO HARDCODING!)
                // Uses a color palette that assigns consistent colors based on hash
                const colorPalette = [
                  { primary: "#a78bfa", glow: "#8b5cf6" }, // purple
                  { primary: "#34d399", glow: "#10b981" }, // green
                  { primary: "#fbbf24", glow: "#f59e0b" }, // yellow
                  { primary: "#60a5fa", glow: "#3b82f6" }, // blue
                  { primary: "#f472b6", glow: "#ec4899" }, // pink
                  { primary: "#fb923c", glow: "#f97316" }, // orange
                  { primary: "#a3e635", glow: "#84cc16" }, // lime
                  { primary: "#2dd4bf", glow: "#14b8a6" }, // teal
                  { primary: "#c084fc", glow: "#a855f7" }, // violet
                  { primary: "#9ca3af", glow: "#6b7280" }, // gray (fallback)
                ];

                // Simple string hash function for consistent color assignment
                const hashString = (str: string): number => {
                  let hash = 0;
                  for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash = hash & hash; // Convert to 32-bit integer
                  }
                  return Math.abs(hash);
                };

                const getColorForGroup = (groupName: string) => {
                  const index = hashString(groupName) % colorPalette.length;
                  return colorPalette[index];
                };

                // Format group name for display (snake_case → Title Case)
                const formatGroupName = (name: string): string => {
                  return name
                    .split(/[_-]/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(" ");
                };

                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                    {Object.entries(groups).map(([groupName, params]) => {
                      const colors = getColorForGroup(groupName);
                      return (
                        <SliderGroup key={groupName} title={formatGroupName(groupName)} color={colors}>
                          {params.map((param) => {
                            const hasPendingChange = pendingTargetChanges.has(param.parameterId);
                            const pendingValue = pendingTargetChanges.get(param.parameterId);
                            const hasPlaybookOverride = param.playbookValue !== null || (hasPendingChange && pendingValue !== null);
                            const displayValue = hasPendingChange
                              ? (pendingValue !== null && pendingValue !== undefined ? pendingValue : param.systemValue || 0.5)
                              : (param.playbookValue !== null ? param.playbookValue : param.systemValue || 0.5);

                            // Show system default as target marker when value differs from default
                            const systemDefault = param.systemValue ?? 0.5;
                            const showDefaultMarker = Math.abs(displayValue - systemDefault) > 0.01;

                            // Determine scope for badge
                            const scope = hasPendingChange ? "PENDING" : (param.playbookValue !== null ? "PLAYBOOK" : (param.systemValue !== null ? "SYSTEM" : "DEFAULT"));
                            const scopeColors: Record<string, { bg: string; text: string; label: string }> = {
                              PENDING: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", label: "●" },
                              PLAYBOOK: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-text)", label: "P" },
                              SYSTEM: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", label: "S" },
                              DEFAULT: { bg: "var(--surface-secondary)", text: "var(--text-muted)", label: "D" },
                            };
                            const scopeStyle = scopeColors[scope];

                            return (
                              <div key={param.parameterId} style={{ position: "relative" }}>
                                <VerticalSlider
                                  value={displayValue}
                                  targetValue={showDefaultMarker ? systemDefault : undefined}
                                  color={colors}
                                  editable={isEditable}
                                  onChange={(value) => handleTargetChange(param.parameterId, value)}
                                  isModified={hasPendingChange || hasPlaybookOverride}
                                  label={param.name.replace("BEH-", "").replace(/-/g, " ")}
                                  tooltip={`${param.definition ?? ""}\n\nSystem default: ${Math.round(systemDefault * 100)}%`}
                                  width={56}
                                  height={140}
                                  showGauge={true}
                                />

                                {/* Value comparison badge - shows current vs default */}
                                <div
                                  style={{
                                    marginTop: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 4,
                                  }}
                                >
                                  {/* Scope badge */}
                                  <span
                                    style={{
                                      fontSize: 8,
                                      fontWeight: 600,
                                      padding: "2px 4px",
                                      borderRadius: 3,
                                      background: scopeStyle.bg,
                                      color: scopeStyle.text,
                                      fontFamily: "ui-monospace, monospace",
                                    }}
                                    title={`Source: ${scope}`}
                                  >
                                    {scopeStyle.label}
                                  </span>

                                  {/* Value display - clickable to reset when modified */}
                                  {showDefaultMarker && isEditable ? (
                                    <button
                                      onClick={() => handleTargetChange(param.parameterId, null)}
                                      style={{
                                        fontSize: 9,
                                        padding: "2px 5px",
                                        background: "transparent",
                                        border: "1px dashed var(--border-default)",
                                        color: "var(--text-muted)",
                                        borderRadius: 3,
                                        cursor: "pointer",
                                        fontFamily: "ui-monospace, monospace",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 3,
                                        transition: "all 0.15s",
                                      }}
                                      title={`Click to reset to ${Math.round(systemDefault * 100)}%`}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "var(--status-warning-bg)";
                                        e.currentTarget.style.borderColor = "var(--status-warning-text)";
                                        e.currentTarget.style.color = "var(--status-warning-text)";
                                        e.currentTarget.style.borderStyle = "solid";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "transparent";
                                        e.currentTarget.style.borderColor = "var(--border-default)";
                                        e.currentTarget.style.color = "var(--text-muted)";
                                        e.currentTarget.style.borderStyle = "dashed";
                                      }}
                                    >
                                      <span style={{ textDecoration: "line-through", opacity: 0.6 }}>
                                        {Math.round(displayValue * 100)}
                                      </span>
                                      <span>→</span>
                                      <span style={{ fontWeight: 600 }}>
                                        {Math.round(systemDefault * 100)}
                                      </span>
                                    </button>
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-placeholder)",
                                        fontFamily: "ui-monospace, monospace",
                                      }}
                                    >
                                      ={Math.round(systemDefault * 100)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </SliderGroup>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Config Settings Section */}
              <div style={{ marginTop: 32 }}>
                {/* Section Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                      System Configuration
                    </h3>
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                      Fine-tune memory, learning, and AI behavior for this playbook.
                    </p>
                  </div>
                  {pendingConfigCount > 0 && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={resetAllConfigSettings}
                        style={{
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 500,
                          background: "var(--surface-secondary)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>↺</span>
                        <span>Reset All</span>
                      </button>
                      <button
                        onClick={handleSaveConfigSettings}
                        disabled={savingConfigSettings}
                        style={{
                          padding: "8px 16px",
                          fontSize: 12,
                          fontWeight: 500,
                          background: "var(--button-primary-bg)",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: savingConfigSettings ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {savingConfigSettings ? "Saving..." : `Save ${pendingConfigCount} Changes`}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                  {/* Memory Settings Group */}
                  <SliderGroup title="Memory Settings" color={{ primary: "#60a5fa", glow: "#3b82f6" }}>
                    {/* Memory Min Confidence */}
                    <div>
                      <VerticalSlider
                        value={getConfigValue("memoryMinConfidence")}
                        targetValue={isConfigModified("memoryMinConfidence") ? defaultConfigSettings.memoryMinConfidence : undefined}
                        color={{ primary: "#60a5fa", glow: "#3b82f6" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("memoryMinConfidence", v)}
                        isModified={isConfigModified("memoryMinConfidence")}
                        label="Min Confidence"
                        tooltip="Minimum confidence threshold for memory injection (0-100%)"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("memoryMinConfidence") && (
                        <button
                          onClick={() => resetConfigSetting("memoryMinConfidence")}
                          style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}
                        >
                          ↺ {Math.round(defaultConfigSettings.memoryMinConfidence * 100)}
                        </button>
                      )}
                    </div>

                    {/* Memory Max Count (normalized to 0-1 for slider, display as 0-50) */}
                    <div>
                      <VerticalSlider
                        value={getConfigValue("memoryMaxCount") / 50}
                        targetValue={isConfigModified("memoryMaxCount") ? defaultConfigSettings.memoryMaxCount / 50 : undefined}
                        color={{ primary: "#60a5fa", glow: "#3b82f6" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("memoryMaxCount", Math.round(v * 50))}
                        isModified={isConfigModified("memoryMaxCount")}
                        label="Max Count"
                        tooltip={`Maximum memories to inject: ${getConfigValue("memoryMaxCount")}`}
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("memoryMaxCount") && (
                        <button
                          onClick={() => resetConfigSetting("memoryMaxCount")}
                          style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}
                        >
                          ↺ {defaultConfigSettings.memoryMaxCount}
                        </button>
                      )}
                    </div>

                    {/* Memory Decay Half-Life (normalized to 0-1 for slider, display as 1-90 days) */}
                    <div>
                      <VerticalSlider
                        value={getConfigValue("memoryDecayHalfLife") / 90}
                        targetValue={isConfigModified("memoryDecayHalfLife") ? defaultConfigSettings.memoryDecayHalfLife / 90 : undefined}
                        color={{ primary: "#60a5fa", glow: "#3b82f6" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("memoryDecayHalfLife", Math.max(1, Math.round(v * 90)))}
                        isModified={isConfigModified("memoryDecayHalfLife")}
                        label="Decay (days)"
                        tooltip={`Memory half-life: ${getConfigValue("memoryDecayHalfLife")} days`}
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("memoryDecayHalfLife") && (
                        <button
                          onClick={() => resetConfigSetting("memoryDecayHalfLife")}
                          style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}
                        >
                          ↺ {defaultConfigSettings.memoryDecayHalfLife}d
                        </button>
                      )}
                    </div>
                  </SliderGroup>

                  {/* Learning Rate Group */}
                  <SliderGroup title="Learning Rate" color={{ primary: "#34d399", glow: "#10b981" }}>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("learningRate")}
                        targetValue={isConfigModified("learningRate") ? defaultConfigSettings.learningRate : undefined}
                        color={{ primary: "#34d399", glow: "#10b981" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("learningRate", v)}
                        isModified={isConfigModified("learningRate")}
                        label="Learn Rate"
                        tooltip="How fast to adapt targets per learning event (0-100%)"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("learningRate") && (
                        <button onClick={() => resetConfigSetting("learningRate")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.learningRate * 100)}
                        </button>
                      )}
                    </div>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("learningTolerance")}
                        targetValue={isConfigModified("learningTolerance") ? defaultConfigSettings.learningTolerance : undefined}
                        color={{ primary: "#34d399", glow: "#10b981" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("learningTolerance", v)}
                        isModified={isConfigModified("learningTolerance")}
                        label="Tolerance"
                        tooltip="How close is 'on target'? (0-50%)"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("learningTolerance") && (
                        <button onClick={() => resetConfigSetting("learningTolerance")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.learningTolerance * 100)}
                        </button>
                      )}
                    </div>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("learningMinConfidence")}
                        targetValue={isConfigModified("learningMinConfidence") ? defaultConfigSettings.learningMinConfidence : undefined}
                        color={{ primary: "#34d399", glow: "#10b981" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("learningMinConfidence", v)}
                        isModified={isConfigModified("learningMinConfidence")}
                        label="Min Conf"
                        tooltip="Minimum confidence to learn from"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("learningMinConfidence") && (
                        <button onClick={() => resetConfigSetting("learningMinConfidence")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.learningMinConfidence * 100)}
                        </button>
                      )}
                    </div>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("learningMaxConfidence")}
                        targetValue={isConfigModified("learningMaxConfidence") ? defaultConfigSettings.learningMaxConfidence : undefined}
                        color={{ primary: "#34d399", glow: "#10b981" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("learningMaxConfidence", v)}
                        isModified={isConfigModified("learningMaxConfidence")}
                        label="Max Conf"
                        tooltip="Maximum confidence ceiling"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("learningMaxConfidence") && (
                        <button onClick={() => resetConfigSetting("learningMaxConfidence")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.learningMaxConfidence * 100)}
                        </button>
                      )}
                    </div>
                  </SliderGroup>

                  {/* AI Settings Group */}
                  <SliderGroup title="AI Settings" color={{ primary: "#c084fc", glow: "#a855f7" }}>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("aiTemperature")}
                        targetValue={isConfigModified("aiTemperature") ? defaultConfigSettings.aiTemperature : undefined}
                        color={{ primary: "#c084fc", glow: "#a855f7" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("aiTemperature", v)}
                        isModified={isConfigModified("aiTemperature")}
                        label="Temperature"
                        tooltip="AI creativity vs consistency (0=deterministic, 100=creative)"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("aiTemperature") && (
                        <button onClick={() => resetConfigSetting("aiTemperature")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.aiTemperature * 100)}
                        </button>
                      )}
                    </div>
                  </SliderGroup>

                  {/* Target Bounds Group */}
                  <SliderGroup title="Target Bounds" color={{ primary: "#fb923c", glow: "#f97316" }}>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("targetClampMin")}
                        targetValue={isConfigModified("targetClampMin") ? defaultConfigSettings.targetClampMin : undefined}
                        color={{ primary: "#fb923c", glow: "#f97316" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("targetClampMin", v)}
                        isModified={isConfigModified("targetClampMin")}
                        label="Min Target"
                        tooltip="Minimum allowed target value"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("targetClampMin") && (
                        <button onClick={() => resetConfigSetting("targetClampMin")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.targetClampMin * 100)}
                        </button>
                      )}
                    </div>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("targetClampMax")}
                        targetValue={isConfigModified("targetClampMax") ? defaultConfigSettings.targetClampMax : undefined}
                        color={{ primary: "#fb923c", glow: "#f97316" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("targetClampMax", v)}
                        isModified={isConfigModified("targetClampMax")}
                        label="Max Target"
                        tooltip="Maximum allowed target value"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("targetClampMax") && (
                        <button onClick={() => resetConfigSetting("targetClampMax")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.targetClampMax * 100)}
                        </button>
                      )}
                    </div>
                  </SliderGroup>

                  {/* Threshold Sensitivity Group */}
                  <SliderGroup title="Thresholds" color={{ primary: "#f472b6", glow: "#ec4899" }}>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("thresholdLow")}
                        targetValue={isConfigModified("thresholdLow") ? defaultConfigSettings.thresholdLow : undefined}
                        color={{ primary: "#f472b6", glow: "#ec4899" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("thresholdLow", v)}
                        isModified={isConfigModified("thresholdLow")}
                        label="Low Thresh"
                        tooltip="Below this value = 'low'"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("thresholdLow") && (
                        <button onClick={() => resetConfigSetting("thresholdLow")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.thresholdLow * 100)}
                        </button>
                      )}
                    </div>
                    <div>
                      <VerticalSlider
                        value={getConfigValue("thresholdHigh")}
                        targetValue={isConfigModified("thresholdHigh") ? defaultConfigSettings.thresholdHigh : undefined}
                        color={{ primary: "#f472b6", glow: "#ec4899" }}
                        editable={isEditable}
                        onChange={(v) => handleConfigChange("thresholdHigh", v)}
                        isModified={isConfigModified("thresholdHigh")}
                        label="High Thresh"
                        tooltip="Above this value = 'high'"
                        width={56}
                        height={120}
                        showGauge={true}
                      />
                      {isConfigModified("thresholdHigh") && (
                        <button onClick={() => resetConfigSetting("thresholdHigh")} style={{ marginTop: 4, fontSize: 8, padding: "2px 6px", background: "var(--surface-secondary)", border: "1px solid var(--border-default)", borderRadius: 3, cursor: "pointer", display: "block", marginLeft: "auto", marginRight: "auto", color: "var(--text-muted)" }}>
                          ↺ {Math.round(defaultConfigSettings.thresholdHigh * 100)}
                        </button>
                      )}
                    </div>
                  </SliderGroup>
                </div>
              </div>

            </>
          )}
        </div>
      )}

      {/* Explorer Tab */}
      {activeTab === "explorer" && (
        <div style={{ marginTop: 24 }}>
          {explorerLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading playbook tree...
            </div>
          ) : !explorerTree ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load playbook structure
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24, height: "calc(100vh - 300px)" }}>
              {/* Left Panel: File Explorer Tree */}
              <div style={{
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}>
                {/* Tree Header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-default)",
                  background: "var(--surface-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>Playbook Structure</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={expandAllNodes}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        background: "var(--status-info-bg)",
                        color: "var(--button-primary-bg)",
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
                        background: "var(--surface-secondary)",
                        color: "var(--text-muted)",
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

              {/* Right Panel: Detail View or Group Specs Panel */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}>
                {selectedNode ? (
                  // Check if this is a group node - show spec cards with toggles
                  (selectedNode.type === "group" || selectedNode.type === "output-group") && selectedNode.children && selectedNode.children.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      {/* Group Header */}
                      <div style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-default)",
                        background: "var(--background)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                            {selectedNode.name}
                          </h3>
                          <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                            {selectedNode.meta?.count || selectedNode.children.length} specs
                            {selectedNode.meta?.enabledCount !== undefined &&
                              ` • ${selectedNode.meta.enabledCount} enabled`}
                          </p>
                        </div>
                        {systemSpecsHaveChanges && (
                          <button
                            onClick={handleSaveSystemSpecs}
                            disabled={savingSystemSpecs}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              background: "var(--status-success-text)",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: savingSystemSpecs ? "not-allowed" : "pointer",
                            }}
                          >
                            {savingSystemSpecs ? "Saving..." : "Save Changes"}
                          </button>
                        )}
                      </div>

                      {/* Spec Cards with Toggles */}
                      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                        {(() => {
                          // Collect all spec nodes from children (handle nested output-groups)
                          const collectSpecs = (nodes: TreeNode[]): TreeNode[] => {
                            const specs: TreeNode[] = [];
                            for (const node of nodes) {
                              if (node.type === "spec") {
                                specs.push(node);
                              } else if (node.children) {
                                specs.push(...collectSpecs(node.children));
                              }
                            }
                            return specs;
                          };

                          const specNodes = collectSpecs(selectedNode.children || []);

                          // If this has output-groups, group by those
                          const hasSubGroups = selectedNode.children?.some(c => c.type === "output-group");

                          if (hasSubGroups) {
                            // Render grouped by output-group
                            return selectedNode.children?.map((subGroup) => {
                              if (subGroup.type !== "output-group") return null;
                              const subSpecs = collectSpecs(subGroup.children || []);
                              if (subSpecs.length === 0) return null;

                              return (
                                <div key={subGroup.id} style={{ marginBottom: 20 }}>
                                  <div style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    letterSpacing: "0.05em",
                                    marginBottom: 8,
                                    paddingBottom: 4,
                                    borderBottom: "1px solid var(--input-border)",
                                  }}>
                                    {subGroup.name}
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {subSpecs.map((specNode) => {
                                      const spec = (availableItems?.systemSpecs || []).find(s => s.id === specNode.id);
                                      const isEnabled = systemSpecToggles.get(specNode.id) ?? true;
                                      const isGloballyActive = specNode.meta?.isActive !== false;
                                      const effectiveEnabled = isGloballyActive && isEnabled;
                                      const specHasOverride = hasConfigOverride(specNode.id);
                                      const specHasConfig = spec?.config && Object.keys(spec.config).length > 0;

                                      return (
                                        <div
                                          key={specNode.id}
                                          style={{
                                            padding: "12px 14px",
                                            background: !isGloballyActive
                                              ? "var(--status-error-bg)"
                                              : specHasOverride
                                                ? "var(--status-warning-bg)"
                                                : effectiveEnabled
                                                  ? "var(--surface-primary)"
                                                  : "var(--background)",
                                            border: !isGloballyActive
                                              ? "1px solid var(--status-error-border)"
                                              : specHasOverride
                                                ? "1px solid var(--status-warning-border)"
                                                : effectiveEnabled
                                                  ? "1px solid var(--status-success-border)"
                                                  : "1px solid var(--border-default)",
                                            borderRadius: 8,
                                            opacity: effectiveEnabled ? 1 : 0.6,
                                            transition: "all 0.15s",
                                          }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                                                <SpecRoleBadge role={specNode.meta?.specRole || spec?.specRole} size="sm" showIcon={false} />
                                                {outputTypeBadge(specNode.meta?.outputType || spec?.outputType || "")}
                                                {!isGloballyActive && (
                                                  <span style={{
                                                    fontSize: 9,
                                                    fontWeight: 600,
                                                    padding: "1px 4px",
                                                    background: "var(--button-destructive-bg)",
                                                    color: "white",
                                                    borderRadius: 3,
                                                    textTransform: "uppercase",
                                                  }}>
                                                    Inactive
                                                  </span>
                                                )}
                                              </div>
                                              <Link
                                                href={`${routePrefix}/specs/${specNode.id}`}
                                                style={{
                                                  fontWeight: 600,
                                                  fontSize: 13,
                                                  color: effectiveEnabled ? "var(--text-primary)" : "var(--text-muted)",
                                                  textDecoration: "none",
                                                  display: "block",
                                                  marginBottom: 4,
                                                }}
                                              >
                                                {specNode.name.replace(/^🚫\s*/, "")}
                                              </Link>
                                              {specNode.description && (
                                                <div style={{
                                                  fontSize: 11,
                                                  color: effectiveEnabled ? "var(--text-muted)" : "var(--text-placeholder)",
                                                  lineHeight: 1.4,
                                                  overflow: "hidden",
                                                  display: "-webkit-box",
                                                  WebkitLineClamp: 2,
                                                  WebkitBoxOrient: "vertical",
                                                }}>
                                                  {specNode.description}
                                                </div>
                                              )}
                                            </div>
                                            {/* Toggle controls */}
                                            {isGloballyActive && (
                                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                {specHasConfig && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (spec) handleOpenConfigModal(spec);
                                                    }}
                                                    style={{
                                                      width: 28,
                                                      height: 28,
                                                      borderRadius: 6,
                                                      border: specHasOverride ? "2px solid var(--status-warning-text)" : "1px solid var(--input-border)",
                                                      background: specHasOverride ? "var(--status-warning-bg)" : "var(--surface-primary)",
                                                      cursor: "pointer",
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent: "center",
                                                    }}
                                                    title={specHasOverride ? "Config overridden - click to edit" : "Configure spec settings"}
                                                  >
                                                    <span style={{ fontSize: 14 }}>⚙️</span>
                                                  </button>
                                                )}
                                                <button
                                                  onClick={() => handleToggleSystemSpec(specNode.id)}
                                                  style={{
                                                    width: 40,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    border: "none",
                                                    background: isEnabled ? "var(--status-success-text)" : "var(--button-disabled-bg)",
                                                    cursor: "pointer",
                                                    position: "relative",
                                                    transition: "background 0.15s",
                                                  }}
                                                >
                                                  <div style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: "50%",
                                                    background: "var(--surface-primary)",
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
                              );
                            });
                          } else {
                            // Render flat list of specs
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {specNodes.map((specNode) => {
                                  const spec = (availableItems?.systemSpecs || []).find(s => s.id === specNode.id) ||
                                               items.find(i => i.spec?.id === specNode.id)?.spec;
                                  const isSystemSpec = specNode.meta?.isSystemSpec;
                                  const isEnabled = isSystemSpec
                                    ? (systemSpecToggles.get(specNode.id) ?? true)
                                    : true;
                                  const isGloballyActive = specNode.meta?.isActive !== false;
                                  const effectiveEnabled = isGloballyActive && isEnabled;
                                  const specHasOverride = isSystemSpec && hasConfigOverride(specNode.id);
                                  const specHasConfig = spec?.config && Object.keys(spec.config).length > 0;

                                  return (
                                    <div
                                      key={specNode.id}
                                      style={{
                                        padding: "12px 14px",
                                        background: effectiveEnabled ? "var(--surface-primary)" : "var(--background)",
                                        border: effectiveEnabled
                                          ? "1px solid var(--status-success-border)"
                                          : "1px solid var(--border-default)",
                                        borderRadius: 8,
                                        opacity: effectiveEnabled ? 1 : 0.6,
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                                            <SpecRoleBadge role={specNode.meta?.specRole || spec?.specRole} size="sm" showIcon={false} />
                                            {outputTypeBadge(specNode.meta?.outputType || spec?.outputType || "")}
                                          </div>
                                          <Link
                                            href={`${routePrefix}/specs/${specNode.id}`}
                                            style={{
                                              fontWeight: 600,
                                              fontSize: 13,
                                              color: effectiveEnabled ? "var(--text-primary)" : "var(--text-muted)",
                                              textDecoration: "none",
                                              display: "block",
                                              marginBottom: 4,
                                            }}
                                          >
                                            {specNode.name.replace(/^🚫\s*/, "")}
                                          </Link>
                                          {specNode.description && (
                                            <div style={{
                                              fontSize: 11,
                                              color: effectiveEnabled ? "var(--text-muted)" : "var(--text-placeholder)",
                                              lineHeight: 1.4,
                                            }}>
                                              {specNode.description}
                                            </div>
                                          )}
                                        </div>
                                        {/* Toggle for system specs only */}
                                        {isSystemSpec && isGloballyActive && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                            {specHasConfig && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (spec) handleOpenConfigModal(spec as Spec);
                                                }}
                                                style={{
                                                  width: 28,
                                                  height: 28,
                                                  borderRadius: 6,
                                                  border: specHasOverride ? "2px solid var(--status-warning-text)" : "1px solid var(--input-border)",
                                                  background: specHasOverride ? "var(--status-warning-bg)" : "var(--surface-primary)",
                                                  cursor: "pointer",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                }}
                                                title={specHasOverride ? "Config overridden" : "Configure"}
                                              >
                                                <span style={{ fontSize: 14 }}>⚙️</span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() => handleToggleSystemSpec(specNode.id)}
                                              style={{
                                                width: 40,
                                                height: 22,
                                                borderRadius: 11,
                                                border: "none",
                                                background: isEnabled ? "var(--status-success-text)" : "var(--button-disabled-bg)",
                                                cursor: "pointer",
                                                position: "relative",
                                              }}
                                            >
                                              <div style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: "50%",
                                                background: "var(--surface-primary)",
                                                position: "absolute",
                                                top: 2,
                                                left: isEnabled ? 20 : 2,
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
                            );
                          }
                        })()}
                      </div>
                    </div>
                  ) : (
                    // Regular detail view for non-group nodes
                    <NodeDetailPanel node={selectedNode} />
                  )
                ) : (
                  <div style={{
                    padding: 48,
                    textAlign: "center",
                    color: "var(--text-placeholder)",
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
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading template variables...
            </div>
          ) : !slugsData ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load slugs data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
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
                    border: activeFilter === null ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                    background: activeFilter === null ? "var(--status-info-bg)" : "var(--surface-primary)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{slugsData.counts.total}</div>
                </button>
                {[
                  { key: "IDENTITY", label: "🎭 Identity", count: slugsData.counts.identity },
                  { key: "CONTENT", label: "📖 Content", count: slugsData.counts.content },
                  { key: "VOICE", label: "🎙️ Voice", count: slugsData.counts.voice },
                  { key: "MEASURE", label: "📊 Measure", count: slugsData.counts.measure },
                  { key: "LEARN", label: "🧠 Learn", count: slugsData.counts.learn },
                  { key: "ADAPT", label: "🔄 Adapt", count: slugsData.counts.adapt },
                  { key: "REWARD", label: "⭐ Reward", count: slugsData.counts.reward || 0 },
                  { key: "GUARDRAIL", label: "🛡️ Guard", count: slugsData.counts.guardrail || 0 },
                  { key: "COMPOSE", label: "🧩 Compose", count: slugsData.counts.compose || 0 },
                ].map(stat => (
                  <button
                    key={stat.key}
                    onClick={() => toggleFilter(stat.key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === stat.key ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                      background: activeFilter === stat.key ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: stat.count > 0 ? "pointer" : "default",
                      opacity: stat.count > 0 ? 1 : 0.5,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                    disabled={stat.count === 0}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{stat.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === stat.key ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{stat.count}</div>
                  </button>
                ))}
              </div>

              {/* Tree View */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {slugsData.tree
                  .filter(category => !activeFilter || category.name.toUpperCase() === activeFilter)
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
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-placeholder)" }}>
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
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading parameters...
            </div>
          ) : !parametersData ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load parameters data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
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
                    border: activeFilter === null ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                    background: activeFilter === null ? "var(--status-info-bg)" : "var(--surface-primary)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{parametersData.counts.parameters}</div>
                </button>
                {parametersData.categories.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() => toggleFilter(cat.category)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === cat.category ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                      background: activeFilter === cat.category ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{cat.icon} {cat.category}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === cat.category ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{cat.parameters.length}</div>
                  </button>
                ))}
                <div style={{ marginLeft: "auto", position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search parameters..."
                    value={parameterSearch}
                    onChange={(e) => setParameterSearch(e.target.value)}
                    style={{
                      padding: "8px 12px 8px 32px",
                      borderRadius: 6,
                      border: "1px solid var(--border-default)",
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      width: 200,
                      outline: "none",
                    }}
                  />
                  <span style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    pointerEvents: "none",
                  }}>🔍</span>
                  {parameterSearch && (
                    <button
                      onClick={() => setParameterSearch("")}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        padding: 0,
                      }}
                    >✕</button>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                overflow: "hidden",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}>
                {parametersData.categories
                  .filter(category => !activeFilter || activeFilter === category.category)
                  .map((category) => {
                    const searchLower = parameterSearch.toLowerCase();
                    const filteredParams = parameterSearch
                      ? category.parameters.filter(p =>
                          p.parameterId.toLowerCase().includes(searchLower) ||
                          p.name.toLowerCase().includes(searchLower) ||
                          (p.definition && p.definition.toLowerCase().includes(searchLower))
                        )
                      : category.parameters;
                    if (parameterSearch && filteredParams.length === 0) return null;
                    return (
                  <div key={category.category}>
                    {/* Category Header */}
                    <div
                      onClick={() => toggleParamCategoryExpand(category.category)}
                      style={{
                        padding: "12px 16px",
                        background: "var(--background)",
                        borderBottom: "1px solid var(--border-default)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{category.icon}</span>
                      <span style={{ fontWeight: 600 }}>{category.category}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({filteredParams.length}{parameterSearch && filteredParams.length !== category.parameters.length ? ` / ${category.parameters.length}` : ""})</span>
                      <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 12 }}>
                        {expandedParamCategories.has(category.category) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Category Content */}
                    {expandedParamCategories.has(category.category) && (
                      <div style={{ padding: "8px 0" }}>
                        {filteredParams.map((param) => (
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
                                borderBottom: "1px solid var(--border-subtle)",
                              }}
                            >
                              <span style={{
                                fontSize: 11,
                                fontFamily: "monospace",
                                color: "var(--button-primary-bg)",
                                background: "var(--status-info-bg)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}>
                                {param.parameterId}
                              </span>
                              <span style={{ fontWeight: 500 }}>{param.name}</span>
                              {param.sourceFeatureSet && (
                                <a
                                  href={`/lab/features/${param.sourceFeatureSet.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: 10,
                                    background: "var(--status-success-bg)",
                                    color: "var(--status-success-text)",
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    textDecoration: "none",
                                  }}
                                >
                                  📦 {param.sourceFeatureSet.name}
                                </a>
                              )}
                              {param.scoringAnchors.length > 0 && (
                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                  {param.scoringAnchors.length} anchors
                                </span>
                              )}
                              <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 11 }}>
                                {expandedParams.has(param.parameterId) ? "▼" : "▶"}
                              </span>
                            </div>
                            {/* Parameter Details */}
                            {expandedParams.has(param.parameterId) && (
                              <div style={{ padding: "8px 16px 16px 48px", background: "var(--background)" }}>
                                {param.definition && (
                                  <div style={{ marginBottom: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                                    {param.definition}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12 }}>
                                  <div>
                                    <span style={{ color: "var(--text-muted)" }}>Scale:</span>{" "}
                                    <span style={{ fontWeight: 500 }}>{param.scaleType}</span>
                                  </div>
                                  <div>
                                    <span style={{ color: "var(--text-muted)" }}>Type:</span>{" "}
                                    <span style={{ fontWeight: 500 }}>{param.parameterType}</span>
                                  </div>
                                </div>
                                {(param.interpretationHigh || param.interpretationLow) && (
                                  <div style={{ marginBottom: 12, fontSize: 12 }}>
                                    {param.interpretationHigh && (
                                      <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "var(--status-success-text)" }}>↑ High:</span>{" "}
                                        <span style={{ color: "var(--text-secondary)" }}>{param.interpretationHigh}</span>
                                      </div>
                                    )}
                                    {param.interpretationLow && (
                                      <div>
                                        <span style={{ color: "var(--status-error-text)" }}>↓ Low:</span>{" "}
                                        <span style={{ color: "var(--text-secondary)" }}>{param.interpretationLow}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Scoring Anchors */}
                                {param.scoringAnchors.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                                      Scoring Anchors
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {param.scoringAnchors.map((anchor) => (
                                        <div
                                          key={anchor.id}
                                          style={{
                                            padding: "8px 12px",
                                            background: "var(--surface-primary)",
                                            borderRadius: 6,
                                            border: anchor.isGold ? "2px solid var(--status-warning-border)" : "1px solid var(--border-default)",
                                          }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <span style={{
                                              fontWeight: 700,
                                              fontSize: 14,
                                              color: anchor.score >= 0.7 ? "var(--status-success-text)" : anchor.score <= 0.3 ? "var(--status-error-text)" : "var(--status-warning-text)",
                                            }}>
                                              {anchor.score.toFixed(1)}
                                            </span>
                                            {anchor.isGold && (
                                              <span style={{ fontSize: 11, color: "var(--status-warning-text)", background: "var(--status-warning-bg)", padding: "1px 4px", borderRadius: 3 }}>
                                                Gold
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, fontStyle: "italic" }}>
                                            &ldquo;{anchor.example}&rdquo;
                                          </div>
                                          {anchor.rationale && (
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
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
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Used by:</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {param.usedBySpecs.map((spec) => (
                                        <span
                                          key={spec.specId}
                                          style={{
                                            fontSize: 10,
                                            background: "var(--status-success-bg)",
                                            color: "var(--status-success-text)",
                                            padding: "2px 6px",
                                            borderRadius: 3,
                                            border: "1px solid var(--status-success-border)",
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
                );
                })}
                {parametersData.categories.length === 0 && (
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-placeholder)" }}>
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
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Loading triggers...
            </div>
          ) : !triggersData ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              Failed to load triggers data
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary - Clickable Filters */}
              <div style={{
                padding: 16,
                background: "var(--background)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
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
                    border: activeFilter === null ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                    background: activeFilter === null ? "var(--status-info-bg)" : "var(--surface-primary)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 70,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>All</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === null ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{triggersData.counts.triggers}</div>
                </button>
                {triggersData.categories.map(cat => (
                  <button
                    key={cat.outputType}
                    onClick={() => toggleFilter(cat.outputType)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: activeFilter === cat.outputType ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                      background: activeFilter === cat.outputType ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 70,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{cat.icon} {cat.outputType}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: activeFilter === cat.outputType ? "var(--button-primary-bg)" : "var(--text-primary)" }}>{cat.specs.reduce((sum, s) => sum + s.triggers.length, 0)}</div>
                  </button>
                ))}
              </div>

              {/* Categories by Output Type */}
              <div style={{
                background: "var(--surface-primary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
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
                        background: "var(--background)",
                        borderBottom: "1px solid var(--border-default)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{category.icon}</span>
                      <span style={{ fontWeight: 600 }}>{category.outputType}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({category.specs.length} specs)</span>
                      <span style={{ marginLeft: 8, color: "var(--text-placeholder)", fontSize: 11, fontStyle: "italic" }}>
                        {category.description}
                      </span>
                      <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 12 }}>
                        {expandedTriggerCategories.has(category.outputType) ? "▼" : "▶"}
                      </span>
                    </div>
                    {/* Specs in this category */}
                    {expandedTriggerCategories.has(category.outputType) && (
                      <div style={{ padding: "8px 0" }}>
                        {category.specs.map((spec, specIdx) => (
                          <div key={`${category.outputType}-${spec.specId}-${specIdx}`}>
                            {/* Spec Header */}
                            <div
                              onClick={() => toggleTriggerSpecExpand(spec.specId)}
                              style={{
                                padding: "8px 16px 8px 32px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                borderBottom: "1px solid var(--border-subtle)",
                              }}
                            >
                              <span style={{
                                fontSize: 10,
                                fontFamily: "monospace",
                                color: "var(--status-success-text)",
                                background: "var(--status-success-bg)",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}>
                                {spec.specSlug}
                              </span>
                              <span style={{ fontWeight: 500 }}>{spec.specName}</span>
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                {spec.triggers.length} trigger{spec.triggers.length !== 1 ? "s" : ""}
                              </span>
                              <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 11 }}>
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
                                      background: "var(--status-warning-bg)",
                                      borderRadius: 6,
                                      border: "1px solid var(--status-warning-border)",
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
                                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                          ({trigger.actions.length} action{trigger.actions.length !== 1 ? "s" : ""})
                                        </span>
                                        <span style={{ marginLeft: "auto", color: "var(--text-placeholder)", fontSize: 10 }}>
                                          {expandedTriggerItems.has(trigger.id) ? "▼" : "▶"}
                                        </span>
                                      </div>
                                      {/* Given/When/Then */}
                                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                        <div><span style={{ color: "var(--badge-purple-text)", fontWeight: 500 }}>Given:</span> {trigger.given}</div>
                                        <div><span style={{ color: "var(--status-warning-text)", fontWeight: 500 }}>When:</span> {trigger.when}</div>
                                        <div><span style={{ color: "var(--status-success-text)", fontWeight: 500 }}>Then:</span> {trigger.then}</div>
                                      </div>
                                    </div>
                                    {/* Actions */}
                                    {expandedTriggerItems.has(trigger.id) && trigger.actions.length > 0 && (
                                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--status-warning-border)" }}>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                                          Actions
                                        </div>
                                        {trigger.actions.map((action) => (
                                          <div
                                            key={action.id}
                                            style={{
                                              padding: "6px 10px",
                                              background: "var(--surface-primary)",
                                              borderRadius: 4,
                                              marginBottom: 4,
                                              fontSize: 12,
                                              border: "1px solid var(--border-default)",
                                            }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                              <span>▶️</span>
                                              <span style={{ flex: 1 }}>{action.description}</span>
                                              <span style={{
                                                fontSize: 10,
                                                color: "var(--text-muted)",
                                                background: "var(--surface-secondary)",
                                                padding: "1px 4px",
                                                borderRadius: 2,
                                              }}>
                                                w:{action.weight.toFixed(1)}
                                              </span>
                                            </div>
                                            {action.parameterId && (
                                              <div style={{ marginLeft: 24, fontSize: 11, color: "var(--button-primary-bg)" }}>
                                                → {action.parameterName || action.parameterId}
                                              </div>
                                            )}
                                            {action.learnCategory && (
                                              <div style={{ marginLeft: 24, fontSize: 11, color: "var(--badge-purple-text)" }}>
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
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-placeholder)" }}>
                    No triggers found in this playbook
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visualizer Tab */}
      {activeTab === "visualizer" && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
              height: "calc(100vh - 320px)",
              minHeight: 500,
            }}
          >
            <iframe
              src={`/x/taxonomy-graph?focus=playbook:${playbookId}&depth=6&embed=1`}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
              title="Playbook Visualizer"
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Interactive graph showing specs, parameters, triggers, and their relationships
            </span>
            <Link
              href={`/x/taxonomy-graph?focus=playbook:${playbookId}&depth=6`}
              style={{
                fontSize: 12,
                color: "var(--button-primary-bg)",
                textDecoration: "none",
              }}
            >
              Open fullscreen →
            </Link>
          </div>
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

// Explorer Tree Node Component (uses nodeIcons/nodeColors from ExplorerTree)
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
          border: "1px solid var(--text-placeholder)",
          borderRadius: 2,
          background: "var(--surface-primary)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
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
                  background: "var(--button-disabled-bg)",
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
              background: "var(--button-disabled-bg)",
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
                background: "var(--button-disabled-bg)",
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
              background: "var(--button-disabled-bg)",
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
          if (!isSelected) e.currentTarget.style.background = "var(--hover-bg)";
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
          color: isSelected ? colors.text : "var(--text-secondary)",
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
            color: "var(--text-muted)",
            background: "var(--border-default)",
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
        borderBottom: "1px solid var(--border-default)",
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
              color: "var(--text-primary)",
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
            <h3 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Description
            </h3>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-secondary)",
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
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
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
                      background: "var(--background)",
                      borderRadius: 6,
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}>
                      {key}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
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
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Full Template ({node.meta.length} chars)
            </h3>
            <pre style={{
              margin: 0,
              padding: 16,
              background: "var(--code-bg)",
              color: "var(--code-text)",
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
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Full Description
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "var(--status-info-bg)",
              borderRadius: 8,
              border: "1px solid var(--status-info-border)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--status-info-text)",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullDescription}
            </p>
          </div>
        )}

        {/* Instruction Content (for instruction nodes) */}
        {node.type === "instruction" && node.meta?.fullText && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Instruction
            </h3>
            <p style={{
              margin: 0,
              padding: 16,
              background: "var(--status-success-bg)",
              borderRadius: 8,
              border: "1px solid var(--status-success-border)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--status-success-text)",
              whiteSpace: "pre-wrap",
            }}>
              {node.meta.fullText}
            </p>
          </div>
        )}

        {/* Children Summary */}
        {node.children && node.children.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
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
                          color: "var(--text-muted)",
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
                      background: "var(--surface-primary)",
                      borderRadius: 4,
                      color: "var(--text-muted)",
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
                  color: "var(--text-muted)",
                  fontSize: 12,
                  background: "var(--background)",
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
  REWARD: "⭐",
  GUARDRAIL: "🛡️",
  COMPOSE: "🧩",
};

const slugCategoryColors: Record<string, { bg: string; border: string; headerBg: string }> = {
  IDENTITY: { bg: "var(--badge-blue-bg)", border: "var(--status-info-border)", headerBg: "var(--badge-blue-bg)" },
  CONTENT: { bg: "var(--badge-green-bg)", border: "var(--status-success-border)", headerBg: "var(--badge-green-bg)" },
  VOICE: { bg: "var(--status-warning-bg)", border: "var(--status-warning-border)", headerBg: "var(--badge-yellow-bg)" },
  MEASURE: { bg: "var(--status-success-bg)", border: "var(--status-success-border)", headerBg: "var(--status-success-bg)" },
  LEARN: { bg: "var(--badge-purple-bg)", border: "var(--badge-purple-text)", headerBg: "var(--badge-purple-bg)" },
  ADAPT: { bg: "var(--badge-yellow-bg)", border: "var(--status-warning-border)", headerBg: "var(--badge-yellow-bg)" },
  REWARD: { bg: "var(--badge-yellow-bg)", border: "var(--status-warning-border)", headerBg: "var(--badge-yellow-bg)" },
  GUARDRAIL: { bg: "var(--status-error-bg)", border: "var(--status-error-border)", headerBg: "var(--status-error-bg)" },
  COMPOSE: { bg: "var(--badge-pink-bg)", border: "var(--badge-pink-border)", headerBg: "var(--badge-pink-bg)" },
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
  const colors = slugCategoryColors[category.name] || { bg: "var(--background)", border: "var(--border-default)", headerBg: "var(--surface-secondary)" };

  return (
    <div style={{ borderBottom: "1px solid var(--border-default)" }}>
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
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {expanded ? "▼" : "▶"}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{category.name}</span>
        <span style={{
          fontSize: 11,
          padding: "2px 8px",
          background: "var(--surface-primary)",
          borderRadius: 10,
          color: "var(--text-muted)",
        }}>
          {category.children?.length || 0} specs
        </span>
        {category.meta?.description && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{category.meta.description}</span>
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
      background: "var(--surface-primary)",
      borderRadius: 8,
      border: "1px solid var(--border-default)",
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
          background: expanded ? "var(--background)" : "var(--surface-primary)",
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 10, color: "var(--text-placeholder)", width: 12 }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <span style={{ fontSize: 14 }}>📋</span>
        {spec.specId ? (
          <Link href={`${routePrefix}/specs/${spec.specId}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 500, fontSize: 13, flex: 1, textDecoration: "none", color: "inherit" }}>{spec.name}</Link>
        ) : (
          <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{spec.name}</span>
        )}
        {spec.specSlug && spec.specId && (
          <Link
            href={`${routePrefix}/specs/${spec.specId}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              padding: "2px 6px",
              background: "var(--surface-secondary)",
              borderRadius: 4,
              color: "var(--button-primary-bg)",
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
            background: spec.meta.scope === "SYSTEM" ? "var(--badge-blue-bg)" : "var(--status-success-bg)",
            color: spec.meta.scope === "SYSTEM" ? "var(--status-info-text)" : "var(--status-success-text)",
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
          background: isProduces ? "var(--status-warning-bg)" : (depth % 2 === 0 ? "var(--background)" : "var(--surface-primary)"),
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 9, color: "var(--text-placeholder)", marginTop: 3 }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 9 }} />}

        {isProduces ? (
          <>
            <span style={{ color: "var(--status-warning-text)", fontWeight: 500 }}>→ {node.name}:</span>
            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{node.meta?.outputType}</span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: "monospace", color: "var(--button-primary-bg)" }}>
              {node.path || node.name}
            </span>
            {displayValue !== null && (
              <span style={{
                flex: 1,
                color: "var(--text-secondary)",
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
                background: "var(--status-info-bg)",
                color: "var(--button-primary-bg)",
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
                  color: "var(--button-primary-bg)",
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
