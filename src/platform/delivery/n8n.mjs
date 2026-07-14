export class N8nWebhookError extends Error {
  constructor(status, body = "") {
    super(`n8n delivery webhook failed with status ${status}: ${body.slice(0, 300)}`);
    this.name = "N8nWebhookError";
    this.status = status;
  }
}

export function createN8nDeliveryClient({ webhookUrl, secret, fetchImpl = globalThis.fetch } = {}) {
  if (!webhookUrl) throw new TypeError("webhookUrl is required");
  if (!secret) throw new TypeError("secret is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
  const url = new URL(webhookUrl).toString();

  return Object.freeze({
    async dispatchCampaign(payload, { idempotencyKey } = {}) {
      if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          "Idempotency-Key": String(idempotencyKey),
        },
        body: JSON.stringify(payload),
      });
      const body = await response.text();
      if (!response.ok) throw new N8nWebhookError(response.status, body);
      let result = {};
      if (body) {
        try { result = JSON.parse(body); } catch { throw new Error("n8n returned invalid JSON"); }
      }
      const executionId = result.executionId ?? result.execution_id ?? result.id;
      if (executionId === undefined || String(executionId).trim() === "") {
        throw new Error("n8n did not return an execution id");
      }
      return { executionId: String(executionId) };
    },
  });
}
