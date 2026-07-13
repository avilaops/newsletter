import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_STATUS,
  DomainValidationError,
  applyCampaignEdit,
  approveCampaign,
  assertQueueable,
  computeCampaignHash,
  rejectCampaign,
  submitForReview,
} from "../../src/platform/domain/state-machine.mjs";

function draft(overrides = {}) {
  return {
    id: "5f451805-6a35-4c2c-aaba-5798c0b28d8b",
    name: "Resumo diario",
    subject: "Noticias do dia",
    previewText: "O que importa agora",
    htmlContent: "<h1>Noticias</h1>",
    audienceListIds: [12, 4],
    status: CAMPAIGN_STATUS.DRAFT,
    version: 1,
    ...overrides,
  };
}

test("hash is deterministic and treats audience IDs as a set", () => {
  const first = computeCampaignHash(draft());
  const second = computeCampaignHash({
    ...draft(),
    audienceListIds: [4, 12, 12],
    approvedAt: "workflow metadata is intentionally ignored",
  });

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
});

test("campaign follows draft -> in_review -> approved and becomes queueable", () => {
  const reviewing = submitForReview(draft());
  assert.equal(reviewing.status, CAMPAIGN_STATUS.IN_REVIEW);
  assert.equal(reviewing.contentHash, computeCampaignHash(reviewing));

  const approved = approveCampaign(reviewing, "admin@avilaops.com");
  assert.equal(approved.status, CAMPAIGN_STATUS.APPROVED);
  assert.equal(approved.approvedHash, approved.contentHash);
  assert.equal(assertQueueable(approved), true);
  assert.equal(Object.isFrozen(approved), true);
});

test("approved edit invalidates approval and returns campaign to draft", () => {
  const approved = approveCampaign(submitForReview(draft()), { id: "admin-1" });
  const edited = applyCampaignEdit(approved, { subject: "Noticias atualizadas" });

  assert.equal(edited.status, CAMPAIGN_STATUS.DRAFT);
  assert.equal(edited.approvedHash, null);
  assert.equal(edited.approvedBy, null);
  assert.notEqual(edited.contentHash, approved.contentHash);
  assert.throws(() => assertQueueable(edited), { code: "invalid_transition" });
});

test("tampered content cannot be approved or queued with a stale hash", () => {
  const reviewing = submitForReview(draft());
  const tamperedReview = { ...reviewing, htmlContent: "<h1>Alterado</h1>" };
  assert.throws(() => approveCampaign(tamperedReview, "admin-1"), {
    code: "stale_content_hash",
  });

  const approved = approveCampaign(reviewing, "admin-1");
  const tamperedApproved = { ...approved, htmlContent: "<h1>Alterado</h1>" };
  assert.throws(() => assertQueueable(tamperedApproved), {
    code: "approval_hash_mismatch",
  });
});

test("review may be rejected, but rejection requires an actor and reason", () => {
  const reviewing = submitForReview(draft());
  const rejected = rejectCampaign(reviewing, "reviewer-1", "Atualizar as fontes");

  assert.equal(rejected.status, CAMPAIGN_STATUS.REJECTED);
  assert.equal(rejected.rejectionReason, "Atualizar as fontes");
  assert.equal(rejected.approvedHash, null);
  assert.throws(() => rejectCampaign(reviewing, "reviewer-1", ""), DomainValidationError);
});

test("invalid transitions and empty audiences are rejected", () => {
  assert.throws(() => approveCampaign(draft(), "admin-1"), {
    code: "invalid_transition",
  });
  assert.throws(() => submitForReview(draft({ audienceListIds: [] })), {
    code: "audience_required",
  });
});

