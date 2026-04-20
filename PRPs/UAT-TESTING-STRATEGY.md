# Manual UAT Testing Strategy — Local Development

**Scope:** UAT-04.1-04.2-05 + UAT-06-12
**Branches:** `feature/prp-04.1-04.2-05-combined`, `feature/prp-06-line-push-alerts`, `feature/prp-12-pet-health-passport`
**Date:** 2026-04-15

---

## Branch Merge Order & Per-Branch Testing

### Why merge one-by-one?

Merging all 5 branches at once makes it hard to isolate which branch broke something. Instead, merge incrementally into `main`, testing each branch's UAT cases before moving to the next.

### Dependency Analysis

| Branch | DB Migration | Depends On | Touches |
|---|---|---|---|
| **PRP-04.1** poster-share-card | None | `pet_reports` (existing) | `app/api/poster/`, `app/api/share-card/`, `app/post/[id]/` |
| **PRP-04.2** voice-recording | None | `pet_reports` (existing) | `app/api/voice/`, `app/post/lost/`, `lib/validations/pet-report.ts` |
| **PRP-05** found-pet-reporting | `20260414000006` | `pet_reports`, `profiles` (existing) | `app/api/found-reports/`, `app/api/sightings/`, `app/api/conversations/`, `app/post/found/`, `app/post/page.tsx` |
| **PRP-06** line-push-alerts | `20260414100001` | `pet_reports`, `profiles` (existing) | `app/api/alerts/push/`, `lib/line-templates/`, `lib/line-messaging.ts` |
| **PRP-12** pet-health-passport | `20260414100000` | `pets`, `profiles` (existing) | `app/api/cron/`, `app/api/pet-weight/`, `app/pets/[id]/passport/` |

**Key finding:** No branch depends on another branch's code or tables. They all depend only on pre-existing tables (`pet_reports`, `profiles`, `pets`). The barrel exports (`lib/types/index.ts`, `lib/validations/index.ts`) each add unique entries — no conflicts.

### Recommended Merge Sequence

```
main ← PRP-04.1 ← PRP-04.2 ← PRP-05 ← PRP-12 ← PRP-06
       (poster)   (voice)    (found)   (passport)  (push)
```

#### Step 1: `feature/prp-04.1-poster-share-card` → main

**Why first:** No DB migration, no dependencies, simplest change. Adds poster PDF + share card JPEG generation. Quick to validate.

**Manual tests to run:**
- UAT-04.1-05 **Test 2** (all sub-items) — poster generation, JPEG download, non-owner hiding
- UAT-04.1-05 **Test 12.1, 12.2** — Thai text rendering in PDF/JPEG
- UAT-04.1-05 **Test 8.2, 8.3** — PDPA phone opt-in/opt-out on poster

**How to test:** Create a lost alert (or use an existing one) → go to `/post/[id]` → tap poster/share card buttons → inspect downloaded files.

**Merge gate:** Poster PDF has correct Thai text, QR code, phone number logic. JPEG is sharp at 1080x1350.

---

#### Step 2: `feature/prp-04.2-voice-recording` → main

**Why second:** No DB migration. Adds voice recording step to lost wizard. PRP-04.1 being already merged means you can test the full flow: record voice → submit → generate poster (cross-feature Test 11.1).

**Manual tests to run:**
- UAT-04.1-05 **Test 1** (all sub-items) — voice recording wizard step
- UAT-04.1-05 **Test 14** — voice playback for finders (Account B)
- UAT-04.1-05 **Test 11.1** — voice + poster cross-feature
- UAT-04.1-05 **Test 9.1** — voice in LIFF WebView (LINE app)
- UAT-04.1-05 **Test 7.1** — auto-stop at 30 seconds
- UAT-04.1-05 **Test 8.1** — PDPA voice consent gate

**How to test:** `/post/lost` → go through wizard → Step 3 is voice → record/playback/re-record → submit → verify on detail page.

**Merge gate:** Voice records/plays/downloads correctly. Consent gate blocks upload without checkbox. Auto-stop at 30s works.

---

#### Step 3: `feature/prp-05-found-pet-reporting` → main

**Why third:** First branch with a DB migration (`found_reports`, `pet_sightings`, `conversations`, `messages`). Adds the "found pet" counterpart. With 04.1+04.2 already merged, you can test the complete lost+found ecosystem.

**Run migration first:** `supabase db push` or apply `20260414000006_found_reports_tables.sql`

**Manual tests to run:**
- UAT-04.1-05 **Test 3** (all) — found pet report form
- UAT-04.1-05 **Test 4** (all) — community hub found tab
- UAT-04.1-05 **Test 5** (all) — contact bridge chat (2 accounts)
- UAT-04.1-05 **Test 13** (all) — sighting reports
- UAT-04.1-05 **Test 15** (all) — found report detail page
- UAT-04.1-05 **Test 7.3, 7.4** — minimal found report, unauth access
- UAT-04.1-05 **Test 8.4** — secret detail hidden from public
- UAT-04.1-05 **Test 16.2** — found wizard back navigation
- UAT-04.1-05 **Test 17** — infinite scroll on found tab
- UAT-04.1-05 **Test 18** — DB migration verification
- UAT-04.1-05 **Test 19** — Supabase storage (photos)
- UAT-04.1-05 **Test 20** — URL sharing / deep links

**Also re-test (regression):**
- UAT-04.1-05 **Test 6** — all regression checks (existing features still work)
- UAT-04.1-05 **Test 11.2** — found tab → detail → back preserves tab

**Merge gate:** Found reports create/display correctly. Contact bridge works between 2 accounts. Sightings submit. Secret detail is hidden. Community hub shows both lost+found tabs.

---

#### Step 4: `feature/prp-12-pet-health-passport` → main

**Why fourth (before PRP-06):** PRP-12 is fully self-contained (pet health features only). Its migration (`20260414100000`) adds `pet_milestones`, `health_reminders`, `pet_weight_logs` — none depend on found_reports or push_logs. Testing it before PRP-06 means if push tests fail, you know it's PRP-06, not PRP-12.

**Run migration:** `supabase db push` or apply `20260414100000_pet_health_passport.sql`

**Manual tests to run:**
- UAT-06-12 **Test 7** — passport access control (own pet vs other's pet)
- UAT-06-12 **Test 8** — weight tracking (add, validation)
- UAT-06-12 **Test 9** — milestone timeline (add custom)
- UAT-06-12 **Test 10** — dismiss reminder
- UAT-06-12 **Test 11** — DB triggers (vaccination → auto-reminder, DOB → milestone)
- UAT-06-12 **Test 12** — health reminder cron (`curl /api/cron/health-reminders`)
- UAT-06-12 **Test 13** — birthday celebration cron (`curl /api/cron/celebrations`)
- UAT-06-12 **Test 14** — OG image (`/api/og/passport/[petId]`)
- UAT-06-12 **Test 16** — DB integrity (RLS, CASCADE, indexes)
- UAT-06-12 **Test 17** — PDPA data export (includes new health tables)

**Also test LINE messages (needs public URL):**
- UAT-06-12 **Test 12** — health reminder LINE message on phone
- UAT-06-12 **Test 13** — birthday/gotcha-day LINE message on phone

**Merge gate:** Passport page loads with all sections. Weight chart renders. Milestones display. DB triggers auto-create reminders. Cron endpoints send correct LINE messages. RLS blocks cross-user access.

---

#### Step 5: `feature/prp-06-line-push-alerts` → main

**Why last:** Push alerts are the most complex to test (require public URL, Supabase webhook, 2 phones, profile config in DB). By merging last, all the features that *generate* alerts (lost reports, found reports, sightings) are already in place — you can test the full end-to-end: report a pet → push fires → recipient taps → sees detail page.

**Run migration:** `supabase db push` or apply `20260414100001_push_notifications.sql`

**Setup required:**
1. Configure Tester B's profile in Supabase (radius, species filter, home_geog, quiet hours)
2. Create Supabase Database Webhook: `pet_reports` INSERT → POST to `/api/alerts/push`
3. Expose localhost via ngrok/cloudflared OR deploy to Vercel preview

**Manual tests to run:**
- UAT-06-12 **Test 1** — lost pet push (Phone B gets red Flex Message)
- UAT-06-12 **Test 2** — found pet push (Phone A gets green Flex Message)
- UAT-06-12 **Test 3** — species filter (dog-only → no cat alerts)
- UAT-06-12 **Test 4** — quiet hours (no push during quiet window)
- UAT-06-12 **Test 5** — radius boundary (1km vs 18km)
- UAT-06-12 **Test 6** — push logs PDPA (no PII in columns)
- UAT-06-12 **Test 15** — Vercel cron config (2 jobs active)
- UAT-06-12 **Test 18** — Thai language in LINE messages
- UAT-06-12 **Test 19** — regression smoke test

**Merge gate:** Push messages deliver to correct recipients based on distance/species/quiet hours. Push logs contain no PII. Flex Messages render correctly with Thai text on iOS/Android.

---

### Quick Reference: Merge Checklist

```
[ ] Step 1: PRP-04.1 → main
    [ ] Tests: 2, 8.2, 8.3, 12.1, 12.2
    [ ] npm run test && npm run test:e2e && npm run type-check
    [ ] Merge PR

[ ] Step 2: PRP-04.2 → main
    [ ] Tests: 1, 7.1, 8.1, 9.1, 11.1, 14
    [ ] npm run test && npm run test:e2e && npm run type-check
    [ ] Merge PR

[ ] Step 3: PRP-05 → main
    [ ] supabase db push (migration 20260414000006)
    [ ] Tests: 3, 4, 5, 6, 7.3, 7.4, 8.4, 13, 15, 16.2, 17, 18, 19, 20
    [ ] npm run test && npm run test:e2e && npm run type-check
    [ ] Merge PR

[ ] Step 4: PRP-12 → main
    [ ] supabase db push (migration 20260414100000)
    [ ] Tests: 7-14, 16, 17 (UAT-06-12 numbering)
    [ ] npm run test && npm run test:e2e && npm run type-check
    [ ] Merge PR

[ ] Step 5: PRP-06 → main
    [ ] supabase db push (migration 20260414100001)
    [ ] Setup: ngrok + Supabase webhook + Tester B profile
    [ ] Tests: 1-6, 15, 18, 19 (UAT-06-12 numbering)
    [ ] npm run test && npm run test:e2e && npm run type-check
    [ ] Merge PR
```

---

## Core Insight: Rich Menu = Direct URL Navigation

The Rich Menu buttons map exactly to app routes:

| Rich Menu Button | Opens LIFF URL | Equivalent Local URL |
|---|---|---|
| หน้าหลัก (Home) | `liff.line.me/{LIFF_ID}/` | `localhost:3000/` |
| ชุมชน (Community) | `liff.line.me/{LIFF_ID}/post` | `localhost:3000/post` |
| สัตว์เลี้ยง (Pets) | `liff.line.me/{LIFF_ID}/pets` | `localhost:3000/pets` |
| โปรไฟล์ (Profile) | `liff.line.me/{LIFF_ID}/profile` | `localhost:3000/profile` |

**Tapping a Rich Menu button = navigating to that URL.** The only difference is the LIFF WebView environment (which affects mic access, download behavior, and the `isInLiff` flag that hides the bottom nav bar).

So for ~70% of test cases, you can test locally in a browser by navigating directly to routes — no LINE app needed.

---

## How Auth Works Locally

The app uses **client-side auth only** (no server middleware blocking routes). The `LiffProvider`:

1. Calls `liff.init()` → checks for LIFF context
2. If in browser (not LIFF): triggers `liffLogin()` → redirects to LINE OAuth
3. After LINE login: exchanges ID token at `/api/auth/line` → gets Supabase JWT
4. JWT stored **in-memory** (lost on page refresh)

**For local browser testing:** Navigate to `http://localhost:3000/` → you'll be redirected to LINE login → authorize → returned to app with auth. After that, navigate directly to any route.

**For 2-account testing:** Use the main browser for Account A, and an incognito/private window for Account B (separate LINE login).

---

## Test Classification: 3 Tiers

### Tier 1: Browser-Only (Direct URL Navigation)

These simulate Rich Menu taps — navigating directly to the route is functionally identical.

| UAT-04.1/04.2/05 Section | Route to Open | Notes |
|---|---|---|
| **Test 1** Voice Recording Wizard | `/post/lost` | Full wizard works in browser |
| **Test 2** Poster & Share Card | `/post/[id]` (alert detail) | PDF/JPEG download works in any browser |
| **Test 3** Found Pet Report | `/post/found` | Full form works in browser |
| **Test 4** Community Hub Found Tab | `/post` | Tab switching, cards, navigation |
| **Test 5** Contact Bridge | `/conversations` | 2-account: browser + incognito |
| **Test 6** Regression (except 6.3) | `/post`, `/profile`, `/pets` | All navigable directly |
| **Test 7** Edge Cases | `/post/lost`, `/post/found` | Browser works fine |
| **Test 8** PDPA | Various | All testable in browser |
| **Test 10.1** Offline poster | `/post/[id]` | Disconnect WiFi test |
| **Test 11** Cross-Feature | Various | Browser works |
| **Test 12** Thai Text | Poster/JPEG inspection | Download and inspect files |
| **Test 13** Sighting Reports | `/post/[id]` | 2-account test |
| **Test 14** Voice Playback | `/post/[id]` | Play/download audio |
| **Test 15** Found Report Detail | `/post/found/[id]` | Owner vs non-owner views |
| **Test 16** Wizard Navigation | `/post/lost`, `/post/found` | Back button behavior |
| **Test 17** Infinite Scroll | `/post` | Scroll pagination |
| **Test 20** URL Sharing (except 20.3, 20.4) | Various URLs in incognito | Public access test |

| UAT-06-12 Section | Route to Open | Notes |
|---|---|---|
| **Test 7** Passport Access Control | `/pets/[id]/passport` | Auth + 404 tests |
| **Test 8** Weight Tracking | `/pets/[id]/passport` | Add weight, validation |
| **Test 9** Milestone Timeline | `/pets/[id]/passport` | Add milestone |
| **Test 10** Dismiss Reminder | `/pets/[id]/passport` | Dismiss flow |
| **Test 14** OG Image | `/api/og/passport/[petId]` | Direct browser/curl |
| **Test 19** Regression | Various | Quick smoke test |

### Tier 2: LINE App Required (Cannot Simulate in Browser)

These test LINE-specific behavior that browsers cannot replicate.

| UAT-04.1/04.2/05 Section | Why LINE Required |
|---|---|
| **Test 6.3** Rich Menu navigation | Tests actual Rich Menu button taps on phone |
| **Test 9.1** Voice in LIFF WebView | Tests mic permission inside LINE's browser |
| **Test 9.2** Poster download in LIFF | Tests file download inside LINE's browser |
| **Test 9.3** JPEG share via LINE | Tests LINE share flow on phone |
| **Test 9.4** GPS in LIFF | Tests location permission inside LINE's browser |
| **Test 20.3** QR code scan | Physical QR scan from poster |
| **Test 20.4** Share via LINE | Tests LINE share target picker |

| UAT-06-12 Section | Why LINE Required |
|---|---|
| **Test 1** Lost Pet Push | Verifies LINE Flex Message received on Phone B |
| **Test 2** Found Pet Push | Verifies green Flex Message on Phone A |
| **Test 3** Species Filter | Verifies message NOT received (dog-only filter) |
| **Test 4** Quiet Hours | Verifies message NOT received during quiet hours |
| **Test 5** Radius Boundary | Verifies distance filtering works on phone |
| **Test 12** Health Reminder Cron | Verifies LINE message with pet name + CTA |
| **Test 13** Birthday Celebration | Verifies LINE message with photo carousel |
| **Test 18** Thai Language in LINE | Verifies Thai rendering on iOS/Android |

### Tier 3: Supabase Dashboard / External Tools Required

These need direct database access or external dashboard, not the app UI.

| Section | Tool Needed | What to Check |
|---|---|---|
| **04.1-05 Test 18** DB Migration | Supabase Studio | Table existence, geo-sync trigger, CASCADE |
| **04.1-05 Test 19** Supabase Storage | Supabase Studio | Bucket files, public URLs, write protection |
| **06-12 Test 6** Push Logs PDPA | Supabase Studio | Column inspection (no PII) |
| **06-12 Test 11** DB Triggers | Supabase Studio | Insert vaccination → check auto-reminder |
| **06-12 Test 15** Vercel Cron Config | Vercel Dashboard | Two cron jobs listed and active |
| **06-12 Test 16** DB Integrity | Supabase SQL Editor | RLS queries, CASCADE, indexes |
| **06-12 Test 17** PDPA Data Export | Terminal (curl) | curl the export API |

---

## Recommended Execution Sequence

### Phase 1: Setup (15 min)

1. Confirm `feature/prp-04.1-04.2-05-combined` has all 3 feature branches merged
2. `npm run dev` on that branch
3. Open browser → `http://localhost:3000` → complete LINE login as **Account A**
4. Open incognito window → login as **Account B**
5. Ensure Account A has pet **"บัดดี้"** registered (species: สุนัข)

### Phase 2: UAT-04.1/04.2/05 — Browser Tests (60-90 min)

**Run in this order** — later tests depend on data created by earlier ones:

| # | Test | Creates Data For | Route |
|---|---|---|---|
| 1 | **Test 1** Voice Recording Wizard | Tests 2, 11, 14 | `/post/lost` |
| 2 | **Test 2** Poster & Share Card | Test 12 (inspect files) | `/post/[id]` |
| 3 | **Test 3** Found Pet Report | Tests 4, 5, 15 | `/post/found` |
| 4 | **Test 4** Community Hub Found Tab | — | `/post` |
| 5 | **Test 13** Sighting Reports (Account B) | — | `/post/[id]` |
| 6 | **Test 14** Voice Playback (Account B) | — | `/post/[id]` |
| 7 | **Test 15** Found Report Detail | — | `/post/found/[id]` |
| 8 | **Test 5** Contact Bridge (both accounts) | — | `/conversations` |
| 9 | **Test 16** Wizard Navigation | — | `/post/lost`, `/post/found` |
| 10 | **Test 12** Thai Text Rendering | — | Inspect downloaded PDF/JPEG |
| 11 | **Test 11** Cross-Feature Interaction | — | Various |
| 12 | **Test 6** Regression (skip 6.3) | — | `/post`, `/profile`, `/pets` |
| 13 | **Test 7** Edge Cases | — | `/post/lost`, `/post/found` |
| 14 | **Test 8** PDPA Compliance | — | Various |
| 15 | **Test 20** URL Sharing (skip 20.3, 20.4) | — | Incognito windows |
| 16 | **Test 17** Infinite Scroll | — | `/post` |
| 17 | **Test 10.1** Offline poster (last — needs network off) | — | `/post/[id]` |

### Phase 3: UAT-04.1/04.2/05 — LINE App Tests (30 min)

Switch to phone with LINE app. These need the LIFF WebView environment:

1. **Test 9.1** — Voice recording in LIFF WebView
2. **Test 9.2** — Poster download in LIFF
3. **Test 9.3** — JPEG share card via LINE chat
4. **Test 9.4** — GPS permission in found report
5. **Test 6.3** — Rich Menu navigation (all 4 buttons)
6. **Test 20.3** — QR code scan from printed poster
7. **Test 20.4** — Share via LINE target picker

### Phase 4: UAT-04.1/04.2/05 — Supabase Tests (20 min)

Open Supabase Studio:

1. **Test 18** — Verify tables: `found_reports`, `pet_sightings`, `conversations`, `messages`
2. **Test 18.3** — Insert found_report with lat/lng → verify `geog` auto-populated
3. **Test 18.4** — Delete pet_reports row → verify CASCADE to pet_sightings
4. **Test 19** — Check storage buckets: voice-recordings, photos

### Phase 5: Switch to PRP-06/12 (10 min)

```bash
# Stop dev server
# Option A: If combined branch exists
git checkout feature/prp-06-12-combined

# Option B: Create a test branch merging both
git checkout -b test/uat-prp-06-12 main
git merge feature/prp-06-line-push-alerts
git merge feature/prp-12-pet-health-passport

npm install && npm run dev
```

### Phase 6: UAT-06-12 — Browser Tests (30 min)

1. **Test 7** — Passport access control: own pet loads, other's pet → 404/redirect
2. **Test 8** — Weight tracking: add 12.5kg, try 0kg (error), try 250kg (error)
3. **Test 9** — Milestone timeline: add custom milestone
4. **Test 10** — Dismiss reminder (create one in Supabase first if needed)
5. **Test 14** — OG image: open `/api/og/passport/[petId]` directly
6. **Test 19** — Regression smoke test: create alert, add vaccination, add parasite log

### Phase 7: UAT-06-12 — Supabase + Curl Tests (30 min)

1. **Test 11a** — Insert vaccination with `next_due_date` → verify auto-created `health_reminders` row
2. **Test 11b** — Set `date_of_birth` on pet → verify auto-created `pet_milestones` row
3. **Test 16a** — RLS: switch to `anon` role, SELECT from health tables → 0 rows
4. **Test 16b** — CASCADE: delete test pet → verify milestones/reminders/weight_logs gone
5. **Test 16c** — Check indexes exist: `idx_profiles_home_geog`, `idx_health_reminders_due`, etc.
6. **Test 6** — Push logs PDPA: verify only `id, alert_id, alert_type, recipient_count, sent_at` columns
7. **Test 17** — curl data export API → verify `pet_milestones`, `health_reminders`, `pet_weight_logs` in response
8. **Test 15** — Vercel Dashboard: verify 2 cron jobs active

### Phase 8: UAT-06-12 — LINE Push Tests (45 min)

> **Requires public URL.** Choose one:
> - **Option A:** `ngrok http 3000` — expose localhost via tunnel
> - **Option B:** Deploy to Vercel preview — push branch, use preview URL
> - **Option C:** Manual curl to `/api/alerts/push` — tests handler logic without webhook

**Prerequisite:** Configure Tester B's profile in Supabase:
```sql
UPDATE profiles SET
  notification_radius_km = 5,
  push_species_filter = '{dog,cat}',
  push_quiet_start = NULL,
  push_quiet_end = NULL,
  home_geog = ST_SetSRID(ST_MakePoint(100.5018, 13.7563), 4326)::geography
WHERE line_display_name = 'Tester B';
```

Then configure Supabase Database Webhook pointing to your public URL's `/api/alerts/push`.

**Test sequence:**

| # | Test | Action | Expected on Phone |
|---|---|---|---|
| 1 | **Test 1** Lost Pet Push | Report lost pet near Siam (Account A) | Phone B: red Flex Message |
| 2 | **Test 2** Found Pet Push | Report found pet near Siam (Account B) | Phone A: green Flex Message |
| 3 | **Test 3** Species Filter | Set B to dog-only, report lost cat | Phone B: NO message |
| 4 | | Reset B to dog+cat, report lost dog | Phone B: message received |
| 5 | **Test 4** Quiet Hours | Set quiet hours covering now, report | Phone B: NO message |
| 6 | | Set quiet hours NOT covering now, report | Phone B: message received |
| 7 | **Test 5** Radius | Set B to 1km, report at Don Mueang (18km away) | Phone B: NO message |
| 8 | | Report at Siam Paragon (0.5km away) | Phone B: message received |

**Cron tests** (can curl localhost or public URL):

```bash
# Test 12: Health Reminder
curl -X POST -H "Authorization: Bearer {CRON_SECRET}" http://localhost:3000/api/cron/health-reminders

# Test 13: Birthday Celebration
curl -X POST -H "Authorization: Bearer {CRON_SECRET}" http://localhost:3000/api/cron/celebrations
```

9. **Test 12** — Prepare reminder row → curl cron → verify LINE message on Phone A
10. **Test 13** — Set pet birthday to today → curl cron → verify birthday message
11. **Test 18** — Review all received LINE messages for Thai text rendering

---

## Summary

| Phase | Tier | Est. Time | Environment |
|---|---|---|---|
| Phase 2: UAT-04.1/04.2/05 Browser | Tier 1 | 60-90 min | Browser + incognito |
| Phase 3: UAT-04.1/04.2/05 LINE | Tier 2 | 30 min | Phone + LINE app |
| Phase 4: UAT-04.1/04.2/05 Supabase | Tier 3 | 20 min | Supabase Studio |
| Phase 6: UAT-06-12 Browser | Tier 1 | 30 min | Browser + incognito |
| Phase 7: UAT-06-12 Supabase/Curl | Tier 3 | 30 min | Supabase Studio + terminal |
| Phase 8: UAT-06-12 LINE Push | Tier 2 | 45 min | Phone + public URL |
| **Total** | | **~4-5 hours** | |

**Tip:** Run all Tier 1 (browser) tests first across both UAT checklists, then batch all Tier 2 (LINE app) tests together, then all Tier 3 (Supabase) tests. This minimizes context-switching between environments.
