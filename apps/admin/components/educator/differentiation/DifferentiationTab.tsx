"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  DiffStudent,
  DifferentiationResponse,
} from "@/app/api/educator/classrooms/[id]/differentiation/route";
import type { TriageCategory } from "@/lib/caller-utils";
import { ClassSnapshot } from "./ClassSnapshot";
import { BandGroup } from "./BandGroup";
import "./differentiation.css";

// ─── Banding ──────────────────────────────────────────────────────────────────

type BandDimension = "mastery" | "triage" | "pace";

type Band = { key: string; students: DiffStudent[] };

function bandStudents(students: DiffStudent[], dim: BandDimension): Band[] {
  if (dim === "mastery") {
    const order = ["foundation", "developing", "advanced", "noData"];
    const groups = new Map<string, DiffStudent[]>(order.map((k) => [k, []]));
    for (const s of students) {
      groups.get(s.masteryBand)!.push(s);
    }
    return order.map((k) => ({ key: k, students: groups.get(k)! }));
  }

  if (dim === "triage") {
    const order: TriageCategory[] = ["attention", "active", "advancing", "inactive", "new"];
    const groups = new Map<string, DiffStudent[]>(order.map((k) => [k, []]));
    for (const s of students) {
      groups.get(s.triage)!.push(s);
    }
    return order.map((k) => ({ key: k, students: groups.get(k)! }));
  }

  // Pace
  const paceOrder = ["fast", "moderate", "slow", "self_directed", "unknown"];
  const groups = new Map<string, DiffStudent[]>(paceOrder.map((k) => [k, []]));
  for (const s of students) {
    const key = s.pacePreference ?? "unknown";
    const bucket = groups.get(key) ?? groups.get("unknown")!;
    bucket.push(s);
  }
  return paceOrder.map((k) => ({ key: k, students: groups.get(k)! }));
}

// ─── Dimension chip ────────────────────────────────────────────────────────────

type DimChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function DimChip({ label, active, onClick }: DimChipProps) {
  return (
    <button
      className={`diff-dimension-chip${active ? " diff-dimension-chip-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyNoStudents() {
  return (
    <div className="diff-empty">
      <div className="diff-empty-title">No students yet</div>
      <p className="diff-empty-body">
        Add students from the Roster tab to see differentiation data.
      </p>
    </div>
  );
}

function EmptyNoCalls() {
  return (
    <div className="diff-empty">
      <div className="diff-empty-title">No sessions yet</div>
      <p className="diff-empty-body">
        Differentiation data appears after each student&apos;s first session.
        <br />
        Share the class invite link to get students started.
      </p>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

type Props = { classroomId: string };

export function DifferentiationTab({ classroomId }: Props) {
  const [data, setData] = useState<DifferentiationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimension, setDimension] = useState<BandDimension>("mastery");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/educator/classrooms/${classroomId}/differentiation`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="diff-loading">
        <div className="hf-spinner" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="hf-banner hf-banner-error">
        Failed to load differentiation data: {error}
      </div>
    );
  }

  if (!data) return null;

  const { students } = data;

  // ── Empty: no students ─────────────────────────────────────────────────────
  if (students.length === 0) return <EmptyNoStudents />;

  // ── Empty: students but no calls ───────────────────────────────────────────
  const anyCallsMade = students.some((s) => s.totalCalls > 0);
  if (!anyCallsMade) return <EmptyNoCalls />;

  const bands = bandStudents(students, dimension).filter((b) => b.students.length > 0);
  const topBandKey = bands[0]?.key;

  return (
    <div>
      {/* Level 0 — Class snapshot */}
      <ClassSnapshot students={students} />

      {/* Dimension selector */}
      <div className="diff-dimension-row">
        <span className="diff-dimension-label">Group by:</span>
        <DimChip
          label="Mastery"
          active={dimension === "mastery"}
          onClick={() => { setDimension("mastery"); setExpandedId(null); }}
        />
        <DimChip
          label="Engagement"
          active={dimension === "triage"}
          onClick={() => { setDimension("triage"); setExpandedId(null); }}
        />
        <DimChip
          label="Pace"
          active={dimension === "pace"}
          onClick={() => { setDimension("pace"); setExpandedId(null); }}
        />
      </div>

      {/* Level 1 — Band groups */}
      {bands.map((band) => (
        <BandGroup
          key={band.key}
          bandKey={band.key}
          students={band.students}
          expandedId={expandedId}
          onExpand={setExpandedId}
          defaultOpen={band.key === topBandKey}
        />
      ))}
    </div>
  );
}
