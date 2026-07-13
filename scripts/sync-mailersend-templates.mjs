import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  readCatalog,
  readJson,
  rootDirectory,
  templatesDirectory,
} from "./template-utils.mjs";

const apply = process.argv.includes("--apply");
const catalog = await readCatalog();

if (!apply) {
  console.log("DRY RUN - no network requests will be made");
  for (const entry of catalog) console.log(`- ${entry.name} (${entry.slug})`);
  console.log("Run npm run templates:sync only after admin approval with a Templates-only token.");
  process.exit(0);
}

const approval = await readJson(path.join(rootDirectory, "config", "approval.json"));
if (approval.templateSync.status !== "approved" || !approval.templateSync.approvedBy || !approval.templateSync.approvedAt) {
  throw new Error("Template sync blocked: explicit admin approval is missing in config/approval.json");
}

const token = process.env.MAILERSEND_TEMPLATE_API_TOKEN;
const domainId = process.env.MAILERSEND_DOMAIN_ID;
if (!token || !domainId) {
  throw new Error("MAILERSEND_TEMPLATE_API_TOKEN and MAILERSEND_DOMAIN_ID are required");
}

async function api(pathname, options = {}) {
  const response = await fetch(`https://api.mailersend.com/v1${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MailerSend ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.status === 204 ? null : response.json();
}

const remote = await api("/templates?limit=100");
for (const entry of catalog) {
  const html = await readFile(path.join(templatesDirectory, entry.html), "utf8");
  const text = await readFile(path.join(templatesDirectory, entry.text), "utf8");
  const payload = {
    name: entry.name,
    html,
    text,
    domain_id: domainId,
    tags: entry.tags,
  };
  const existing = remote.data.find((template) => template.name === entry.name);
  if (existing) {
    if (existing.origin && existing.origin !== "api") {
      throw new Error(`${entry.name} exists but was not created by API; refusing to overwrite`);
    }
    await api(`/templates/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) });
    console.log(`updated ${entry.name}`);
  } else {
    await api("/templates", { method: "POST", body: JSON.stringify(payload) });
    console.log(`created ${entry.name}`);
  }
}
