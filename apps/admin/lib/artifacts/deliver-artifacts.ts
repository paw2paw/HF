/**
 * Artifact Delivery Orchestration
 *
 * Delivers PENDING artifacts via the configured delivery channel.
 * Called after extractArtifacts() creates PENDING records.
 */

import { prisma } from "@/lib/prisma";
import { ArtifactStatus } from "@prisma/client";
import { getDeliveryChannel } from "./channels";

type Logger = {
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  error: (msg: string, data?: any) => void;
};

export interface DeliveryOrchestrationResult {
  delivered: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Deliver all PENDING artifacts for a specific call.
 */
export async function deliverArtifacts(
  callId: string,
  callerId: string,
  log: Logger
): Promise<DeliveryOrchestrationResult> {
  const result: DeliveryOrchestrationResult = {
    delivered: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const channel = getDeliveryChannel();

  // Load pending artifacts for this call
  const artifacts = await prisma.conversationArtifact.findMany({
    where: {
      callId,
      callerId,
      status: ArtifactStatus.PENDING,
    },
    orderBy: { createdAt: "asc" },
  });

  if (artifacts.length === 0) {
    log.info("No pending artifacts to deliver", { callId });
    return result;
  }

  // Load caller for channel eligibility check
  const caller = await prisma.caller.findUnique({ where: { id: callerId } });
  if (!caller) {
    log.error("Caller not found for artifact delivery", { callerId });
    result.errors.push("Caller not found");
    return result;
  }

  if (!caller.artifactConsent) {
    log.info("Caller has not consented to artifacts", { callerId });
    result.skipped = artifacts.length;
    return result;
  }

  if (!channel.canDeliver(caller)) {
    log.info("Channel cannot deliver to this caller", {
      callerId,
      channel: channel.name,
    });
    result.skipped = artifacts.length;
    return result;
  }

  // Deliver each artifact
  for (const artifact of artifacts) {
    try {
      const deliveryResult = await channel.deliver(artifact, caller);

      if (deliveryResult.success) {
        result.delivered++;
        log.info("Artifact delivered", {
          artifactId: artifact.id,
          type: artifact.type,
          channel: channel.name,
        });
      } else {
        await prisma.conversationArtifact.update({
          where: { id: artifact.id },
          data: { status: ArtifactStatus.FAILED },
        });
        result.failed++;
        result.errors.push(
          `Artifact "${artifact.title}": ${deliveryResult.error ?? "delivery failed"}`
        );
      }
    } catch (err: any) {
      await prisma.conversationArtifact.update({
        where: { id: artifact.id },
        data: { status: ArtifactStatus.FAILED },
      }).catch(() => {}); // Best effort status update

      result.failed++;
      result.errors.push(`Artifact "${artifact.title}": ${err.message}`);
      log.error("Artifact delivery error", {
        artifactId: artifact.id,
        error: err.message,
      });
    }
  }

  log.info("Artifact delivery complete", {
    callId,
    channel: channel.name,
    ...result,
  });

  return result;
}
