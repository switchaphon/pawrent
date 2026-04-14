/**
 * Cursor-based pagination helpers.
 * Cursor = base64-encoded JSON { created_at, id }.
 */

interface CursorPayload {
  created_at: string;
  id: string;
}

export function encodeCursor(createdAt: string, id: string): string {
  const payload: CursorPayload = { created_at: createdAt, id };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (typeof parsed.created_at === "string" && typeof parsed.id === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
