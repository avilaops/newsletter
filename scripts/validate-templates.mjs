import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  readCatalog,
  readJson,
  renderTemplate,
  rootDirectory,
  samplesDirectory,
  templatesDirectory,
} from "./template-utils.mjs";

const errors = [];
const catalog = await readCatalog();

for (const entry of catalog) {
  const htmlSource = await readFile(path.join(templatesDirectory, entry.html), "utf8");
  const textSource = await readFile(path.join(templatesDirectory, entry.text), "utf8");
  const sample = await readJson(path.join(samplesDirectory, entry.sample));
  const renderedHtml = renderTemplate(htmlSource, sample, { html: true });
  const renderedText = renderTemplate(textSource, sample, { html: false });

  if (!htmlSource.includes("{{unsubscribe}}")) errors.push(`${entry.html}: missing unsubscribe link`);
  if (!textSource.includes("{{unsubscribe}}")) errors.push(`${entry.text}: missing unsubscribe link`);
  if (!htmlSource.includes('name="viewport"')) errors.push(`${entry.html}: missing viewport meta tag`);
  if (!htmlSource.includes('role="presentation"')) errors.push(`${entry.html}: missing presentation table`);
  if (renderedHtml.includes("{{") || renderedHtml.includes("{%")) {
    errors.push(`${entry.html}: preview has unresolved template expressions`);
  }
  if (renderedText.includes("{{") || renderedText.includes("{%")) {
    errors.push(`${entry.text}: preview has unresolved template expressions`);
  }
}

const trackedFiles = [
  "README.md",
  ".env.example",
  "package.json",
  "scripts/sync-mailersend-templates.mjs",
  "src/templates/catalog.json",
];
for (const file of trackedFiles) {
  const content = await readFile(path.join(rootDirectory, file), "utf8");
  if (/eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(content)) {
    errors.push(`${file}: contains a JWT-like secret`);
  }
}

const packageJson = await readJson(path.join(rootDirectory, "package.json"));
if (Object.keys(packageJson.scripts ?? {}).some((name) => /send/i.test(name))) {
  errors.push("package.json: email sending commands are not allowed in this project");
}

const syncScript = await readFile(
  path.join(rootDirectory, "scripts", "sync-mailersend-templates.mjs"),
  "utf8",
);
if (/\/v1\/email\b/.test(syncScript)) {
  errors.push("scripts/sync-mailersend-templates.mjs: email sending endpoint is not allowed");
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`validated ${catalog.length} templates`);
console.log("email sending: not implemented");
