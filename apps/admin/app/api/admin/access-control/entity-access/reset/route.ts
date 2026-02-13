import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { invalidateAccessCache } from "@/lib/access-control";
import * as fs from "fs";
import * as path from "path";

/**
 * @api POST /api/admin/access-control/entity-access/reset
 * @auth SUPERADMIN
 * @note INFRASTRUCTURE TOOL — reads seed file from disk to restore default contract
 * @description Reset the ENTITY_ACCESS_V1 contract to its seed default
 */
export async function POST() {
  const authResult = await requireAuth("SUPERADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const contractPath = path.join(
    process.cwd(),
    "docs-archive/bdd-specs/contracts/ENTITY_ACCESS_V1.contract.json"
  );

  if (!fs.existsSync(contractPath)) {
    return NextResponse.json(
      { ok: false, error: "Seed contract file not found on disk. Cannot reset." },
      { status: 404 }
    );
  }

  const content = fs.readFileSync(contractPath, "utf-8");

  // Validate it parses correctly
  try {
    const parsed = JSON.parse(content);
    if (!parsed.contractId || !parsed.matrix) {
      return NextResponse.json(
        { ok: false, error: "Seed file is missing contractId or matrix" },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Seed file contains invalid JSON" },
      { status: 500 }
    );
  }

  await prisma.systemSetting.upsert({
    where: { key: "contract:ENTITY_ACCESS_V1" },
    update: { value: content },
    create: { key: "contract:ENTITY_ACCESS_V1", value: content },
  });

  invalidateAccessCache();

  return NextResponse.json({ ok: true });
}
