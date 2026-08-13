import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function closeDatabase(): void {
  if (db.open) {
    db.close();
  }
}

export function isDatabaseOpen(): boolean {
  return db.open;
}
