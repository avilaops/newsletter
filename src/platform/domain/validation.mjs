export class DomainValidationError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "DomainValidationError";
    this.code = code;
    this.details = details;
  }
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertPlainObject(value, fieldName) {
  if (!isPlainObject(value)) {
    throw new DomainValidationError(
      "invalid_object",
      `${fieldName} must be a plain object`,
      { field: fieldName },
    );
  }
}

export function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DomainValidationError(
      "required_field",
      `${fieldName} must be a non-empty string`,
      { field: fieldName },
    );
  }
}

export function assertSha256(value, fieldName) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new DomainValidationError(
      "invalid_hash",
      `${fieldName} must be a lowercase SHA-256 hash`,
      { field: fieldName },
    );
  }
}

export function normalizeAudienceListIds(value, { required = false } = {}) {
  if (!Array.isArray(value)) {
    throw new DomainValidationError(
      "invalid_audience",
      "audienceListIds must be an array",
      { field: "audienceListIds" },
    );
  }

  const ids = value.map((id) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new DomainValidationError(
        "invalid_audience",
        "audienceListIds may contain only positive safe integers",
        { field: "audienceListIds", value: id },
      );
    }
    return id;
  });

  const normalized = [...new Set(ids)].sort((left, right) => left - right);
  if (required && normalized.length === 0) {
    throw new DomainValidationError(
      "audience_required",
      "At least one audience list is required before review or queueing",
      { field: "audienceListIds" },
    );
  }
  return normalized;
}

export function assertCampaignContent(content, { queueable = false } = {}) {
  assertPlainObject(content, "campaign");
  assertNonEmptyString(content.name, "name");
  assertNonEmptyString(content.subject, "subject");
  assertNonEmptyString(content.htmlContent, "htmlContent");

  if (content.previewText !== undefined && content.previewText !== null) {
    if (typeof content.previewText !== "string") {
      throw new DomainValidationError(
        "invalid_field",
        "previewText must be a string",
        { field: "previewText" },
      );
    }
  }

  return {
    name: content.name,
    subject: content.subject,
    previewText: content.previewText ?? "",
    htmlContent: content.htmlContent,
    audienceListIds: normalizeAudienceListIds(content.audienceListIds ?? [], {
      required: queueable,
    }),
  };
}

export function actorIdentifier(actor) {
  const identifier = typeof actor === "string" ? actor : actor?.id;
  assertNonEmptyString(identifier, "actor");
  return identifier.trim();
}

