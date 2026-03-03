import { NextResponse } from "next/server";
import { getSubjectsCatalogSettings } from "@/lib/system-settings";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/subjects-catalog
 * @visibility internal
 * @scope subjects:read
 * @auth session
 * @tags subjects, wizard
 * @description Returns the admin-configured subjects catalog for wizard UIs.
 * @response 200 { ok: true, catalog: SubjectEntry[], allowFreeText: boolean }
 */
export async function GET() {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const settings = await getSubjectsCatalogSettings();
  return NextResponse.json({
    ok: true,
    catalog: settings.catalog,
    allowFreeText: settings.allowFreeText,
  });
}
