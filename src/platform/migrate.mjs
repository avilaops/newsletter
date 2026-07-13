import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase, withTransaction } from "./db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDirectory = path.join(root, "db", "migrations");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = createDatabase(connectionString);
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const exists = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (exists.rowCount) continue;
    const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
    await withTransaction(pool, async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
    });
    console.log(`applied ${file}`);
  }
} finally {
  await pool.end();
}
