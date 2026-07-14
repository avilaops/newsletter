import assert from "node:assert/strict";
import test from "node:test";

import { createDeliveryWorker, DeliveryValidationError } from "../../src/platform/worker.mjs";
import { createRepository } from "../../src/platform/repository.mjs";

function approvedCampaign(overrides = {}) {
  return {
    id: "campaign-1",
    status: "approved",
    contentHash: "sha256:approved",
    approvedHash: "sha256:approved",
    name: "Avila Ops - Daily",
    subject: "Daily news",
    htmlContent: "<h1>Daily news</h1>",
    audienceListIds: [3],
    remoteCampaignId: null,
    ...overrides,
  };
}

function harness({ campaign = approvedCampaign(), env = { DELIVERY_ENABLED: "true" } } = {}) {
  const events = [];
  const item = {
    id: "outbox-1",
    campaignId: "campaign-1",
    contentHash: "sha256:approved",
    payload: { tags: ["avilaops"] },
    attempts: 0,
  };
  const repository = {
    async getCampaign(id) {
      events.push(["getCampaign", id]);
      return campaign;
    },
    async getCampaignRecipients(id, hash) {
      events.push(["getCampaignRecipients", id, hash]);
      return ["reader@example.com"];
    },
    async setRemoteCampaign(id, remoteId) {
      events.push(["setRemoteCampaign", id, remoteId]);
    },
  };
  const outbox = {
    async claimNext() {
      events.push(["claimNext"]);
      return item;
    },
    async markDispatched(id, result) {
      events.push(["markDispatched", id, result]);
    },
    async fail(id, error) {
      events.push(["fail", id, error]);
    },
  };
  const deliveryClient = {
    async dispatchCampaign(payload, options) {
      events.push(["dispatchCampaign", payload, options]);
      return { executionId: "exec-91" };
    },
  };

  return {
    events,
    item,
    worker: createDeliveryWorker({ repository, outbox, deliveryClient, env }),
  };
}

test("delivery is disabled by default without even claiming an outbox item", async () => {
  const { events, worker } = harness({ env: {} });

  assert.deepEqual(await worker.processNext(), { status: "disabled" });
  assert.deepEqual(events, []);
});

test("a campaign changed after approval is rejected before the delivery client", async () => {
  const { events, worker } = harness({
    campaign: approvedCampaign({ contentHash: "sha256:changed" }),
  });

  const result = await worker.processNext();

  assert.equal(result.status, "failed");
  assert.ok(result.error instanceof DeliveryValidationError);
  assert.equal(events.some(([name]) => name === "dispatchCampaign"), false);
  assert.deepEqual(
    events.map(([name]) => name),
    ["claimNext", "getCampaign", "fail"],
  );
});

test("an outbox hash mismatch is rejected before the delivery client", async () => {
  const setup = harness();
  setup.item.contentHash = "sha256:stale-outbox";

  const result = await setup.worker.processNext();

  assert.equal(result.status, "failed");
  assert.ok(result.error instanceof DeliveryValidationError);
  assert.equal(setup.events.some(([name]) => name === "dispatchCampaign"), false);
});

test("an approved campaign is only marked dispatched after n8n accepts it", async () => {
  const { events, worker } = harness();

  const result = await worker.processNext();

  assert.deepEqual(result, { status: "dispatched", campaignId: "campaign-1", remoteId: "exec-91" });
  assert.deepEqual(
    events.map(([name]) => name),
    [
      "claimNext",
      "getCampaign",
      "getCampaignRecipients",
      "dispatchCampaign",
      "setRemoteCampaign",
      "markDispatched",
    ],
  );
  assert.deepEqual(events[3][1], {
    name: "Avila Ops - Daily",
    subject: "Daily news",
    campaignId: "campaign-1",
    outboxId: "outbox-1",
    contentHash: "sha256:approved",
    audienceListIds: [3],
    htmlContent: "<h1>Daily news</h1>",
    previewText: "",
    recipientEmails: ["reader@example.com"],
  });
  assert.deepEqual(events[3][2], { idempotencyKey: "outbox-1" });
});

test("a retry reuses a persisted n8n execution instead of dispatching a duplicate", async () => {
  const { events, worker } = harness({
    campaign: approvedCampaign({ remoteCampaignId: 91 }),
  });

  const result = await worker.processNext();

  assert.deepEqual(result, { status: "dispatched", campaignId: "campaign-1", remoteId: 91 });
  assert.equal(events.some(([name]) => name === "dispatchCampaign"), false);
  assert.deepEqual(
    events.map(([name]) => name),
    ["claimNext", "getCampaign", "getCampaignRecipients", "markDispatched"],
  );
});

test("delivery fails before n8n when the approved recipient snapshot is empty", async () => {
  const setup = harness();
  setup.worker = createDeliveryWorker({
    repository: {
      async getCampaign() { return approvedCampaign(); },
      async getCampaignRecipients() { return []; },
      async setRemoteCampaign() { throw new Error("must not persist"); },
    },
    outbox: {
      async claimNext() { return setup.item; },
      async markDispatched() { throw new Error("must not dispatch"); },
      async fail(id, error) { setup.events.push(["fail", id, error]); },
    },
    deliveryClient: {
      async dispatchCampaign() { throw new Error("must not call n8n"); },
    },
    env: { DELIVERY_ENABLED: "true" },
  });

  const result = await setup.worker.processNext();
  assert.equal(result.status, "failed");
  assert.ok(result.error instanceof DeliveryValidationError);
  assert.match(result.error.message, /no frozen recipients/);
});

test("the outbox reclaims a dispatch lock after the configured timeout", async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push([sql, params]);
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      return {
        rows: [{
          id: "outbox-1",
          campaign_id: "campaign-1",
          content_hash: "sha256:approved",
          payload: {},
          status: "dispatching",
          attempts: 2,
        }],
      };
    },
    release() {},
  };
  const pool = { async connect() { return client; } };
  const { outbox } = createRepository(pool, { dispatchLockTimeoutMs: 90_000 });

  const claimed = await outbox.claimNext();

  const claimQuery = queries.find(([sql]) => sql.includes("WITH candidate"));
  assert.match(claimQuery[0], /status = 'dispatching'.*locked_at/s);
  assert.deepEqual(claimQuery[1], [90]);
  assert.equal(claimed.attempts, 2);
});

test("the outbox rejects unsafe dispatch lock timeouts", () => {
  assert.throws(
    () => createRepository({}, { dispatchLockTimeoutMs: 999 }),
    /at least 1000/,
  );
});
