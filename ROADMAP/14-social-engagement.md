# PRP-14: Social Engagement Layer — Reactions, Comments, Shares, Follows

## Priority: HIGH

## Prerequisites: PRP-01 (LINE auth), PRP-03.1 (pet_reports table naming)

## Problem

Pawrent's current social interaction is limited to a simple like toggle on posts (`post_likes` + `toggle_like` RPC). Lost/found pet reports have zero social engagement — no comments, no shares, no community support signals. PRP-10's prayer counter (`alert_prayers`) adds cultural merit-making but uses a separate table/RPC from likes, creating schema fragmentation.

Pet parents who see a lost pet alert want to:

- **React** — show support ("praying for safe return"), express empathy
- **Comment** — "I saw a similar cat near Soi 5 yesterday", "Have you checked the shelter?"
- **Share** — viral spread to LINE groups, Facebook pet communities, copy link for forums

Without these primitives, lost pet reports stay isolated instead of gaining community momentum. This PRP creates a **unified, polymorphic social engagement layer** that works across all content types: posts, pet_reports, community_posts (PRP-15), and memorials (PRP-10).

---

## Scope

**In scope:**

- Polymorphic reactions system (replaces `post_likes` + `alert_prayers`)
- Comments with single-level threading (Instagram-style flat replies)
- Share tracking (LINE, Facebook, copy link, native share, download)
- User-follows-user for feed personalization
- Migration of existing `post_likes` data into unified `reactions` table
- Backward-compatible wrappers for `toggle_like()` and `pray_for_pet()` RPCs

**Out of scope:**

- Push notifications for social events (deferred — PRP-11)
- Content moderation / reporting system (deferred — Phase III)
- Direct messaging between users (exists in PRP-05 as `conversations` table)
- Community post creation (PRP-15)

---

## Tasks

### 14.1 Database Migration — Core Social Tables

- [ ] Create `reactions` table with polymorphic `target_type` + `target_id`
- [ ] Create `comments` table with single-level `parent_id` threading
- [ ] Create `shares` table for write-only share analytics
- [ ] Create `follows` table for user-follows-user
- [ ] RLS policies on all four tables
- [ ] Indexes on target lookups, user lookups

```sql
-- REACTIONS (replaces post_likes + alert_prayers)
CREATE TABLE IF NOT EXISTS reactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN (
    'post', 'pet_report', 'community_post', 'memorial'
  )),
  target_id   uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'like' CHECK (kind IN (
    'like', 'prayer', 'flower', 'heart', 'paw'
  )),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (target_type, target_id, user_id, kind)
);

CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reactions" ON reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated can react" ON reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reaction" ON reactions FOR DELETE
  USING (auth.uid() = user_id);

-- COMMENTS (single-level threading)
CREATE TABLE IF NOT EXISTS comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN (
    'post', 'pet_report', 'community_post', 'memorial'
  )),
  target_id   uuid NOT NULL,
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,  -- NULL = top-level
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_deleted  boolean DEFAULT false,  -- soft delete for threading integrity
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_user ON comments(user_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view non-deleted comments" ON comments
  FOR SELECT USING (is_deleted = false);
CREATE POLICY "Authenticated can comment" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can soft-delete own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (is_deleted = true);

-- SHARES (write-only analytics)
CREATE TABLE IF NOT EXISTS shares (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN (
    'post', 'pet_report', 'community_post'
  )),
  target_id   uuid NOT NULL,
  user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  platform    text NOT NULL CHECK (platform IN (
    'line', 'facebook', 'copy_link', 'native', 'download'
  )),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_shares_target ON shares(target_type, target_id);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view share counts" ON shares FOR SELECT USING (true);
CREATE POLICY "Authenticated can record share" ON shares FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- FOLLOWS (user-follows-user)
CREATE TABLE IF NOT EXISTS follows (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE
  USING (auth.uid() = follower_id);
```

### 14.2 toggle_reaction() RPC + Data Migration

- [ ] Create `toggle_reaction()` RPC — atomic insert/delete with count return
- [ ] Migrate existing `post_likes` data into `reactions` (target_type='post', kind='like')
- [ ] Create backward-compatible `toggle_like()` wrapper
- [ ] Create backward-compatible `pray_for_pet()` wrapper (delegates to toggle_reaction with kind='prayer')

```sql
CREATE OR REPLACE FUNCTION toggle_reaction(
  p_target_type text,
  p_target_id uuid,
  p_kind text DEFAULT 'like'
)
RETURNS TABLE(action text, count bigint) AS $$
DECLARE
  v_existed boolean;
BEGIN
  DELETE FROM reactions
  WHERE target_type = p_target_type
    AND target_id = p_target_id
    AND user_id = auth.uid()
    AND kind = p_kind
  RETURNING true INTO v_existed;

  IF v_existed IS NULL THEN
    INSERT INTO reactions (target_type, target_id, user_id, kind)
    VALUES (p_target_type, p_target_id, auth.uid(), p_kind);
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN v_existed THEN 'removed' ELSE 'added' END,
    (SELECT count(*) FROM reactions
     WHERE target_type = p_target_type
       AND target_id = p_target_id
       AND kind = p_kind);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 14.3 Denormalized Count Triggers

- [ ] Add `comments_count`, `shares_count` columns to `posts` table
- [ ] Add `comments_count`, `shares_count`, `reactions_count` columns to `pet_reports` table
- [ ] Create trigger functions to INCREMENT/DECREMENT counts (no SELECT COUNT)
- [ ] Backfill counts from migrated data

```sql
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count int DEFAULT 0;

ALTER TABLE pet_reports
  ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reactions_count int DEFAULT 0;

-- Trigger: increment/decrement reaction count
CREATE OR REPLACE FUNCTION update_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format(
      'UPDATE %I SET reactions_count = reactions_count + 1 WHERE id = $1',
      CASE NEW.target_type
        WHEN 'post' THEN 'posts'
        WHEN 'pet_report' THEN 'pet_reports'
        WHEN 'community_post' THEN 'community_posts'
      END
    ) USING NEW.target_id;
  ELSIF TG_OP = 'DELETE' THEN
    EXECUTE format(
      'UPDATE %I SET reactions_count = reactions_count - 1 WHERE id = $1',
      CASE OLD.target_type
        WHEN 'post' THEN 'posts'
        WHEN 'pet_report' THEN 'pet_reports'
        WHEN 'community_post' THEN 'community_posts'
      END
    ) USING OLD.target_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reaction_count
  AFTER INSERT OR DELETE ON reactions
  FOR EACH ROW EXECUTE FUNCTION update_reaction_count();

-- Similar triggers for comments_count and shares_count
```

### 14.4 TypeScript Types

- [ ] Create `lib/types/social.ts` — Reaction, Comment, Share, Follow interfaces
- [ ] Export from `lib/types/index.ts` barrel

```typescript
// lib/types/social.ts

export type ReactionTargetType = "post" | "pet_report" | "community_post" | "memorial";
export type ReactionKind = "like" | "prayer" | "flower" | "heart" | "paw";
export type SharePlatform = "line" | "facebook" | "copy_link" | "native" | "download";

export interface Reaction {
  id: string;
  target_type: ReactionTargetType;
  target_id: string;
  user_id: string;
  kind: ReactionKind;
  created_at: string;
}

export interface Comment {
  id: string;
  target_type: ReactionTargetType;
  target_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
  // Joined fields
  profiles?: { full_name: string | null; avatar_url: string | null };
  replies?: Comment[];
}

export interface Share {
  id: string;
  target_type: ReactionTargetType;
  target_id: string;
  user_id: string | null;
  platform: SharePlatform;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}
```

### 14.5 Zod Validations

- [ ] Create `lib/validations/social.ts` — reactionSchema, commentSchema, shareSchema
- [ ] Export from `lib/validations/index.ts` barrel

```typescript
// lib/validations/social.ts
import { z } from "zod";

const targetTypes = ["post", "pet_report", "community_post", "memorial"] as const;
const reactionKinds = ["like", "prayer", "flower", "heart", "paw"] as const;
const sharePlatforms = ["line", "facebook", "copy_link", "native", "download"] as const;

export const reactionSchema = z.object({
  target_type: z.enum(targetTypes),
  target_id: z.string().uuid(),
  kind: z.enum(reactionKinds).default("like"),
});

export const commentSchema = z.object({
  target_type: z.enum(targetTypes),
  target_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(1000),
});

export const shareSchema = z.object({
  target_type: z.enum(targetTypes),
  target_id: z.string().uuid(),
  platform: z.enum(sharePlatforms),
});

export const followSchema = z.object({
  following_id: z.string().uuid(),
});
```

### 14.6 API Routes

- [ ] `app/api/reactions/route.ts` — POST (toggle), GET (list for target + user status)
- [ ] `app/api/comments/route.ts` — POST (create), GET (list with cursor pagination)
- [ ] `app/api/comments/[id]/route.ts` — DELETE (soft-delete own)
- [ ] `app/api/shares/route.ts` — POST (record share event)
- [ ] `app/api/follows/route.ts` — POST (toggle follow), GET (status + counts)

All routes follow auth → rate-limit → validate → query pattern per CLAUDE.md.

Rate limits:

- Reactions: 60/min
- Comments: 20/min
- Shares: 30/min
- Follows: 30/min

### 14.7 Comment Sheet Component

- [ ] Create `components/comment-sheet.tsx` — bottom sheet modal for comments
- [ ] Shows comments list with profile avatar, name, relative time
- [ ] Input field at bottom for new comment
- [ ] Reply button on each comment (shows reply-to indicator)
- [ ] Soft-delete button on own comments (shows "[deleted]" placeholder)
- [ ] Cursor-paginated "Load more" at top

### 14.8 Reaction Button Component

- [ ] Create `components/reaction-button.tsx` — polymorphic reaction button
- [ ] Accepts `targetType`, `targetId`, `kind` props
- [ ] Visual variants: prayer (🙏), like (❤️), flower (🌸), paw (🐾)
- [ ] Animated toggle with count display
- [ ] Shows "123 คนร่วมอธิษฐาน" for prayer, "45 likes" for like

### 14.9 Share Sheet Component

- [ ] Create `components/share-sheet.tsx` — bottom sheet with share options
- [ ] LINE share (via LIFF shareTargetPicker)
- [ ] Facebook share (URL share intent)
- [ ] Copy link to clipboard
- [ ] Native Web Share API fallback
- [ ] Download poster (leverages PRP-04.1 share card)
- [ ] Records share event to `/api/shares` on each action

### 14.10 Follow Button Component

- [ ] Create `components/follow-button.tsx` — toggle follow/unfollow
- [ ] Shows follower/following counts on profile
- [ ] "Following" state indicator

### 14.11 Wire Social UI onto Pet Report Detail

- [ ] Add ReactionButton (prayer variant) to `app/post/[id]/page.tsx`
- [ ] Add CommentSheet trigger button with count
- [ ] Add ShareSheet trigger button with count
- [ ] Display engagement bar: "🙏 123 · 💬 45 · ↗ 12"

### 14.12 Wire Social UI onto Existing Post Feed

- [ ] Replace existing like button with ReactionButton (like variant)
- [ ] Add CommentSheet to post cards
- [ ] Add ShareSheet to post cards
- [ ] Maintain backward compatibility with `likes_count` display

### 14.13 Backward Compatibility

- [ ] `toggle_like(p_post_id)` → calls `toggle_reaction('post', p_post_id, 'like')`
- [ ] `pray_for_pet(p_alert_id)` → calls `toggle_reaction('pet_report', p_alert_id, 'prayer')`
- [ ] `getUserLikes()` in `lib/db.ts` → queries `reactions` table instead of `post_likes`
- [ ] Deprecation notices on old functions

---

## Task Ordering

```
14.1 (DB tables) → 14.2 (RPC + migration) → 14.3 (triggers)
                 → 14.4 (types) → 14.5 (validations) → 14.6 (API routes)
                 → 14.7-14.10 (UI components)
                 → 14.11-14.12 (wire up) → 14.13 (backward compat)
```

Tasks 14.4-14.5 can run in parallel with 14.2-14.3.
Tasks 14.7-14.10 (components) can run in parallel.

---

## PDPA Checklist

- [x] All tables CASCADE on profile deletion (user_id FK → ON DELETE CASCADE)
- [x] Reactions/comments display profile name + avatar only (no extra PII)
- [x] Shares table user_id is nullable (anonymous share tracking acceptable)
- [x] Follow relationships are public (standard social pattern, opt-in by following)
- [ ] Add `reactions`, `comments`, `shares`, `follows` to `/api/me/data-export` response
- [ ] Add all tables to account deletion cascade verification

---

## Verification

### Full CI Validation Gate

```bash
npm run test:coverage    # Unit + integration + coverage thresholds (90/85)
npm run test:e2e         # Playwright E2E (Chromium + Firefox)
npm run type-check       # TypeScript strict mode
```

- [ ] Reaction toggle works atomically (no double-counting)
- [ ] Comment creates with profile join, replies display under parent
- [ ] Soft-deleted comments show "[deleted]" in thread, preserving replies
- [ ] Share recording tracks platform correctly
- [ ] Follow toggle prevents self-follow
- [ ] Denormalized counts match actual counts after migration
- [ ] Existing `toggle_like` callers still work via wrapper
- [ ] PRP-10 prayer counter backed by reactions (kind='prayer')
- [ ] Rate limits enforced on all social endpoints
- [ ] RLS prevents cross-user mutations

---

## Confidence Score: 8/10

**Risk areas:**

- Polymorphic `target_id` has no FK enforcement — application-level validation + RLS compensate
- Migration of `post_likes` → `reactions` needs careful backfill + count reconciliation
- Denormalized count triggers with dynamic table names require thorough testing
- LINE shareTargetPicker requires LIFF SDK initialization (may need LIFF context check)

---

## Changelog

| Version | Date       | Changes                                                                     |
| ------- | ---------- | --------------------------------------------------------------------------- |
| v1.0    | 2026-04-14 | Initial PRP — Social engagement layer: reactions, comments, shares, follows |
