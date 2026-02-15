import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/settings/channels
 * @visibility internal
 * @scope settings:channels:list
 * @auth session (ADMIN+)
 * @tags settings, channels
 * @description List all delivery channel configurations. Includes global defaults and per-domain overrides.
 * @response 200 { ok: true, channels: ChannelConfig[] }
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const channels = await prisma.channelConfig.findMany({
    include: {
      domain: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ channelType: "asc" }, { priority: "desc" }],
  });

  return NextResponse.json({ ok: true, channels });
}

/**
 * @api POST /api/settings/channels
 * @visibility internal
 * @scope settings:channels:upsert
 * @auth session (ADMIN+)
 * @tags settings, channels
 * @description Create or update a delivery channel configuration.
 * @body channelType string - "sim" | "whatsapp" | "sms"
 * @body domainId string? - Domain ID (null for global default)
 * @body isEnabled boolean - Whether this channel is active
 * @body config object - Provider-specific settings (API keys, endpoints, etc.)
 * @body priority number - Priority for channel selection (higher = preferred)
 * @response 200 { ok: true, channel: ChannelConfig }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const body = await request.json();
  const { channelType, domainId, isEnabled, config: channelConfig, priority } = body;

  if (!channelType) {
    return NextResponse.json({ ok: false, error: "channelType is required" }, { status: 400 });
  }

  if (!["sim", "whatsapp", "sms"].includes(channelType)) {
    return NextResponse.json({ ok: false, error: "channelType must be sim, whatsapp, or sms" }, { status: 400 });
  }

  const channel = await prisma.channelConfig.upsert({
    where: {
      domainId_channelType: {
        domainId: domainId || null,
        channelType,
      },
    },
    update: {
      isEnabled: isEnabled ?? true,
      config: channelConfig ?? {},
      priority: priority ?? 0,
    },
    create: {
      channelType,
      domainId: domainId || null,
      isEnabled: isEnabled ?? true,
      config: channelConfig ?? {},
      priority: priority ?? 0,
    },
    include: {
      domain: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({ ok: true, channel });
}

/**
 * @api DELETE /api/settings/channels
 * @visibility internal
 * @scope settings:channels:delete
 * @auth session (ADMIN+)
 * @tags settings, channels
 * @description Delete a channel configuration by ID.
 * @body id string - Channel config ID to delete
 * @response 200 { ok: true }
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  await prisma.channelConfig.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
