import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const tokenFile = path.join(__dirname, ".auth", "token.json");

test.describe("authenticated API flows", () => {
  let token: string;

  test.beforeAll(() => {
    if (!fs.existsSync(tokenFile)) {
      test.skip(true, "no auth token — E2E_TEST_MODE off");
      return;
    }
    token = JSON.parse(fs.readFileSync(tokenFile, "utf-8")).access_token;
  });

  // ── Auth gate ────────────────────────────────────────────────────────────────

  test("GET /api/pets returns 200 with valid JWT", async ({ request }) => {
    const res = await request.get("/api/pets", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/pets without token returns 401", async ({ request }) => {
    const res = await request.get("/api/pets");
    expect(res.status()).toBe(401);
  });

  // ── Profile ──────────────────────────────────────────────────────────────────

  test("GET /api/profile returns 200 with user fields", async ({ request }) => {
    const res = await request.get("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 if profile row exists, 404 if new user has no profile yet — both are valid auth states
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("line_user_id");
    }
  });

  // ── Pet CRUD round-trip ───────────────────────────────────────────────────────

  test("POST /api/pets creates a pet then DELETE removes it", async ({ request }) => {
    // Create
    const createRes = await request.post("/api/pets", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: "E2E Test Pet",
        species: "dog",
        breed: null,
        sex: null,
        color: null,
        weight_kg: null,
        date_of_birth: null,
        microchip_number: null,
        neutered: false,
        special_notes: null,
        status: "active",
      },
    });
    expect(createRes.status()).toBe(200);
    const created = await createRes.json();
    expect(created).toHaveProperty("id");
    expect(created.name).toBe("E2E Test Pet");

    // Clean up — DELETE requires { petId } in body
    const deleteRes = await request.delete("/api/pets", {
      headers: { Authorization: `Bearer ${token}` },
      data: { petId: created.id },
    });
    expect(deleteRes.status()).toBe(200);
    const deleted = await deleteRes.json();
    expect(deleted.success).toBe(true);
  });

  // ── Public route (no auth) ────────────────────────────────────────────────────

  test("GET /api/hospitals returns 200 without auth", async ({ request }) => {
    const res = await request.get("/api/hospitals");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
