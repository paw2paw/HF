Control Sets

Purpose

Control Sets are versioned, auditable collections of operational controls that govern system behaviour across conversations, agents, and analyses.

They replace the original idea of a flat, mutable parameters.csv with a stable, inspectable, reproducible model suitable for:
	•	experimentation
	•	auditing
	•	rollback
	•	future automation (reward systems, policies, optimisation)

A Control Set is always derived, never edited in place.

⸻

What a Control Set Is

A Control Set is:
	•	A snapshot of many individual controls at a point in time
	•	Immutable once created
	•	Identified by an ID, timestamp, and optional human stamp
	•	Used as input to:
	•	agents
	•	analysis pipelines
	•	prompt assembly
	•	reward / NBM logic (future)

A Control Set typically contains items that were previously called “parameters”.

⸻

What a Control Set Is Not

A Control Set is not:
	•	A single parameter
	•	A user profile
	•	A live configuration store
	•	A mutable settings table

Edits do not modify a Control Set.
Edits create a new Control Set.

⸻

Control Items (formerly “parameters”)

Each Control Set contains many Control Items.

A Control Item represents a measurable or enforceable dimension of system behaviour.

Examples:
	•	Maximum interruption frequency
	•	Empathy weighting
	•	Hallucination tolerance
	•	Safety strictness
	•	Technical call quality thresholds

These were previously stored in parameters.csv.

⸻

Control Domains

Control Items are grouped into Domains to make reasoning and evolution easier.

Recommended domains (initial):

1. Personality Controls

Affect how the system sounds and behaves socially.

Examples:
	•	warmth
	•	assertiveness
	•	verbosity
	•	empathy bias
	•	humour tolerance

⸻

2. Quality Controls

Affect output quality and performance.

Examples:
	•	factual precision threshold
	•	repetition penalty
	•	correction strictness
	•	summarisation aggressiveness

⸻

3. Guardrail Controls

Affect safety and compliance.

Examples:
	•	self-harm response strictness
	•	escalation triggers
	•	refusal thresholds
	•	safety override flags

⸻

4. Technical / Call Controls

Affect audio, latency, and interaction mechanics.

Examples:
	•	interruption handling
	•	silence timeout
	•	retry limits
	•	speech cadence limits

⸻

5. Optimisation / Reward Controls (future)

Used by reward systems and NBM engines.

Examples:
	•	retention weighting
	•	session-length optimisation
	•	exploration vs exploitation bias

⸻

Control Set Lifecycle

1. Authoring

Controls are authored in one of two ways:
	•	imported from a raw source (legacy CSV, scripts)
	•	edited inside the Admin UI (future)

These edits apply to a working set, not a Control Set.

⸻

2. Snapshotting

When ready, the working set is snapshotted:
	•	Assigned an ID
	•	Timestamped
	•	Stored immutably
	•	Visible under /derived/control-sets

This is the moment a Control Set is born.

⸻

3. Consumption

Control Sets are consumed by:
	•	Agents
	•	Prompt builders
	•	Analysis pipelines
	•	Experiments

Consumption is explicit — systems reference a Control Set ID.

⸻

4. Audit & Rollback

Because Control Sets are immutable:
	•	Past behaviour can be reconstructed
	•	Regressions can be traced
	•	Rollback is simply “use an older Control Set”

⸻

Relationship to Models

A Model (future concept) is a composition of Control Sets and other inputs.

Examples:
	•	A Reward Model = Control Set + reward weights
	•	A Personality Model = subset of Personality Controls
	•	A Policy Model = Guardrail Controls + escalation logic

Control Sets are the atomic building blocks of Models.

⸻

Relationship to Snapshots

Technically, a Control Set is a snapshot.

We use the term Control Set instead of “Parameter Snapshot” because:
	•	it describes intent, not mechanism
	•	it avoids the misleading implication of “just numbers”
	•	it scales to policies, rewards, and traits

⸻

Current Implementation Notes
	•	UI route: /derived/control-sets
	•	Backed by ops endpoint: analysis:inspect:sets
	•	Data source: Prisma parameterSet (to be renamed later)
	•	Read-only in current phase

Renaming of database models is intentionally deferred.

⸻

Future Work (Non-Blocking)

Planned but not required for MVP:
	•	Editable working set UI
	•	Domain-aware editors
	•	Control diffing between sets
	•	Control Set → Model binding
	•	Promotion workflows (draft → active)

⸻

Design Principle

Nothing mutable affects behaviour directly.
Everything that affects behaviour is versioned.

Control Sets enforce this rule.