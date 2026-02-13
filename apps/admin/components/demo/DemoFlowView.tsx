"use client";

import { useMemo, useCallback } from "react";
import ReactFlow, {
  type Node,
  type Edge,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { DemoFlowNode, type DemoFlowNodeData } from "./DemoFlowNode";
import type { DemoSpec, DemoStepContent } from "@/lib/demo/types";

const nodeTypes = { demoStep: DemoFlowNode };

/** Horizontal spacing between step nodes */
const X_GAP = 260;
/** Vertical spacing per row (for wrapping) */
const Y_GAP = 180;
/** Max steps per row before wrapping */
const MAX_PER_ROW = 5;

function getContentType(content: DemoStepContent): "screenshot" | "markdown" | "split" {
  return content.type;
}

function hasScreenshotContent(content: DemoStepContent): boolean {
  if (content.type === "screenshot") return true;
  if (content.type === "split") {
    return hasScreenshotContent(content.left) || hasScreenshotContent(content.right);
  }
  return false;
}

interface DemoFlowViewProps {
  spec: DemoSpec;
  onStepClick?: (stepIndex: number) => void;
}

export function DemoFlowView({ spec, onStepClick }: DemoFlowViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node<DemoFlowNodeData>[] = [];
    const edges: Edge[] = [];

    spec.steps.forEach((step, i) => {
      // Arrange in rows: left-to-right, wrap after MAX_PER_ROW
      const row = Math.floor(i / MAX_PER_ROW);
      const col = row % 2 === 0 ? i % MAX_PER_ROW : MAX_PER_ROW - 1 - (i % MAX_PER_ROW);
      const x = col * X_GAP + 40;
      const y = row * Y_GAP + 40;

      nodes.push({
        id: step.id,
        type: "demoStep",
        position: { x, y },
        data: {
          stepIndex: i,
          totalSteps: spec.steps.length,
          title: step.title,
          description: step.description,
          contentType: getContentType(step.content),
          hasScreenshot: hasScreenshotContent(step.content),
          hasSidebarHighlight: !!step.sidebarHighlight,
          sidebarHref: step.sidebarHighlight?.href,
          isFirst: i === 0,
          isLast: i === spec.steps.length - 1,
          onNavigate: onStepClick,
        },
      });

      // Edge from previous step
      if (i > 0) {
        const prevStep = spec.steps[i - 1];
        edges.push({
          id: `e-${prevStep.id}-${step.id}`,
          source: prevStep.id,
          target: step.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "var(--accent-primary, #7c3aed)", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent-primary, #7c3aed)" },
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [spec, onStepClick]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as DemoFlowNodeData;
      onStepClick?.(data.stepIndex);
    },
    [onStepClick],
  );

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-default, #333)" />
        <Controls
          style={{ background: "var(--surface-primary, #1e1e2e)", borderColor: "var(--border-default, #333)" }}
        />
      </ReactFlow>
    </div>
  );
}
