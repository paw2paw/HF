import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import type { SidebarLayout } from "@/lib/sidebar/types";

function getSettingKey(userId: string): string {
  return `sidebar.user_layout.${userId}`;
}

/**
 * @api GET /api/sidebar-layout/personal
 * @visibility internal
 * @scope sidebar:read
 * @auth session
 * @tags sidebar
 * @description Loads the current user's personal sidebar layout preference from system settings.
 * @response 200 { layout: SidebarLayout | null }
 * @response 401 { error: "Unauthorized" }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: getSettingKey(session.user.id) },
    });

    if (!setting) {
      return NextResponse.json({ layout: null });
    }

    const layout: SidebarLayout = JSON.parse(setting.value);
    return NextResponse.json({ layout });
  } catch (error) {
    console.error("Error loading personal sidebar layout:", error);
    return NextResponse.json({ layout: null });
  }
}

/**
 * @api POST /api/sidebar-layout/personal
 * @visibility internal
 * @scope sidebar:write
 * @auth session
 * @tags sidebar
 * @description Saves the current user's personal sidebar layout preference. Creates or updates the system setting.
 * @body layout SidebarLayout - The sidebar layout configuration to save
 * @response 200 { success: true }
 * @response 400 { error: "Invalid layout format" }
 * @response 401 { error: "Unauthorized" }
 * @response 500 { error: "Failed to save layout" }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  try {
    const body = await req.json();
    const { layout } = body as { layout: SidebarLayout };

    if (!layout) {
      return NextResponse.json(
        { error: "Invalid layout format" },
        { status: 400 }
      );
    }

    const key = getSettingKey(session.user.id);
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(layout) },
      create: { key, value: JSON.stringify(layout) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving personal sidebar layout:", error);
    return NextResponse.json(
      { error: "Failed to save layout" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/sidebar-layout/personal
 * @visibility internal
 * @scope sidebar:delete
 * @auth session
 * @tags sidebar
 * @description Clears the current user's personal sidebar layout preference, reverting to defaults.
 * @response 200 { success: true }
 * @response 401 { error: "Unauthorized" }
 */
export async function DELETE() {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  try {
    await prisma.systemSetting.delete({
      where: { key: getSettingKey(session.user.id) },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
