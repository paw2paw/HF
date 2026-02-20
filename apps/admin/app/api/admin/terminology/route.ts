import { NextResponse } from "next/server";
import {
  requireEntityAccess,
  isEntityAuthError,
  invalidateAccessCache,
} from "@/lib/access-control";
import {
  getTerminologyContract,
  invalidateTerminologyCache,
  type TermKey,
  type TerminologyContract,
} from "@/lib/terminology";
import { ContractRegistry } from "@/lib/contracts/registry";
import { prisma } from "@/lib/prisma";
import { auditLog, AuditAction } from "@/lib/audit";
import { ROLE_LEVEL } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

/**
 * @api GET /api/admin/terminology
 * @auth terminology:R
 * @description Load the TERMINOLOGY_V1 contract for the terminology editor
 */
export async function GET() {
  const authResult = await requireEntityAccess("terminology", "R");
  if (isEntityAuthError(authResult)) return authResult.error;

  const contract = await getTerminologyContract();

  if (!contract || !contract.terms) {
    return NextResponse.json(
      {
        ok: false,
        error: "TERMINOLOGY_V1 contract not found. Run npm run db:seed to populate.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, contract });
}

/**
 * @api POST /api/admin/terminology
 * @auth terminology:U
 * @description Update the TERMINOLOGY_V1 contract (meta-RBAC: caller can only modify roles strictly below their authority level)
 */
export async function POST(req: Request) {
  // Meta-RBAC: permission to modify terminology is itself governed by the access matrix
  const authResult = await requireEntityAccess("terminology", "U");
  if (isEntityAuthError(authResult)) return authResult.error;

  const { session } = authResult;

  const body = await req.json();
  const terms = body.terms as Record<TermKey, Record<string, string>>;

  if (!terms || typeof terms !== "object") {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid 'terms'" },
      { status: 400 }
    );
  }

  // Meta-RBAC authority enforcement: caller can only modify roles strictly below their authority level
  const callerLevel = ROLE_LEVEL[session.user.role];
  const validTermKeys: TermKey[] = ["domain", "playbook", "spec", "caller"];

  for (const termKey of validTermKeys) {
    const roleTerms = terms[termKey];
    if (!roleTerms || typeof roleTerms !== "object") {
      return NextResponse.json(
        { ok: false, error: `Invalid term object for '${termKey}'` },
        { status: 400 }
      );
    }

    for (const role of Object.keys(roleTerms)) {
      const targetLevel = ROLE_LEVEL[role as UserRole] ?? -1;
      if (targetLevel >= callerLevel) {
        return NextResponse.json(
          {
            ok: false,
            error: `Cannot modify terminology for role '${role}' — same or higher authority level than ${session.user.role}`,
          },
          { status: 403 }
        );
      }
    }
  }

  // Validate term values
  for (const termKey of validTermKeys) {
    const roleTerms = terms[termKey];
    for (const [role, label] of Object.entries(roleTerms)) {
      if (typeof label !== "string" || label.trim().length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid label for ${termKey}.${role}: must be non-empty string`,
          },
          { status: 400 }
        );
      }
      if (label.length > 100) {
        return NextResponse.json(
          {
            ok: false,
            error: `Label too long for ${termKey}.${role}: max 100 characters`,
          },
          { status: 400 }
        );
      }
    }
  }

  // Load existing contract, merge in updated terms
  const contract = await ContractRegistry.getContract("TERMINOLOGY_V1");
  if (!contract) {
    return NextResponse.json(
      {
        ok: false,
        error: "TERMINOLOGY_V1 contract not found. Run npm run db:seed first.",
      },
      { status: 404 }
    );
  }

  const updated: TerminologyContract = { ...contract, terms };

  await prisma.systemSetting.upsert({
    where: { key: "contract:TERMINOLOGY_V1" },
    update: { value: JSON.stringify(updated) },
    create: { key: "contract:TERMINOLOGY_V1", value: JSON.stringify(updated) },
  });

  // Bust cache so changes take effect immediately
  invalidateTerminologyCache();

  // Log the change
  const modifiedRoles = Object.keys(
    validTermKeys.reduce(
      (acc: Record<string, boolean>, termKey) => {
        Object.keys(terms[termKey]).forEach((role) => {
          acc[role] = true;
        });
        return acc;
      },
      {}
    )
  );

  await auditLog({
    userId: session.user.id,
    userEmail: session.user.email,
    action: AuditAction.UPDATED_TERMINOLOGY,
    entityType: "TerminologyMap",
    metadata: { modifiedRoles },
  });

  return NextResponse.json({ ok: true });
}
