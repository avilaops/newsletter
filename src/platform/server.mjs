import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { loadServerConfig } from "./config.mjs";
import { createDatabase } from "./db.mjs";
import { DomainValidationError } from "./domain/index.mjs";
import { createRepository } from "./repository.mjs";

const config = loadServerConfig();
const pool = createDatabase(config.DATABASE_URL);
const { repository } = createRepository(pool);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const app = Fastify({ logger: true, bodyLimit: 1_048_576 });

const campaignInput = z.object({
  name: z.string().trim().min(1).max(255),
  subject: z.string().trim().min(1).max(255),
  previewText: z.string().max(500).default(""),
  htmlContent: z.string().trim().min(10).max(900_000),
  audienceListIds: z.array(z.number().int().positive()).default([]),
});
const campaignPatch = campaignInput.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one editable field is required",
});
const sourceInput = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(["rss", "website", "api"]),
  url: z.url().refine((value) => value.startsWith("http://") || value.startsWith("https://")),
  category: z.string().trim().min(1).max(80).default("geral"),
  schedule: z.string().trim().min(5).max(100).default("0 * * * *"),
  active: z.boolean().default(true),
});
const audienceInput = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).default(""),
  recipientCount: z.number().int().min(0).default(0),
  externalKey: z.string().trim().max(255).default(""),
  emails: z.array(z.email().transform((value) => value.trim().toLowerCase())).max(10_000).default([]),
});
const articleInput = z.object({
  sourceId: z.uuid(),
  externalKey: z.string().trim().min(1).max(500),
  title: z.string().trim().min(3).max(500),
  summary: z.string().trim().max(5000).default(""),
  body: z.string().trim().min(1).max(200_000),
  sourceUrl: z.url().refine((value) => value.startsWith("http://") || value.startsWith("https://")).optional().nullable(),
  publishedAt: z.iso.datetime().optional().nullable(),
  category: z.string().trim().min(1).max(80).default("geral"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual ?? "", "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function authenticate(request) {
  const authorization = request.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!constantTimeEqual(token, config.ADMIN_API_TOKEN)) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
}

function authenticateIngest(request) {
  if (!config.N8N_INGEST_TOKEN) {
    const error = new Error("Ingestion is not configured");
    error.statusCode = 503;
    throw error;
  }
  const authorization = request.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!constantTimeEqual(token, config.N8N_INGEST_TOKEN)) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
}

function actor(request) {
  const value = request.headers["x-admin-id"];
  if (typeof value !== "string" || value.trim().length < 2 || value.length > 120) {
    const error = new Error("X-Admin-Id header is required for write operations");
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

app.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/api/ingest/")) authenticateIngest(request);
  else if (request.url.startsWith("/api/") && request.url !== "/api/health") authenticate(request);
  if (request.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: "invalid_request", details: error.issues });
  }
  if (error instanceof DomainValidationError) {
    return reply.code(409).send({ error: error.code, message: error.message, details: error.details });
  }
  if (error.code === "23505") return reply.code(409).send({ error: "conflict", message: error.message });
  if (error.code === "23514") return reply.code(409).send({ error: "constraint_violation", message: error.message });
  const status = error.statusCode ?? 500;
  if (status >= 500) app.log.error(error);
  return reply.code(status).send({ error: status === 500 ? "internal_error" : error.message });
});

app.get("/api/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok", deliveryEnabled: config.DELIVERY_ENABLED === "true" };
});

app.get("/api/campaigns", async () => ({ data: await repository.listCampaigns() }));

app.get("/api/sources", async () => ({ data: await repository.listSources() }));
app.post("/api/sources", async (request, reply) => {
  const created = await repository.createSource(sourceInput.parse(request.body), actor(request));
  return reply.code(201).send({ data: created });
});
app.patch("/api/sources/:id", async (request, reply) => {
  const patch = sourceInput.partial().refine((value) => Object.keys(value).length > 0).parse(request.body);
  const updated = await repository.updateSource(request.params.id, patch, actor(request));
  if (!updated) return reply.code(404).send({ error: "not_found" });
  return { data: updated };
});

app.get("/api/audiences", async () => ({ data: await repository.listAudiences() }));
app.post("/api/audiences", async (request, reply) => {
  const created = await repository.createAudience(audienceInput.parse(request.body), actor(request));
  return reply.code(201).send({ data: created });
});

app.get("/api/articles", async () => ({ data: await repository.listArticles() }));
app.get("/api/ingest/sources", async () => ({
  data: (await repository.listSources()).filter((source) => source.active),
}));
app.post("/api/ingest/articles", async (request, reply) => {
  const input = articleInput.parse(request.body);
  const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const article = await repository.ingestArticle({ ...input, contentHash }, "n8n-collector");
  return reply.code(202).send({ data: article });
});

app.post("/api/campaigns", async (request, reply) => {
  const created = await repository.createCampaign(campaignInput.parse(request.body), actor(request));
  return reply.code(201).send({ data: created });
});

app.patch("/api/campaigns/:id", async (request, reply) => {
  const updated = await repository.updateCampaign(request.params.id, campaignPatch.parse(request.body), actor(request));
  if (!updated) return reply.code(404).send({ error: "not_found" });
  return { data: updated };
});

app.post("/api/campaigns/:id/submit", async (request, reply) => {
  const campaign = await repository.submitCampaign(request.params.id, actor(request));
  if (!campaign) return reply.code(404).send({ error: "not_found" });
  return { data: campaign };
});

app.post("/api/campaigns/:id/approve", async (request, reply) => {
  const campaign = await repository.approveCampaign(request.params.id, actor(request));
  if (!campaign) return reply.code(404).send({ error: "not_found" });
  return { data: campaign };
});

app.post("/api/campaigns/:id/reject", async (request, reply) => {
  const body = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(request.body);
  const campaign = await repository.rejectCampaign(request.params.id, actor(request), body.reason);
  if (!campaign) return reply.code(404).send({ error: "not_found" });
  return { data: campaign };
});

app.post("/api/campaigns/:id/queue", async (request, reply) => {
  const queued = await repository.queueCampaign(request.params.id, actor(request), {
    channel: "n8n",
  });
  if (!queued) return reply.code(404).send({ error: "not_found" });
  return reply.code(202).send({ data: queued });
});

await app.register(fastifyStatic, { root: path.join(root, "public"), prefix: "/" });
app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "not_found" });
  return reply.sendFile("index.html");
});

const shutdown = async (signal) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await app.listen({ port: config.PORT, host: config.HOST });
