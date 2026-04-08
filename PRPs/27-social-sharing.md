# PRP-27: Social Media Sharing & Viral Growth Cards

## Priority: MEDIUM

## Prerequisites: PRP-14 (design system), PRP-13 (Line auth — for OG image personalization)

## Works with: PRP-22 (milestones), PRP-28 (gamification badges), PRP-23 (SOS found story)

## Problem

Pawrent's content — pet milestones, vaccine completion, SOS found stories, quiz badge results — is inherently emotional and shareable. But today there is no way to take that content to Facebook, Instagram, TikTok, or Line. Every moment that doesn't get shared is a missed organic acquisition opportunity.

Pet content performs exceptionally well on social media in Thailand. A "Mochi is Fully Vaccinated 🐾" card with a cute design and Pawrent branding, shared by 1,000 users, reaches hundreds of thousands of potential new users — at zero cost.

This PRP creates the **viral growth loop**: Pawrent generates shareable moments → users post them → their followers discover Pawrent.

---

## Scope

**In scope:**

- Shareable image card generation (server-side via Vercel OG / Satori)
- Web Share API for native mobile sharing (works with any installed app)
- Deep links for Instagram Stories and Line (direct share)
- OG meta tags for rich link previews when sharing URLs
- Share triggers on: posts, milestones, vaccine completion, SOS found, quiz badges (PRP-28)
- Pawrent watermark / branding on all generated cards

**Out of scope:**

- Auto-posting to social accounts (requires OAuth per platform — complex, privacy-sensitive)
- TikTok video generation (future — needs video composition)
- Analytics on share performance (future — UTM tracking)

---

## Tasks

### 27.1 Shareable Card Templates

Cards are generated server-side as images using **Satori** (already available via `next/og`). No external service needed — runs on Vercel Edge.

**Card types and their content:**

| Card Type            | Trigger                            | Content                                                           |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| **Vaccine Complete** | All core vaccines = protected      | Pet photo, name, "Fully Vaccinated ✅", badge, Pawrent logo       |
| **Birthday**         | Annual birthday milestone (PRP-22) | Pet photo, name, "Happy [N]th Birthday 🎂", age, Pawrent logo     |
| **Life Stage**       | Senior milestone (PRP-22)          | Pet photo, "Now a Senior 🐾", life stage name, health tip         |
| **SOS Found**        | SOS resolved as "found"            | Pet photo, "We Found [Name]! 💛", days missing, thank-you message |
| **Quiz Result**      | Gamification result (PRP-28)       | Badge illustration, personality type name, pet name, Pawrent CTA  |
| **Annual Wrap**      | Year-end summary (PRP-22)          | Pet photo, "[Name]'s Year in Review", key stats, Pawrent logo     |
| **Pet Profile**      | Manual share from pet page         | Pet photo, name, breed, QR code linking to passport (PRP-21)      |

**Card dimensions:** 1080×1080px (Instagram square) — also works for Facebook, Line, TikTok thumbnail.

---

### 27.2 OG Image API (`app/api/og/route.tsx`)

Uses Next.js `ImageResponse` (Satori under the hood):

```typescript
// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");     // card type
  const petId = searchParams.get("petId");
  const token = searchParams.get("token");   // signed, short-lived

  // Verify token (prevent unauthenticated card generation for private data)
  const payload = await verifyOgToken(token);
  if (!payload || payload.petId !== petId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pet = await getPetPublicData(petId);

  // Render card based on type
  return new ImageResponse(
    <CardTemplate type={type} pet={pet} />,
    { width: 1080, height: 1080 }
  );
}
```

**OG token:** Short-lived signed JWT (15 min) to prevent generating cards for other users' pets. Reuses `lib/checkin.ts` signing pattern from PRP-19.

**`app/api/og/token/route.ts`:**

- `POST` — generate OG token for a pet (auth required, must own pet)
- Returns `{ token, card_url }` — card_url is ready to share

---

### 27.3 OG Meta Tags for Shared URLs

When a Pawrent URL is shared (e.g., `/passport/[token]`, `/pets/[id]`), the link preview should show the pet's photo and a compelling description.

**`app/passport/[token]/page.tsx`** — add to page head:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const pet = await getPetByPassportToken(params.token);
  return {
    title: `${pet.name}'s Health Passport — Pawrent`,
    description: `${pet.name} is a ${pet.breed ?? pet.species}. View their full vaccination history and health records.`,
    openGraph: {
      images: [`/api/og?type=pet_profile&petId=${pet.id}&token=${ogToken}`],
    },
    twitter: { card: "summary_large_image" },
  };
}
```

Same pattern for `/pets/[id]`, SOS alert pages, and event pages (PRP-25).

---

### 27.4 Share Button Component (`components/share-button.tsx`)

Reusable component used across all shareable moments.

```typescript
interface ShareButtonProps {
  title: string; // e.g. "Mochi is Fully Vaccinated!"
  text: string; // e.g. "Mochi just completed her vaccination schedule 💉🐾"
  url: string; // Pawrent URL (passport, pet profile, etc.)
  imageUrl?: string; // pre-generated card URL from /api/og
  platforms?: ("native" | "line" | "instagram" | "facebook")[];
}
```

**Share flow:**

1. User taps "Share" → bottom sheet opens
2. Sheet shows:
   - Preview of the generated card image
   - Platform buttons: Line / Instagram / Facebook / Copy Link
   - "Download Image" button (saves card to camera roll)
3. On platform tap:

**Line share:**

```
https://social-plugins.line.me/lineit/share?url={encodeURIComponent(url)}
```

**Instagram:** Web Share API with image file (Instagram accepts image via Web Share on mobile):

```typescript
const file = await fetchImageAsFile(imageUrl, "pawrent-share.jpg");
await navigator.share({ files: [file], title, text });
```

**Facebook:**

```
https://www.facebook.com/sharer/sharer.php?u={encodeURIComponent(url)}
```

**Native (Web Share API — any app):**

```typescript
await navigator.share({ title, text, url });
// Falls back to copy link if Web Share not supported
```

**Download image:**

```typescript
const a = document.createElement("a");
a.href = imageUrl;
a.download = `${petName}-pawrent.jpg`;
a.click();
```

---

### 27.5 Share Triggers — Where Share Buttons Appear

| Location                         | Card Type          | Share Text                               |
| -------------------------------- | ------------------ | ---------------------------------------- |
| Pet profile card                 | `pet_profile`      | "Meet [Name]! My [breed] 🐾"             |
| After vaccine completion toast   | `vaccine_complete` | "[Name] is fully vaccinated! 💉"         |
| Birthday milestone card (PRP-22) | `birthday`         | "Happy [N]th birthday [Name]! 🎂"        |
| SOS resolved screen              | `sos_found`        | "We found [Name]! Thank you everyone 💛" |
| Quiz result (PRP-28)             | `quiz_result`      | "I'm a [Badge Type] 🐱 Take the quiz!"   |
| Health passport page             | `pet_profile`      | "Here's [Name]'s health passport"        |

---

### 27.6 Pawrent Branding on Cards

Every generated card includes:

- Pawrent logo (bottom-right corner, subtle)
- "pawrent.app" URL watermark
- Card border/frame using CI brand colors (from PRP-14)
- Consistent typography (Sarabun for Thai text)

**Important:** The branding is subtle — the pet and the moment are the hero, not the logo. Overly branded cards don't get shared.

---

## Task Ordering

**27.1 (Card templates design) → 27.2 (OG API) → 27.3 (Meta tags) → 27.4 (Share button) → 27.5 (Wire up triggers) → 27.6 (Brand polish)**

## Verification

```bash
# /api/og?type=vaccine_complete returns 1080x1080 JPEG
# Expired/invalid token returns 401
# Sharing URL in Line shows rich preview (image + title)
# Web Share API opens native share sheet on mobile
# Instagram share via Web Share API (test on real iOS/Android)
# Download saves image to camera roll
# All card types render without broken images
npm run build
# Manual: share a card from Line → verify preview renders
```

## Confidence Score: 7/10

**Risk areas:**

- Satori/ImageResponse with Thai fonts (Sarabun): must include font file in OG route — `fetch()` the font from a public URL at render time
- Web Share API with image files: iOS Safari supports it; Android Chrome supports it; Line in-app browser may not — always show "Download Image" as fallback
- Instagram does not have a direct share URL (unlike Line/Facebook) — Web Share API with image file is the best approach on mobile
- Card generation latency: Satori renders in ~200-500ms — acceptable for share flow but cache generated cards in KV/Redis if frequently accessed
