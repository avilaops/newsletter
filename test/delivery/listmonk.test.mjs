import assert from "node:assert/strict";
import test from "node:test";

import { createListmonkClient, ListmonkHttpError } from "../../src/platform/delivery/listmonk.mjs";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("createCampaign and startCampaign use the documented listmonk API", async () => {
  const calls = [];
  const responses = [
    jsonResponse({ data: { id: 41, status: "draft" } }),
    jsonResponse({ data: { id: 41, status: "running" } }),
  ];
  const client = createListmonkClient({
    baseUrl: "https://listmonk.invalid/",
    username: "api-user",
    password: "api-token",
    fetchImpl: async (...args) => {
      calls.push(args);
      return responses.shift();
    },
  });

  const created = await client.createCampaign({
    name: "Edition 1",
    subject: "Daily news",
    lists: [7],
  });
  const started = await client.startCampaign(created.id);

  assert.deepEqual(created, { id: 41, status: "draft" });
  assert.deepEqual(started, { id: 41, status: "running" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "https://listmonk.invalid/api/campaigns");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers.Authorization, "Basic YXBpLXVzZXI6YXBpLXRva2Vu");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    name: "Edition 1",
    subject: "Daily news",
    lists: [7],
  });
  assert.equal(calls[1][0], "https://listmonk.invalid/api/campaigns/41/status");
  assert.equal(calls[1][1].method, "PUT");
  assert.deepEqual(JSON.parse(calls[1][1].body), { status: "running" });
});

test("listmonk errors expose status without leaking credentials", async () => {
  const client = createListmonkClient({
    baseUrl: "https://listmonk.invalid",
    username: "secret-user",
    password: "secret-token",
    fetchImpl: async () => jsonResponse({ message: "denied" }, { ok: false, status: 403 }),
  });

  await assert.rejects(
    () => client.createCampaign({ name: "No send" }),
    (error) => {
      assert.ok(error instanceof ListmonkHttpError);
      assert.equal(error.status, 403);
      assert.doesNotMatch(error.message, /secret-user|secret-token/);
      return true;
    },
  );
});

