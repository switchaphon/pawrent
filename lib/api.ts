import { getAuthToken, setAuthToken } from "./auth-token";

// @line/liff requires a browser environment — importing it at the top level
// would blow up in any Node/Edge context.  getLiffIdToken is dynamically
// imported inside the 401 handler so this module stays SSR-safe.

export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    // 401 silent re-auth — one attempt only, and never recurse into the auth
    // route itself (that would loop if the auth route itself returns 401).
    if (res.status === 401 && !url.includes("/api/auth/line")) {
      const freshToken = await tryRefreshToken();
      if (freshToken) {
        // Retry the original request with the new token.
        const retryHeaders: Record<string, string> = {
          ...((options.headers as Record<string, string>) || {}),
          Authorization: `Bearer ${freshToken}`,
        };
        if (!(options.body instanceof FormData)) {
          retryHeaders["Content-Type"] = "application/json";
        }
        const retryRes = await fetch(url, { ...options, headers: retryHeaders });
        const retryData = await retryRes.json();
        if (!retryRes.ok) {
          throw new Error(retryData.error || "Request failed");
        }
        return retryData;
      }
    }

    throw new Error(data.error || "Request failed");
  }

  return data;
}

// ---------------------------------------------------------------------------
// tryRefreshToken
//
// Attempts a silent LIFF re-auth by getting a fresh id_token from the LIFF
// singleton and exchanging it at /api/auth/line.
//
// Returns the new access token string on success, or null on any failure
// (no LIFF environment, LIFF not initialised, network error, etc.).
//
// The dynamic import keeps @line/liff out of the SSR bundle — liff.ts itself
// guards on browser availability; we just avoid importing at module top.
// ---------------------------------------------------------------------------
async function tryRefreshToken(): Promise<string | null> {
  try {
    // Dynamic import — SSR-safe; no-ops gracefully if LIFF is absent.
    // Uses alias path so tests can mock it via vi.mock("@/lib/liff", ...).
    // Any import failure is caught by the outer try/catch below.
    const liffModule = await import("@/lib/liff");

    const idToken = liffModule.getLiffIdToken();
    if (!idToken) return null;

    const res = await fetch("/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const freshToken: string | undefined = data.access_token;
    if (!freshToken) return null;

    setAuthToken(freshToken);
    return freshToken;
  } catch {
    // LIFF unavailable (import failed, SSR, uninitialised) → give up silently.
    return null;
  }
}
