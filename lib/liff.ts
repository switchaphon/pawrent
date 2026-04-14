import liff from "@line/liff";

let initPromise: Promise<void> | null = null;

export async function initializeLiff(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

export function getLiffProfile() {
  return liff.getProfile();
}

export function getLiffIdToken(): string | null {
  return liff.getIDToken();
}

export function isInLiffBrowser(): boolean {
  return liff.isInClient();
}

export function liffLogin(): void {
  if (!liff.isLoggedIn()) {
    liff.login();
  }
}

export function liffLogout(): void {
  liff.logout();
}

/**
 * Share content via LINE's shareTargetPicker.
 * Gracefully falls back if not in LIFF browser or feature unavailable.
 * Returns true if share was successful, false otherwise.
 */
export async function liffShareTargetPicker(
  messages: Parameters<typeof liff.shareTargetPicker>[0]
): Promise<boolean> {
  try {
    if (!liff.isInClient()) {
      return false;
    }
    if (!liff.isApiAvailable("shareTargetPicker")) {
      return false;
    }
    const result = await liff.shareTargetPicker(messages);
    // shareTargetPicker resolves with undefined when user cancels
    return result !== undefined;
  } catch {
    return false;
  }
}

/** Reset singleton state — for testing only */
export function resetLiffState(): void {
  initPromise = null;
}
