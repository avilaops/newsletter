import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const rootDirectory = path.resolve(scriptsDirectory, "..");
export const templatesDirectory = path.join(rootDirectory, "src", "templates");
export const samplesDirectory = path.join(rootDirectory, "src", "sample-data");

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readCatalog() {
  return readJson(path.join(templatesDirectory, "catalog.json"));
}

function resolveValue(context, expression) {
  return expression
    .trim()
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), context);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderVariables(template, context, html) {
  return template.replace(
    /{{\s*([A-Za-z][A-Za-z0-9_.]*)(?:\|default\((['"])(.*?)\2\))?\s*}}/g,
    (_, expression, _quote, fallback) => {
      const value = resolveValue(context, expression);
      const output = value === undefined || value === null || value === "" ? fallback ?? "" : value;
      return html ? escapeHtml(output) : String(output);
    },
  );
}

export function renderTemplate(template, data, { html = true } = {}) {
  let output = template;
  const loopPattern = /{%\s*for\s+([A-Za-z][A-Za-z0-9_]*)\s+in\s+([A-Za-z][A-Za-z0-9_.]*)\s*%}([\s\S]*?){%\s*endfor\s*%}/g;

  let previous;
  do {
    previous = output;
    output = output.replace(loopPattern, (_, itemName, collectionExpression, body) => {
      const collection = resolveValue(data, collectionExpression);
      if (!Array.isArray(collection)) return "";
      return collection
        .map((item, index) =>
          renderVariables(body, { ...data, [itemName]: item, loop: { index: index + 1 } }, html),
        )
        .join("");
    });
  } while (output !== previous);

  return renderVariables(output, data, html);
}
