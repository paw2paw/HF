import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function jsonParam<T>(sp: URLSearchParams, key: string, fallback: T): T {
  const raw = sp.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  // React Admin simple-rest params:
  // ?sort=["field","ASC"]&range=[0,24]&filter={}
  const sort = jsonParam<[string, "ASC" | "DESC"]>(sp, "sort", ["updatedAt", "DESC"]);
  const range = jsonParam<[number, number]>(sp, "range", [0, 24]);
  const filter = jsonParam<Record<string, any>>(sp, "filter", {});

  const [sortField, sortDir] = sort;
  const [start, end] = range;
  const take = end - start + 1;
  const skip = start;

  // Minimal filtering support (extend later)
  const where: any = {};
  if (filter.q && typeof filter.q === "string") {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { parameterId: { contains: filter.q, mode: "insensitive" } },
      { domainGroup: { contains: filter.q, mode: "insensitive" } },
      { sectionId: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  if (filter.sectionId) where.sectionId = String(filter.sectionId);
  if (filter.isActive !== undefined) where.isActive = Boolean(filter.isActive);
  if (filter.isMvpCore !== undefined) where.isMvpCore = Boolean(filter.isMvpCore);

  const total = await prisma.parameter.count({ where });

  const data = await prisma.parameter.findMany({
    where,
    orderBy: { [sortField]: sortDir.toLowerCase() },
    skip,
    take,
  });

  const res = NextResponse.json(data);

  // React Admin expects Content-Range + exposed header
  res.headers.set("Content-Range", `parameters ${start}-${Math.min(end, start + data.length - 1)}/${total}`);
  res.headers.set("Access-Control-Expose-Headers", "Content-Range");

  return res;
}

export async function POST(req: Request) {
  const body = await req.json();
  const created = await prisma.parameter.create({ data: body });
  return NextResponse.json(created);
}