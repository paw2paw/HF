"use client";

import { memo, useCallback, useState } from "react";
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  useReactFlow,
} from "reactflow";

interface Waypoint {
  x: number;
  y: number;
}

interface EditableEdgeData {
  waypoints?: Waypoint[];
  label?: string;
  onWaypointsChange?: (edgeId: string, waypoints: Waypoint[]) => void;
}

const WAYPOINT_STORAGE_KEY = "hf-flow-waypoints";

// Load waypoints from localStorage
function loadWaypoints(): Record<string, Waypoint[]> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(WAYPOINT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save waypoints to localStorage
function saveWaypoints(waypoints: Record<string, Waypoint[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WAYPOINT_STORAGE_KEY, JSON.stringify(waypoints));
  } catch {
    // localStorage might be full
  }
}

export const EditableEdge = memo(function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<EditableEdgeData>) {
  const { setEdges } = useReactFlow();
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Get waypoints from data or localStorage
  const waypoints: Waypoint[] = data?.waypoints || [];

  // Calculate path through waypoints
  const getPathThroughWaypoints = useCallback(() => {
    if (waypoints.length === 0) {
      // No waypoints - use default bezier
      const [path] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return path;
    }

    // Build path through waypoints
    const points = [
      { x: sourceX, y: sourceY },
      ...waypoints,
      { x: targetX, y: targetY },
    ];

    // Create smooth curve through points
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      // Calculate control points for smooth curve
      const midX = (current.x + next.x) / 2;

      // Use quadratic bezier for smoother curves
      path += ` Q ${current.x + (next.x - current.x) * 0.5} ${current.y}, ${midX} ${(current.y + next.y) / 2}`;
      path += ` Q ${next.x - (next.x - current.x) * 0.5} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, waypoints]);

  // Add a new waypoint at click position
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.detail === 2) {
        // Double-click to add waypoint
        const rect = (event.target as SVGElement).closest("svg")?.getBoundingClientRect();
        if (!rect) return;

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Find where to insert the waypoint (between which existing points)
        const newWaypoints = [...waypoints, { x, y }];

        // Sort waypoints by distance from source
        newWaypoints.sort((a, b) => {
          const distA = Math.hypot(a.x - sourceX, a.y - sourceY);
          const distB = Math.hypot(b.x - sourceX, b.y - sourceY);
          return distA - distB;
        });

        updateWaypoints(newWaypoints);
      }
    },
    [waypoints, sourceX, sourceY]
  );

  // Update waypoints and persist
  const updateWaypoints = useCallback(
    (newWaypoints: Waypoint[]) => {
      // Update edge data
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id === id) {
            return {
              ...edge,
              data: { ...edge.data, waypoints: newWaypoints },
            };
          }
          return edge;
        })
      );

      // Persist to localStorage
      const allWaypoints = loadWaypoints();
      if (newWaypoints.length > 0) {
        allWaypoints[id] = newWaypoints;
      } else {
        delete allWaypoints[id];
      }
      saveWaypoints(allWaypoints);

      // Callback if provided
      data?.onWaypointsChange?.(id, newWaypoints);
    },
    [id, setEdges, data]
  );

  // Handle waypoint drag
  const handleWaypointDrag = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      const svg = (event.target as SVGElement).closest("svg");
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWaypointX = waypoints[index].x;
      const startWaypointY = waypoints[index].y;

      setIsDragging(index);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const newWaypoints = [...waypoints];
        newWaypoints[index] = {
          x: startWaypointX + deltaX,
          y: startWaypointY + deltaY,
        };

        // Update in real-time
        setEdges((edges) =>
          edges.map((edge) => {
            if (edge.id === id) {
              return {
                ...edge,
                data: { ...edge.data, waypoints: newWaypoints },
              };
            }
            return edge;
          })
        );
      };

      const handleMouseUp = () => {
        setIsDragging(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Persist final position
        const allWaypoints = loadWaypoints();
        allWaypoints[id] = waypoints.map((wp, i) => {
          if (i === index) {
            const currentEdge = document.querySelector(`[data-edge-id="${id}"]`);
            // Get current position from edges state
            return waypoints[i];
          }
          return wp;
        });

        // Re-read current state and save
        setEdges((edges) => {
          const edge = edges.find((e) => e.id === id);
          if (edge?.data?.waypoints) {
            allWaypoints[id] = edge.data.waypoints;
            saveWaypoints(allWaypoints);
          }
          return edges;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [id, waypoints, setEdges]
  );

  // Remove waypoint on right-click
  const handleWaypointRightClick = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const newWaypoints = waypoints.filter((_, i) => i !== index);
      updateWaypoints(newWaypoints);
    },
    [waypoints, updateWaypoints]
  );

  const path = getPathThroughWaypoints();

  return (
    <>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleEdgeClick}
        style={{ cursor: "pointer" }}
      />

      {/* Visible edge path */}
      <path
        d={path}
        fill="none"
        strokeWidth={style?.strokeWidth || 2}
        stroke={style?.stroke || "#94a3b8"}
        strokeDasharray={style?.strokeDasharray}
        markerEnd={markerEnd}
        style={{
          ...style,
          transition: "stroke 0.2s",
        }}
      />

      {/* Waypoint handles */}
      <EdgeLabelRenderer>
        {waypoints.map((waypoint, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${waypoint.x}px, ${waypoint.y}px)`,
              pointerEvents: "all",
            }}
          >
            <div
              onMouseDown={(e) => handleWaypointDrag(index, e)}
              onContextMenu={(e) => handleWaypointRightClick(index, e)}
              style={{
                width: isDragging === index ? 14 : 10,
                height: isDragging === index ? 14 : 10,
                borderRadius: "50%",
                background: isDragging === index ? "#7c3aed" : "#94a3b8",
                border: "2px solid white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                cursor: "grab",
                transition: "all 0.15s",
                opacity: isHovered || isDragging !== null ? 1 : 0,
              }}
              title="Drag to move, right-click to remove"
            />
          </div>
        ))}

        {/* Add waypoint hint on hover */}
        {isHovered && waypoints.length === 0 && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 10,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            Double-click to add waypoint
          </div>
        )}
      </EdgeLabelRenderer>

      {/* Edge label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2 - 12}px)`,
              background: "white",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 10,
              color: "#6b7280",
              border: "1px solid #e5e7eb",
              pointerEvents: "none",
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

// Export function to load saved waypoints
export function loadSavedWaypoints(): Record<string, Waypoint[]> {
  return loadWaypoints();
}

// Export function to clear all waypoints
export function clearSavedWaypoints() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WAYPOINT_STORAGE_KEY);
}
