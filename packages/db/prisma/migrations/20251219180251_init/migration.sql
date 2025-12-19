-- CreateTable
CREATE TABLE "Parameter" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "domainGroup" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "measurementMvp" TEXT,
    "measurementVoiceOnly" TEXT,
    "interpretationHigh" TEXT,
    "interpretationLow" TEXT,
    "scaleType" TEXT NOT NULL,
    "directionality" TEXT NOT NULL,
    "computedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMvpCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterMapping" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParameterMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parameter_parameterId_key" ON "Parameter"("parameterId");

-- AddForeignKey
ALTER TABLE "ParameterMapping" ADD CONSTRAINT "ParameterMapping_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("parameterId") ON DELETE RESTRICT ON UPDATE CASCADE;
