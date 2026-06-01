/**
 * Pure presentation helpers for the Virtual Pet ID Card.
 *
 * Extracted from app/api/pet-card/[petId]/route.tsx so the sex→color/badge logic
 * can be unit-tested in isolation. This logic regressed once (R2 grill, 2026-05-26):
 * the route compared lowercase "male"/"female" while the DB stores "Male"/"Female"
 * (see lib/validations/pets.ts: z.enum(["Male","Female"])), so every card rendered
 * with a neutral gold ring and no GOOD BOY/GIRL badge regardless of sex.
 */

export const CARD_W = 750;
export const CARD_H = 1050;

export const CARD_COLORS = {
  BEIGE: "#FAF7F2",
  BEIGE_ALT: "#F0EDE6",
  GOLD: "#B8730A",
  TEXT_DARK: "#2E2A2E",
  TEXT_MUTED: "#6B6560",
  PINK: "#F06FA8",
  BLUE: "#4A90D9",
  BADGE_RED: "#D32F2F",
  BADGE_GREEN: "#4C6B3C",
} as const;

/**
 * Normalise a stored sex value to "male" | "female" | null.
 * Tolerates casing ("Male"), short forms ("M"/"F") and Thai ("ผู้"/"เมีย").
 */
export function normalizeSex(sex: string | null | undefined): "male" | "female" | null {
  const s = sex?.trim().toLowerCase();
  if (s === "male" || s === "m" || s === "ผู้") return "male";
  if (s === "female" || s === "f" || s === "เมีย") return "female";
  return null;
}

/** Photo-ring colour: pink=female, blue=male, null=unspecified (caller falls back to gold). */
export function sexColor(sex: string | null | undefined): string | null {
  const s = normalizeSex(sex);
  if (s === "female") return CARD_COLORS.PINK;
  if (s === "male") return CARD_COLORS.BLUE;
  return null;
}

/** GOOD BOY / GOOD GIRL badge — null (no badge) when sex is unspecified. */
export function goodBadge(sex: string | null | undefined): { label: string; bg: string } | null {
  const s = normalizeSex(sex);
  if (s === "female") return { label: "GOOD GIRL", bg: CARD_COLORS.BADGE_RED };
  if (s === "male") return { label: "GOOD BOY", bg: CARD_COLORS.BADGE_GREEN };
  return null;
}

/** Thai sex word for the info table: ผู้ / เมีย / — */
export function sexWord(sex: string | null | undefined): string {
  const s = normalizeSex(sex);
  if (s === "female") return "เมีย";
  if (s === "male") return "ผู้";
  return "—";
}

/** Compact age string: "8 เดือน" (under a year) or "3 ขวบ". */
export function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 1) return `${Math.max(months, 0)} เดือน`;
  return `${years} ขวบ`;
}

const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** Thai Buddhist-era short date, e.g. "15 มี.ค. 2565". */
export function formatThaiCardDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** No-photo fallback emoji, matched case- and locale-insensitively. */
export function cardFallbackEmoji(species: string | null | undefined): string {
  const s = species?.toLowerCase() ?? "";
  if (s.includes("cat") || s.includes("แมว")) return "🐱";
  if (s.includes("rabbit") || s.includes("กระต่าย")) return "🐰";
  if (s.includes("bird") || s.includes("นก")) return "🐦";
  return "🐶";
}
