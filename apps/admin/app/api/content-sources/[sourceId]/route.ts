import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContentTrustLevel, DocumentType } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const VALID_DOCUMENT_TYPES: DocumentType[] = [
  "CURRICULUM", "TEXTBOOK", "WORKSHEET", "EXAMPLE", "ASSESSMENT", "REFERENCE",
];

// Trust level hierarchy for validation (can only promote, not demote without admin)
const TRUST_LEVEL_ORDER: ContentTrustLevel[] = [
  "UNVERIFIED",
  "AI_ASSISTED",
  "EXPERT_CURATED",
  "PUBLISHED_REFERENCE",
  "ACCREDITED_MATERIAL",
  "REGULATORY_STANDARD",
];

/**
 * @api GET /api/content-sources/:sourceId
 * @visibility public
 * @scope content-sources:read
 * @auth session
 * @tags content-trust
 * @description Get a content source by ID, including assertion count and freshness status
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      include: {
        _count: { select: { assertions: true } },
        supersededBy: { select: { id: true, slug: true, name: true } },
        supersedes: { select: { id: true, slug: true, name: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    // Compute freshness
    let freshnessStatus: "valid" | "expiring" | "expired" | "unknown" = "unknown";
    if (source.validUntil) {
      const days = Math.floor((source.validUntil.getTime() - Date.now()) / 86400000);
      if (days < 0) freshnessStatus = "expired";
      else if (days <= 60) freshnessStatus = "expiring";
      else freshnessStatus = "valid";
    }

    return NextResponse.json({
      ok: true,
      source: {
        ...source,
        freshnessStatus,
        assertionCount: source._count.assertions,
      },
    });
  } catch (error: any) {
    console.error("[content-sources/:id] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

/**
 * @api PATCH /api/content-sources/:sourceId
 * @visibility public
 * @scope content-sources:write
 * @auth session
 * @tags content-trust
 * @description Update a content source. Trust level changes are validated and logged.
 * @body trustLevel ContentTrustLevel - New trust level (optional)
 * @body verificationNotes string - Notes explaining the trust level change (required when changing trust)
 * @body name string - Updated name (optional)
 * @body description string - Updated description (optional)
 * @body validUntil string - Updated expiry date (optional)
 * @body isActive boolean - Active status (optional)
 * @body supersededById string - ID of newer source that replaces this one (optional)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;
    const body = await req.json();

    const existing = await prisma.contentSource.findUnique({
      where: { id: sourceId },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    const {
      trustLevel,
      verificationNotes,
      documentType,
      name,
      description,
      publisherOrg,
      accreditingBody,
      accreditationRef,
      validFrom,
      validUntil,
      isActive,
      supersededById,
    } = body;

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (publisherOrg !== undefined) updateData.publisherOrg = publisherOrg;
    if (accreditingBody !== undefined) updateData.accreditingBody = accreditingBody;
    if (accreditationRef !== undefined) updateData.accreditationRef = accreditationRef;
    if (validFrom !== undefined) updateData.validFrom = validFrom ? new Date(validFrom) : null;
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (supersededById !== undefined) updateData.supersededById = supersededById || null;

    // Document type change — track correction signal for classifier learning
    if (documentType !== undefined) {
      if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
        return NextResponse.json(
          { ok: false, error: `Invalid document type: ${documentType}` },
          { status: 400 },
        );
      }
      updateData.documentType = documentType;
      updateData.documentTypeSource = "admin:manual";

      // If AI previously classified this, track whether admin corrected it
      if (existing.aiClassification) {
        const [aiType] = existing.aiClassification.split(":");
        updateData.classificationCorrected = aiType !== documentType;
      }
    }

    // Trust level change — requires validation and audit
    let trustChanged = false;
    if (trustLevel && trustLevel !== existing.trustLevel) {
      // Validate trust level is a real enum value
      if (!TRUST_LEVEL_ORDER.includes(trustLevel)) {
        return NextResponse.json(
          { ok: false, error: `Invalid trust level: ${trustLevel}` },
          { status: 400 }
        );
      }

      // Require verification notes for trust changes
      if (!verificationNotes?.trim()) {
        return NextResponse.json(
          { ok: false, error: "Verification notes are required when changing trust level" },
          { status: 400 }
        );
      }

      const oldIndex = TRUST_LEVEL_ORDER.indexOf(existing.trustLevel);
      const newIndex = TRUST_LEVEL_ORDER.indexOf(trustLevel);
      const direction = newIndex > oldIndex ? "promoted" : "demoted";

      updateData.trustLevel = trustLevel;
      updateData.verifiedAt = new Date();
      updateData.verificationNotes = `[${direction.toUpperCase()} ${existing.trustLevel} → ${trustLevel}] ${verificationNotes}`;
      trustChanged = true;
    } else if (verificationNotes !== undefined) {
      updateData.verificationNotes = verificationNotes;
    }

    const updated = await prisma.contentSource.update({
      where: { id: sourceId },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      source: updated,
      trustChanged,
    });
  } catch (error: any) {
    console.error("[content-sources/:id] PATCH error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
