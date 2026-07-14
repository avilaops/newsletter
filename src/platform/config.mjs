import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  ADMIN_API_TOKEN: z.string().optional(),
  DELIVERY_ENABLED: z.enum(["true", "false"]).default("false"),
  N8N_DELIVERY_WEBHOOK_URL: z.string().default(""),
  N8N_WEBHOOK_SECRET: z.string().default(""),
  N8N_INGEST_TOKEN: z.string().default(""),
  WORKER_POLL_MS: z.coerce.number().int().min(250).default(5000),
  WORKER_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1000).default(300_000),
});

export function loadConfig(environment = process.env) {
  return schema.parse(environment);
}

export function loadServerConfig(environment = process.env) {
  return schema.extend({ ADMIN_API_TOKEN: z.string().min(20) }).parse(environment);
}
