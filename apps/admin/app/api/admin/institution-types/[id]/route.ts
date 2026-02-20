import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { TERM_KEYS } from "@/lib/terminology/types";
import { invalidateTerminologyCache } from "@/lib/terminology";

/**
 * @api PATCH /api/admin/institution-types/[id]
 * @visibility internal
 * @scope admin:write
 * @auth bearer
 * @tags admin
 * @description Update an institution type's name, terminology, or config (ADMIN role required)
 * @param id string - Institution type ID
 * @body name string - Display name
 * @body description string - Description
 * @body terminology object - 7-key TermMap
 * @body setupSpecSlug string - Wizard spec slug
 * @body defaultDomainKind string - INSTITUTION or COMMUNITY
 * @body isActive boolean - Whether this type is active
 * @response 200 { ok: true, type: InstitutionType }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Not found" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.institutionType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.setupSpecSlug !== undefined) updateData.setupSpecSlug = body.setupSpecSlug?.trim() || null;
  if (body.defaultDomainKind !== undefined) {
    updateData.defaultDomainKind = body.defaultDomainKind === "COMMUNITY" ? "COMMUNITY" : "INSTITUTION";
  }

  // Validate terminology if provided
  if (body.terminology !== undefined) {
    if (!body.terminology || typeof body.terminology !== "object") {
      return NextResponse.json({ ok: false, error: "Terminology must be an object" }, { status: 400 });
    }
    const missingKeys = TERM_KEYS.filter((k) => !body.terminology[k]?.trim());
    if (missingKeys.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Missing terminology keys: ${missingKeys.join(", ")}` },
        { status: 400 },
      );
    }
    updateData.terminology = body.terminology;
  }

  const type = await prisma.institutionType.update({
    where: { id },
    data: updateData,
  });

  // Invalidate terminology cache for all institutions using this type
  invalidateTerminologyCache();

  return NextResponse.json({ ok: true, type });
}

/**
 * @api DELETE /api/admin/institution-types/[id]
 * @visibility internal
 * @scope admin:write
 * @auth bearer
 * @tags admin
 * @description Soft-delete an institution type by setting isActive=false (ADMIN role required)
 * @param id string - Institution type ID
 * @response 200 { ok: true }
 * @response 404 { ok: false, error: "Not found" }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;

  const existing = await prisma.institutionType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await prisma.institutionType.update({
    where: { id },
    data: { isActive: false },
  });

  invalidateTerminologyCache();

  return NextResponse.json({ ok: true });
}
