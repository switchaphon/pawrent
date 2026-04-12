# PRP-10: Social Features — Comments, Following, Nearby Pets

## Priority: MEDIUM

## Prerequisites: PRPs 01-09 complete

## Problem

The community feed currently supports photo posts and likes, but lacks deeper social interaction. Users can't comment on posts, follow other pet parents, or discover nearby pets — limiting engagement and the app's value as a pet community platform.

## Scope

**In scope:**

- Post comments system (add, view, delete own comments)
- Pet following / pet parent following
- Nearby pet parents discovery (using existing geolocation)

**Out of scope:**

- Direct messaging (future PRP)
- Push notifications for social events (covered in PRP-11)
- Content moderation / reporting (future PRP)

---

## Tasks

### 10.1 Post Comments System

**Database schema:**

```sql
CREATE TABLE IF NOT EXISTS comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_post_id ON comments(post_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment"
  ON comments FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING ((select auth.uid()) = user_id);
```

**TypeScript type (add to lib/types.ts):**

```typescript
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Joined fields
  profiles?: { full_name: string | null; avatar_url: string | null };
}
```

**API routes:**

- `GET /api/comments?postId=xxx` — fetch comments for a post (with profile join, ordered by created_at ASC, limit 50)
- `POST /api/comments` — add comment (auth required, rate limit 20/min)
- `DELETE /api/comments` — delete own comment (auth required)

**Zod validation:**

```typescript
export const commentSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string().min(1).max(1000),
});
```

**UI changes:**

- Add comment icon + count below each post (next to like button)
- Comment sheet/modal: shows comments list + input field
- Each comment shows: avatar, name, content, time ago, delete button (own comments)

**Files to create:**

- `app/api/comments/route.ts`
- `components/comment-sheet.tsx`

**Files to modify:**

- `lib/types.ts` — add Comment interface
- `lib/validations.ts` — add commentSchema
- `lib/db.ts` — add getComments, createComment, deleteComment
- `app/page.tsx` — add comment button to post cards
- `__tests__/api-comments.test.ts` — tests

---

### 10.2 Pet Following System

**Database schema:**

```sql
CREATE TABLE IF NOT EXISTS follows (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
  ON follows FOR SELECT USING (true);

CREATE POLICY "Users can follow"
  ON follows FOR INSERT
  WITH CHECK ((select auth.uid()) = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING ((select auth.uid()) = follower_id);
```

**API routes:**

- `POST /api/follows` — follow/unfollow toggle (rate limit 30/min)
- `GET /api/follows?userId=xxx` — get follower/following counts and list

**UI changes:**

- Follow button on post cards (next to pet name)
- Following/followers count on profile page
- "Following" feed filter tab (show only posts from followed users)

**Files to create:**

- `app/api/follows/route.ts`

**Files to modify:**

- `lib/types.ts` — add Follow interface
- `lib/db.ts` — add toggleFollow, getFollowStatus, getFollowerCount
- `app/page.tsx` — add follow button, feed filter
- `app/profile/page.tsx` — add follower/following counts

---

### 10.3 Nearby Pet Parents

**Approach:** Use the existing `LocationProvider` + `calculateDistance()` from `lib/db.ts` to show nearby users who opt-in to location sharing.

**Database schema:**

```sql
-- Add location fields to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS location_visible boolean DEFAULT false;
```

**API route:**

- `GET /api/nearby?lat=x&lng=y&radius=5` — fetch profiles within radius (km), only where location_visible=true

**UI changes:**

- Location sharing toggle on profile page
- "Nearby" tab on feed or dedicated page showing pet parents within 5km
- Each card shows: avatar, name, pets count, distance

**Files to create:**

- `app/api/nearby/route.ts`
- `app/nearby/page.tsx` or integrate into feed

---

## Task Ordering

**10.1 (Comments) → 10.2 (Following) → 10.3 (Nearby)**

Comments is the highest-value social feature. Following builds on the feed infrastructure. Nearby is independent but lower priority.

## Verification

```bash
npm test
npm run test:coverage
npm run test:e2e
npx tsc --noEmit
```

## Confidence Score: 8/10

**Remaining 2:** RPC function for comment count aggregation (like toggle_like) may be needed for performance. Nearby query without PostGIS will be slow at scale — acceptable for MVP with <1000 users.
