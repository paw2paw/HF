import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const record = await prisma.parameter.findUnique({ where: { id: params.id } });
  return NextResponse.json(record);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updated = await prisma.parameter.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const deleted = await prisma.parameter.delete({ where: { id: params.id } });
  return NextResponse.json(deleted);
}