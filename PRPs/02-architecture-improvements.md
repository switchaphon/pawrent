# PRP-02: Architecture Improvements

## Priority: HIGH

## Prerequisites

- **PRP-01 must be complete** — specifically task 1.2 (middleware + `@supabase/ssr` + `lib/supabase-server.ts`). Server Components and API routes need the server-side Supabase client.

## Problem

The entire app is client-rendered with zero Server Components, no input validation, a race-condition-prone likes system, and no data caching. This wastes Next.js 16's capabilities and creates performance and reliability issues.

## Architecture Decision: Server Components + Selective Client Caching

**Pattern chosen:** Server Components for initial page loads, client-side fetching only for interactive mutations.

- **Server Components** → initial data fetching for pages (feed, pets, notifications)
- **Client Components** → interactive elements (likes, forms, maps, modals)
- **No TanStack Query for now** — Next.js router cache handles navigation caching. TanStack Query adds complexity without clear benefit until we need polling or optimistic updates beyond likes. Revisit in a future PRP if needed.
- **API Route Handlers** → mutations only (POST/PUT/DELETE). No GET routes — reads go through Server Components.

## Scope Split

This PRP is divided into 3 independent phases that can be executed sequentially. Each phase is self-contained and shippable.

**Phase A (standalone):** Zod validation + likes fix
**Phase B (depends on PRP-01):** Server Components + providers refactor
**Phase C (depends on Phase B):** API routes for mutations

---

## Phase A: Input Validation + Likes Fix

**No dependencies on PRP-01.** Can be executed immediately.

### A.1 Add Input Validation with Zod

- [ ] Install `zod` (`npm install zod`)
- [ ] Create `lib/validations.ts` with schemas for all user inputs
- [ ] Apply validation in form `onSubmit` handlers (client-side, before Supabase calls)
- [ ] Add file upload validation (size + type checks)

**Zod Schemas:**

```typescript
// lib/validations.ts
import { z } from "zod";

export const petSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  species: z.string().nullable(),
  breed: z.string().nullable(),
  sex: z.enum(["male", "female", "unknown"]).nullable(),
  color: z.string().max(50).nullable(),
  weight_kg: z.number().min(0).max(500).nullable(),
  date_of_birth: z.string().nullable(),
  microchip_number: z.string().max(50).nullable(),
  special_notes: z.string().max(1000).nullable(),
});

export const sosAlertSchema = z.object({
  pet_id: z.string().uuid("Select a pet"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(2000).nullable(),
});

export const postSchema = z.object({
  caption: z.string().max(500).nullable(),
  pet_id: z.string().uuid().nullable(),
});

export const feedbackSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
});

export const vaccinationSchema = z.object({
  pet_id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(["protected", "due_soon", "overdue"]),
  last_date: z.string().nullable(),
  next_due_date: z.string().nullable(),
});

export const parasiteLogSchema = z.object({
  pet_id: z.string().uuid(),
  medicine_name: z.string().max(200).nullable(),
  administered_date: z.string(),
  next_due_date: z.string(),
});

// File upload validation
export const imageFileSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Image must be under 5MB"),
  type: z.enum(["image/jpeg", "image/png", "image/webp"], {
    errorMap: () => ({ message: "Only JPEG, PNG, and WebP images allowed" }),
  }),
});

export const videoFileSchema = z.object({
  size: z.number().max(50 * 1024 * 1024, "Video must be under 50MB"),
  type: z.enum(["video/mp4", "video/quicktime"], {
    errorMap: () => ({ message: "Only MP4 and MOV videos allowed" }),
  }),
});
```

**Form files to modify (add Zod validation to `onSubmit`):**
- `components/create-pet-form.tsx` — use `petSchema`
- `components/edit-pet-form.tsx` — use `petSchema.partial()`
- `components/create-post-form.tsx` — use `postSchema` + `imageFileSchema`
- `components/add-vaccine-form.tsx` — use `vaccinationSchema`
- `components/add-parasite-log-form.tsx` — use `parasiteLogSchema`
- `app/sos/page.tsx` — use `sosAlertSchema` + `videoFileSchema`
- `app/feedback/page.tsx` — use `feedbackSchema` + `imageFileSchema`
- `components/auth-form.tsx` — use `z.string().email()` + `z.string().min(6)`

**Files to create:**
- `lib/validations.ts`

**Files to modify:**
- `package.json` (add `zod`)
- 8 form files listed above

---

### A.2 Fix Likes System

The current `handleLike` at `app/page.tsx:44-53` does a naive `likes_count + 1` update. Race conditions lose counts, and users can like infinitely.

- [ ] Run the SQL migration below via Supabase Dashboard SQL editor
- [ ] Update `app/page.tsx` to use the new `toggle_like` function
- [ ] Update `lib/db.ts` to add `toggleLike()` and `getUserLikes()` functions
- [ ] Keep `likes_count` as a denormalized cache (updated by the DB function)

**SQL Migration — Likes System:**

```sql
-- A.2: Create post_likes table and atomic toggle function
-- Run via Supabase Dashboard > SQL Editor

-- Junction table for likes
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- RLS for post_likes
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all likes"
  ON post_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own likes"
  ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);

-- Atomic toggle function: like if not liked, unlike if already liked
-- Returns the new likes_count
CREATE OR REPLACE FUNCTION toggle_like(p_post_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
BEGIN
  -- Check if like exists
  SELECT EXISTS(
    SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Unlike
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
  ELSE
    -- Like
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, p_user_id);
  END IF;

  -- Update denormalized count
  SELECT COUNT(*) INTO v_count FROM post_likes WHERE post_id = p_post_id;
  UPDATE posts SET likes_count = v_count WHERE id = p_post_id;

  RETURN v_count;
END;
$$;

-- Migrate existing likes_count data (best effort — no user attribution possible)
-- Existing likes_count values are kept as-is. New likes will be tracked properly.
-- Over time, the denormalized count will self-correct as users interact.
```

**Updated `lib/db.ts` functions:**

```typescript
// Toggle like (atomic, idempotent)
export async function toggleLike(postId: string, userId: string) {
  const { data, error } = await supabase.rpc("toggle_like", {
    p_post_id: postId,
    p_user_id: userId,
  });
  return { newCount: data as number | null, error };
}

// Get which posts the current user has liked
export async function getUserLikes(userId: string, postIds: string[]) {
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  return { data: data?.map((d) => d.post_id) || [], error };
}
```

**Updated `app/page.tsx` handleLike:**

```typescript
const handleLike = async (postId: string) => {
  if (!user) return;
  // Optimistic toggle
  const isLiked = likedPosts.has(postId);
  const post = posts.find((p) => p.id === postId);
  if (!post) return;

  setLikedPosts((prev) => {
    const next = new Set(prev);
    isLiked ? next.delete(postId) : next.add(postId);
    return next;
  });
  setPosts(posts.map((p) =>
    p.id === postId
      ? { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) }
      : p
  ));

  const { newCount, error } = await toggleLike(postId, user.id);
  if (error) {
    // Revert on error
    setLikedPosts((prev) => {
      const next = new Set(prev);
      isLiked ? next.add(postId) : next.delete(postId);
      return next;
    });
    setPosts(posts.map((p) =>
      p.id === postId ? { ...p, likes_count: post.likes_count } : p
    ));
  } else if (newCount !== null) {
    setPosts(posts.map((p) =>
      p.id === postId ? { ...p, likes_count: newCount } : p
    ));
  }
};
```

**Files to modify:**
- `lib/db.ts` — add `toggleLike()`, `getUserLikes()`
- `app/page.tsx` �� refactor `handleLike`, add `likedPosts` state, fetch user likes on mount
- Supabase SQL Editor — run likes migration

---

## Phase B: Server Components + Providers Refactor

**Depends on:** PRP-01 complete (task 1.2: `@supabase/ssr` + `lib/supabase-server.ts`)

### B.1 Extract Client Providers Wrapper

The root `layout.tsx` currently wraps children in `ToastProvider > AuthProvider > LocationProvider`. These are all Client Components, which forces the entire tree client-side. Extract them into a dedicated wrapper so `layout.tsx` stays a Server Component (preserving `metadata` and `viewport` exports).

- [ ] Create `components/providers.tsx` as a `"use client"` wrapper
- [ ] Update `app/layout.tsx` to import and use the wrapper
- [ ] Verify `metadata` export still works (it won't if layout becomes a Client Component)

**`components/providers.tsx`:**

```typescript
"use client";

import { AuthProvider } from "@/components/auth-provider";
import { LocationProvider } from "@/components/location-provider";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <LocationProvider>{children}</LocationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
```

**Updated `app/layout.tsx`:**

```typescript
import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// ... font, metadata, viewport unchanged ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Files to create:**
- `components/providers.tsx`

**Files to modify:**
- `app/layout.tsx`

---

### B.2 Convert Suitable Pages to Server Components

Only pages where the Server Component wrapper adds real value (server-side data fetch, reduced client JS). **NOT candidates:** hospital (Leaflet needs browser), pets (753-line monolith — decomposition is PRP-03).

**Candidate pages and their decomposition:**

#### `app/page.tsx` (Feed)

Server Component fetches initial posts, passes to Client Component for interactivity.

```
app/page.tsx (Server Component)
  └── fetches posts via server Supabase client
  └── renders <FeedContent posts={initialPosts} />

components/feed-content.tsx (Client Component — new)
  └── handles likes, create post, auth context
  └── uses initialPosts as starting state
```

#### `app/notifications/page.tsx` (Notifications)

Server Component fetches alerts, passes to Client Component for distance calculation (needs browser geolocation).

```
app/notifications/page.tsx (Server Component)
  └── fetches active alerts + recently found via server client
  └── renders <NotificationsContent initialAlerts={...} initialFound={...} />

components/notifications-content.tsx (Client Component — new)
  └── handles geolocation, distance calc, UI
  └── uses initialAlerts as starting state
```

#### Pages that stay fully Client Components:
- `app/pets/page.tsx` — too complex, defer to PRP-03 decomposition
- `app/hospital/page.tsx` — Leaflet requires browser, already minimal
- `app/sos/page.tsx` — form-heavy, auth-dependent, no server fetch benefit
- `app/profile/page.tsx` — entirely user-specific interactive content
- `app/feedback/page.tsx` — simple form, no initial data to fetch

- [ ] Refactor `app/page.tsx` → Server Component + `components/feed-content.tsx` Client Component
- [ ] Refactor `app/notifications/page.tsx` → Server Component + `components/notifications-content.tsx` Client Component
- [ ] Create server-side data fetching functions in `lib/db-server.ts` using the server Supabase client from PRP-01
- [ ] Verify HTML source includes rendered content (not empty shell)

**Files to create:**
- `components/feed-content.tsx` (extracted from `app/page.tsx`)
- `components/notifications-content.tsx` (extracted from `app/notifications/page.tsx`)
- `lib/db-server.ts` (server-side fetch functions using `createServerClient`)

**Files to modify:**
- `app/page.tsx` (convert to Server Component)
- `app/notifications/page.tsx` (convert to Server Component)

---

## Phase C: API Routes for Mutations

**Depends on:** Phase B complete (server client available), Phase A complete (Zod schemas available)

### C.1 Create Mutation-Only API Routes

API routes handle POST/PUT/DELETE only. They use the server Supabase client, enforce auth, and validate input with Zod schemas from Phase A.

- [ ] Create `app/api/posts/like/route.ts` — toggle like (calls `toggle_like` RPC)
- [ ] Create `app/api/posts/route.ts` — POST create post with image upload
- [ ] Create `app/api/sos/route.ts` — POST create alert, PUT resolve alert
- [ ] Create `app/api/pets/route.ts` — POST create, PUT update, DELETE
- [ ] Create `app/api/feedback/route.ts` — POST submit feedback
- [ ] Each route: verify auth session, validate with Zod, call Supabase, return JSON
- [ ] Update client components to call API routes instead of direct Supabase for mutations

**Example API route pattern:**

```typescript
// app/api/posts/like/route.ts
import { createServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await request.json();
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("toggle_like", {
    p_post_id: postId,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ likes_count: data });
}
```

**File uploads** use `request.formData()` (built into Next.js Route Handlers):

```typescript
// app/api/posts/route.ts (POST handler)
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("image") as File;
  const caption = formData.get("caption") as string | null;
  const petId = formData.get("pet_id") as string | null;

  // Validate with Zod
  // Upload file to Supabase Storage
  // Insert post record
  // Return created post
}
```

**Files to create:**
- `app/api/posts/route.ts`
- `app/api/posts/like/route.ts`
- `app/api/sos/route.ts`
- `app/api/pets/route.ts`
- `app/api/feedback/route.ts`

**Files to modify (switch from direct Supabase to fetch API routes):**
- `components/create-post-form.tsx`
- `app/page.tsx` or `components/feed-content.tsx` (like handler)
- `app/sos/page.tsx`
- `components/create-pet-form.tsx`
- `components/edit-pet-form.tsx`
- `app/feedback/page.tsx`

---

## Rollback Plan

- **Phase A:** Revert `lib/validations.ts`, remove Zod from forms (forms work without validation). Drop `post_likes` table and restore naive `handleLike`.
- **Phase B:** Restore `"use client"` on page files, move providers back to `layout.tsx`, delete extracted components.
- **Phase C:** Delete API route files, restore direct Supabase calls in form components.

---

## Verification

### Phase A Checks

```bash
# TypeScript compiles with Zod schemas
npx tsc --noEmit

# Likes toggle is idempotent — run in Supabase SQL Editor:
# SELECT toggle_like('<post_id>', '<user_id>'); -- returns count
# SELECT toggle_like('<post_id>', '<user_id>'); -- returns count - 1
```

- [ ] Submit pet form with empty name → shows "Name is required" error
- [ ] Upload 10MB image → shows "Image must be under 5MB" error
- [ ] Like a post → heart fills, count increments
- [ ] Like same post again → heart unfills, count decrements
- [ ] Two users like same post �� count is 2 (no race condition)

### Phase B Checks

```bash
# View page source to verify server-rendered HTML
curl -s http://localhost:3000 | grep -c "Community Feed"
# Expected: 1 (content in HTML, not empty shell)

# Verify layout metadata still exports
curl -s http://localhost:3000 | grep "Pawrent | Pet OS Dashboard"
# Expected: found in <title> tag
```

- [ ] Feed page loads with posts visible in HTML source
- [ ] Notifications page loads with alerts in HTML source
- [ ] All interactive features (likes, create post, navigation) still work

### Phase C Checks

```bash
# API route rejects unauthenticated requests
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/posts/like \
  -H "Content-Type: application/json" -d '{"postId":"test"}'
# Expected: 401

# API route accepts authenticated requests (use browser devtools to grab cookie)
```

- [ ] Creating a post goes through API route (check Network tab)
- [ ] Direct Supabase calls removed from client components for mutations
- [ ] All existing features work end-to-end

---

## Confidence Score: 8/10

**Remaining 2:** Phase B depends on PRP-01's server client implementation (not yet built). Phase C's exact API route structure may need adjustment based on how Phase B shapes the component tree.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-04 | Initial PRP — 5 tasks, single scope |
| v2.0 | 2026-04-04 | Major revision: split into 3 phases, resolved SC vs TanStack Query conflict, added SQL for likes, removed hospital from SC candidates, detailed feed/notifications decomposition, added Zod schemas, added verification commands, removed TanStack Query (deferred), enumerated all form files |
