"use client";

/**
 * TrustFooterCard — measurement-transparency strip on the caller overview.
 *
 * Surfaces the #566 evidence-aware scoring story to the educator:
 *   • How many of the caller's calls had skill scores backed by explicit
 *     learner-side evidence (`hasLearnerEvidence === true`)
 *   • How many scores were dropped by the Boaz guard (we infer dropped
 *     skills from the expected-vs-actual delta on evidence-first calls)
 *   • A per-call evidence-ratio sparkline so the educator can see when
 *     the system had clean signal vs. when it didn't
 *
 * Educators trust measurement more when the system is honest about its
 * limits. "Pronunciation didn't score on calls 1–3 because the transcript
 * was text-only" beats a flat 0% reading they can't explain.
 *
 * Hides itself when no scores carry the new he/eq fields (legacy data
 * only, or pre-Step-1 calls).
 */

type ScoreLite = {
  callId: string;
  parameterId: string;
  score: number;
  hasLearnerEvidence?: boolean | null;
  evidenceQuality?: number | null;
  parameter?: { parameterId?: string | null } | null;
};

type CallLite = {
  id: string;
  callSequence?: number | null;
  endedAt?: string | Date | null;
};

interface TrustFooterCardProps {
  calls: CallLite[];
  scores: ScoreLite[];
}

function isSkillScore(s: ScoreLite): boolean {
  const id = (s.parameter?.parameterId ?? s.parameterId ?? "").toLowerCase();
  return id.startsWith("skill_");
}

export function TrustFooterCard({ calls, scores }: TrustFooterCardProps) {
  const skillScores = (scores ?? []).filter(isSkillScore);
  if (skillScores.length === 0) return null;

  // Only show this card when at least one row carries an explicit
  // evidence judgement. Pure null-everywhere = no Step 1 data to surface.
  const withEvidenceField = skillScores.filter((s) => typeof s.hasLearnerEvidence === "boolean");
  if (withEvidenceField.length === 0) return null;

  const total = skillScores.length;
  const withEvidence = skillScores.filter((s) => s.hasLearnerEvidence === true).length;
  const withoutEvidence = skillScores.filter((s) => s.hasLearnerEvidence === false).length;
  const unknownEvidence = skillScores.filter(
    (s) => s.hasLearnerEvidence === null || s.hasLearnerEvidence === undefined,
  ).length;
  const evidencePct = total > 0 ? Math.round((withEvidence / total) * 100) : 0;

  // Per-call evidence ratio for the sparkline.
  const endedCalls = (calls ?? [])
    .filter((c) => c.endedAt)
    .sort((a, b) => {
      const da = new Date(a.endedAt ?? 0).getTime();
      const db = new Date(b.endedAt ?? 0).getTime();
      return da - db;
    });

  const callRatios = endedCalls.map((c) => {
    const callSkillScores = skillScores.filter((s) => s.callId === c.id);
    if (callSkillScores.length === 0) {
      return { call: c, ratio: null as number | null, total: 0, withEv: 0 };
    }
    const withEv = callSkillScores.filter((s) => s.hasLearnerEvidence === true).length;
    return {
      call: c,
      ratio: withEv / callSkillScores.length,
      total: callSkillScores.length,
      withEv,
    };
  });

  return (
    <div className="hf-card trust-footer">
      <div className="hf-section-title">Measurement transparency</div>
      <div className="hf-section-desc">
        Where the system saw real learner evidence vs. where it didn&rsquo;t.
        Scores backed by transcript evidence are more reliable than scores
        the AI inferred from context alone.
      </div>

      <div className="trust-footer-summary">
        <div className="trust-footer-stat">
          <span className="trust-footer-stat-value">{evidencePct}%</span>
          <span className="trust-footer-stat-label">of skill scores had explicit learner evidence</span>
        </div>
        <div className="trust-footer-breakdown">
          <span className="trust-footer-pill trust-footer-pill--evidence">
            ✓ {withEvidence} backed
          </span>
          {withoutEvidence > 0 && (
            <span
              className="trust-footer-pill trust-footer-pill--no-evidence"
              title="Scorer judged no learner evidence — these usually get dropped by the Boaz guard; if any persisted, they pre-date the guard"
            >
              ✗ {withoutEvidence} no evidence
            </span>
          )}
          {unknownEvidence > 0 && (
            <span
              className="trust-footer-pill trust-footer-pill--unknown"
              title="Legacy scores written before the evidence-aware scorer landed"
            >
              ? {unknownEvidence} legacy
            </span>
          )}
        </div>
      </div>

      {callRatios.length > 0 && (
        <div className="trust-footer-spark">
          <span className="trust-footer-spark-label">Per call:</span>
          <div className="trust-footer-spark-row">
            {callRatios.map((r, i) => (
              <span
                key={r.call.id}
                className={`trust-footer-spark-dot ${
                  r.ratio === null
                    ? "trust-footer-spark-dot--empty"
                    : r.ratio >= 0.75
                      ? "trust-footer-spark-dot--good"
                      : r.ratio >= 0.4
                        ? "trust-footer-spark-dot--mixed"
                        : "trust-footer-spark-dot--poor"
                }`}
                title={
                  r.ratio === null
                    ? `Call #${r.call.callSequence ?? i + 1}: no skill scores`
                    : `Call #${r.call.callSequence ?? i + 1}: ${r.withEv} of ${r.total} skill scores had learner evidence (${Math.round(r.ratio * 100)}%)`
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
