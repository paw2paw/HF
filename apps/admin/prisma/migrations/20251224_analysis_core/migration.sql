-- =========================
-- PARAMETER SET (SNAPSHOT)
-- =========================
CREATE TABLE "ParameterSet" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ParameterSetParameter" (
  "id" TEXT PRIMARY KEY,
  "parameterSetId" TEXT NOT NULL,
  "parameterId" TEXT NOT NULL,
  "definition" TEXT,
  "scaleType" TEXT,
  "directionality" TEXT,
  "interpretationLow" TEXT,
  "interpretationHigh" TEXT,

  CONSTRAINT "psp_set_fk"
    FOREIGN KEY ("parameterSetId") REFERENCES "ParameterSet"("id") ON DELETE CASCADE
);

CREATE INDEX "psp_set_idx" ON "ParameterSetParameter"("parameterSetId");

-- =========================
-- ANALYSIS RUN
-- =========================
CREATE TABLE "AnalysisRun" (
  "id" TEXT PRIMARY KEY,
  "parameterSetId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP,

  CONSTRAINT "run_set_fk"
    FOREIGN KEY ("parameterSetId") REFERENCES "ParameterSet"("id")
);

-- =========================
-- CALLS + SCORES
-- =========================
CREATE TABLE "Call" (
  "id" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "externalId" TEXT,
  "transcript" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CallScore" (
  "id" TEXT PRIMARY KEY,
  "analysisRunId" TEXT NOT NULL,
  "callId" TEXT NOT NULL,
  "parameterId" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "evidence" TEXT,

  CONSTRAINT "score_run_fk"
    FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE,
  CONSTRAINT "score_call_fk"
    FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE
);
