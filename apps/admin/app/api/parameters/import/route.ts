import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/parameters/import
 * Import parameters from CSV, matching by parameterId
 *
 * Behavior:
 * - Match by parameterId (case-sensitive)
 * - If exists: Update parameter fields, merge slug links (add new, keep existing)
 * - If new: Create parameter with all fields and links
 * - Tags: Merge (add new tags, keep existing)
 * - Slug links: Merge by slug name (add new, update existing weights/modes)
 *
 * Expected CSV format:
 * parameterId,name,domainGroup,sectionId,scaleType,directionality,computedBy,definition,interpretationLow,interpretationHigh,measurementMvp,measurementVoiceOnly,tags,slugLinks
 *
 * - tags: pipe-delimited tag names (e.g., "Active|MVP")
 * - slugLinks: pipe-delimited in format "slugSlug:weight:mode" (e.g., "openness-comm:1.0:ABSOLUTE")
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return NextResponse.json(
        { ok: false, error: "CSV must have header row and at least one data row" },
        { status: 400 }
      );
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Validate required header
    const parameterIdIndex = headers.indexOf("parameterId");
    if (parameterIdIndex === -1) {
      return NextResponse.json(
        { ok: false, error: "CSV must have 'parameterId' column" },
        { status: 400 }
      );
    }

    // Build column index map
    const colIndex: Record<string, number> = {};
    headers.forEach((h, i) => {
      colIndex[h] = i;
    });

    // Pre-fetch all existing slugs for linking
    const allSlugs = await prisma.promptSlug.findMany({
      select: { id: true, slug: true },
    });
    const slugMap = new Map(allSlugs.map((s) => [s.slug, s.id]));

    // Pre-fetch all existing tags
    const allTags = await prisma.tag.findMany({
      select: { id: true, name: true },
    });
    const tagMap = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
      slugLinksAdded: 0,
      slugLinksUpdated: 0,
      tagsAdded: 0,
    };

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const rowNum = rowIdx + 2; // Account for header and 0-indexing

      const getValue = (col: string): string | null => {
        const idx = colIndex[col];
        if (idx === undefined) return null;
        const val = row[idx];
        return val === "" ? null : val;
      };

      const parameterId = getValue("parameterId");
      if (!parameterId) {
        results.errors.push(`Row ${rowNum}: Missing parameterId`);
        continue;
      }

      try {
        // Check if parameter exists
        const existing = await prisma.parameter.findUnique({
          where: { parameterId },
          include: {
            tags: { include: { tag: true } },
            promptSlugLinks: { include: { slug: true } },
          },
        });

        // Prepare parameter data
        const paramData: any = {};
        const fieldMap: Record<string, string> = {
          name: "name",
          domainGroup: "domainGroup",
          sectionId: "sectionId",
          scaleType: "scaleType",
          directionality: "directionality",
          computedBy: "computedBy",
          definition: "definition",
          interpretationLow: "interpretationLow",
          interpretationHigh: "interpretationHigh",
          measurementMvp: "measurementMvp",
          measurementVoiceOnly: "measurementVoiceOnly",
        };

        for (const [csvCol, dbField] of Object.entries(fieldMap)) {
          const val = getValue(csvCol);
          if (val !== null) {
            paramData[dbField] = val;
          }
        }

        // Create or update parameter
        let paramRecord;
        if (existing) {
          paramRecord = await prisma.parameter.update({
            where: { parameterId },
            data: paramData,
          });
          results.updated++;
        } else {
          paramRecord = await prisma.parameter.create({
            data: {
              parameterId,
              ...paramData,
            },
          });
          results.created++;
        }

        // Process tags (merge)
        const tagsStr = getValue("tags");
        if (tagsStr) {
          const tagNames = tagsStr.split("|").map((t) => t.trim()).filter(Boolean);
          const existingTagNames = new Set(
            existing?.tags.map((t) => t.tag?.name?.toLowerCase()) || []
          );

          for (const tagName of tagNames) {
            if (existingTagNames.has(tagName.toLowerCase())) continue;

            // Find or create tag
            let tagId = tagMap.get(tagName.toLowerCase());
            if (!tagId) {
              const newTag = await prisma.tag.create({
                data: { name: tagName },
              });
              tagId = newTag.id;
              tagMap.set(tagName.toLowerCase(), tagId);
            }

            // Create parameter-tag link
            await prisma.parameterTag.upsert({
              where: {
                parameterId_tagId: {
                  parameterId: paramRecord.id,
                  tagId,
                },
              },
              update: {},
              create: {
                parameterId: paramRecord.id,
                tagId,
              },
            });
            results.tagsAdded++;
          }
        }

        // Process slug links (merge)
        const slugLinksStr = getValue("slugLinks");
        if (slugLinksStr) {
          const linkParts = slugLinksStr.split("|").map((l) => l.trim()).filter(Boolean);
          const existingSlugSlugs = new Set(
            existing?.promptSlugLinks.map((l) => l.slug?.slug) || []
          );

          for (const linkStr of linkParts) {
            const [slugSlug, weightStr, mode] = linkStr.split(":");
            if (!slugSlug) continue;

            const slugId = slugMap.get(slugSlug);
            if (!slugId) {
              results.errors.push(`Row ${rowNum}: Slug '${slugSlug}' not found`);
              continue;
            }

            const weight = parseFloat(weightStr) || 1.0;
            const linkMode = mode === "DELTA" ? "DELTA" : "ABSOLUTE";

            if (existingSlugSlugs.has(slugSlug)) {
              // Update existing link
              await prisma.promptSlugParameter.update({
                where: {
                  slugId_parameterId: {
                    slugId,
                    parameterId: paramRecord.parameterId,
                  },
                },
                data: { weight, mode: linkMode },
              });
              results.slugLinksUpdated++;
            } else {
              // Create new link
              await prisma.promptSlugParameter.create({
                data: {
                  slugId,
                  parameterId: paramRecord.parameterId,
                  weight,
                  mode: linkMode,
                },
              });
              results.slugLinksAdded++;
            }
          }
        }
      } catch (err: any) {
        results.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      results,
      summary: `Created ${results.created}, updated ${results.updated} parameters. Added ${results.slugLinksAdded} slug links, updated ${results.slugLinksUpdated}. Added ${results.tagsAdded} tags. ${results.errors.length} errors.`,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to import parameters" },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV text into rows, handling quoted fields with commas and newlines
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentField);
        if (currentRow.some((f) => f.trim() !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        if (char === "\r") i++; // Skip \n in \r\n
      } else if (char !== "\r") {
        currentField += char;
      }
    }
  }

  // Don't forget the last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}
