import { setTimeout as delay } from "node:timers/promises";
import { loadConfig } from "./config.mjs";
import { createDatabase } from "./db.mjs";
import { createN8nDeliveryClient } from "./delivery/n8n.mjs";
import { createRepository } from "./repository.mjs";
import { createDeliveryWorker } from "./worker.mjs";

const config = loadConfig();
if (config.DELIVERY_ENABLED === "true" && (!config.N8N_DELIVERY_WEBHOOK_URL || !config.N8N_WEBHOOK_SECRET)) {
  throw new Error("N8N_DELIVERY_WEBHOOK_URL and N8N_WEBHOOK_SECRET are required when DELIVERY_ENABLED=true");
}
const pool = createDatabase(config.DATABASE_URL);
const { repository, outbox } = createRepository(pool, {
  dispatchLockTimeoutMs: config.WORKER_LOCK_TIMEOUT_MS,
});
const deliveryClient = config.DELIVERY_ENABLED === "true"
  ? createN8nDeliveryClient({
      webhookUrl: config.N8N_DELIVERY_WEBHOOK_URL,
      secret: config.N8N_WEBHOOK_SECRET,
    })
  : null;
const worker = createDeliveryWorker({ repository, outbox, deliveryClient, env: process.env });
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

try {
  while (!stopping) {
    const result = await worker.processNext();
    if (result.status === "failed") console.error(result.error);
    if (result.status === "disabled") await delay(config.WORKER_POLL_MS);
    else if (result.status === "idle") await delay(config.WORKER_POLL_MS);
  }
} finally {
  await pool.end();
}
