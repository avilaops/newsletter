import { createHash } from "node:crypto";

import {
  DomainValidationError,
  assertCampaignContent,
  isPlainObject,
} from "./validation.mjs";

function canonicalizeValue(value, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DomainValidationError(
        "non_json_value",
        "Campaign hash input may contain only finite numbers",
      );
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new DomainValidationError("cyclic_value", "Campaign hash input is cyclic");
    }
    ancestors.add(value);
    const result = `[${value.map((item) => canonicalizeValue(item, ancestors)).join(",")}]`;
    ancestors.delete(value);
    return result;
  }

  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      throw new DomainValidationError("cyclic_value", "Campaign hash input is cyclic");
    }
    ancestors.add(value);
    const fields = Object.keys(value)
      .sort()
      .map((key) => {
        const fieldValue = value[key];
        if (fieldValue === undefined) {
          throw new DomainValidationError(
            "non_json_value",
            `Campaign hash input contains undefined at ${key}`,
          );
        }
        return `${JSON.stringify(key)}:${canonicalizeValue(fieldValue, ancestors)}`;
      });
    ancestors.delete(value);
    return `{${fields.join(",")}}`;
  }

  throw new DomainValidationError(
    "non_json_value",
    `Campaign hash input contains unsupported type ${typeof value}`,
  );
}

export function canonicalJson(value) {
  return canonicalizeValue(value, new Set());
}

// Only delivery-affecting fields belong to this snapshot. Workflow metadata,
// timestamps, remote IDs and approval data must never influence the hash.
export function campaignHashInput(campaign) {
  return assertCampaignContent({
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText ?? campaign.preview_text,
    htmlContent: campaign.htmlContent ?? campaign.html_content,
    audienceListIds: campaign.audienceListIds ?? campaign.audience_list_ids ?? [],
  });
}

export function computeCampaignHash(campaign) {
  return createHash("sha256")
    .update(canonicalJson(campaignHashInput(campaign)), "utf8")
    .digest("hex");
}

