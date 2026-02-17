/**
 * @api GET /api/educator/playbooks
 * @auth EDUCATOR
 * @desc List published playbooks for a domain, for course selection during classroom creation
 * @query domainId - Domain ID to filter playbooks (required)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

export async function GET(request: NextRequest) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const domainId = request.nextUrl.searchParams.get("domainId");

  if (!domainId) {
    return NextResponse.json(
      { ok: false, error: "domainId is required" },
      { status: 400 }
    );
  }

  const playbooks = await prisma.playbook.findMany({
    where: { domainId, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      description: true,
      publishedAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, playbooks });
}
