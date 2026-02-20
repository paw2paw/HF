-- CreateTable
CREATE TABLE "InstitutionType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "terminology" JSONB NOT NULL,
    "setupSpecSlug" TEXT,
    "defaultDomainKind" "DomainKind" NOT NULL DEFAULT 'INSTITUTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionType_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "Institution" ADD COLUMN "typeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionType_slug_key" ON "InstitutionType"("slug");
CREATE INDEX "InstitutionType_slug_idx" ON "InstitutionType"("slug");
CREATE INDEX "InstitutionType_isActive_idx" ON "InstitutionType"("isActive");
CREATE INDEX "Institution_typeId_idx" ON "Institution"("typeId");

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "InstitutionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
