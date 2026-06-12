/**
 * Integration tests for lib/db — two-pool module.
 *
 * These tests run against the REAL compose Postgres DB (seeded).
 * They are skipped in the normal jsdom CI run and must be run explicitly:
 *
 *   DATABASE_URL_TEST=postgres://pawrent_app:pawrent_app_dev_password@localhost:5433/pawrent \
 *   DATABASE_ADMIN_URL_TEST=postgres://pawrent_admin:pawrent_admin_dev_password@localhost:5433/pawrent \
 *   npx vitest run __tests__/db-pools.integration.test.ts
 *
 * The describe.skipIf guard below ensures `npm run test` (jsdom, no DB env)
 * stays green — the block is skipped entirely, not errored.
 *
 * Seeded fixtures used by these tests (db/seed/seed.sql):
 *   USER1 = 00000000-0000-4000-8000-000000000001 (Mali) — owns 2 pets
 *   USER2 = 00000000-0000-4000-8000-000000000002 (Niran) — owns 1 pet
 *   USER3 = 00000000-0000-4000-8000-000000000003 (Anong) — owns 2 pets
 *   Active SOS: pet 10000000-0000-4000-8000-000000000002 (น้องส้ม, owner=USER1)
 *   Post: 30000000-0000-4000-8000-000000000001 (seeded likes_count = 2)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { query, adminQuery } from "@/lib/db/index";
import { pets } from "@/lib/db/schema";
import {
  toggleLike,
  nearbyReports,
  usersWithinRadius,
  submitAnonymousFeedback,
} from "@/lib/db/rpc";

// ---------------------------------------------------------------------------
// Gate — skip entirely if test DB env vars are not set.
// ---------------------------------------------------------------------------
const hasTestDb = !!process.env.DATABASE_URL_TEST;

// ---------------------------------------------------------------------------
// Fixed seed UUIDs
// ---------------------------------------------------------------------------
const USER1 = "00000000-0000-4000-8000-000000000001";
const USER2 = "00000000-0000-4000-8000-000000000002";
const USER3 = "00000000-0000-4000-8000-000000000003";
// น้องส้ม — USER1's pet, has active SOS
const PET_SOS = "10000000-0000-4000-8000-000000000002";
// Post with seeded likes (USER1's post)
const POST1 = "30000000-0000-4000-8000-000000000001";

// ---------------------------------------------------------------------------
// Admin client for setup/teardown — uses DATABASE_ADMIN_URL_TEST directly
// so it doesn't go through adminQuery (which wraps in a tx).
// ---------------------------------------------------------------------------
let adminRaw: ReturnType<typeof postgres>;
let adminDrizzle: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (!hasTestDb) return;
  // Map the _TEST suffixed env vars to the names the module reads.
  // Must happen before any query()/adminQuery() call (lazy pool init).
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  process.env.DATABASE_ADMIN_URL = process.env.DATABASE_ADMIN_URL_TEST;
  adminRaw = postgres(process.env.DATABASE_ADMIN_URL_TEST!);
  adminDrizzle = drizzle(adminRaw);
});

afterAll(async () => {
  if (!hasTestDb) return;
  await adminRaw.end();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe.skipIf(!hasTestDb)("lib/db two-pool integration", () => {
  // -------------------------------------------------------------------------
  // 1. query(user1) SELECT pets → exactly user1's 2 pets
  // -------------------------------------------------------------------------
  it("query(user1) SELECT pets returns only user1 own pets", async () => {
    const rows = await query(USER1, (tx) => tx.select().from(pets));
    const ids = rows.map((r) => r.id);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.ownerId === USER1)).toBe(true);
    // The SOS pet belongs to USER1 too — confirm it's included
    expect(ids).toContain(PET_SOS);
  });

  // -------------------------------------------------------------------------
  // 2. query(user2) SELECT pets → own pet + active-SOS pet, NOT user1's other
  // -------------------------------------------------------------------------
  it("query(user2) SELECT pets returns own pet + SOS-visible pet only", async () => {
    const rows = await query(USER2, (tx) => tx.select().from(pets));
    expect(rows.length).toBe(2);
    const ids = new Set(rows.map((r) => r.id));
    // Must see น้องส้ม (active SOS, owner=USER1)
    expect(ids.has(PET_SOS)).toBe(true);
    // Must NOT see USER1's other pet (หมูเด้ง — no active SOS)
    const MOODENG = "10000000-0000-4000-8000-000000000001";
    expect(ids.has(MOODENG)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. query(user1) INSERT pet owned by user2 → rejected by RLS
  // -------------------------------------------------------------------------
  it("query(user1) INSERT pet owned by user2 is rejected by RLS", async () => {
    await expect(
      query(USER1, async (tx) => {
        return tx.execute(
          sql`INSERT INTO pets (owner_id, name, status, pawrent_id)
              VALUES (${USER2}::uuid, 'RLS Test Pet', 'active', 'PW-RLSTEST')`
        );
      })
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // 4. query(user1) UPDATE another's pet → 0 rows affected
  // -------------------------------------------------------------------------
  it("query(user1) UPDATE user2 pet returns 0 rows", async () => {
    const KHAONIAO = "10000000-0000-4000-8000-000000000003"; // USER2's pet
    const result = await query(USER1, (tx) =>
      tx.execute(sql`UPDATE pets SET special_notes = 'rls-test' WHERE id = ${KHAONIAO}::uuid`)
    );
    // postgres-js returns rows array; for UPDATE count we check rowCount
    const count = (result as unknown as { count: number }).count ?? 0;
    expect(count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. query with invalid userId throws before SQL
  // -------------------------------------------------------------------------
  it("query() with non-UUID userId throws immediately", async () => {
    // The throw happens before the fn callback is ever invoked.
    await expect(query("not-a-uuid", () => Promise.resolve(null))).rejects.toThrow(
      /userId must be a valid UUID/
    );
  });

  it("query() with empty string throws immediately", async () => {
    await expect(query("", () => Promise.resolve(null))).rejects.toThrow(
      /userId must be a valid UUID/
    );
  });

  // -------------------------------------------------------------------------
  // 6. adminQuery SELECT pets → all 5 (BYPASSRLS)
  // -------------------------------------------------------------------------
  it("adminQuery SELECT pets returns all 5 seeded pets", async () => {
    const rows = await adminQuery((tx) => tx.select().from(pets));
    expect(rows.length).toBe(5);
  });

  // -------------------------------------------------------------------------
  // 7. Tx isolation — sequential query() calls don't leak app.user_id
  // -------------------------------------------------------------------------
  it("tx isolation: sequential query() calls with different userIds do not leak", async () => {
    const [rows1, rows2] = await Promise.all([
      query(USER1, (tx) => tx.select().from(pets)),
      query(USER3, (tx) => tx.select().from(pets)),
    ]);
    // USER1 sees: own 2 pets (both owned by USER1, one has active SOS).
    // The SOS pet (น้องส้ม) is also owned by USER1, so all rows1 belong to USER1.
    expect(rows1.every((r) => r.ownerId === USER1)).toBe(true);

    // USER3 sees: own 2 pets + น้องส้ม (active SOS, owner=USER1).
    // Check that USER3's own pets are present, and that no USER1 non-SOS pet leaked.
    const ids2 = new Set(rows2.map((r) => r.id));
    // USER3's own pets must be present
    expect(ids2.has("10000000-0000-4000-8000-000000000004")).toBe(true); // ละมุน
    expect(ids2.has("10000000-0000-4000-8000-000000000005")).toBe(true); // ทองดี
    // SOS pet visible to anyone — present is correct
    expect(ids2.has(PET_SOS)).toBe(true);
    // USER1's non-SOS pet (หมูเด้ง) must NOT be visible to USER3
    expect(ids2.has("10000000-0000-4000-8000-000000000001")).toBe(false);
    // USER2's pet must NOT be visible to USER3
    expect(ids2.has("10000000-0000-4000-8000-000000000003")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 8a. rpc.nearbyReports — returns seeded Bangkok active SOS report
  // -------------------------------------------------------------------------
  it("rpc.nearbyReports returns active SOS report near Bangkok center", async () => {
    // Center: Lumpini area. Active report is at 13.7447, 100.5349 (~3.5km away).
    const rows = await adminQuery((tx) =>
      nearbyReports(tx, {
        lat: 13.7563,
        lng: 100.5018,
        radiusM: 50_000, // 50km
      })
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const found = rows.find((r) => r.id === "20000000-0000-4000-8000-000000000001");
    expect(found).toBeDefined();
    expect(found!.is_active).toBe(true);
    expect(found!.distance_m).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8b. rpc.usersWithinRadius — returns Mali's line_user_id from her home
  // -------------------------------------------------------------------------
  it("rpc.usersWithinRadius returns at least one user from Bangkok center", async () => {
    // Center = Mali's home (100.5689, 13.7367), radius 5km — she's within her own 5km radius
    const lineUserIds = await adminQuery((tx) =>
      usersWithinRadius(tx, { lat: 13.7367, lng: 100.5689, radiusKm: 5 })
    );
    expect(lineUserIds.length).toBeGreaterThanOrEqual(1);
    expect(lineUserIds).toContain("line-compose-mali");
  });

  // -------------------------------------------------------------------------
  // 8c. rpc.toggleLike — insert then remove; cleans up after itself
  // -------------------------------------------------------------------------
  it("rpc.toggleLike inserts then removes a like correctly", async () => {
    // Baseline: count actual rows in post_likes (not the denormalized
    // posts.likes_count, which the seed sets independently).
    const baseline = await adminQuery(async (tx) => {
      const rows = await tx.execute<{ count: string }>(
        sql`SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = ${POST1}::uuid`
      );
      return Number((rows as unknown as { count: string }[])[0].count);
    });

    try {
      // First call: add like (USER2 must not already have liked POST1)
      const countAfterLike = await query(USER2, (tx) => toggleLike(tx, POST1, USER2));
      expect(countAfterLike).toBe(baseline + 1);

      // Second call: remove like
      const countAfterUnlike = await query(USER2, (tx) => toggleLike(tx, POST1, USER2));
      expect(countAfterUnlike).toBe(baseline);
    } finally {
      // Clean up: remove any like USER2 may have left and restore posts.likes_count
      await adminDrizzle.execute(
        sql`DELETE FROM post_likes WHERE post_id = ${POST1}::uuid AND user_id = ${USER2}::uuid`
      );
      await adminDrizzle.execute(
        sql`UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = ${POST1}::uuid) WHERE id = ${POST1}::uuid`
      );
    }
  });

  // -------------------------------------------------------------------------
  // 8d. rpc.submitAnonymousFeedback — inserts into feedback table
  // -------------------------------------------------------------------------
  it("rpc.submitAnonymousFeedback inserts a feedback row", async () => {
    let feedbackId: string | undefined;
    try {
      const result = await adminQuery((tx) =>
        submitAnonymousFeedback(tx, {
          message: "integration-test feedback",
          userId: null,
          imageUrl: null,
        })
      );
      expect(result).toBeDefined();
      feedbackId = (result as { id?: string }).id;
      expect(typeof feedbackId).toBe("string");
    } finally {
      if (feedbackId) {
        await adminDrizzle.execute(sql`DELETE FROM feedback WHERE id = ${feedbackId}::uuid`);
      }
    }
  });
});
