import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  readCatalog,
  templatesDirectory,
} from "./template-utils.mjs";

const apply = process.argv.includes("--apply");
const catalog = await readCatalog();

if (!apply) {
  console.log("DRY RUN - no network requests will be made");
  for (const entry of catalog) console.log(`- ${entry.name} (${entry.slug})`);
  console.log("Run npm run templates:sync with a Templates-only token, then review the templates in MailerSend.");
  process.exit(0);
}

const token = process.env.MAILERSEND_TEMPLATE_API_TOKEN;
const domainId = process.env.MAILERSEND_DOMAIN_ID;
if (!token) {
  throw new Error("MAILERSEND_TEMPLATE_API_TOKEN is required");
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

const query = new URLSearchParams({ limit: "100" });
if (domainId) query.set("domain_id", domainId);

const remote = await api(`/templates?${query}`);
const synced = [];
for (const entry of catalog) {
  const html = await readFile(path.join(templatesDirectory, entry.html), "utf8");
  const text = await readFile(path.join(templatesDirectory, entry.text), "utf8");
  const payload = {
    name: entry.name,
    html,
    text,
    tags: entry.tags,
    ...(domainId ? { domain_id: domainId } : {}),
  };
  const existing = remote.data.find((template) => template.name === entry.name);
  if (existing) {
    if (existing.origin && existing.origin !== "api") {
      throw new Error(`${entry.name} exists but was not created by API; refusing to overwrite`);
    }
    const result = await api(`/templates/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    synced.push({ id: result.data.id, name: entry.name, action: "updated" });
  } else {
    const result = await api("/templates", { method: "POST", body: JSON.stringify(payload) });
    synced.push({ id: result.data.id, name: entry.name, action: "created" });
  }
}

for (const template of synced) {
  const verification = await api(`/templates/${template.id}`);
  if (verification.data.name !== template.name) {
    throw new Error(`Remote verification failed for ${template.name}`);
  }
  console.log(`${template.action} and verified ${template.name} (${template.id})`);
}

console.log(`synced ${synced.length} templates; review them in MailerSend before requesting account approval`);
