# PRP-02: Architecture Improvements

## Priority: HIGH

## Prerequisites

- **PRP-01 is complete.** Specifically:
  - `lib/supabase-server.ts` exists (server-side Supabase client factory)
  - `middleware.ts` exists (session refresh only — no redirects, client uses localStorage)
  - RLS is enabled on all tables
  - `@supabase/ssr` is installed
- **Key PRP-01 lesson:** The client-side Supabase SDK uses **localStorage** for auth, not cookies. The server client (`lib/supabase-server.ts`) uses cookies but they won't have auth data until we migrate the client auth. **Phase B Server Components cannot rely on server-side auth** — they must pass data without user context, or be deferred until client auth migrates to cookies.

## Problem

The entire app is client-rendered with zero Server Components, no input validation, a race-condition-prone likes system, and no data caching. This wastes Next.js 16's capabilities and creates performance and reliability issues.

## Architecture Decision: Incremental Improvement, Not Full Rewrite

**Lesson from PRP-01:** Removing `ProtectedRoute` caused 4 unplanned hotfixes. This PRP takes an incremental approach — each phase ships independently without breaking existing features.

- **Phase A (standalone):** Zod validation + likes fix — zero risk to existing features
- **Phase B (deferred):** Server Components — blocked until client auth migrates to cookies. Attempting SC now would mean Server Components can't access user data, making them useless for user-specific pages.
- **Phase C (depends on Phase A):** API routes for mutations — improves security by moving sensitive operations server-side

**Phase B is descoped from this PRP.** It requires a prerequisite (client auth migration to cookies) that warrants its own PRP. This PRP focuses on Phase A and Phase C only.

## Scope

**In scope:**
- `lib/validations.ts` — Zod schemas for all forms
- `app/page.tsx` — likes system rewrite
- `lib/db.ts` — toggleLike + getUserLikes functions
- `app/api/` — mutation-only API routes
- 8 form components — client-side validation

**Out of scope (deferred):**
- Server Components (requires cookie-based client auth)
- `providers.tsx` extraction (only needed for Server Components)
- TanStack Query (revisit when there's a real need)

---

## Phase A: Input Validation + Likes Fix

**No dependencies.** Can be executed immediately.

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
  sex: z.enum(["Male", "Female"]).nullable(),  // Capitalized — matches create-pet-form.tsx
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

// File upload validation — includes image/jpg for browser compatibility
export const imageFileSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "Image must be under 5MB"),
  type: z.string().refine(
    (t) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(t),
    { message: "Only JPEG, PNG, and WebP images allowed" }
  ),
});

export const videoFileSchema = z.object({
  size: z.number().max(50 * 1024 * 1024, "Video must be under 50MB"),
  type: z.string().refine(
    (t) => ["video/mp4", "video/quicktime"].includes(t),
    { message: "Only MP4 and MOV videos allowed" }
  ),
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
- [ ] Update `lib/db.ts` to add `toggleLike()` and `getUserLikes()` functions
- [ ] Refactor `app/page.tsx` to use toggle likes with `likedPosts` state
- [ ] Keep `likes_count` as a denormalized cache (updated by the DB function)

**SQL Migration — Likes System:**

```sql
-- A.2: Create post_likes table and atomic toggle function
-- Run via Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS post_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

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

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);

-- Atomic toggle function with auth.uid() check to prevent spoofing
CREATE OR REPLACE FUNCTION toggle_like(p_post_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
  v_count integer;
BEGIN
  -- Verify caller matches the user_id parameter
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: user_id mismatch';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
  ELSE
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, p_user_id);
  END IF;

  SELECT COUNT(*) INTO v_count FROM post_likes WHERE post_id = p_post_id;
  UPDATE posts SET likes_count = v_count WHERE id = p_post_id;

  RETURN v_count;
END;
$$;
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

**Refactored `app/page.tsx` — key changes to `FeedContent`:**

The home page now has an auth gate (`HomePage` shows `AuthForm` if not signed in — added in PRP-01). `FeedContent` only renders when authenticated.

```typescript
// Add to FeedContent state:
const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

// Add to fetchPosts (after setPosts):
// Fetch user's liked posts
if (user && data && data.length > 0) {
  getUserLikes(user.id, data.map((p: FeedPost) => p.id)).then(({ data: liked }) => {
    setLikedPosts(new Set(liked));
  });
}

// Replace handleLike:
const handleLike = async (postId: string) => {
  if (!user) return;
  const isLiked = likedPosts.has(postId);
  const post = posts.find((p) => p.id === postId);
  if (!post) return;

  // Optimistic toggle
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

// Update Heart button to show filled state:
<Heart className={`w-6 h-6 ${likedPosts.has(post.id) ? "fill-destructive text-destructive" : ""}`} />
```

**Files to modify:**
- `lib/db.ts` — add `toggleLike()`, `getUserLikes()`
- `app/page.tsx` — refactor `handleLike`, add `likedPosts` state, fetch user likes on mount, update Heart icon
- Supabase SQL Editor — run likes migration

---

## Phase C: API Routes for Mutations

**Depends on:** Phase A complete (Zod schemas available), PRP-01 complete (`lib/supabase-server.ts` exists)

**Note on server auth:** The server Supabase client uses cookies. Currently the client SDK uses localStorage, so the server client won't have the user's session for most requests. API routes will need to accept the auth token from the client or use an alternative auth approach. For now, API routes validate auth by checking the `Authorization` header forwarded by the client.

### C.1 Create Mutation-Only API Routes

API routes handle POST/PUT/DELETE only. They validate input with Zod and call Supabase.

- [ ] Create `app/api/posts/like/route.ts` — toggle like
- [ ] Create `app/api/posts/route.ts` — POST create post with image upload
- [ ] Create `app/api/sos/route.ts` — POST create alert, PUT resolve alert
- [ ] Create `app/api/pets/route.ts` — POST create, PUT update, DELETE
- [ ] Create `app/api/feedback/route.ts` — POST submit feedback
- [ ] Each route: validate with Zod, call Supabase, return JSON
- [ ] Update client components to call API routes instead of direct Supabase for mutations

**API route auth pattern:**

Since the client uses localStorage auth (not cookies), API routes receive the Supabase JWT via the request. The server client created from cookies won't have the session. Instead, create a per-request client with the token:

```typescript
// lib/supabase-api.ts — for use in API Route Handlers
import { createClient } from "@supabase/supabase-js";

export function createApiClient(authHeader: string | null) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }
  );
  return client;
}
```

**Example API route:**

```typescript
// app/api/posts/like/route.ts
import { createApiClient } from "@/lib/supabase-api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createApiClient(authHeader);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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

**File uploads** use `request.formData()`:

```typescript
// app/api/posts/route.ts (POST handler)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createApiClient(authHeader);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("image") as File;
  const caption = formData.get("caption") as string | null;
  const petId = formData.get("pet_id") as string | null;

  // Validate with Zod imageFileSchema + postSchema
  // Upload file to Supabase Storage
  // Insert post record
  // Return created post
}
```

**Client-side: forwarding auth token:**

```typescript
// Helper to call API routes with auth
async function apiMutate(url: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

**Files to create:**
- `lib/supabase-api.ts` — API route client factory
- `app/api/posts/route.ts`
- `app/api/posts/like/route.ts`
- `app/api/sos/route.ts`
- `app/api/pets/route.ts`
- `app/api/feedback/route.ts`

**Files to modify (switch mutations from direct Supabase to API routes):**
- `components/create-post-form.tsx`
- `app/page.tsx` (like handler)
- `app/sos/page.tsx`
- `components/create-pet-form.tsx`
- `components/edit-pet-form.tsx`
- `app/feedback/page.tsx`

---

## Rollback Plan

- **Phase A:** Revert `lib/validations.ts`, remove Zod from forms. Drop `post_likes` table and restore naive `handleLike`.
- **Phase C:** Delete API route files and `lib/supabase-api.ts`, restore direct Supabase calls in form components.

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
- [ ] Like a post → heart fills red, count increments
- [ ] Like same post again → heart unfills, count decrements
- [ ] Two users like same post → count is 2 (no race condition)
- [ ] Page refresh → liked posts show filled hearts (persisted)

### Phase C Checks

```bash
# API route rejects unauthenticated requests
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/posts/like \
  -H "Content-Type: application/json" -d '{"postId":"test"}'
# Expected: 401
```

- [ ] Creating a post goes through API route (check Network tab)
- [ ] Direct Supabase mutation calls removed from client components
- [ ] All existing features work end-to-end

---

## Confidence Score: 9/10

**Previous: 8.5/10 → Now: 9/10**

Improvements:
- Phase B descoped (blocked by auth mechanism mismatch discovered in PRP-01)
- Sex field enum fixed to match actual form values (`"Male"`, `"Female"`)
- `image/jpg` added to file validation
- `auth.uid()` check added to `toggle_like` SQL
- `likedPosts` initialization code added
- API route auth pattern updated for localStorage-based client auth
- Codebase drift from PRP-01 execution fully accounted for

Remaining 1: Phase C's exact client-side auth forwarding pattern needs testing in practice.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-04 | Initial PRP — 5 tasks, single scope |
| v2.0 | 2026-04-04 | Major revision: split into 3 phases, resolved SC vs TanStack Query conflict, added SQL/code |
| v3.0 | 2026-04-05 | Post-PRP-01 refinement: descoped Phase B (auth mechanism mismatch), fixed sex enum casing, added image/jpg, added auth.uid() check to toggle_like, added likedPosts init code, updated API route auth pattern for localStorage client, accounted for codebase drift |
