-- CreateTable
CREATE TABLE "BddFeature" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BddFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BddScenario" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "given" TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "then" TEXT NOT NULL,
    "name" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BddScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BddAcceptanceCriteria" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scaleType" TEXT NOT NULL DEFAULT 'binary',
    "minScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "parameterId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BddAcceptanceCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BddScoringAnchor" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "positiveSignals" TEXT[],
    "negativeSignals" TEXT[],
    "isGold" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BddScoringAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BddFeature_slug_key" ON "BddFeature"("slug");

-- CreateIndex
CREATE INDEX "BddFeature_category_idx" ON "BddFeature"("category");

-- CreateIndex
CREATE INDEX "BddFeature_isActive_idx" ON "BddFeature"("isActive");

-- CreateIndex
CREATE INDEX "BddScenario_featureId_idx" ON "BddScenario"("featureId");

-- CreateIndex
CREATE INDEX "BddAcceptanceCriteria_scenarioId_idx" ON "BddAcceptanceCriteria"("scenarioId");

-- CreateIndex
CREATE INDEX "BddAcceptanceCriteria_parameterId_idx" ON "BddAcceptanceCriteria"("parameterId");

-- CreateIndex
CREATE INDEX "BddScoringAnchor_criteriaId_idx" ON "BddScoringAnchor"("criteriaId");

-- CreateIndex
CREATE INDEX "BddScoringAnchor_score_idx" ON "BddScoringAnchor"("score");

-- CreateIndex
CREATE INDEX "BddScoringAnchor_isGold_idx" ON "BddScoringAnchor"("isGold");

-- AddForeignKey
ALTER TABLE "BddScenario" ADD CONSTRAINT "BddScenario_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "BddFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BddAcceptanceCriteria" ADD CONSTRAINT "BddAcceptanceCriteria_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BddAcceptanceCriteria" ADD CONSTRAINT "BddAcceptanceCriteria_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "BddScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BddScoringAnchor" ADD CONSTRAINT "BddScoringAnchor_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "BddAcceptanceCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
