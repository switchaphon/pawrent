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

/** Reset singleton state — for testing only */
export function resetLiffState(): void {
  initPromise = null;
}
