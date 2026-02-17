/**
 * Visual encoding for graph visualiser leaf nodes.
 * Maps metadata (confidence, decay, progress, etc.) to visual channels (size, opacity, ring).
 * Pure functions — no React, no side effects.
 */

export type VisualMode = "simple" | "rich";

export interface RingVisual {
  color: string;
  width: number;
}

export interface EncodedVisuals {
  radius: number;
  opacity: number;
  color: string;
  ring?: RingVisual;
}

export interface EncodableNode {
  type: string;
  value?: number;
  status?: string;
  confidence?: number;
  decayFactor?: number;
  category?: string;
  progress?: number;
  age?: number;
  scoreCount?: number;
  anchorCount?: number;
  source?: string;
  minValue?: number;
  maxValue?: number;
}

// Memory category ring colors (same palette as memoryCategoryColors in caller-graph)
const memoryCategoryRingColors: Record<string, string> = {
  FACT: "#7c3aed",
  PREFERENCE: "#a78bfa",
  EVENT: "#6d28d9",
  TOPIC: "#8b5cf6",
  RELATIONSHIP: "#c4b5fd",
  CONTEXT: "#ddd6fe",
};

// Goal status ring colors
const goalStatusRingColors: Record<string, string> = {
  ACTIVE: "#22c55e",
  COMPLETED: "#eab308",
  PAUSED: "#6b7280",
};

// BehaviorTarget source ring colors
const targetSourceRingColors: Record<string, string> = {
  SEED: "#f59e0b",
  LEARNED: "#22c55e",
  MANUAL: "#3b82f6",
};

function simple(baseSize: number, baseColor: string): EncodedVisuals {
  return { radius: baseSize, opacity: 1, color: baseColor };
}

export function encodeCallerNode(
  node: EncodableNode,
  mode: VisualMode,
  baseSize: number,
  baseColor: string
): EncodedVisuals {
  if (mode === "simple") return simple(baseSize, baseColor);

  switch (node.type) {
    case "memory": {
      const confidence = node.confidence ?? 0.5;
      const decay = node.decayFactor ?? 1;
      const ring = node.category && memoryCategoryRingColors[node.category]
        ? { color: memoryCategoryRingColors[node.category], width: 1.5 + confidence }
        : undefined;
      return {
        radius: baseSize + confidence * 4,
        opacity: 0.4 + decay * 0.6,
        color: baseColor,
        ring,
      };
    }
    case "personality": {
      const v = node.value ?? 0.5;
      return {
        radius: baseSize + Math.abs(v - 0.5) * 6,
        opacity: 0.3 + v * 0.7,
        color: baseColor,
      };
    }
    case "goal": {
      const progress = node.progress ?? 0;
      const status = node.status ?? "ACTIVE";
      const opacityMap: Record<string, number> = {
        ACTIVE: 1,
        COMPLETED: 0.8,
        PAUSED: 0.5,
        ARCHIVED: 0.3,
      };
      const ringColor = goalStatusRingColors[status];
      return {
        radius: baseSize + progress * 6,
        opacity: opacityMap[status] ?? 1,
        color: baseColor,
        ring: ringColor ? { color: ringColor, width: 2 } : undefined,
      };
    }
    case "target": {
      const confidence = node.confidence ?? 0.5;
      return {
        radius: baseSize + confidence * 4,
        opacity: 0.5 + confidence * 0.5,
        color: baseColor,
      };
    }
    case "call": {
      const scoreCount = node.scoreCount ?? 0;
      const age = node.age ?? 0;
      return {
        radius: baseSize + Math.min(scoreCount, 10) * 0.4,
        opacity: 1.0 - age * 0.5,
        color: baseColor,
      };
    }
    default:
      return simple(baseSize, baseColor);
  }
}

export function encodeTaxonomyNode(
  node: EncodableNode,
  mode: VisualMode,
  baseSize: number,
  baseColor: string
): EncodedVisuals {
  if (mode === "simple") return simple(baseSize, baseColor);

  switch (node.type) {
    case "parameter": {
      const anchors = node.anchorCount ?? 0;
      return {
        radius: baseSize + Math.min(anchors, 5) * 0.6,
        opacity: 1,
        color: baseColor,
      };
    }
    case "behaviorTarget": {
      const confidence = node.confidence ?? 0.5;
      const ringColor = node.source && targetSourceRingColors[node.source]
        ? { color: targetSourceRingColors[node.source], width: 2 }
        : undefined;
      return {
        radius: baseSize + confidence * 4,
        opacity: 0.5 + confidence * 0.5,
        color: baseColor,
        ring: ringColor,
      };
    }
    case "range": {
      const span = (node.maxValue ?? 1) - (node.minValue ?? 0);
      return {
        radius: baseSize + span * 3,
        opacity: 1,
        color: baseColor,
      };
    }
    default:
      return simple(baseSize, baseColor);
  }
}
