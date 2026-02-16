import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

type Params = { params: Promise<{ subjectId: string }> };

/**
 * @api GET /api/subjects/:subjectId
 * @visibility internal
 * @scope subjects:read
 * @auth session
 * @tags subjects
 * @description Get subject detail with sources, domains, and latest curriculum.
 * @param subjectId string - Subject ID (path)
 * @response 200 { subject: {...} }
 * @response 404 { error: "Subject not found" }
 * @response 500 { error: "..." }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        sources: {
          include: {
            source: {
              include: { _count: { select: { assertions: true } } },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        domains: {
          include: { domain: { select: { id: true, name: true, slug: true } } },
        },
        curricula: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json({ subject });
  } catch (error: any) {
    console.error("[subjects/:id] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @api PATCH /api/subjects/:subjectId
 * @visibility internal
 * @scope subjects:update
 * @auth session
 * @tags subjects
 * @description Update subject fields (name, description, trust level, qualification info, active status).
 * @param subjectId string - Subject ID (path)
 * @body name string - Display name
 * @body description string - Subject description
 * @body defaultTrustLevel string - Default trust level for sources
 * @body qualificationBody string - Awarding body
 * @body qualificationRef string - Qualification reference
 * @body qualificationLevel string - Qualification level
 * @body isActive boolean - Active status
 * @response 200 { subject: {...} }
 * @response 500 { error: "..." }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();

    const {
      name,
      description,
      defaultTrustLevel,
      qualificationBody,
      qualificationRef,
      qualificationLevel,
      isActive,
    } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (defaultTrustLevel !== undefined) data.defaultTrustLevel = defaultTrustLevel;
    if (qualificationBody !== undefined) data.qualificationBody = qualificationBody;
    if (qualificationRef !== undefined) data.qualificationRef = qualificationRef;
    if (qualificationLevel !== undefined) data.qualificationLevel = qualificationLevel;
    if (isActive !== undefined) data.isActive = isActive;

    const subject = await prisma.subject.update({
      where: { id: subjectId },
      data,
    });

    return NextResponse.json({ subject });
  } catch (error: any) {
    console.error("[subjects/:id] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
