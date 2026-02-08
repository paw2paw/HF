import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { SidebarLayout } from "@/lib/sidebar/types";

const SETTING_KEY = "sidebar.default_layout";

// GET /api/admin/sidebar-layout - Get the global default sidebar layout
export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!setting) {
      return NextResponse.json({ layout: null });
    }

    const layout: SidebarLayout = JSON.parse(setting.value);
    return NextResponse.json({ layout });
  } catch (error) {
    console.error("Error loading sidebar layout:", error);
    return NextResponse.json({ layout: null });
  }
}

// POST /api/admin/sidebar-layout - Set the global default sidebar layout (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { layout } = body as { layout: SidebarLayout };

    if (!layout || !Array.isArray(layout.sectionOrder)) {
      return NextResponse.json(
        { error: "Invalid layout format" },
        { status: 400 }
      );
    }

    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(layout) },
      create: { key: SETTING_KEY, value: JSON.stringify(layout) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving sidebar layout:", error);
    return NextResponse.json(
      { error: "Failed to save layout" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sidebar-layout - Clear the global default (admin only)
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.systemSetting.delete({
      where: { key: SETTING_KEY },
    });
    return NextResponse.json({ success: true });
  } catch {
    // Might not exist, that's fine
    return NextResponse.json({ success: true });
  }
}
