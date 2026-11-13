// Database connection.
// - On Vercel (DATABASE_URL is set): Neon serverless Postgres over HTTPS.
// - On a laptop without DATABASE_URL: PGlite, a real Postgres that runs inside Node
//   and saves to the ./.pglite folder. Same SQL works in both.
// Every other file just calls q("SELECT ...", [params]) and gets rows back.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import path from "node:path";

type Row = Record<string, any>;
type Runner = { query: (text: string, params?: unknown[]) => Promise<Row[]>; exec: (text: string) => Promise<void> };

// SIN_DATABASE_URL = the Neon database in Singapore (close to India); DATABASE_URL = the older US one.
const url = process.env.SIN_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Keep one connection per server process (Next.js dev reloads modules, so store it on globalThis).
const g = globalThis as unknown as { __db?: Promise<Runner> };

async function makeRunner(): Promise<Runner> {
  if (url) {
    const sql = neon(url);
    return {
      query: (text, params = []) => sql.query(text, params) as Promise<Row[]>,
      // Neon's HTTP driver runs one statement per call, so split the file on ";" at line ends.
      exec: async (text) => {
        for (const stmt of splitSql(text)) await sql.query(stmt);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  // On Vercel without a database configured, only /tmp is writable (temporary fallback).
  const dir = process.env.VERCEL ? "/tmp/pglite" : path.join(process.cwd(), ".pglite");
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    query: async (text, params = []) => (await db.query<Row>(text, params as any[])).rows,
    exec: async (text) => {
      await db.exec(text);
    },
  };
}

// Split a .sql file into single statements (our files never put ";" inside strings).
function splitSql(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function runner(): Promise<Runner> {
  if (!g.__db) g.__db = makeRunner();
  return g.__db;
}

// Run one SQL query with $1, $2 ... parameters and return the rows.
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSeeded();
  return (await (await runner()).query(text, params)) as T[];
}

// Read a file from the db/ folder (schema.sql, seed.sql, routes.json).
export function dbFile(name: string): string {
  return readFileSync(path.join(process.cwd(), "db", name), "utf8");
}

// Rebuild the whole database from db/schema.sql + db/seed.sql + the cached road routes.
export async function seedDatabase(): Promise<void> {
  const r = await runner();
  await r.exec(dbFile("schema.sql"));
  await r.exec(dbFile("seed.sql"));
  const routes = JSON.parse(dbFile("routes.json")) as Record<string, { route: unknown }>;
  for (const [busId, v] of Object.entries(routes)) {
    await r.query("UPDATE buses SET route = $1 WHERE id = $2", [JSON.stringify(v.route), Number(busId)]);
  }
}

// First request on an empty database creates the tables + demo data automatically.
let seededCheck: Promise<void> | null = null;
function ensureSeeded(): Promise<void> {
  if (!seededCheck) {
    seededCheck = (async () => {
      const r = await runner();
      const t = await r.query("SELECT to_regclass('public.meta') AS t");
      if (!t[0]?.t) await seedDatabase();
    })().catch((e) => {
      seededCheck = null;
      throw e;
    });
  }
  return seededCheck;
}
