"use client";

// ── GenerateStep ── Async step: kicks off server work, polls for completion.
// Validates: useAsyncStep, phase machine, skeleton-first, error/retry, refresh survival.

import { useCallback } from "react";
import { useAsyncStep } from "@/hooks/useAsyncStep";
import { StepFooter } from "@/components/wizards/StepFooter";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import type { StepRenderProps } from "@/components/wizards/types";
import type { PollableTask } from "@/hooks/useTaskPoll";
import { BookOpen } from "lucide-react";

interface GeneratedModule {
  id: string;
  title: string;
  description: string;
  learningOutcomes?: string[];
}

interface GenerateResult {
  moduleCount: number;
  modules: GeneratedModule[];
}

export function GenerateStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const name = getData<string>("labName") || "";
  const emphasis = getData<string>("labEmphasis") || "balanced";
  const duration = getData<string>("labDuration") || "30";

  // Skeleton modules (shown before full completion)
  const skeletonModules = getData<GeneratedModule[]>("labSkeletonModules");

  const async = useAsyncStep<GenerateResult>({
    taskIdKey: "labGenerateTaskId",
    getData,
    setData,
    start: useCallback(async () => {
      const res = await fetch("/api/wizard-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emphasis, duration }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to start generation");
      return data.taskId;
    }, [name, emphasis, duration]),

    onSkeleton: useCallback(
      (task: PollableTask) => {
        const ctx = task.context || {};
        if (ctx.skeletonReady && ctx.skeletonModules) {
          setData("labSkeletonModules", ctx.skeletonModules);
          return true;
        }
        return false;
      },
      [setData],
    ),

    onComplete: useCallback((task: PollableTask) => {
      return task.context?.result as GenerateResult;
    }, []),
  });

  // ── Done: show enriched result ──────────────────────
  if (async.phase === "done" && async.result) {
    return (
      <div className="hf-wizard-step">
        <h1 className="hf-page-title">Generated Modules</h1>
        <p className="hf-page-subtitle" style={{ marginBottom: 20 }}>
          {async.result.moduleCount} modules created for &ldquo;{name}&rdquo;
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {async.result.modules.map((mod) => (
            <div key={mod.id} className="hf-card-compact">
              <div className="hf-flex hf-gap-sm hf-items-center" style={{ marginBottom: 4 }}>
                <BookOpen style={{ width: 16, height: 16, color: "var(--accent-primary)" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  {mod.title}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                {mod.description}
              </p>
              {mod.learningOutcomes && mod.learningOutcomes.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {mod.learningOutcomes.map((lo, i) => (
                    <li key={i} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {lo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <StepFooter
          onBack={onPrev}
          onNext={() => {
            setData("labModules", async.result!.modules);
            onNext();
          }}
          nextLabel="Accept"
        />
      </div>
    );
  }

  // ── Skeleton: show modules while enrichment continues ─
  if (async.phase === "skeleton" && skeletonModules) {
    return (
      <div className="hf-wizard-step">
        <h1 className="hf-page-title">Generating...</h1>
        <p className="hf-page-subtitle" style={{ marginBottom: 20 }}>
          Modules found \u2014 enriching with learning outcomes...
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {skeletonModules.map((mod) => (
            <div key={mod.id} className="hf-card-compact" style={{ opacity: 0.7 }}>
              <div className="hf-flex hf-gap-sm hf-items-center" style={{ marginBottom: 4 }}>
                <span
                  className="hf-spinner"
                  style={{ width: 14, height: 14, borderWidth: 2 }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  {mod.title}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Working: spinner ────────────────────────────────
  if (async.isWorking && async.phase !== "skeleton") {
    const msg = async.progress?.context?.message || "Starting...";
    const stepIndex = async.progress?.context?.stepIndex;
    const totalSteps = async.progress?.context?.totalSteps;

    return (
      <div className="hf-wizard-step" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div
          className="hf-spinner"
          style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 16 }}
        />
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Generating
        </p>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 12px" }}>
          {msg}
        </p>
        {totalSteps && (
          <div style={{ width: 200, height: 6, borderRadius: 3, background: "var(--surface-secondary)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                background: "var(--accent-primary)",
                transition: "width 0.3s ease",
                width: `${(((stepIndex ?? 0) + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>
        )}
        <StepFooter
          onBack={() => async.cancel()}
          backLabel="Cancel"
          onNext={() => {}}
          nextDisabled
          nextLabel="Generating..."
        />
      </div>
    );
  }

  // ── Idle / Error: show trigger ──────────────────────
  return (
    <div className="hf-wizard-step">
      <h1 className="hf-page-title">Ready to generate</h1>
      <p className="hf-page-subtitle" style={{ marginBottom: 20 }}>
        We&apos;ll create a curriculum for &ldquo;{name}&rdquo; ({emphasis}, {duration}min sessions).
      </p>

      <ErrorBanner error={async.error} />

      {async.error && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="hf-btn hf-btn-secondary"
            onClick={async.retry}
          >
            Retry
          </button>
        </div>
      )}

      <StepFooter
        onBack={onPrev}
        onNext={async.execute}
        nextLabel="Generate"
        nextDisabled={async.phase === "submitting"}
        nextLoading={async.phase === "submitting"}
      />
    </div>
  );
}
