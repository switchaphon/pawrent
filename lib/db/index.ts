/**
 * Two-pool DB module for pawrent.
 *
 * WHY two pools:
 *   pawrent_app  — non-owner role, RLS enforced. Every user-context query runs
 *                  inside a transaction that sets app.user_id via set_config so
 *                  RLS policies can read current_setting('app.user_id', true).
 *
 *   pawrent_admin — table owner, BYPASSRLS. Separate pool for the 8 listed
 *                   service-context call sites only.
 *
 * GOTCHA: The Postgres table owner silently bypasses RLS regardless of the
 * ENABLE ROW LEVEL SECURITY setting. pawrent_app must NOT own the tables.
 *
 * LAZY INITIALISATION: postgres() is not called at module import time so that
 * test suites that import this module without DATABASE_URL set can still load
 * it and skip integration blocks cleanly. The pool is created on first query().
 *
 * Public surface: query, adminQuery, and re-exports from schema + rpc.
 * The raw postgres() clients and drizzle handles are NOT exported.
 *
 * PDPA: never log userId or row contents in this module.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Type alias for a transaction handle (used in rpc.ts callers)
// ---------------------------------------------------------------------------
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
export type Tx = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]
>[0];

// ---------------------------------------------------------------------------
// Lazy pool construction — deferred to first use so the module can be imported
// in test environments where the env vars are absent (the integration suite
// guards on DATABASE_URL_TEST via describe.skipIf before calling anything).
// ---------------------------------------------------------------------------
type DbHandle = PostgresJsDatabase<typeof schema>;

let _appDb: DbHandle | undefined;
let _adminDb: DbHandle | undefined;

function getAppDb(): DbHandle {
  if (!_appDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _appDb = drizzle(postgres(url, { max: 10 }), { schema });
  }
  return _appDb;
}

function getAdminDb(): DbHandle {
  if (!_adminDb) {
    const url = process.env.DATABASE_ADMIN_URL;
    if (!url) throw new Error("DATABASE_ADMIN_URL is not set");
    _adminDb = drizzle(postgres(url, { max: 4 }), { schema });
  }
  return _adminDb;
}

// ---------------------------------------------------------------------------
// UUID validation — fail fast before any SQL round-trip.
// A malformed userId mid-transaction would explode inside an RLS policy cast.
// ---------------------------------------------------------------------------
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUuid(userId: string): void {
  if (!UUID_RE.test(userId)) {
    throw new Error(
      `query(): userId must be a valid UUID, got: "${userId.slice(0, 64)}"`
    );
  }
}

// ---------------------------------------------------------------------------
// query(userId, fn)
//
// Opens a transaction on the app pool, sets app.user_id via set_config
// (parameterised — NOT string-interpolated SET LOCAL, which would be
// injection-unsafe), then runs fn(tx). RLS policies read
// current_setting('app.user_id', true) automatically.
//
// is_local=true means the setting is rolled back at transaction end —
// guarantees isolation between concurrent requests on different user IDs.
// ---------------------------------------------------------------------------
export async function query<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  assertValidUuid(userId);

  return getAppDb().transaction(async (tx) => {
    // userId is bound as a SQL parameter — never string-interpolated.
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

// ---------------------------------------------------------------------------
// adminQuery(fn)
//
// Runs fn on the admin pool (pawrent_admin = table owner = BYPASSRLS).
//
// LEGITIMATE CALL SITES (the 8 files using SUPABASE_SERVICE_ROLE_KEY today)
// — new call sites are a review blocker:
//   1. app/api/auth/line/route.ts             — upsert profile on login
//   2. app/api/cron/celebrations/route.ts     — birthday/milestone fan-out
//   3. app/api/cron/health-reminders/route.ts — daily reminder fan-out
//   4. app/api/line/webhook/route.ts          — inbound LINE events
//   5. app/api/og/passport/[petId]/route.tsx  — OG passport image
//   6. app/api/pet-card/[petId]/route.tsx     — pet ID card image
//   7. app/api/pet-card/[petId]/qr/route.ts   — pet ID card QR
//   8. app/p/[pawrentId]/page.tsx             — public profile SSR page
//   9. app/pets/[id]/passport/page.tsx        — public passport RSC
//      (decision #21 — converted from supabase-server, wave 5)
// ---------------------------------------------------------------------------
export async function adminQuery<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getAdminDb().transaction(async (tx) => fn(tx));
}

// ---------------------------------------------------------------------------
// Re-export schema tables + types so callers have a single import point.
// ---------------------------------------------------------------------------
export * from "./schema";
