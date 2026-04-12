# PRP-16: Home Dashboard & Community Feed

## Priority: MEDIUM

## Prerequisites: PRP-14 (design system), PRP-13 (Line auth — for greeting name)

## Problem

The current home page is a community feed, but Pawrent is evolving into a personal pet OS. Pet owners need a personalized dashboard that gives them an at-a-glance view of their pets' health status, nearby alerts, and quick access to core actions — not just a social feed. The community feed remains important but moves to its own dedicated tab.

---

## Scope

**In scope:**

- Home tab: personal dashboard with greeting, pet health summary, quick shortcuts, nearby SOS alerts
- Community tab: community feed with photos, likes, and comments
- Comments system (from PRP-10.1 — folded here)
- Feed filter: All posts / Following
- Unread notification badge on Community tab

**Out of scope:**

- Following/follower system (deferred post-launch)
- Breed/species community groups (future PRP)
- Direct messaging (future PRP)

---

## Tasks

### 16.1 Home Dashboard Page (`app/page.tsx` rewrite)

**Sections:**

#### Header

- **Greeting**: "สวัสดี! [Line display name]" (pulled from LIFF profile via PRP-13)
- **Notification bell**: icon with unread badge (Line Messaging API unread — future hook)

#### Pet Health Summary Card

- Horizontal scroll of pet chips (same as current `/pets` selector)
- Active pet shows:
  - Next vaccine due: "วัคซีนครบกำหนด 15 ม.ค." or "วัคซีนครบถ้วน ✓"
  - Parasite prevention: "ครบกำหนดใน 12 วัน"
  - Status color: green (all good) / yellow (due soon) / red (overdue)
- Tap → navigates to `/pets?pet={id}`

#### Quick Shortcuts (3 cards)

```
┌─────────────┬─────────────┬─────────────┐
│  สัตว์เลี้ยง  │  บริการ & จอง │   นัดหมาย   │
│  My Pets    │  Services   │ Appointments│
└─────────────┴─────────────┴─────────────┘
```

#### Nearby SOS Alerts (if any active within 5km)

- Compact card: "มีสัตว์หายใกล้คุณ 2 ตัว" with AlertTriangle icon
- Tap → navigates to `/notifications`
- Hidden if no active nearby alerts

#### Community Teaser

- 3 latest posts preview (small thumbnails)
- "ดูทั้งหมด" → navigates to `/community` tab

---

### 16.2 Community Tab (`app/community/page.tsx`)

Moves the existing community feed from `/` to `/community`.

**Feed layout:**

- Tab bar: "ทั้งหมด" (All) / "ที่ติดตาม" (Following) — Following tab shows empty state with "Follow pet parents to see their posts" until following system ships
- Post cards (existing design, updated to ShadCN)
- Floating "+" button to create post

**Post card (updated):**

- Pet photo, name, breed, age
- Post image (aspect-square)
- Like button + count (existing optimistic UI)
- **Comment icon + count** (new — from 16.3)
- Caption
- Time ago
- Owner follow button (greyed out until following ships)

---

### 16.3 Comments System

**Database schema:**

```sql
CREATE TABLE IF NOT EXISTS comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz DEFAULT now()
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

-- Denormalized count on posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0;

-- Uses INCREMENT pattern (not SELECT COUNT) to avoid hot row locks on popular posts
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comments_count();
```

**TypeScript type:**

```typescript
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null };
}
```

**API routes:**

- `GET /api/comments?postId=xxx` — fetch comments, joined with profiles, ordered ASC, limit 50
- `POST /api/comments` — add comment (auth required, rate limit 20/min)
- `DELETE /api/comments?id=xxx` — delete own comment (auth required)

**Community feed pagination:**
Use cursor-based pagination for the posts feed — return `{ data, next_cursor, has_more }` where `next_cursor` is the `created_at` of the last post. Query with `.lt('created_at', cursor).order('created_at', { ascending: false }).limit(20)`. Do **not** use offset/limit (`.range()`) — it causes full table scans as the feed grows.

**Zod validation:**

```typescript
export const commentSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string().min(1).max(1000),
});
```

**UI — `components/comment-sheet.tsx`:**

- Bottom sheet triggered by comment icon on post card
- Header: "[N] ความคิดเห็น"
- Comments list: avatar, name (bold), content, time ago, trash icon (own comments only)
- Input bar at bottom: avatar + text input + send button
- Auto-focus input when sheet opens
- Optimistic insert: add comment to list immediately, revert on API error

---

### 16.4 Route Changes

| Old Route        | New Route        | Notes                       |
| ---------------- | ---------------- | --------------------------- |
| `/`              | `/`              | Home dashboard (new)        |
| `/` (feed)       | `/community`     | Community feed moved        |
| `/notifications` | `/notifications` | SOS alerts feed (unchanged) |

Update all internal links referencing the feed.

---

## Task Ordering

**16.1 (Dashboard) → 16.2 (Community tab) → 16.3 (Comments) → 16.4 (Route cleanup)**

## Verification

```bash
# Dashboard shows correct pet health status
# Nearby SOS card hides when no active alerts
# Community feed loads at /community
# Comments open in bottom sheet
# Comment count updates after add/delete
# Optimistic UI reverts correctly on error
npm test
npx tsc --noEmit
```

## Confidence Score: 9/10

**Risk areas:**

- Health summary logic must handle pets with no vaccine/parasite records gracefully (empty state, not error)
- Route change from `/` to `/community` must update all existing links and redirects
