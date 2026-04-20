# PRP-15: Community Feeds — Breed-Tagged Social Feed

## Priority: MEDIUM

## Prerequisites: PRP-01 (LINE auth), PRP-14 (social engagement layer)

## Problem

After a pet parent uses the lost/found system, they have no reason to return to Pawrent daily. Thai pet communities thrive on breed-specific social media — Facebook groups like "British Shorthair Thailand" and "French Bulldog Lovers TH" have hundreds of thousands of members sharing photos, advice, and stories. Pawrent has no equivalent social feed.

By creating a **system-suggested social feed** (similar to Facebook's algorithm-curated feed), pet parents can share breed-specific content without explicitly "joining" communities. The feed auto-curates based on the user's registered pets — register a British Shorthair, and your feed surfaces British Shorthair content alongside general pet posts. Zero friction, maximum relevance.

---

## Scope

**In scope:**

- System-managed breed/species feed tags (pre-seeded from breed data)
- Community posts: text + optional image, auto-tagged by breed via pet selection
- Personalized feed algorithm (breed match + species + recency + engagement + proximity)
- Browse-by-breed tag pages
- Trending posts view (cross-breed viral content)
- "Post as [Pet Name]" flow — select pet, breed auto-tags

**Out of scope:**

- User-created communities or groups (not in this phase)
- Community moderation tools (deferred — Phase III)
- Direct messaging within communities (exists in PRP-05 contact bridge)
- Push notifications for feed activity (PRP-11)
- Pet-friendly places map (PRP-13 — separate concern)

---

## Tasks

### 15.1 Database Migration — Feed Tags + Community Posts

- [ ] Create `feed_tags` table — system-managed breed/species tags
- [ ] Create `community_posts` table — tagged social posts
- [ ] RLS policies on both tables
- [ ] Indexes for feed queries

```sql
-- FEED TAGS (system-managed, not user-created)
CREATE TABLE IF NOT EXISTS feed_tags (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name_th     text NOT NULL CHECK (char_length(name_th) <= 200),
  name_en     text CHECK (char_length(name_en) <= 200),
  species     text NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
  breed       text,  -- NULL = species-wide tag (e.g., "all dogs")
  icon_url    text,
  post_count  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_feed_tags_species_breed ON feed_tags(species, breed);
CREATE INDEX idx_feed_tags_slug ON feed_tags(slug);

ALTER TABLE feed_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view feed tags" ON feed_tags FOR SELECT USING (true);
-- Only system/admin can create tags (no INSERT policy for regular users)

-- COMMUNITY POSTS (breed-tagged social posts)
CREATE TABLE IF NOT EXISTS community_posts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id          uuid REFERENCES pets(id) ON DELETE SET NULL,
  content         text CHECK (char_length(content) <= 2000),
  image_url       text,  -- optional (text-only posts allowed)
  species         text NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
  breed           text,  -- nullable, for feed matching
  lat             double precision,  -- optional, for proximity feed
  lng             double precision,
  geog            extensions.geography(Point, 4326),
  reactions_count int DEFAULT 0,
  comments_count  int DEFAULT 0,
  shares_count    int DEFAULT 0,
  is_pinned       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_community_posts_feed ON community_posts(species, breed, created_at DESC);
CREATE INDEX idx_community_posts_user ON community_posts(user_id);
CREATE INDEX idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_geog ON community_posts USING GIST(geog);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view community posts" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated can post" ON community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can update own posts" ON community_posts FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Authors can delete own posts" ON community_posts FOR DELETE
  USING (auth.uid() = user_id);
```

### 15.2 Seed Feed Tags

- [ ] Create seed migration with top Thai breed tags
- [ ] Include species-wide tags ("All Dogs", "All Cats")
- [ ] Thai + English names for each tag

```sql
-- Seed top Thai dog breeds
INSERT INTO feed_tags (slug, name_th, name_en, species, breed) VALUES
  ('all-dogs', 'สุนัขทั้งหมด', 'All Dogs', 'dog', NULL),
  ('french-bulldog', 'เฟรนช์บูลด็อก', 'French Bulldog', 'dog', 'French Bulldog'),
  ('pomeranian', 'ปอมเมอเรเนียน', 'Pomeranian', 'dog', 'Pomeranian'),
  ('chihuahua', 'ชิวาวา', 'Chihuahua', 'dog', 'Chihuahua'),
  ('shih-tzu', 'ชิห์สุ', 'Shih Tzu', 'dog', 'Shih Tzu'),
  ('golden-retriever', 'โกลเด้นรีทรีฟเวอร์', 'Golden Retriever', 'dog', 'Golden Retriever'),
  ('poodle', 'พุดเดิ้ล', 'Poodle', 'dog', 'Poodle'),
  ('corgi', 'คอร์กี้', 'Corgi', 'dog', 'Corgi'),
  ('siberian-husky', 'ไซบีเรียนฮัสกี้', 'Siberian Husky', 'dog', 'Siberian Husky'),
  ('bangkaew', 'บางแก้ว', 'Bangkaew', 'dog', 'Bangkaew'),
  ('thai-ridgeback', 'ไทยหลังอาน', 'Thai Ridgeback', 'dog', 'Thai Ridgeback');

-- Seed top Thai cat breeds
INSERT INTO feed_tags (slug, name_th, name_en, species, breed) VALUES
  ('all-cats', 'แมวทั้งหมด', 'All Cats', 'cat', NULL),
  ('british-shorthair', 'บริติชชอร์ตแฮร์', 'British Shorthair', 'cat', 'British Shorthair'),
  ('scottish-fold', 'สก๊อตติชโฟลด์', 'Scottish Fold', 'cat', 'Scottish Fold'),
  ('persian', 'เปอร์เซีย', 'Persian', 'cat', 'Persian'),
  ('siamese', 'วิเชียรมาศ', 'Siamese', 'cat', 'Siamese'),
  ('maine-coon', 'เมนคูน', 'Maine Coon', 'cat', 'Maine Coon'),
  ('ragdoll', 'แร็กดอลล์', 'Ragdoll', 'cat', 'Ragdoll'),
  ('munchkin', 'มันช์กิน', 'Munchkin', 'cat', 'Munchkin'),
  ('exotic-shorthair', 'เอ็กโซติกชอร์ตแฮร์', 'Exotic Shorthair', 'cat', 'Exotic Shorthair'),
  ('korat', 'โคราช', 'Korat', 'cat', 'Korat'),
  ('khao-manee', 'ขาวมณี', 'Khao Manee', 'cat', 'Khao Manee');
```

### 15.3 Personalized Feed RPC

- [ ] Create `get_personalized_feed()` RPC — returns posts matching user's pets' breeds
- [ ] Scoring: breed_match (3x) > species_match (2x) > recency > engagement
- [ ] Cursor pagination
- [ ] Include posts from followed users (PRP-14 follows) with boost

```sql
CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_cursor timestamptz DEFAULT now(),
  p_limit int DEFAULT 20
)
RETURNS SETOF community_posts AS $$
  WITH user_pets AS (
    SELECT DISTINCT species, breed
    FROM pets
    WHERE owner_id = auth.uid()
  )
  SELECT cp.*
  FROM community_posts cp
  LEFT JOIN user_pets up ON (
    cp.species = up.species
    AND (cp.breed = up.breed OR up.breed IS NULL)
  )
  WHERE cp.created_at < p_cursor
  ORDER BY
    -- Breed match gets highest priority
    CASE WHEN up.breed IS NOT NULL AND cp.breed = up.breed THEN 0
         WHEN up.species IS NOT NULL THEN 1
         ELSE 2
    END,
    -- Then by recency
    cp.created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;
```

### 15.4 Trending Feed RPC

- [ ] Create `get_trending_feed()` RPC — cross-breed viral posts
- [ ] Score by reactions + comments + shares in last 24-48 hours
- [ ] Cursor pagination

```sql
CREATE OR REPLACE FUNCTION get_trending_feed(
  p_cursor timestamptz DEFAULT now(),
  p_limit int DEFAULT 20
)
RETURNS SETOF community_posts AS $$
  SELECT *
  FROM community_posts
  WHERE created_at > now() - interval '48 hours'
    AND created_at < p_cursor
  ORDER BY (reactions_count + comments_count * 2 + shares_count * 3) DESC,
           created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;
```

### 15.5 TypeScript Types

- [ ] Create `lib/types/community.ts` — FeedTag, CommunityPost interfaces
- [ ] Export from `lib/types/index.ts` barrel

```typescript
// lib/types/community.ts

export interface FeedTag {
  id: string;
  slug: string;
  name_th: string;
  name_en: string | null;
  species: "dog" | "cat" | "other";
  breed: string | null;
  icon_url: string | null;
  post_count: number;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  pet_id: string | null;
  content: string | null;
  image_url: string | null;
  species: "dog" | "cat" | "other";
  breed: string | null;
  lat: number | null;
  lng: number | null;
  reactions_count: number;
  comments_count: number;
  shares_count: number;
  is_pinned: boolean;
  created_at: string;
  // Joined fields
  profiles?: { full_name: string | null; avatar_url: string | null };
  pets?: { name: string; breed: string | null; avatar_url: string | null };
}
```

### 15.6 Zod Validations

- [ ] Create `lib/validations/community.ts` — communityPostSchema
- [ ] Export from `lib/validations/index.ts` barrel

```typescript
// lib/validations/community.ts
import { z } from "zod";

export const communityPostSchema = z.object({
  pet_id: z.string().uuid().optional(),
  content: z.string().min(1).max(2000),
  image_url: z.string().url().optional(),
  // species + breed auto-derived from pet_id, or explicitly set
  species: z.enum(["dog", "cat", "other"]).optional(),
  breed: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
```

### 15.7 API Routes

- [ ] `app/api/feed/route.ts` — GET personalized feed (cursor paginated)
- [ ] `app/api/feed/trending/route.ts` — GET trending posts
- [ ] `app/api/feed/breed/[slug]/route.ts` — GET posts by breed tag
- [ ] `app/api/feed/posts/route.ts` — POST create community post
- [ ] `app/api/feed/tags/route.ts` — GET list all feed tags with counts

All routes follow auth → rate-limit → validate → query pattern.

Rate limits:

- Feed reads: 60/min
- Post creation: 10/min
- Tag list: 30/min

### 15.8 Feed Page — Personalized Social Feed

- [ ] Create `app/feed/page.tsx` — main feed page
- [ ] Tab navigation: "For You" (personalized) | "Trending" | "Lost & Found" (pet_reports)
- [ ] Breed tag filter chips (horizontal scroll, based on user's pets)
- [ ] Infinite scroll with cursor pagination
- [ ] Each post card shows: author avatar + name, pet avatar + breed badge, content, image, engagement bar (reactions/comments/shares via PRP-14 components)
- [ ] Floating "+" button for new post

### 15.9 Breed Tag Page

- [ ] Create `app/feed/breed/[slug]/page.tsx` — browse all posts for a breed
- [ ] Header with breed icon, name (Thai), member count approximation
- [ ] Same post card layout as main feed
- [ ] Sort: Recent (default) | Popular

### 15.10 Create Community Post Flow

- [ ] Create `app/feed/post/page.tsx` — post creation page
- [ ] Step 1: Select pet (dropdown of user's pets) — auto-fills species + breed
- [ ] Step 2: Write content (textarea, max 2000 chars)
- [ ] Step 3: Optional photo upload (reuse existing upload pattern)
- [ ] Step 4: Optional location tag (use existing GPS/map components)
- [ ] Submit → redirect to feed

### 15.11 Wire PRP-14 Social Engagement

- [ ] Add ReactionButton (like/paw variants) to community post cards
- [ ] Add CommentSheet to community post cards
- [ ] Add ShareSheet to community post cards
- [ ] Engagement works via `target_type = 'community_post'`

### 15.12 Profile Integration

- [ ] Add "Posts" tab on user profile page — shows user's community posts
- [ ] Add breed badges on profile (derived from registered pets)
- [ ] "View [Breed] Feed" link from pet profile page

---

## Task Ordering

```
15.1 (DB tables) → 15.2 (seed data) → 15.3-15.4 (RPCs)
               → 15.5 (types) → 15.6 (validations) → 15.7 (API routes)
               → 15.8-15.10 (pages) → 15.11 (wire PRP-14) → 15.12 (profile)
```

Tasks 15.3+15.4 (RPCs) can run in parallel.
Tasks 15.5+15.6 (types/validations) can run in parallel with RPCs.
Tasks 15.8-15.10 (pages) can run in parallel.

---

## Feed Algorithm — Design Notes

### Scoring Model (MVP)

The personalized feed uses a simple weighted scoring system:

| Signal        | Weight | Description                                                |
| ------------- | ------ | ---------------------------------------------------------- |
| Breed match   | 3x     | Post breed matches one of user's pets' breeds              |
| Species match | 2x     | Post species matches but different breed                   |
| Following     | 1.5x   | Post by a user the current user follows                    |
| Recency       | 1x     | Newer posts score higher (decay over 48h)                  |
| Engagement    | 0.5x   | Higher reactions+comments+shares                           |
| Proximity     | 0.3x   | Closer posts score slightly higher (if location available) |

For MVP, this is implemented as a simple SQL ORDER BY. Future iterations can move to a proper scoring function or materialized view.

### Feed Mixing

To avoid filter bubbles (showing only British Shorthair posts to a BSH owner), the feed mixes:

- 60% breed-matched content
- 20% species-matched content (other breeds of same species)
- 10% followed users' posts (any breed)
- 10% trending/popular posts (any breed)

This mixing is handled in the application layer, not pure SQL.

---

## PDPA Checklist

- [x] Community posts are public by design (user actively posts)
- [x] Feed personalization uses only pet breed/species (not sensitive data)
- [x] Location on posts is optional and opt-in
- [x] All tables CASCADE on profile deletion
- [ ] Add `community_posts` to `/api/me/data-export` response
- [ ] Add `feed_tags` (read-only, no user data) — no export needed

---

## Verification

### Full CI Validation Gate

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Personalized feed returns breed-matched posts first
- [ ] Trending feed surfaces high-engagement posts from last 48h
- [ ] Breed tag page filters correctly
- [ ] Post creation auto-tags breed from selected pet
- [ ] Feed renders with engagement bar (reactions/comments/shares)
- [ ] Cursor pagination works correctly (no duplicate/missing posts)
- [ ] Text-only posts display correctly (no broken image placeholder)
- [ ] Feed loads within 500ms for typical user (< 5 pets)
- [ ] RLS prevents mutation of other users' posts

---

## Confidence Score: 7/10

**Risk areas:**

- Feed algorithm quality — simple SQL scoring may feel "dumb" compared to Facebook/Instagram; may need tuning after user testing
- Performance of personalized feed query at scale (JOIN with user's pets + ORDER BY scoring) — may need materialized view or caching
- Breed matching depends on consistent breed naming between `pets.breed` and `feed_tags.breed` — need normalization strategy
- Text-only posts may feel low-effort without moderation — consider minimum content length
- No moderation tools in this PRP — spam/abuse handling deferred to Phase III

---

## Changelog

| Version | Date       | Changes                                                               |
| ------- | ---------- | --------------------------------------------------------------------- |
| v1.0    | 2026-04-14 | Initial PRP — Community feeds with breed-tagged system-suggested feed |
