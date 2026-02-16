import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";

/**
 * @api POST /api/content-sources/suggest
 * @visibility internal
 * @scope content-sources:write
 * @auth session
 * @tags content-sources, ai
 * @description AI-fills content source metadata from a free-text description, ISBN, or URL.
 *   Returns suggested values for all form fields. User reviews and adjusts before creating.
 *
 * @body description string - Free-text description of the content source (e.g. "CII R04 Insurance Syllabus 2025/26" or an ISBN)
 * @response 200 { ok, fields: { slug, name, trustLevel, publisherOrg, ... }, interpretation: string }
 * @response 400 { ok: false, error: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json();
    const description = body.description?.trim();

    if (!description || description.length < 3) {
      return NextResponse.json(
        { ok: false, error: "description must be at least 3 characters" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert librarian and content cataloguer. Given a description of an educational content source (textbook, syllabus, study guide, etc.), extract or infer metadata to fill a content source record.

Return a JSON object with these fields (all optional except slug and name):
- "slug": kebab-case identifier (e.g. "cii-r04-syllabus-2025")
- "name": display name (e.g. "CII R04 Insurance Syllabus 2025/26")
- "description": brief description of what this source covers
- "trustLevel": one of REGULATORY_STANDARD (L5: exam board syllabus, regulatory handbook), ACCREDITED_MATERIAL (L4: approved study text), PUBLISHED_REFERENCE (L3: academic textbook), EXPERT_CURATED (L2: qualified professional content), AI_ASSISTED (L1: AI-generated), UNVERIFIED (L0: unknown)
- "documentType": one of CURRICULUM (formal syllabus with LOs), TEXTBOOK (reference material), WORKSHEET (learner activity), EXAMPLE (illustrative), ASSESSMENT (test/quiz), REFERENCE (glossary/cheat sheet)
- "publisherOrg": publishing organisation
- "accreditingBody": accreditation or awarding body
- "accreditationRef": accreditation reference code
- "qualificationRef": qualification reference (e.g. "CII R04", "GCSE 8700")
- "authors": array of author names
- "isbn": ISBN if identifiable
- "edition": edition string (e.g. "37th Edition")
- "publicationYear": 4-digit year
- "validFrom": ISO date string if known (e.g. "2025-09-01")
- "validUntil": ISO date string if known

Rules:
- Only include fields you can reasonably infer. Omit fields you're uncertain about.
- For trust level, infer from the source type: exam board syllabi = REGULATORY_STANDARD, approved study texts = ACCREDITED_MATERIAL, academic textbooks = PUBLISHED_REFERENCE, etc.
- If an ISBN is provided, try to infer publisher, authors, edition from it.
- Return ONLY valid JSON, no markdown fences, no explanation.
- Also include an "interpretation" field (string) briefly explaining your reasoning.`;

    // @ai-call content-sources.suggest — Infer content source metadata from description | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "content-sources.suggest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        temperature: 0.3,
        maxTokens: 1024,
      },
      { sourceOp: "content-sources:suggest" }
    );

    const raw = response.content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    // Sanitize and validate fields
    const validTrustLevels = new Set([
      "REGULATORY_STANDARD",
      "ACCREDITED_MATERIAL",
      "PUBLISHED_REFERENCE",
      "EXPERT_CURATED",
      "AI_ASSISTED",
      "UNVERIFIED",
    ]);
    const validDocTypes = new Set([
      "CURRICULUM",
      "TEXTBOOK",
      "WORKSHEET",
      "EXAMPLE",
      "ASSESSMENT",
      "REFERENCE",
    ]);

    const fields: Record<string, any> = {};

    // Required fields
    if (parsed.slug && typeof parsed.slug === "string") {
      fields.slug = parsed.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
    if (parsed.name && typeof parsed.name === "string") {
      fields.name = parsed.name.trim();
    }

    // Optional string fields
    for (const key of [
      "description",
      "publisherOrg",
      "accreditingBody",
      "accreditationRef",
      "qualificationRef",
      "isbn",
      "edition",
    ]) {
      if (parsed[key] && typeof parsed[key] === "string") {
        fields[key] = parsed[key].trim();
      }
    }

    // Enum fields
    if (parsed.trustLevel && validTrustLevels.has(parsed.trustLevel)) {
      fields.trustLevel = parsed.trustLevel;
    }
    if (parsed.documentType && validDocTypes.has(parsed.documentType)) {
      fields.documentType = parsed.documentType;
    }

    // Array fields
    if (Array.isArray(parsed.authors)) {
      fields.authors = parsed.authors.filter(
        (a: any) => typeof a === "string" && a.trim()
      );
    }

    // Number fields
    if (
      parsed.publicationYear &&
      typeof parsed.publicationYear === "number" &&
      parsed.publicationYear >= 1900 &&
      parsed.publicationYear <= 2100
    ) {
      fields.publicationYear = parsed.publicationYear;
    }

    // Date fields
    for (const key of ["validFrom", "validUntil"]) {
      if (parsed[key] && typeof parsed[key] === "string") {
        const d = new Date(parsed[key]);
        if (!isNaN(d.getTime())) {
          fields[key] = parsed[key];
        }
      }
    }

    return NextResponse.json({
      ok: true,
      fields,
      interpretation: parsed.interpretation || "",
    });
  } catch (error: any) {
    console.error("Error suggesting content source:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
