# PRP-00: Lost & Found Strategy & Architecture

## Priority: CRITICAL

## Prerequisites: None — this is the root strategy document

## Problem

Pawrent is currently a general-purpose pet health OS with basic SOS alerting. Lost pet recovery in Thailand relies on unstructured Facebook posts, fragmented LINE groups, and a single competitor (Foundy, ~491 users) that lacks pre-registered pet profiles, real-time push alerts, and daily engagement hooks. During high-risk festivals (Loy Krathong, Songkran, New Year), pet loss spikes by hundreds of percent — yet no platform exists that combines health records, proximity broadcasting, and two-sided matching into a single daily-use app.

This PRP defines the strategic vision, competitive positioning, architecture, and phased roadmap for transforming Pawrent into the definitive pet recovery and community platform for Thailand.

---

## 1. Executive Summary

**Vision:** Build Lost & Found as an integrated feature inside a full pet health OS — not a standalone tool. When the panic moment hits, the pet's data is already there, the community is already engaged, and LINE pushes notifications automatically.

**Core Differentiator:** Two-sided matching engine powered by pre-registered pet profiles.

```
Owner loses pet  →  SOSAlert (broadcast to nearby users)
Stranger finds pet  →  FoundPetReport (broadcast to nearby owners)
System cross-matches  →  Notify both parties
```

**Target Market:** Thai pet parents (ทาสหมา / ทาสแมว) — 54M LINE users in Thailand.

**Distribution Channel:** LINE OA + LIFF (zero app-store friction, instant push notifications).

---

## 2. Competitive Analysis

### Foundy (foundy.tigerfoundationtech.co.th)

| Aspect | Foundy | Pawrent Advantage |
|--------|--------|-------------------|
| Users | ~491 total, 227 lost listings | Building daily engagement via health tracking before emergencies |
| Pet data | User fills everything at panic time | Pet profiles pre-registered with breed, photos, microchip, vaccinations |
| Notifications | Relies on manual social sharing | LINE push to nearby users automatically |
| Matching | Basic AI photo matching + breed filter | Metadata + proximity + microchip instant-match + AI image (Phase II) |
| Contact | Phone number exposed publicly | Anonymized chat bridge (PDPA-compliant) |
| Ecosystem | Standalone lost/found tool | Feature inside full pet health OS — daily-use retention |
| Company | Side project from HR software company | Pet-first platform with vet clinic data |

**Strengths to adopt from Foundy:**
- Circular pet photo markers on map (emotionally engaging)
- Reward field on lost pet alerts (incentive mechanism)
- Simpler form for finders vs owners (lower friction)
- Radius selector on map (1/3/5/10km)
- "AI will notify owner automatically" promise
- Stats as social proof on homepage

**What NOT to copy:**
- Phone number as primary contact (PDPA risk)
- No auth-gated found reports (spam risk)
- Static social sharing only (LINE push is 10x more effective)

### Petco Love Lost (petcolove.org/lost)

| Aspect | Petco Love Lost | Relevance to Pawrent |
|--------|----------------|---------------------|
| Image matching | 512 data points per image, 50% return rate | Gold standard — aim for this accuracy in Phase II |
| Partnerships | 3,000+ shelters in US | Thailand equivalent: partner with local vet clinics |
| Scale | US-focused, English-only | Thailand needs a local solution |
| Distribution | Web + Nextdoor + Ring Neighbors | LINE is Thailand's equivalent |

### Thai Facebook Groups

| Pain Point | Pawrent Solution |
|-----------|-----------------|
| Unstructured posts, no geofencing | Proximity-based push (3-5km radius) |
| No cross-matching | Automatic lost-to-found matching |
| No data persistence | Pet profiles with health records |
| City-wide groups (noisy) | Hyper-local alerts (your neighborhood) |

---

## 3. Pawrent's Structural Advantages

| Advantage | Why It Matters |
|-----------|---------------|
| **Health records = richer profiles** | Vaccinations, microchip numbers, breed data already in DB — more identifiable than a photo alone |
| **LINE is the channel** | 54M Thai users. Foundy and Facebook groups can't push real-time alerts like LINE OA can |
| **Community already exists** | Feed/post infrastructure means found-pet reports are a natural extension, not a separate app |
| **Microchip integration** | If someone finds a pet and scans the chip, Pawrent can instantly match to the owner |
| **Two-sided matching** | Lost pet → push to nearby users. Found pet → push to nearby owners. Bidirectional cross-matching. |
| **Daily engagement** | Health tracking, community feed, cultural hooks prevent users from uninstalling between emergencies |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LINE Platform                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Rich Menu│  │   LIFF   │  │ Messaging API (Push)   │ │
│  │ (4 tabs) │  │ Web App  │  │ Flex Messages, Multicast│ │
│  └────┬─────┘  └────┬─────┘  └───────────┬────────────┘ │
└───────┼──────────────┼────────────────────┼──────────────┘
        │              │                    │
        ▼              ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js 16 (App Router)                     │
│  ┌────────────────┐  ┌──────────────────────────────┐   │
│  │  LIFF Provider  │  │  API Routes                   │  │
│  │  (auth context) │  │  /api/sos, /api/found-reports │  │
│  └────────────────┘  │  /api/match, /api/alerts       │  │
│                       └──────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Pages: /sos/lost, /sos/found, /map, /matches      │  │
│  │  Components: MapPicker, AlertCard, MatchList        │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + Extensions)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ PostGIS  │  │ pgvector │  │  Auth    │  │ Realtime│ │
│  │ ST_DWithin│ │ CLIP emb │  │ LINE JWT │  │ Channels│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Tables: sos_alerts, found_reports, match_candidates│  │
│  │  conversations, messages, user_watch_zones          │  │
│  │  RPC: nearby_alerts(), cross_match(), grid_snap()   │  │
│  │  RLS: 33+ policies, fuzzy location privacy          │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Background Services                         │
│  ┌──────────────────┐  ┌───────────────────────────┐    │
│  │ DB Webhook on     │  │ LINE Push via Messaging   │    │
│  │ sos_alerts INSERT │  │ API (multicast to nearby) │    │
│  └──────────────────┘  └───────────────────────────┘    │
│  ┌──────────────────┐  ┌───────────────────────────┐    │
│  │ Match Engine      │  │ CLIP Embedding Generator  │    │
│  │ (async RPC)       │  │ (Phase II — PRP-09)       │    │
│  └──────────────────┘  └───────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Phase Definitions

### Phase I: Foundation & Emergency Core (PRP-01 through PRP-08)

**Goal:** Launch a functioning two-sided lost/found matching platform with LINE push alerts.

**Exit Criteria:**
- Users can report lost pets with location, photos, and reward
- Strangers can report found pets with anonymous option
- Nearby users receive LINE Flex Message alerts within 5km
- Attribute-based matching produces ranked candidate list
- Interactive map shows lost/found pets with radius filter
- All data PDPA-compliant with fuzzy location privacy

| PRP | Title | Priority |
|-----|-------|----------|
| 01 | LINE LIFF Foundation & Auth Migration | CRITICAL |
| 02 | LINE Rich Menu & Navigation Shell | HIGH |
| 03 | PostGIS Foundation & Geospatial Infrastructure | CRITICAL |
| 04 | Lost Pet Reporting Flow | CRITICAL |
| 05 | Found Pet / Stray Reporting Flow | HIGH |
| 06 | LINE Push Notifications & Geospatial Alerts | HIGH |
| 07 | Smart Matching Engine | HIGH |
| 08 | Interactive Map View & Discovery | MEDIUM |

### Phase II: Community Retention & Thai Culture (PRP-09 through PRP-11)

**Goal:** Add engagement hooks to prevent users from blocking the LineOA between emergencies. Build viral growth mechanics.

**Exit Criteria:**
- AI image similarity enhances matching accuracy
- Thai cultural features (Mutelu, Rainbow Bridge) drive daily engagement
- Viral quizzes produce shareable content that drives new user acquisition

| PRP | Title | Priority |
|-----|-------|----------|
| 09 | AI Image Matching & Similarity Search | MEDIUM |
| 10 | Thai Cultural Hooks — Mutelu & Rainbow Bridge | MEDIUM |
| 11 | Viral Quizzes & Shareable Result Cards | MEDIUM |

### Phase III: Commercial & Ecosystem (Backlog)

> These features are documented here for roadmap visibility. No PRPs will be created until Phase I+II are stable.

- **Epic 6: Street Eyes Network** — Motorcycle taxi/rider bounty program with 1-tap "Quick Snap" stray reporting. GPS auto-attached. Monetization: premium push to rider network.
- **Epic 7: Smart QR Collar Tags** — Physical pet ID tags with QR code. Scan opens LIFF page with pet info + silent SOS to owner. Monetization: tag sales.
- **Epic 8: 1-Click Print Toolkit** — Auto-generated A4 lost pet posters (PDF) with QR code linking to live profile. Partner print shop routing. Monetization: print commission.
- **Epic 9: Festival Mode & Micro-Insurance** — Pre-festival "Red Alert" broadcasts, profile freshness reminders, 7-day runaway/injury micro-insurance via Thai insurers. Monetization: insurance commission.
- **Epic 10: Hyper-Local B2B Ecosystem** — Local pet businesses (groomers, clinics, cafes) pay subscription for map pins + geo-targeted LINE coupons to nearby pet owners.
- **Epic 11: Found & Injured Triage** — 1-Click nearest 24h vet routing, GrabPet deep-link, community crowdfunding for stray vet bills.
- **Epic 12: Lifesaver Blood Network** — Pet blood donor registration, geofenced emergency broadcast to eligible donors.
- **Epic 13: Civic Tech & Soi Dog Management** — TNR heatmaps, rabies watch, aggressive stray alerts for runners/walkers.
- **Epic 14: Hardware Agnostic Tracking** — Digital twin tagging (AirTag/GPS collar/QR), "Hunt Party" mode for community AirTag search.
- **Epic 15: Pet Playdates** — Temperament-based matching, local meetup coordination, photo sharing.

---

## 6. Dependency Graph

```
Sprint 1 (parallel):
  PRP-01: LINE LIFF Auth        ←── CRITICAL PATH
  PRP-03: PostGIS Foundation    ←── can run in parallel (DB only)

Sprint 2:
  PRP-02: Rich Menu & Nav       (needs PRP-01)
  PRP-04: Lost Pet Reporting    (needs PRP-01 + PRP-03)

Sprint 3:
  PRP-05: Found Pet Reporting   (needs PRP-04 for shared infra)
  PRP-06: LINE Push Alerts      (needs PRP-01 + PRP-02 + PRP-03 + PRP-04)

Sprint 4:
  PRP-07: Matching Engine       (needs PRP-04 + PRP-05)
  PRP-08: Map Discovery         (needs PRP-03 + PRP-04 + PRP-05)

Sprint 5 (Phase II — all parallelizable):
  PRP-09: AI Image Matching     (needs PRP-07)
  PRP-10: Thai Cultural Hooks   (needs PRP-01 + PRP-04)
  PRP-11: Viral Quizzes         (needs PRP-01 + PRP-02)
```

**Critical path:** PRP-01 → PRP-04 → PRP-05 → PRP-07

---

## 7. PDPA Compliance Matrix

| Data Type | Collection Basis | Consent Required | Retention | Deletion |
|-----------|-----------------|-----------------|-----------|----------|
| Pet photos | Legitimate interest (pet ID) | No (service essential) | Until account deleted | CASCADE on profiles |
| GPS location (exact) | Consent | Yes — explicit opt-in | Active alert duration | Cleared on alert resolve |
| GPS location (fuzzy/grid) | Legitimate interest | No (derived, non-personal) | Indefinite | N/A |
| LINE userId | Contract (login) | No (auth essential) | Until account deleted | CASCADE on profiles |
| Found pet reporter contact | Consent | Yes — anonymized by default | Until report resolved | Auto-purge after 90 days |
| Match conversation messages | Consent | Yes — both parties | Until report resolved | Auto-purge after 90 days |
| Microchip number | Consent | Yes — owner provides | Until account deleted | CASCADE on pets |
| Push notification preference | Consent | Yes — explicit opt-in | Until changed | User-controlled |

**Key PDPA rules:**
- Never expose exact home address — use 250m grid-snapping in public APIs
- Anonymous found-pet reporting: LINE userId hashed in public views
- Contact bridge: no phone/LINE ID exchange until mutual consent
- Data export: include all lost/found reports in `/api/me/data-export`
- Breach notification: privacy@pawrent.app within 1 hour, regulator within 72 hours

---

## 8. Technical Decisions

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| PostGIS `geography` type | Spherical distance in meters, uses spatial index | Client-side Haversine (no index, slow) |
| Separate `found_reports` table | Different auth model (anonymous), different fields | Extending `sos_alerts` (would overload the table) |
| Attribute matching first (PRP-07) | 80% of value, no ML infra needed | AI-only matching (complex, costly, slow to ship) |
| pgvector for embeddings (PRP-09) | Native Supabase, no external vector DB | Pinecone/Milvus (additional infrastructure) |
| LINE push via async webhook | Non-blocking, handles viral alerts | Sync in API handler (blocks response, timeout risk) |
| Fuzzy location: 250m grid-snap | Protects privacy per PDPA, prevents stalking | Exact coords public (privacy violation) |
| Anonymized chat bridge | PDPA-compliant, prevents scams | Direct phone exposure (Foundy's approach — risky) |
| Microchip instant match | 100% confidence override, unique identifier | Treat microchip as just another weighted attribute |

---

## 9. Success Metrics

| Metric | Target (Phase I) | Target (Phase II) |
|--------|-----------------|-------------------|
| LINE OA followers | 5,000 | 25,000 |
| Weekly Active Users | 1,000 | 5,000 |
| Lost pet alerts / month | 50 | 200 |
| Found pet reports / month | 30 | 150 |
| Alert-to-match rate | 15% | 30% (with AI) |
| Time to first sighting | < 4 hours | < 2 hours |
| Quiz completion rate | — | 70% |
| Quiz share rate | — | 25% |

---

## 10. Launch Strategy (Solving the Cold Start)

1. **Do NOT launch nationwide.** Launch hyper-locally — target a specific Bangkok district (e.g., Lat Phrao, Chatuchak) or partner with 3-5 local vet clinics.
2. **Use viral quizzes (PRP-11) as Trojan Horse.** "What breed matches your soul?" drives LINE OA follows without requiring an emergency.
3. **Pre-festival campaigns.** 1 week before Loy Krathong/New Year: push "Is your pet's profile up to date?" to existing users. Run LINE ads targeting pet owners in launch area.
4. **Clinic partnerships.** Pet owners visiting clinics add LINE OA via QR poster. Their pet's health data is already in the system when an emergency happens.
5. **Community board engagement.** Non-emergency features (vet recommendations, pet meetups, cultural content) keep users active between emergencies.

---

## Confidence Score: 8/10

**Risk areas:**
- LIFF ↔ Supabase JWT exchange is the hardest technical integration (PRP-01 PoC first)
- LINE push message quota (500 free/month) limits broadcast reach before paid tier
- Cold start: proximity alerts useless without user density in target area
- AI image matching (PRP-09) accuracy for Thai mixed breeds (พันทาง) is unproven

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-09 | Initial strategy — competitive analysis, architecture, phase definitions, PDPA matrix |
