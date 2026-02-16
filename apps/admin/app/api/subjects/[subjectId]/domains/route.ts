import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

type Params = { params: Promise<{ subjectId: string }> };

/**
 * @api GET /api/subjects/:subjectId/domains
 * @visibility internal
 * @scope subjects:read
 * @auth session
 * @tags subjects
 * @description List domains linked to a subject.
 * @param subjectId string - Subject ID (path)
 * @response 200 { domains: [...] }
 * @response 500 { error: "..." }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;

    const domains = await prisma.subjectDomain.findMany({
      where: { subjectId },
      include: {
        domain: { select: { id: true, slug: true, name: true, isActive: true } },
      },
    });

    return NextResponse.json({ domains });
  } catch (error: any) {
    console.error("[subjects/:id/domains] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @api POST /api/subjects/:subjectId/domains
 * @visibility internal
 * @scope subjects:update
 * @auth session
 * @tags subjects
 * @description Link a domain to a subject.
 * @param subjectId string - Subject ID (path)
 * @body domainId string - Domain ID to link (required)
 * @response 201 { link: {...} }
 * @response 400 { error: "domainId is required" }
 * @response 409 { error: "This domain is already linked to this subject" }
 * @response 500 { error: "..." }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();

    if (!body.domainId) {
      return NextResponse.json({ error: "domainId is required" }, { status: 400 });
    }

    const link = await prisma.subjectDomain.create({
      data: {
        subjectId,
        domainId: body.domainId,
      },
      include: {
        domain: { select: { id: true, slug: true, name: true } },
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This domain is already linked to this subject" },
        { status: 409 }
      );
    }
    console.error("[subjects/:id/domains] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * @api DELETE /api/subjects/:subjectId/domains
 * @visibility internal
 * @scope subjects:update
 * @auth session
 * @tags subjects
 * @description Unlink a domain from a subject.
 * @param subjectId string - Subject ID (path)
 * @body domainId string - Domain ID to unlink (required)
 * @response 200 { ok: true }
 * @response 400 { error: "domainId is required" }
 * @response 500 { error: "..." }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();

    if (!body.domainId) {
      return NextResponse.json({ error: "domainId is required" }, { status: 400 });
    }

    await prisma.subjectDomain.delete({
      where: {
        subjectId_domainId: {
          subjectId,
          domainId: body.domainId,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[subjects/:id/domains] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
