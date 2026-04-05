# PRP Validation Report: Nice-to-Have Features (PRP-08)

## Verdict: NEEDS REVISION

The PRP is well-structured and has learned from PRP-04's mistakes — scope is tighter, SQL is included, and tasks are more independent. However, three concrete issues would cause implementation failure if not fixed: the data file name is wrong, four fields present in the source data are missing from the SQL schema, and the hospital-map component needs a specific migration strategy that the PRP does not address. E2E and PWA tasks are directionally sound but have gaps noted below.

---

## Critical Fixes (Must resolve before implementation)

### 1. [Data] Source file is `hospitals.json`, not a TypeScript file

The PRP states "hardcoded `data/hospitals.ts` JSON file" in the Problem section and later says "Keep `data/hospitals.ts` as fallback/seed reference." The actual file is `/Users/switchaphon/recovered-pawrent/src/data/hospitals.json`. The hospital-map component imports it as:

```ts
import hospitalsData from "@/data/hospitals.json";
```

This is a static JSON import, not a TypeScript module. The seed migration SQL must be written against `hospitals.json`. The fallback reference note must point to the correct filename. This is a minor but concrete error that will confuse whoever implements the task.

Fix: Replace every reference to `data/hospitals.ts` in the PRP with `data/hospitals.json`.

### 2. [Data] SQL schema is missing four fields that exist in the source data

The proposed schema defines: `id, name, address, lat, lng, phone, hours, type, created_at`.

The actual `hospitals.json` contains these fields per record:

| JSON field | SQL schema | Status |
|---|---|---|
| `id` | `id uuid` | Mismatch — source uses integer IDs (1–5); PRP upgrades to uuid, which is fine, but seed SQL must not use the JSON ids |
| `name` | `name text` | OK |
| `lat` | `lat double precision` | OK |
| `lng` | `lng double precision` | OK |
| `phone` | `phone text` | OK |
| `address` | `address text` | OK |
| `open_hours` | `hours text` | FIELD NAME MISMATCH — JSON uses `open_hours`, SQL column is `hours`; the component reads `hospital.open_hours` so either the column must be `open_hours` or the API response must map it |
| `certified` | MISSING | boolean, used for the "Certified" badge in the popup |
| `specialists` | MISSING | text array (`text[]`), rendered as specialist tags in the popup |
| `type` | present in SQL | NOT IN SOURCE DATA — the JSON has no `type` field; the DEFAULT 'hospital' covers it, but note the discrepancy |

The `certified` and `specialists` fields are actively rendered by `hospital-map.tsx`. If the database row omits them, the component will break silently — `hospital.certified` becomes undefined (falsy, badge disappears) and `hospital.specialists.length` throws a TypeError since `undefined.length` is a runtime error.

Fix: Add `certified boolean DEFAULT false` and `specialists text[] DEFAULT '{}'` to the schema. Rename the `hours` column to `open_hours` to match the JSON field name and avoid a mapping layer.

Corrected schema:

```sql
CREATE TABLE IF NOT EXISTS hospitals (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  address    text,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  phone      text,
  open_hours text,
  certified  boolean DEFAULT false,
  specialists text[] DEFAULT '{}',
  type       text DEFAULT 'hospital',
  created_at timestamptz DEFAULT now()
);
```

### 3. [Architecture] hospital-map.tsx migration strategy is unspecified and non-trivial

The PRP says "Update `app/hospital/page.tsx` to fetch from API instead of import" but the actual data consumption is entirely in `components/hospital-map.tsx`, not in `page.tsx`. The page is a thin wrapper that dynamically imports the map component with `ssr: false`.

The migration requires changes to `hospital-map.tsx`, not `page.tsx`. Specifically:

- Remove `import hospitalsData from "@/data/hospitals.json"` from the component
- Add a `useState` + `useEffect` (or SWR/fetch) to load from `/api/hospitals` on mount
- Handle loading state (a map with no markers during fetch is confusing)
- Handle fetch error state (no fallback currently exists)
- The `HospitalMarker` component uses `hospital: any` — the task is an opportunity to introduce a proper `Hospital` type in `lib/types.ts` since no `Hospital` type exists there today

The PRP also specifies no error handling strategy for when the API is unavailable. The current static import never fails; the API call can. A silent empty map is a regression.

Fix: Change the task description to target `components/hospital-map.tsx`. Add a subtask for loading/error states and a `Hospital` type definition in `lib/types.ts`.

---

## Risk Analysis

### HIGH — E2E tests against Supabase require a test environment that does not exist

The E2E test flows listed ("Create pet → view pet details → delete pet", "Create post with photo") all require a Supabase instance with real data, real auth, and real storage. The project uses localStorage-based auth (JWT stored client-side, passed as `Authorization` header). Playwright cannot authenticate through a real Supabase sign-up flow without either:

1. A dedicated test Supabase project with a seeded test user and known credentials stored in `.env.test`
2. A mock/intercept layer for Supabase calls

Neither is mentioned in the PRP. Running E2E against the production Supabase project would create test data pollution. Running without auth means all protected routes return 401 and tests fail immediately.

Mitigation: Add a subtask to establish a test environment strategy before writing any E2E tests. At minimum: document whether tests run against a test Supabase project, a local Supabase instance (`supabase start`), or use network interception (Playwright's `page.route()`).

### MEDIUM — @ducanh2912/next-pwa peer dependency covers Next.js 16

Confirmed via `npm show @ducanh2912/next-pwa peerDependencies`: the package declares `next: '>=14.0.0'` as its peer dependency, so Next.js 16.2.2 is within range. `serwist` has no Next.js peer dep constraint at all. Both options are technically compatible.

The real risk is webpack configuration. Next.js 16 ships with Turbopack as the default dev server. Both `@ducanh2912/next-pwa` and `serwist` wrap the webpack config (via `withPWA(nextConfig)`). This is incompatible with Turbopack's dev server — service worker generation only works during `next build`, not `next dev --turbo`. Developers will need to run `next dev --no-turbo` (or `next dev` with the non-turbo flag depending on project config) to test PWA behavior locally.

The PRP correctly marks PWA as investigation-only, which is the right call. Just flag the Turbopack/webpack tension in the investigation scope.

### LOW — `auth.role()` in RLS policy uses a deprecated Supabase helper

The INSERT policy uses `auth.role() = 'authenticated'`. In current Supabase versions, the preferred form is `(select auth.uid()) is not null`, which is also more robust (it works with service role keys correctly, whereas `auth.role()` can be unreliable in some auth contexts). This is a minor style issue, not a blocker.

### LOW — Integer IDs in seed data vs UUID primary key

The JSON records have integer `id` fields (1, 2, 3, 4, 5). The SQL schema uses `uuid DEFAULT gen_random_uuid()`. The seed INSERT statements must not include an `id` column (let Postgres generate the UUIDs) or must use `gen_random_uuid()` explicitly. If someone naively copies the JSON ids into the SQL they will get a type error at migration time.

---

## Missing Context

1. **No Hospital type in lib/types.ts** — The file defines types for all other Supabase tables (Pet, Vaccination, SOSAlert, etc.) but has no `Hospital` interface. Task 8.1 should add one, and `hospital-map.tsx` should replace `hospital: any` with it.

2. **No test environment specification for E2E** — The PRP assumes Playwright can run against a real environment without specifying which one or how to seed it.

3. **No `test:e2e` environment variable isolation** — If the test suite runs against the production Supabase URL, failed or partial test runs will leave orphan rows. A `.env.test` with a separate Supabase project URL is required.

4. **`app/hospital/page.tsx` vs `components/hospital-map.tsx`** — The PRP targets the wrong file for the data migration change. The page is a 27-line shell; all logic is in the map component.

5. **No API route pagination** — Task 8.1 specifies `GET /api/hospitals` but no pagination. With only 5 records this is fine today, but the RLS policy allows authenticated INSERT (user-submitted suggestions), so the table can grow. At minimum, the route should return all records with a reasonable hard limit (e.g., `LIMIT 100`) to prevent an unbounded query later.

---

## Optimization Suggestions

1. **Add `Hospital` type to `lib/types.ts` as part of task 8.1.** Every other Supabase table has a corresponding TypeScript interface. Adding it here aligns with existing patterns and eliminates the `hospital: any` cast in `hospital-map.tsx`.

2. **Use `open_hours` as the column name** (not `hours`) to match the JSON source and avoid a transformation layer in the API route or component.

3. **Seed SQL format.** Write the seed as explicit INSERT statements with all 5 records rather than a data-copying script, so the migration is self-contained and reviewable. Example:
   ```sql
   INSERT INTO hospitals (name, address, lat, lng, phone, open_hours, certified, specialists) VALUES
   ('Bangkok Animal Hospital', '123 Rama I Rd...', 13.7563, 100.5018, '02-123-4567', '24 Hours', true, ARRAY['Surgery','Dental']),
   ...
   ```

4. **E2E: start with unauthenticated flows first.** The hospital map, login page, and sign-up page are all publicly accessible. These E2E tests need no test database and provide immediate value. Authenticated flows (pets, posts, SOS) can follow once the environment strategy is settled.

5. **PWA investigation: test `serwist` first.** It is more actively maintained than `@ducanh2912/next-pwa` and has no framework peer dependency constraint. The official `@serwist/next` package has a documented Next.js integration path. Given the Turbopack concern, note explicitly that POC testing must use `next build && next start`, not `next dev`.

6. **Task ordering within 8.1.** The correct sequence is: (a) add `Hospital` type to `lib/types.ts`, (b) write and run SQL migration with seed, (c) create `GET /api/hospitals`, (d) update `hospital-map.tsx` to fetch from the API with loading/error states. The PRP's current checklist omits the type definition and targets the wrong file.

---

## Revised Confidence Score: 6/10

Original score: 7/10. Delta: -1.

The PRP is better than PRP-04's version of the same tasks — it includes SQL, proper RLS, and realistic scope. The -1 comes from:

- The schema mismatch on `open_hours`/`certified`/`specialists` would produce a runtime TypeError in the existing component the moment the JSON import is removed. This is not a theoretical risk; `hospital.specialists.length` on an undefined value throws immediately.
- The wrong file is targeted for the code change (map component vs. page component).
- E2E tests have a fundamental environment dependency that is unaddressed.

With the three critical fixes applied the score rises back to 7/10. The PWA task is appropriately scoped as investigation-only and poses no execution risk.

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0 | 2026-04-05 | Guardian | Initial validation report |
