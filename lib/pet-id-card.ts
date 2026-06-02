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
  SAGE: "#8B9A6E",
  PAPERCLIP: "#D4664E",
  STAT_PAW: "#E8A0A0",
  STAT_PAW_DIM: "#F2D5D5",
  FOOTER_PINK: "#E91E63",
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

// ── R3 card helpers ─────────────────────────────────────────────

const TH_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export function formatThaiCardDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function sexWordCard(sex: string | null | undefined): string {
  const s = normalizeSex(sex);
  if (s === "female") return "หญิง";
  if (s === "male") return "ชาย";
  return "—";
}

export interface PetTrait {
  label: string;
  score: number;
}

export function petPersonality(name: string): PetTrait[] {
  let h = 0;
  for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  h = Math.abs(h);
  return [
    { label: "พลังงาน", score: (h % 3) + 3 },
    { label: "การเข้าสังคม", score: ((h >> 4) % 3) + 3 },
    { label: "ความอ้อน", score: ((h >> 8) % 3) + 3 },
    { label: "ฝึกง่ายหัวไว", score: ((h >> 12) % 3) + 3 },
  ];
}

export function pawPrintSvg(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 32">` +
      `<ellipse cx="15" cy="24" rx="7" ry="6" fill="${color}"/>` +
      `<ellipse cx="5" cy="13" rx="3.5" ry="4" fill="${color}"/>` +
      `<ellipse cx="11" cy="7" rx="3.5" ry="4" fill="${color}"/>` +
      `<ellipse cx="19" cy="7" rx="3.5" ry="4" fill="${color}"/>` +
      `<ellipse cx="25" cy="13" rx="3.5" ry="4" fill="${color}"/>` +
      `</svg>`
  )}`;
}

export function paperclipSvg(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 64">` +
      `<path d="M15,3 C9,3 5,7 5,13 L5,44 C5,52 9,56 15,56 C21,56 25,52 25,44 L25,18 ` +
      `C25,13 22,10 18,10 C14,10 11,13 11,18 L11,40" ` +
      `fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
      `</svg>`
  )}`;
}

const SEAL_PATH =
  "M50.0,4.0 L60.9,9.4 L73.0,10.2 L79.7,20.3 L89.8,27.0 L90.6,39.1 " +
  "L96.0,50.0 L90.6,60.9 L89.8,73.0 L79.7,79.7 L73.0,89.8 L60.9,90.6 " +
  "L50.0,96.0 L39.1,90.6 L27.0,89.8 L20.3,79.7 L10.2,73.0 L9.4,60.9 " +
  "L4.0,50.0 L9.4,39.1 L10.2,27.0 L20.3,20.3 L27.0,10.2 L39.1,9.4 Z";

export function sealBadgeSvg(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
      `<path d="${SEAL_PATH}" fill="${color}"/>` +
      `</svg>`
  )}`;
}
