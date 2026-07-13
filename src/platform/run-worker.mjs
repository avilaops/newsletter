import { setTimeout as delay } from "node:timers/promises";
import { loadConfig } from "./config.mjs";
import { createDatabase } from "./db.mjs";
import { createListmonkClient } from "./delivery/listmonk.mjs";
import { createRepository } from "./repository.mjs";
import { createDeliveryWorker } from "./worker.mjs";

const config = loadConfig();
if (config.DELIVERY_ENABLED === "true" && !config.LISTMONK_API_TOKEN) {
  throw new Error("LISTMONK_API_TOKEN is required when DELIVERY_ENABLED=true");
}
const pool = createDatabase(config.DATABASE_URL);
const { repository, outbox } = createRepository(pool, {
  dispatchLockTimeoutMs: config.WORKER_LOCK_TIMEOUT_MS,
});
const deliveryClient = createListmonkClient({
  baseUrl: config.LISTMONK_BASE_URL,
  username: config.LISTMONK_API_USER,
  password: config.LISTMONK_API_TOKEN || "delivery-disabled",
});
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
