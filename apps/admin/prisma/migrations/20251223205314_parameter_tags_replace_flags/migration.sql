/*
  Warnings:

  - You are about to drop the column `isActive` on the `Parameter` table. All the data in the column will be lost.
  - You are about to drop the column `isMvpCore` on the `Parameter` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Parameter" DROP COLUMN "isActive",
DROP COLUMN "isMvpCore",
ALTER COLUMN "definition" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterTag" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParameterTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ParameterTag_tagId_idx" ON "ParameterTag"("tagId");

-- CreateIndex
CREATE INDEX "ParameterTag_parameterId_idx" ON "ParameterTag"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterTag_parameterId_tagId_key" ON "ParameterTag"("parameterId", "tagId");

-- AddForeignKey
ALTER TABLE "ParameterTag" ADD CONSTRAINT "ParameterTag_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("parameterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterTag" ADD CONSTRAINT "ParameterTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
