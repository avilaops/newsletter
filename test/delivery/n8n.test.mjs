import assert from "node:assert/strict";
import test from "node:test";
import { createN8nDeliveryClient, N8nWebhookError } from "../../src/platform/delivery/n8n.mjs";

test("dispatchCampaign calls the authenticated n8n webhook idempotently", async () => {
  const calls = [];
  const client = createN8nDeliveryClient({
    webhookUrl: "https://n8n.example/webhook/newsletters",
    secret: "not-logged-secret",
    async fetchImpl(...args) {
      calls.push(args);
      return new Response(JSON.stringify({ executionId: "exec-42" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.deepEqual(
    await client.dispatchCampaign({ campaignId: "campaign-1" }, { idempotencyKey: "outbox-1" }),
    { executionId: "exec-42" },
  );
  assert.equal(calls[0][0], "https://n8n.example/webhook/newsletters");
  assert.equal(calls[0][1].headers.Authorization, "Bearer not-logged-secret");
  assert.equal(calls[0][1].headers["Idempotency-Key"], "outbox-1");
});

test("n8n errors expose status without leaking the credential", async () => {
  const client = createN8nDeliveryClient({
    webhookUrl: "https://n8n.example/webhook/newsletters",
    secret: "super-secret-value",
    async fetchImpl() { return new Response("workflow unavailable", { status: 503 }); },
  });

  await assert.rejects(
    client.dispatchCampaign({}, { idempotencyKey: "outbox-1" }),
    (error) => error instanceof N8nWebhookError
      && error.status === 503
      && !error.message.includes("super-secret-value"),
  );
});
