import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBDDXml } from "@/lib/bdd/parser";

/**
 * GET /api/lab/uploads/debug
 *
 * Debug endpoint to show parser output for all uploads
 */
export async function GET() {
  try {
    const uploads = await prisma.bDDUpload.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    const results = [];

    for (const upload of uploads) {
      const xml = upload.xmlContent;

      // Check what XML patterns are present
      const patterns = {
        hasParameterMeasurementGuide: xml.includes("<parameter_measurement_guide"),
        hasBddStory: xml.includes("<bdd_story"),
        parameterIdTags: (xml.match(/<parameter\s+id=/g) || []).length,
        parameterSummaryTags: (xml.match(/<parameter_summary/g) || []).length,
        submetricTags: (xml.match(/<submetric/g) || []).length,
        metadataTags: (xml.match(/<metadata>/g) || []).length,
      };

      // Try parsing
      let parsed = null;
      let parseError = null;
      try {
        parsed = parseBDDXml(xml, upload.fileType);
      } catch (e: any) {
        parseError = e.message;
      }

      // Sample the XML
      const first2000 = xml.substring(0, 2000);
      const middle = xml.length > 4000 ? xml.substring(xml.length / 2 - 500, xml.length / 2 + 500) : null;

      results.push({
        id: upload.id,
        filename: upload.filename,
        fileType: upload.fileType,
        status: upload.status,
        xmlLength: xml.length,
        patterns,
        parsed: parsed
          ? {
              storyId: parsed.storyId,
              parameterIds: parsed.parameterIds,
              name: parsed.name,
              version: parsed.version,
              storyTitle: parsed.story?.title,
              storyAcceptanceCriteriaCount: parsed.story?.acceptanceCriteria?.length,
              storyScenariosCount: parsed.story?.scenarios?.length,
              storyConstraintsCount: parsed.story?.constraints?.length,
              parametersCount: parsed.parameters?.length,
              parametersPreview: parsed.parameters?.slice(0, 2).map((p) => ({
                id: p.id,
                name: p.name,
                definition: p.definition?.substring(0, 100),
                submetricsCount: p.submetrics?.length,
                submetrics: p.submetrics?.map((sm) => ({
                  id: sm.id,
                  name: sm.name,
                  weight: sm.weight,
                })),
              })),
            }
          : null,
        parseError,
        xmlSamples: {
          first2000,
          middle,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      uploadCount: uploads.length,
      results,
    });
  } catch (error: any) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Debug failed" },
      { status: 500 }
    );
  }
}
