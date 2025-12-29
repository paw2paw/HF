-- CreateTable
CREATE TABLE "ParameterSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParameterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterSetParameter" (
    "id" TEXT NOT NULL,
    "parameterSetId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "definition" TEXT,
    "scaleType" TEXT,
    "directionality" TEXT,
    "interpretationLow" TEXT,
    "interpretationHigh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParameterSetParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "parameterSetId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "transcript" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallScore" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParameterSetParameter_parameterSetId_idx" ON "ParameterSetParameter"("parameterSetId");

-- CreateIndex
CREATE INDEX "ParameterSetParameter_parameterId_idx" ON "ParameterSetParameter"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterSetParameter_parameterSetId_parameterId_key" ON "ParameterSetParameter"("parameterSetId", "parameterId");

-- CreateIndex
CREATE INDEX "AnalysisRun_parameterSetId_idx" ON "AnalysisRun"("parameterSetId");

-- CreateIndex
CREATE INDEX "AnalysisRun_status_idx" ON "AnalysisRun"("status");

-- CreateIndex
CREATE INDEX "Call_source_idx" ON "Call"("source");

-- CreateIndex
CREATE INDEX "Call_externalId_idx" ON "Call"("externalId");

-- CreateIndex
CREATE INDEX "CallScore_analysisRunId_idx" ON "CallScore"("analysisRunId");

-- CreateIndex
CREATE INDEX "CallScore_callId_idx" ON "CallScore"("callId");

-- CreateIndex
CREATE INDEX "CallScore_parameterId_idx" ON "CallScore"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "CallScore_analysisRunId_callId_parameterId_key" ON "CallScore"("analysisRunId", "callId", "parameterId");

-- AddForeignKey
ALTER TABLE "ParameterSetParameter" ADD CONSTRAINT "ParameterSetParameter_parameterSetId_fkey" FOREIGN KEY ("parameterSetId") REFERENCES "ParameterSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterSetParameter" ADD CONSTRAINT "ParameterSetParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("parameterId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_parameterSetId_fkey" FOREIGN KEY ("parameterSetId") REFERENCES "ParameterSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScore" ADD CONSTRAINT "CallScore_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScore" ADD CONSTRAINT "CallScore_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScore" ADD CONSTRAINT "CallScore_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("parameterId") ON DELETE RESTRICT ON UPDATE CASCADE;
