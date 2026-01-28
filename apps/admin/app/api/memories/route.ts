import { NextResponse } from "next/server";
import { MemoryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/memories
 *
 * List user memories with filtering and pagination
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const callerId = url.searchParams.get("callerId");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const includeSuperseded = url.searchParams.get("includeSuperseded") === "true";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "100"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};

    // Filter by callerId
    if (callerId) {
      where.callerId = callerId;
    }

    // Filter by category
    if (category && category in MemoryCategory) {
      where.category = category as MemoryCategory;
    }

    // Search in key or value
    if (search) {
      where.OR = [
        { key: { contains: search, mode: "insensitive" } },
        { value: { contains: search, mode: "insensitive" } },
        { evidence: { contains: search, mode: "insensitive" } },
      ];
    }

    // By default, exclude superseded memories
    if (!includeSuperseded) {
      where.supersededById = null;
    }

    // Also exclude expired memories by default
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ];

    const [memories, total] = await Promise.all([
      prisma.callerMemory.findMany({
        where,
        orderBy: [{ extractedAt: "desc" }],
        take: limit,
        skip: offset,
        include: {
          caller: {
            select: { id: true, name: true, email: true, externalId: true },
          },
          call: {
            select: { id: true, source: true, createdAt: true },
          },
          supersededBy: {
            select: { id: true, key: true, value: true, extractedAt: true },
          },
        },
      }),
      prisma.callerMemory.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      memories,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching memories:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch memories" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memories
 *
 * Create a new memory manually (for corrections or additions)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { callerId, category, key, value, evidence, context, confidence, expiresInDays } = body;

    if (!callerId) {
      return NextResponse.json(
        { ok: false, error: "callerId is required" },
        { status: 400 }
      );
    }

    if (!category || !(category in MemoryCategory)) {
      return NextResponse.json(
        { ok: false, error: "Valid category is required (FACT, PREFERENCE, EVENT, TOPIC, RELATIONSHIP, CONTEXT)" },
        { status: 400 }
      );
    }

    if (!key || !value) {
      return NextResponse.json(
        { ok: false, error: "key and value are required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.caller.findUnique({ where: { id: callerId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Check for existing memory with same normalized key
    const normalizedKey = key.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    const existing = await prisma.callerMemory.findFirst({
      where: {
        callerId,
        normalizedKey,
        supersededById: null,
      },
    });

    let memory;
    let supersededId = null;

    if (existing && existing.value !== value) {
      // Create new memory and supersede old one
      memory = await prisma.callerMemory.create({
        data: {
          callerId,
          category: category as MemoryCategory,
          source: "CORRECTED", // Manual correction
          key,
          value,
          normalizedKey,
          evidence,
          context,
          confidence: confidence ?? 0.95, // High confidence for manual entries
          expiresAt: expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null,
          extractedBy: "manual",
        },
      });

      await prisma.callerMemory.update({
        where: { id: existing.id },
        data: { supersededById: memory.id },
      });

      supersededId = existing.id;
    } else if (existing) {
      // Same value, just update confidence
      memory = await prisma.callerMemory.update({
        where: { id: existing.id },
        data: {
          confidence: Math.max(existing.confidence, confidence ?? 0.95),
          verifiedAt: new Date(),
          verifiedBy: "manual",
        },
      });
    } else {
      // New memory
      memory = await prisma.callerMemory.create({
        data: {
          callerId,
          category: category as MemoryCategory,
          source: "STATED", // Explicit addition
          key,
          value,
          normalizedKey,
          evidence,
          context,
          confidence: confidence ?? 0.95,
          expiresAt: expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null,
          extractedBy: "manual",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      memory,
      supersededId,
    });
  } catch (error: any) {
    console.error("Error creating memory:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create memory" },
      { status: 500 }
    );
  }
}
