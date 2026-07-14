import { computeCampaignHash } from "./hash.mjs";
import {
  DomainValidationError,
  actorIdentifier,
  assertCampaignContent,
  assertNonEmptyString,
  assertPlainObject,
  assertSha256,
} from "./validation.mjs";

export { computeCampaignHash } from "./hash.mjs";
export { DomainValidationError } from "./validation.mjs";

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
});

// Delivery is deliberately independent from editorial approval. In particular,
// Accepting a dispatch in n8n is DISPATCHED, never SENT. SENT is reserved
// for a later reconciliation with external delivery evidence.
export const DELIVERY_STATUS = Object.freeze({
  QUEUED: "queued",
  DISPATCHING: "dispatching",
  DISPATCHED: "dispatched",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const VALID_STATUSES = new Set(Object.values(CAMPAIGN_STATUS));
const EDITABLE_FIELDS = new Set([
  "name",
  "subject",
  "previewText",
  "htmlContent",
  "audienceListIds",
]);

function campaignStatus(campaign) {
  return campaign.status;
}

function contentHash(campaign) {
  return campaign.contentHash ?? campaign.content_hash;
}

function approvedHash(campaign) {
  return campaign.approvedHash ?? campaign.approved_hash;
}

function approvedBy(campaign) {
  return campaign.approvedBy ?? campaign.approved_by;
}

function approvedAt(campaign) {
  return campaign.approvedAt ?? campaign.approved_at;
}

function assertCampaign(campaign) {
  assertPlainObject(campaign, "campaign");
  if (!VALID_STATUSES.has(campaignStatus(campaign))) {
    throw new DomainValidationError(
      "invalid_status",
      `Unknown campaign status: ${campaignStatus(campaign)}`,
    );
  }
  assertCampaignContent({
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText ?? campaign.preview_text,
    htmlContent: campaign.htmlContent ?? campaign.html_content,
    audienceListIds: campaign.audienceListIds ?? campaign.audience_list_ids ?? [],
  });
}

function assertStatus(campaign, expected, operation) {
  assertCampaign(campaign);
  if (campaignStatus(campaign) !== expected) {
    throw new DomainValidationError(
      "invalid_transition",
      `${operation} requires status ${expected}; received ${campaignStatus(campaign)}`,
      { operation, expected, actual: campaignStatus(campaign) },
    );
  }
}

function nowIso() {
  return new Date().toISOString();
}

function bumpVersion(campaign) {
  const version = campaign.version ?? 1;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new DomainValidationError("invalid_version", "version must be a positive integer");
  }
  return version + 1;
}

function immutableCampaign(campaign) {
  if (Array.isArray(campaign.audienceListIds)) {
    Object.freeze(campaign.audienceListIds);
  }
  return Object.freeze(campaign);
}

export function submitForReview(campaign) {
  assertStatus(campaign, CAMPAIGN_STATUS.DRAFT, "submitForReview");
  const normalized = assertCampaignContent(
    {
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.previewText ?? campaign.preview_text,
      htmlContent: campaign.htmlContent ?? campaign.html_content,
      audienceListIds: campaign.audienceListIds ?? campaign.audience_list_ids ?? [],
    },
    { queueable: true },
  );
  const hash = computeCampaignHash(normalized);

  return immutableCampaign({
    ...campaign,
    ...normalized,
    status: CAMPAIGN_STATUS.IN_REVIEW,
    contentHash: hash,
    approvedHash: null,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    updatedAt: nowIso(),
    version: bumpVersion(campaign),
  });
}

export function approveCampaign(campaign, actor) {
  assertStatus(campaign, CAMPAIGN_STATUS.IN_REVIEW, "approveCampaign");
  const reviewer = actorIdentifier(actor);
  const currentHash = computeCampaignHash(campaign);
  assertSha256(contentHash(campaign), "contentHash");
  if (contentHash(campaign) !== currentHash) {
    throw new DomainValidationError(
      "stale_content_hash",
      "Campaign content changed after it was submitted for review",
    );
  }

  return immutableCampaign({
    ...campaign,
    status: CAMPAIGN_STATUS.APPROVED,
    contentHash: currentHash,
    approvedHash: currentHash,
    approvedBy: reviewer,
    approvedAt: nowIso(),
    rejectionReason: null,
    updatedAt: nowIso(),
    version: bumpVersion(campaign),
  });
}

export function rejectCampaign(campaign, actor, reason) {
  assertStatus(campaign, CAMPAIGN_STATUS.IN_REVIEW, "rejectCampaign");
  const reviewer = actorIdentifier(actor);
  assertNonEmptyString(reason, "reason");
  const currentHash = computeCampaignHash(campaign);
  assertSha256(contentHash(campaign), "contentHash");
  if (contentHash(campaign) !== currentHash) {
    throw new DomainValidationError(
      "stale_content_hash",
      "Campaign content changed after it was submitted for review",
    );
  }

  return immutableCampaign({
    ...campaign,
    status: CAMPAIGN_STATUS.REJECTED,
    approvedHash: null,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: reason.trim(),
    rejectedBy: reviewer,
    rejectedAt: nowIso(),
    updatedAt: nowIso(),
    version: bumpVersion(campaign),
  });
}

export function applyCampaignEdit(campaign, patch) {
  assertCampaign(campaign);
  assertPlainObject(patch, "patch");
  const keys = Object.keys(patch);
  if (keys.length === 0) return campaign;

  for (const key of keys) {
    if (!EDITABLE_FIELDS.has(key)) {
      throw new DomainValidationError(
        "field_not_editable",
        `${key} is not an editable campaign content field`,
        { field: key },
      );
    }
  }

  const current = {
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText ?? campaign.preview_text ?? "",
    htmlContent: campaign.htmlContent ?? campaign.html_content,
    audienceListIds: campaign.audienceListIds ?? campaign.audience_list_ids ?? [],
  };
  const normalized = assertCampaignContent({ ...current, ...patch });
  const hash = computeCampaignHash(normalized);

  if (hash === computeCampaignHash(current)) return campaign;

  return immutableCampaign({
    ...campaign,
    ...normalized,
    status: CAMPAIGN_STATUS.DRAFT,
    contentHash: hash,
    approvedHash: null,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    rejectedBy: null,
    rejectedAt: null,
    remoteCampaignId: null,
    updatedAt: nowIso(),
    version: bumpVersion(campaign),
  });
}

export function assertQueueable(campaign) {
  assertStatus(campaign, CAMPAIGN_STATUS.APPROVED, "assertQueueable");
  assertCampaignContent(
    {
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.previewText ?? campaign.preview_text,
      htmlContent: campaign.htmlContent ?? campaign.html_content,
      audienceListIds: campaign.audienceListIds ?? campaign.audience_list_ids ?? [],
    },
    { queueable: true },
  );

  const currentHash = computeCampaignHash(campaign);
  assertSha256(contentHash(campaign), "contentHash");
  assertSha256(approvedHash(campaign), "approvedHash");
  if (contentHash(campaign) !== currentHash || approvedHash(campaign) !== currentHash) {
    throw new DomainValidationError(
      "approval_hash_mismatch",
      "Only the exact approved campaign content may be queued",
    );
  }
  assertNonEmptyString(approvedBy(campaign), "approvedBy");
  assertNonEmptyString(approvedAt(campaign), "approvedAt");
  return true;
}
