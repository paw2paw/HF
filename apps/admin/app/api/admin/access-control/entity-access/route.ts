import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { ContractRegistry } from "@/lib/contracts/registry";
import { prisma } from "@/lib/prisma";
import { invalidateAccessCache } from "@/lib/access-control";

const VALID_SCOPES = ["ALL", "DOMAIN", "OWN", "NONE"];
const VALID_OPS = ["C", "R", "U", "D"];

/**
 * @api GET /api/admin/access-control/entity-access
 * @auth ADMIN
 * @description Load the ENTITY_ACCESS_V1 contract for the access matrix editor
 */
export async function GET() {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const contract = await ContractRegistry.getContract("ENTITY_ACCESS_V1");

  if (!contract) {
    return NextResponse.json(
      { ok: false, error: "ENTITY_ACCESS_V1 contract not found. Run npm run db:seed to populate." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, contract });
}

/**
 * @api POST /api/admin/access-control/entity-access
 * @auth ADMIN
 * @description Update the ENTITY_ACCESS_V1 contract matrix
 */
export async function POST(req: Request) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const body = await req.json();
  const matrix = body.matrix as Record<string, Record<string, string>>;

  if (!matrix || typeof matrix !== "object") {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid 'matrix'" },
      { status: 400 }
    );
  }

  // Validate matrix entries
  for (const [entity, roles] of Object.entries(matrix)) {
    if (typeof roles !== "object") {
      return NextResponse.json(
        { ok: false, error: `Invalid roles object for entity '${entity}'` },
        { status: 400 }
      );
    }
    for (const [role, rule] of Object.entries(roles)) {
      if (rule === "NONE") continue; // NONE with no ops is valid shorthand
      const parts = rule.split(":");
      if (parts.length !== 2) {
        return NextResponse.json(
          { ok: false, error: `Invalid rule format for ${entity}.${role}: '${rule}' (expected SCOPE:OPS)` },
          { status: 400 }
        );
      }
      const [scope, ops] = parts;
      if (!VALID_SCOPES.includes(scope)) {
        return NextResponse.json(
          { ok: false, error: `Invalid scope for ${entity}.${role}: '${scope}'` },
          { status: 400 }
        );
      }
      if (scope === "NONE" && ops) {
        return NextResponse.json(
          { ok: false, error: `NONE scope cannot have operations for ${entity}.${role}` },
          { status: 400 }
        );
      }
      for (const op of ops.split("")) {
        if (!VALID_OPS.includes(op)) {
          return NextResponse.json(
            { ok: false, error: `Invalid operation '${op}' for ${entity}.${role}` },
            { status: 400 }
          );
        }
      }
    }
  }

  // Load existing contract, merge in updated matrix
  const contract = await ContractRegistry.getContract("ENTITY_ACCESS_V1");
  if (!contract) {
    return NextResponse.json(
      { ok: false, error: "ENTITY_ACCESS_V1 contract not found. Run npm run db:seed first." },
      { status: 404 }
    );
  }

  const updated = { ...contract, matrix };

  await prisma.systemSetting.upsert({
    where: { key: "contract:ENTITY_ACCESS_V1" },
    update: { value: JSON.stringify(updated) },
    create: { key: "contract:ENTITY_ACCESS_V1", value: JSON.stringify(updated) },
  });

  // Bust cache so changes take effect immediately
  invalidateAccessCache();

  return NextResponse.json({ ok: true });
}
