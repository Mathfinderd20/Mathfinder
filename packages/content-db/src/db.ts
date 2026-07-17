import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";
import { createSchema } from "./schema";

export type ContentDatabase = BetterSqlite3.Database;

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function defaultDbPath() {
  return path.resolve(PACKAGE_ROOT, "data", "mathfinder.sqlite");
}

export function openDatabase(
  filePath = process.env.CONTENT_DB_PATH || defaultDbPath(),
): ContentDatabase {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new BetterSqlite3(filePath);
  createSchema(db);
  return db;
}
