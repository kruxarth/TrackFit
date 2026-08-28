import * as SQLite from "expo-sqlite";
import { migrations } from "./migrations";

type DbGlobal = typeof globalThis & {
  __trackfitSqlite?: SQLite.SQLiteDatabase;
  __trackfitSqliteOpening?: Promise<SQLite.SQLiteDatabase>;
};

const g = globalThis as DbGlobal;

let dbInstance: SQLite.SQLiteDatabase | null = null;

function isBusyError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("database is locked") || msg.includes("SQLITE_BUSY") || msg.includes("finalizeAsync");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function execIgnoreBusy(db: SQLite.SQLiteDatabase, sql: string): Promise<void> {
  try {
    await db.execAsync(sql);
  } catch (e) {
    if (!isBusyError(e)) throw e;
  }
}

async function configureConnection(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA busy_timeout = 8000;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  // WAL needs an exclusive lock and cannot share a multi-statement exec.
  // Skip it if a previous Fast Refresh connection still holds the file.
  await execIgnoreBusy(db, "PRAGMA journal_mode = WAL;");
  await execIgnoreBusy(db, "PRAGMA synchronous = NORMAL;");
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("trackit.db");
  await configureConnection(db);
  await runMigrations(db);
  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (g.__trackfitSqlite) {
    dbInstance = g.__trackfitSqlite;
    return g.__trackfitSqlite;
  }
  if (dbInstance) return dbInstance;
  if (!g.__trackfitSqliteOpening) {
    g.__trackfitSqliteOpening = (async () => {
      let last: unknown;
      for (let i = 0; i < 8; i++) {
        try {
          const db = await openAndMigrate();
          dbInstance = db;
          g.__trackfitSqlite = db;
          return db;
        } catch (e) {
          last = e;
          if (!isBusyError(e) || i === 7) throw e;
          await sleep(80 * 2 ** i);
        }
      }
      throw last;
    })();
  }
  try {
    return await g.__trackfitSqliteOpening;
  } catch (e) {
    g.__trackfitSqliteOpening = undefined;
    dbInstance = null;
    throw e;
  }
}

export async function openInMemoryDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(":memory:");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  return db;
}

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (const m of migrations) {
    if (m.version > current) {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version};`);
    }
  }
}

export function getDbInstance(): SQLite.SQLiteDatabase | null {
  return dbInstance ?? g.__trackfitSqlite ?? null;
}

export function setDbInstance(db: SQLite.SQLiteDatabase | null) {
  dbInstance = db;
  if (db) {
    g.__trackfitSqlite = db;
    g.__trackfitSqliteOpening = Promise.resolve(db);
  } else {
    g.__trackfitSqlite = undefined;
    g.__trackfitSqliteOpening = undefined;
  }
}

export async function withBusyRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isBusyError(e) || i === attempts - 1) throw e;
      await sleep(40 * 2 ** i);
    }
  }
  throw last;
}
