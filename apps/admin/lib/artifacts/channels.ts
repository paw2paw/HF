/**
 * Delivery Channel Abstraction
 *
 * Provides a pluggable delivery mechanism for conversation artifacts.
 * - SimChannel (Phase 1): Marks as DELIVERED immediately — sim UI fetches artifacts for display
 * - WhatsAppChannel (Phase 2): Sends via WhatsApp Business Cloud API
 *
 * Channel selection via config.artifacts.channel env var.
 */

import { prisma } from "@/lib/prisma";
import { ArtifactStatus, ConversationArtifact, Caller } from "@prisma/client";
import { config } from "@/lib/config";

// =====================================================
// INTERFACE
// =====================================================

export interface DeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface DeliveryChannel {
  name: string;
  canDeliver(caller: Caller): boolean;
  deliver(artifact: ConversationArtifact, caller: Caller): Promise<DeliveryResult>;
}

// =====================================================
// SIM CHANNEL (Phase 1)
// =====================================================

/**
 * SimChannel — artifacts are "delivered" instantly by marking them DELIVERED.
 * The sim chat UI polls/fetches artifacts and renders them as cards.
 * No external transport needed.
 */
export class SimChannel implements DeliveryChannel {
  name = "sim";

  canDeliver(_caller: Caller): boolean {
    return true; // Every sim caller can receive artifacts
  }

  async deliver(artifact: ConversationArtifact, _caller: Caller): Promise<DeliveryResult> {
    await prisma.conversationArtifact.update({
      where: { id: artifact.id },
      data: {
        status: ArtifactStatus.DELIVERED,
        channel: "sim",
        deliveredAt: new Date(),
      },
    });

    return { success: true };
  }
}

// =====================================================
// CHANNEL REGISTRY
// =====================================================

const channels: Record<string, DeliveryChannel> = {
  sim: new SimChannel(),
  // whatsapp: new WhatsAppChannel(), // Phase 2
};

/**
 * Get the configured delivery channel.
 * Falls back to SimChannel if configured channel is unavailable.
 */
export function getDeliveryChannel(): DeliveryChannel {
  const channelName = config.artifacts.channel;
  return channels[channelName] ?? channels.sim;
}

/**
 * Get the delivery channel for a specific domain.
 * Checks ChannelConfig in the database for domain-specific overrides.
 * Falls back to global config, then to env var.
 */
export async function getChannelForDomain(domainId: string): Promise<DeliveryChannel> {
  try {
    // Check for domain-specific config
    const domainConfig = await prisma.channelConfig.findFirst({
      where: { domainId, isEnabled: true },
      orderBy: { priority: "desc" },
    });

    if (domainConfig && channels[domainConfig.channelType]) {
      return channels[domainConfig.channelType];
    }

    // Check for global config (domainId is null)
    const globalConfig = await prisma.channelConfig.findFirst({
      where: { domainId: null, isEnabled: true },
      orderBy: { priority: "desc" },
    });

    if (globalConfig && channels[globalConfig.channelType]) {
      return channels[globalConfig.channelType];
    }
  } catch {
    // DB error — fall back to env var config
  }

  return getDeliveryChannel();
}
