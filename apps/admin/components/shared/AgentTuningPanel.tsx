"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BostonMatrix } from "./BostonMatrix";
import {
  type AgentTuningSettings,
  type MatrixPosition,
  deriveParametersFromMatrices,
  deriveTraitsFromPositions,
  getPresetForPosition,
  reverseDerive,
  AGENT_TUNING_DEFAULTS,
} from "@/lib/domain/agent-tuning";

// ── Types ──────────────────────────────────────────────

export interface AgentTuningPanelOutput {
  /** parameterId → value (0-1) — all derived parameters from all matrices */
  parameterMap: Record<string, number>;
  /** Tone trait labels derived from matrix positions */
  traits: string[];
  /** Raw matrix positions for round-trip persistence */
  matrixPositions: Record<string, MatrixPosition>;
}

interface AgentTuningPanelProps {
  /** Initial matrix positions (e.g. from saved _matrixPositions) */
  initialPositions?: Record<string, MatrixPosition>;
  /** Existing parameter values to reverse-derive positions from (fallback) */
  existingParams?: Record<string, number>;
  /** Called on every position change */
  onChange: (output: AgentTuningPanelOutput) => void;
  /** Compact mode for Quick Launch (smaller, no slider preview) */
  compact?: boolean;
  /** Disable interaction */
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────

export function AgentTuningPanel({
  initialPositions,
  existingParams,
  onChange,
  compact = false,
  disabled = false,
}: AgentTuningPanelProps) {
  const [settings, setSettings] = useState<AgentTuningSettings>(AGENT_TUNING_DEFAULTS);
  const [positions, setPositions] = useState<Record<string, MatrixPosition>>({});
  const [loaded, setLoaded] = useState(false);
  const isFirstEmit = useRef(true);

  // Load settings from API (or use defaults on failure)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agent-tuning/settings");
        const data = await res.json();
        if (!cancelled && data.ok && data.settings) {
          setSettings(data.settings);
        }
      } catch {
        // Use defaults — already set
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initialize positions once settings are loaded
  useEffect(() => {
    if (!loaded) return;

    if (initialPositions && Object.keys(initialPositions).length > 0) {
      // Saved positions from previous session
      setPositions(initialPositions);
    } else if (existingParams && Object.keys(existingParams).length > 0) {
      // Reverse-derive from existing parameter values
      setPositions(reverseDerive(settings, existingParams));
    } else {
      // Default to center (0.5, 0.5) for each matrix
      const defaults: Record<string, MatrixPosition> = {};
      for (const matrix of settings.matrices) {
        defaults[matrix.id] = { x: 0.5, y: 0.5 };
      }
      setPositions(defaults);
    }
  }, [loaded, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Emit onChange whenever positions change (skip initial empty state)
  useEffect(() => {
    if (Object.keys(positions).length === 0) return;
    if (isFirstEmit.current) {
      isFirstEmit.current = false;
      // Still emit on first render so parent gets initial values
    }

    const derived = deriveParametersFromMatrices(settings, positions);
    const parameterMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(derived)) {
      parameterMap[k] = v.value;
    }

    const traits = deriveTraitsFromPositions(settings, positions);

    onChange({
      parameterMap,
      traits,
      matrixPositions: positions,
    });
  }, [positions, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMatrixChange = useCallback(
    (matrixId: string, pos: MatrixPosition) => {
      setPositions((prev) => ({ ...prev, [matrixId]: pos }));
    },
    [],
  );

  if (!loaded) {
    return (
      <div className="hf-tuning-loading">
        Loading tuning configuration...
      </div>
    );
  }

  return (
    <div className={`hf-tuning-grid${compact ? ' hf-tuning-grid-compact' : ''}`}>
      {settings.matrices.map((matrix) => {
        const pos = positions[matrix.id] || { x: 0.5, y: 0.5 };
        const preset = getPresetForPosition(matrix, pos.x, pos.y);

        return (
          <div key={matrix.id} className="hf-tuning-matrix-item">
            <div className={`hf-tuning-matrix-name${compact ? ' hf-tuning-matrix-name-compact' : ''}`}>
              {matrix.name}
            </div>
            {!compact && (
              <div className="hf-tuning-matrix-desc">
                {matrix.description}
              </div>
            )}
            <BostonMatrix
              xAxis={matrix.xAxis}
              yAxis={matrix.yAxis}
              value={pos}
              presets={matrix.presets}
              activePreset={preset?.id || null}
              onChange={(newPos) => handleMatrixChange(matrix.id, newPos)}
              disabled={disabled}
              compact={compact}
            />
            {/* Active preset label */}
            {preset && (
              <div className="hf-tuning-preset-label">
                {preset.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
