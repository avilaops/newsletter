import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  ADMIN_API_TOKEN: z.string().optional(),
  DELIVERY_ENABLED: z.enum(["true", "false"]).default("false"),
  LISTMONK_BASE_URL: z.url().default("http://127.0.0.1:9000"),
  LISTMONK_API_USER: z.string().min(1).default("avila-control-plane"),
  LISTMONK_API_TOKEN: z.string().default(""),
  LISTMONK_TEMPLATE_ID: z.coerce.number().int().positive().default(1),
  WORKER_POLL_MS: z.coerce.number().int().min(250).default(5000),
  WORKER_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1000).default(300_000),
});

export function loadConfig(environment = process.env) {
  return schema.parse(environment);
}

export function loadServerConfig(environment = process.env) {
  return schema.extend({ ADMIN_API_TOKEN: z.string().min(20) }).parse(environment);
}
