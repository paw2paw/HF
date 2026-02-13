import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import type { SidebarLayout } from "@/lib/sidebar/types";

const SETTING_KEY = "sidebar.default_layout";

/**
 * @api GET /api/admin/sidebar-layout
 * @visibility internal
 * @scope admin:read
 * @auth bearer
 * @tags admin
 * @description Get the global default sidebar layout from system settings
 * @response 200 { layout: SidebarLayout | null }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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

/**
 * @api POST /api/admin/sidebar-layout
 * @visibility internal
 * @scope admin:write
 * @auth bearer
 * @tags admin
 * @description Set the global default sidebar layout (ADMIN role required)
 * @body layout SidebarLayout - The sidebar layout configuration with sectionOrder array
 * @response 200 { success: true }
 * @response 400 { error: "Invalid layout format" }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden" }
 * @response 500 { error: "Failed to save layout" }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

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

/**
 * @api DELETE /api/admin/sidebar-layout
 * @visibility internal
 * @scope admin:write
 * @auth bearer
 * @tags admin
 * @description Clear the global default sidebar layout (ADMIN role required)
 * @response 200 { success: true }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden" }
 */
export async function DELETE() {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

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
