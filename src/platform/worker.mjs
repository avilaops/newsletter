export class DeliveryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeliveryValidationError";
  }
}

function requireMethod(target, method, dependencyName) {
  if (!target || typeof target[method] !== "function") {
    throw new TypeError(`${dependencyName}.${method} must be a function`);
  }
}

function validateDependencies(repository, outbox, deliveryClient) {
  for (const method of ["getCampaign", "getCampaignRecipients", "setRemoteCampaign"]) {
    requireMethod(repository, method, "repository");
  }
  for (const method of ["claimNext", "markDispatched", "fail"]) {
    requireMethod(outbox, method, "outbox");
  }
  for (const method of ["dispatchCampaign"]) {
    requireMethod(deliveryClient, method, "deliveryClient");
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function validateApprovedCampaign(item, campaign) {
  if (!campaign) {
    throw new DeliveryValidationError(`campaign ${item.campaignId} was not found`);
  }
  if (campaign.status !== "approved") {
    throw new DeliveryValidationError(
      `campaign ${campaign.id} is not approved (status: ${campaign.status ?? "missing"})`,
    );
  }
  if (!nonEmptyString(campaign.contentHash) || !nonEmptyString(campaign.approvedHash)) {
    throw new DeliveryValidationError(`campaign ${campaign.id} has no approved content hash`);
  }
  if (campaign.contentHash !== campaign.approvedHash) {
    throw new DeliveryValidationError(`campaign ${campaign.id} changed after approval`);
  }
  if (item.contentHash !== campaign.approvedHash) {
    throw new DeliveryValidationError(`outbox item ${item.id} does not match the approved campaign`);
  }

  if (!nonEmptyString(campaign.name) || !nonEmptyString(campaign.subject)) {
    throw new DeliveryValidationError(`campaign ${campaign.id} has invalid name or subject`);
  }
  if (!nonEmptyString(campaign.htmlContent)) {
    throw new DeliveryValidationError(`campaign ${campaign.id} has no HTML content`);
  }
  if (
    !Array.isArray(campaign.audienceListIds) ||
    campaign.audienceListIds.length === 0 ||
    campaign.audienceListIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    throw new DeliveryValidationError(`campaign ${campaign.id} has no valid audience list`);
  }
}

function toN8nPayload(item, campaign, recipientEmails) {
  // Build exclusively from the approved campaign. Outbox metadata is never
  // allowed to override content, recipients, or sender-facing fields.
  return {
    name: campaign.name,
    subject: campaign.subject,
    campaignId: campaign.id,
    outboxId: item.id,
    contentHash: campaign.approvedHash,
    audienceListIds: [...campaign.audienceListIds],
    htmlContent: campaign.htmlContent,
    previewText: campaign.previewText ?? "",
    recipientEmails: [...recipientEmails],
  };
}

/**
 * Builds a single-item delivery worker. DELIVERY_ENABLED must be the literal
 * string "true". With every other value, processNext returns before touching
 * the outbox, repository, delivery client, or network.
 */
export function createDeliveryWorker({
  repository,
  outbox,
  deliveryClient,
  env = process.env,
} = {}) {
  return Object.freeze({
    async processNext() {
      if (env?.DELIVERY_ENABLED !== "true") {
        return { status: "disabled" };
      }

      validateDependencies(repository, outbox, deliveryClient);
      const item = await outbox.claimNext();
      if (!item) return { status: "idle" };

      try {
        const campaign = await repository.getCampaign(item.campaignId);
        validateApprovedCampaign(item, campaign);
        const recipientEmails = await repository.getCampaignRecipients(campaign.id, campaign.approvedHash);
        if (!recipientEmails.length) throw new DeliveryValidationError(`campaign ${campaign.id} has no frozen recipients`);

        let remoteId = campaign.remoteCampaignId;
        if (!remoteId) {
          const dispatched = await deliveryClient.dispatchCampaign(toN8nPayload(item, campaign, recipientEmails), {
            idempotencyKey: item.id,
          });
          remoteId = dispatched.executionId;
          await repository.setRemoteCampaign(campaign.id, remoteId);
        }
        await outbox.markDispatched(item.id, { remoteId });

        return { status: "dispatched", campaignId: campaign.id, remoteId };
      } catch (error) {
        await outbox.fail(item.id, error);
        return {
          status: "failed",
          campaignId: item.campaignId,
          error,
        };
      }
    },
  });
}

export async function processNextDelivery(options) {
  return createDeliveryWorker(options).processNext();
}
