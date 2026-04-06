# ADR: Align comprehension measurement with PIRLS/KS2 reading assessment standards

**Date:** 2026-04-06
**Status:** Accepted
**Deciders:** Paul W, domain expert review

## Context

COMP-MEASURE-001 v1.0 defined four custom comprehension parameters (COMP_THEME, COMP_INFERENCE, COMP_EVIDENCE, COMP_RECALL) that did not align with any established reading assessment framework. The test course's five skills (retrieval, inference, vocabulary in context, language effect, evaluation with evidence) map directly onto the UK KS2 Reading Content Domains (2a-2h) and PIRLS 2021 comprehension processes — the two most widely recognised reading assessment frameworks internationally.

Using a custom taxonomy meant:
- Educator data reports required explanation ("what does COMP_THEME mean in curriculum terms?")
- No comparability with standardised test scores
- Gaps in coverage: vocabulary (2a), language effect (2g), and comparisons (2h) were unmeasured
- COMP_RECALL conflated cross-session memory with in-text retrieval (2b)

HF starts in the UK market and plans to expand internationally, so the framework anchor needs to work for both.

## Decision

Anchor comprehension measurement on PIRLS 2021 as the canonical framework, with KS2 Content Domain codes as metadata for UK educator recognition.

PIRLS was chosen over KS2-only because it is the international standard (used in 60+ countries), subsumes KS2 domains, and avoids locking measurement to a single national curriculum. KS2 domain codes are included as cross-references so UK teachers see familiar labels.

## Consequences

**Positive:**
- Comprehension scores are instantly legible to educators without HF-specific translation
- Full coverage of reading domains: retrieval, inference, vocabulary, language, evaluation
- Data is comparable with national/international assessment benchmarks
- COMP_RECALL is preserved as a genuine HF differentiator (cross-session retention) clearly labelled as an extension
- Each parameter carries `framework` metadata linking to PIRLS process + KS2 domain for automated reporting

**Negative / Trade-offs:**
- 6 parameters instead of 4 — slightly more complex measurement, more tokens in pipeline extraction prompt
- PIRLS Process 3 (Interpret & Integrate) and Process 4 (Evaluate & Critique) are merged into a single COMP_EVALUATION param — purists may want them split
- KS2 2c (Summarise) and 2e (Predict) are not standalone params — they are absorbed into inference and evaluation respectively, matching PIRLS structure
- Existing dev/test CallScore rows with old param IDs (COMP_THEME, COMP_EVIDENCE) will be orphaned after re-seed

## Alternatives considered

| Alternative | Why rejected |
|-------------|-------------|
| Keep custom taxonomy (v1.0) | Data meaningless to educators without explanation; gaps in domain coverage |
| KS2 Content Domains only (2a-2h as individual params) | UK-specific; 8 params is too granular for conversational AI measurement; 2c/2e are low-weight domains hard to measure in dialogue |
| PIRLS 4 processes only (no KS2 cross-refs) | Misses vocabulary (2a) as a standalone domain, which is heavily weighted in KS2 and critical for the test course |
| Split PIRLS 3 and 4 into separate params | Would create 7 params; the distinction between "interpret" and "evaluate" is hard to measure reliably from a transcript |

## Related

- `docs/decisions/learning-measurement-by-profile.md` — profile-to-parameter mapping (updated)
- `docs-archive/bdd-specs/COMP-MEASURE-001-comprehension-measurement.spec.json` — v2.0
- `docs-archive/bdd-specs/COMP-AGG-001-comprehension-aggregation.spec.json` — v2.0
- `docs-archive/bdd-specs/COMP-ADAPT-001-comprehension-adaptation.spec.json` — v2.0
- PIRLS 2021 Assessment Framework: https://pirls2021.org/frameworks/
- UK KS2 Reading Test Framework (STA 2016)
