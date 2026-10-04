import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "uploads");

const MIGRATION = `
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  hospital TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS receipts_date_idx ON receipts(date);

CREATE TABLE IF NOT EXISTS receipt_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS receipt_images_receipt_idx ON receipt_images(receipt_id);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT,
  hospital TEXT NOT NULL,
  purpose TEXT,
  memo TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(date);
`;

type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB };

function createDb(): DB {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const sqlite = new Database(path.join(/*turbopackIgnore: true*/ DATA_DIR, "app.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(MIGRATION);
  migrateSingleImageColumn(sqlite);
  return drizzle(sqlite, { schema });
}

// 초기 버전은 receipts.image_path 한 칸에 사진 한 장만 저장했다.
function migrateSingleImageColumn(sqlite: Database.Database) {
  const columns = sqlite.pragma("table_info(receipts)") as { name: string }[];
  if (!columns.some((c) => c.name === "image_path")) return;
  sqlite.transaction(() => {
    sqlite.exec(`
      INSERT INTO receipt_images (receipt_id, kind, path, position)
      SELECT id, 'receipt', image_path, 0 FROM receipts WHERE image_path IS NOT NULL;
      ALTER TABLE receipts DROP COLUMN image_path;
    `);
  })();
}

export function getDb(): DB {
  if (!globalForDb.__db) globalForDb.__db = createDb();
  return globalForDb.__db;
}
