import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/x/cleanup-callers
 * Deletes all callers that have 0 calls (orphaned records)
 */
export async function POST() {
  try {
    // Find all callers with 0 calls
    const allCallers = await prisma.caller.findMany({
      include: {
        _count: { select: { calls: true } },
      },
    });

    const orphaned = allCallers.filter((c) => c._count.calls === 0);

    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const caller of orphaned) {
      try {
        // Delete related records that don't cascade
        await prisma.callerMemory.deleteMany({ where: { callerId: caller.id } });
        await prisma.callerAttribute.deleteMany({ where: { callerId: caller.id } });
        await prisma.callerTarget.deleteMany({ where: { callerId: caller.id } });
        await prisma.callerPersonality.deleteMany({ where: { callerId: caller.id } });
        await prisma.callerPersonalityProfile.deleteMany({ where: { callerId: caller.id } });
        await prisma.personalityObservation.deleteMany({ where: { callerId: caller.id } });

        // Delete the caller
        await prisma.caller.delete({ where: { id: caller.id } });
        deleted++;
      } catch (e: any) {
        // If deletion fails (e.g., other FK constraints), skip it
        errors.push(`${caller.name || caller.id}: ${e.message}`);
        skipped++;
      }
    }

    // Get final count
    const remaining = await prisma.caller.count();

    return NextResponse.json({
      ok: true,
      message: `Deleted ${deleted} orphaned callers${skipped > 0 ? `, skipped ${skipped}` : ""}`,
      deleted,
      skipped,
      remaining,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    console.error("POST /api/x/cleanup-callers error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Cleanup failed" },
      { status: 500 }
    );
  }
}
