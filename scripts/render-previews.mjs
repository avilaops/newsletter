import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readCatalog,
  readJson,
  renderTemplate,
  rootDirectory,
  samplesDirectory,
  templatesDirectory,
} from "./template-utils.mjs";

const outputDirectory = path.join(rootDirectory, "previews");
await mkdir(outputDirectory, { recursive: true });

for (const template of await readCatalog()) {
  const data = await readJson(path.join(samplesDirectory, template.sample));
  const htmlSource = await readFile(path.join(templatesDirectory, template.html), "utf8");
  const textSource = await readFile(path.join(templatesDirectory, template.text), "utf8");
  const html = renderTemplate(htmlSource, data, { html: true });
  const text = renderTemplate(textSource, data, { html: false });

  await writeFile(path.join(outputDirectory, `${template.slug}.html`), html, "utf8");
  await writeFile(path.join(outputDirectory, `${template.slug}.txt`), text, "utf8");
  console.log(`rendered ${template.slug}`);
}
