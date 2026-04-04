# PRP-03: Quality & Maintainability Improvements

## Priority: MEDIUM

## Problem

Missing error/loading UI, a 753-line monolith page, no file upload guards, and raw `<img>` tags reduce reliability, maintainability, and performance.

## Scope

- All route directories in `app/`
- `app/pets/page.tsx` — 753-line decomposition
- Upload components — file validation
- Image rendering across components

## Tasks

### 3.1 Add Error/Loading/Not-Found Route Files

- [ ] Create `loading.tsx` for each route with skeleton UI
- [ ] Create `error.tsx` for each route with user-friendly error messages and retry
- [ ] Create `not-found.tsx` at app root
- [ ] Replace `console.error` + `alert()` calls with proper error boundaries

**Files to create:**
- `app/loading.tsx`
- `app/error.tsx`
- `app/not-found.tsx`
- `app/pets/loading.tsx`
- `app/pets/error.tsx`
- `app/hospital/loading.tsx`
- `app/sos/loading.tsx`
- `app/notifications/loading.tsx`

### 3.2 Decompose Pets Page

- [ ] Extract pet list view into `components/pet-list.tsx`
- [ ] Extract pet detail view into `components/pet-detail.tsx`
- [ ] Extract health records section into `components/health-records.tsx`
- [ ] Extract vaccination management into `components/vaccination-manager.tsx`
- [ ] Create custom hooks for data fetching:
  - `hooks/use-pets.ts`
  - `hooks/use-pet-detail.ts`
  - `hooks/use-vaccinations.ts`
- [ ] Reduce `app/pets/page.tsx` to < 100 lines of composition logic

**Files to create:**
- `components/pet-list.tsx`
- `components/pet-detail.tsx`
- `components/health-records.tsx`
- `components/vaccination-manager.tsx`
- `hooks/use-pets.ts`
- `hooks/use-pet-detail.ts`
- `hooks/use-vaccinations.ts`

**Files to modify:**
- `app/pets/page.tsx`

### 3.3 Add File Upload Validation

- [ ] Create upload utility with validation rules:
  - Images: max 5MB, types `image/jpeg`, `image/png`, `image/webp`
  - Videos: max 50MB, types `video/mp4`, `video/quicktime`
- [ ] Show user-friendly error messages for rejected files
- [ ] Add progress indicators for uploads
- [ ] Apply to all upload points:
  - Profile avatar (`profile/page.tsx`)
  - Pet photos (`photo-gallery.tsx`)
  - SOS videos (`sos/page.tsx`)
  - Feedback images (`feedback/page.tsx`)

**Files to create:**
- `lib/upload.ts` (new)

**Files to modify:**
- `app/profile/page.tsx`
- `components/photo-gallery.tsx`
- `app/sos/page.tsx`
- `app/feedback/page.tsx`

### 3.4 Replace `<img>` with `next/image`

- [ ] Audit all `<img>` tags in components
- [ ] Replace with `next/image` for automatic lazy loading, responsive sizing, and format optimization
- [ ] Configure `remotePatterns` in `next.config.ts` for Supabase storage URLs
- [ ] Set appropriate `width`, `height`, or `fill` props

**Files to modify:**
- All components rendering images (pet cards, profile, feed posts, gallery)
- `next.config.ts`

## Verification

- [ ] Navigating to a non-existent route shows custom 404 page
- [ ] Throwing an error in a page shows error boundary with retry button
- [ ] Loading states show skeletons during data fetch
- [ ] Pets page is composed of small, focused components (< 150 lines each)
- [ ] Uploading a 10MB image shows a validation error
- [ ] Images render via `next/image` with lazy loading (check Network tab)
