import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.SQLITE_PATH ?? path.join(__dirname, '../../data/database.db');

let _db: SqlJsDatabase | null = null;

// ─── Persistence ─────────────────────────────────────────────────────────────
function saveDB(): void {
  const data = (_db as SqlJsDatabase).export();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Thin better-sqlite3-compatible wrapper ───────────────────────────────────
// Exposes prepare(sql).run(...), prepare(sql).get(...), prepare(sql).all(...)
// so the model layer can stay identical to a better-sqlite3 codebase.
interface RunResult { changes: number }

interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

function makeStmt(sql: string): Statement {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run(...params: unknown[]): RunResult {
      (_db as SqlJsDatabase).run(sql, params as any);
      const changes = (_db as SqlJsDatabase).getRowsModified();
      saveDB();
      return { changes };
    },
    get(...params: unknown[]): Record<string, unknown> | undefined {
      const stmt = (_db as SqlJsDatabase).prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (params.length > 0) stmt.bind(params as any);
      let row: Record<string, unknown> | undefined;
      if (stmt.step()) row = stmt.getAsObject() as Record<string, unknown>;
      stmt.free();
      return row;
    },
    all(...params: unknown[]): Record<string, unknown>[] {
      const stmt = (_db as SqlJsDatabase).prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (params.length > 0) stmt.bind(params as any);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>);
      stmt.free();
      return rows;
    },
  };
}

export const db = {
  prepare: makeStmt,
  exec(sql: string): void {
    (_db as SqlJsDatabase).exec(sql);
    saveDB();
  },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function connectDB(): Promise<void> {
  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(data);
  } else {
    _db = new SQL.Database();
  }

  // Enable foreign keys and WAL equivalent (sql.js is always in-memory; WAL is n/a)
  _db.run('PRAGMA foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      color       TEXT NOT NULL DEFAULT '#58a6ff',
      created_at  TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      id           TEXT PRIMARY KEY,
      category_id  TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      original_url TEXT NOT NULL,
      thumbnail    TEXT NOT NULL,
      local_path   TEXT,
      width        INTEGER NOT NULL DEFAULT 0,
      height       INTEGER NOT NULL DEFAULT 0,
      annotations  TEXT NOT NULL DEFAULT '[]',
      created_at   TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE
    );
  `);

  saveDB();
  console.log(`✅ SQLite database ready: ${DB_PATH}`);
}
