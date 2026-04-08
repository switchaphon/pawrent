# TypeScript & React Code Style — Pawrent

Reference these patterns before writing any code. These are the actual patterns
in use in this codebase — not generic guidelines.

---

## Route Handler Pattern

Every API route follows this exact sequence: auth -> rate-limit -> validate -> query

```typescript
import { createApiClient } from "@/lib/supabase-api";
import { mySchema } from "@/lib/validations";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const limiter = createRateLimiter(10, "1 m");

// Auth helper — extracts Bearer token from Authorization header and creates
// a Supabase client scoped to the authenticated user. Defined once per route file.
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createApiClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await getAuthUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit
  const rateLimited = await checkRateLimit(limiter, auth.user.id);
  if (rateLimited) return rateLimited;

  // 3. Validate
  const body = await request.json();
  const result = mySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  // 4. Query (RLS enforced by Supabase client)
  const { data, error } = await auth.supabase
    .from("my_table")
    .insert({ ...result.data, user_id: auth.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

Error response shape is always `{ error: string }` — never vary this.

---

## Cursor Pagination Pattern

All list endpoints must use cursor pagination, never offset.

```typescript
// Request: GET /api/posts?cursor=<ISO_TIMESTAMP>&limit=20
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to determine has_more

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const has_more = data.length > limit;
  const items = has_more ? data.slice(0, limit) : data;
  const next_cursor = has_more ? items[items.length - 1].created_at : null;

  return NextResponse.json({ data: items, next_cursor, has_more });
}
```

---

## Component Pattern

```typescript
// Server Component (default — no 'use client')
import { createServerClient } from "@/lib/supabase-server";

export default async function PetPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const { data: pet } = await supabase.from("pets").select("*").eq("id", params.id).single();

  if (!pet) return <div>Pet not found</div>;
  return <PetCard pet={pet} />;
}
```

```typescript
// Client Component — only add 'use client' when you need hooks or events
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PetCardProps {
  pet: Pet;
  className?: string;
}

export function PetCard({ pet, className }: PetCardProps) {
  const [liked, setLiked] = useState(false);
  // ...
}
```

Rules:

- Default to Server Component — add `'use client'` only when required
- Always define prop types as an interface above the component
- Use `cn()` from `@/lib/utils` for conditional classNames
- Leaflet/map components: always `dynamic(() => import(...), { ssr: false })`

---

## Zod Schema Pattern

Schemas live in domain-specific files under `lib/validations/`. Never define inline in route handlers.

```typescript
// lib/validations/appointments.ts
import { z } from "zod";

export const appointmentSchema = z.object({
  pet_id: z.string().uuid("Select a pet"),
  service_id: z.string().uuid().nullable(),
  type: z.enum(["vaccination", "checkup", "grooming", "surgery", "other"]),
  scheduled_at: z.string().datetime("Invalid date"),
  notes: z.string().max(1000).nullable(),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
```

```typescript
// lib/validations/index.ts — barrel re-export
export * from "./appointments";
export * from "./pets";
export * from "./budget";
// ... add new domain exports here
```

---

## TypeScript Type Pattern

DB types live in domain-specific files under `lib/types/`. Match the Supabase table exactly.

```typescript
// lib/types/appointments.ts
export interface Appointment {
  id: string;
  pet_id: string;
  service_id: string | null;
  user_id: string;
  type: "vaccination" | "checkup" | "grooming" | "surgery" | "other";
  scheduled_at: string; // ISO timestamp
  notes: string | null;
  created_at: string;
}
```

```typescript
// lib/types/index.ts — barrel re-export
export * from "./appointments";
export * from "./pets";
export * from "./budget";
// ... add new domain exports here
```

---

## Test Pattern

```typescript
// __tests__/api-appointments.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing the route
vi.mock("@/lib/supabase-api", () => ({
  createApiClient: vi.fn(),
}));

import { POST, GET } from "@/app/api/appointments/route";
import { createApiClient } from "@/lib/supabase-api";

describe("POST /api/appointments", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(createApiClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as unknown as ReturnType<typeof createApiClient>);

    const request = new Request("http://localhost/api/appointments", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request as NextRequest);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid input", async () => {
    /* ... */
  });
  it("creates appointment and returns 201", async () => {
    /* ... */
  });
});
```

Rules:

- One test file per route handler or component
- Always mock Supabase at the module level
- Always `vi.clearAllMocks()` in `beforeEach`
- Test all three layers: auth failure, validation failure, happy path

## Integration Test Pattern (for staging DB tests)

When tests run against a shared staging Supabase, use namespaced test data to
prevent pollution between parallel agent runs:

```typescript
const RUN_ID = crypto.randomUUID().slice(0, 8);

beforeAll(async () => {
  testPet = await ownerClient
    .from("pets")
    .insert({ name: `test-pet-${RUN_ID}`, owner_id: TEST_OWNER_ID })
    .select()
    .single();
});

afterAll(async () => {
  await ownerClient.from("pets").delete().like("name", `test-pet-${RUN_ID}%`);
});
```

This ensures parallel test runs (from multiple agents or CI) never conflict.

---

## Database Migration Pattern

```sql
-- migrations/YYYYMMDDHHMMSS_add_appointments.sql

-- Forward migration
CREATE TABLE IF NOT EXISTS appointments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id       uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_appointments_user ON appointments(user_id, created_at DESC);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own appointments"
  ON appointments FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Rollback (always include)
-- DROP TABLE IF EXISTS appointments;
```

Rules:

- Always include rollback comment
- Always enable RLS on new tables
- PostGIS for any `lat/lng` columns: use `geography` + `GIST` index
- INCREMENT triggers (never SELECT COUNT/AVG in hot triggers)
