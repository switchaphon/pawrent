import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLiff = vi.hoisted(() => ({
  init: vi.fn().mockResolvedValue(undefined),
  getProfile: vi.fn().mockResolvedValue({
    userId: "U1234567890",
    displayName: "Test User",
    pictureUrl: "https://example.com/avatar.jpg",
  }),
  getIDToken: vi.fn().mockReturnValue("mock-id-token"),
  isInClient: vi.fn().mockReturnValue(false),
  isLoggedIn: vi.fn().mockReturnValue(true),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@line/liff", () => ({
  default: mockLiff,
}));

import {
  initializeLiff,
  getLiffProfile,
  getLiffIdToken,
  isInLiffBrowser,
  liffLogin,
  liffLogout,
  resetLiffState,
} from "@/lib/liff";

describe("lib/liff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLiffState();
  });

  describe("initializeLiff", () => {
    it("calls liff.init with the correct LIFF ID", async () => {
      await initializeLiff();
      expect(mockLiff.init).toHaveBeenCalledWith({
        liffId: process.env.NEXT_PUBLIC_LIFF_ID,
      });
    });

    it("only initializes once (singleton)", async () => {
      await initializeLiff();
      await initializeLiff();
      expect(mockLiff.init).toHaveBeenCalledTimes(1);
    });

    it("throws meaningful error on init failure", async () => {
      mockLiff.init.mockRejectedValueOnce(new Error("LIFF init failed"));
      await expect(initializeLiff()).rejects.toThrow("LIFF init failed");
    });
  });

  describe("getLiffProfile", () => {
    it("returns LINE profile data", async () => {
      const profile = await getLiffProfile();
      expect(profile).toEqual({
        userId: "U1234567890",
        displayName: "Test User",
        pictureUrl: "https://example.com/avatar.jpg",
      });
    });
  });

  describe("getLiffIdToken", () => {
    it("returns ID token when logged in", () => {
      expect(getLiffIdToken()).toBe("mock-id-token");
    });

    it("returns null when no token available", () => {
      mockLiff.getIDToken.mockReturnValueOnce(null);
      expect(getLiffIdToken()).toBeNull();
    });
  });

  describe("isInLiffBrowser", () => {
    it("returns false when not in LIFF client", () => {
      mockLiff.isInClient.mockReturnValueOnce(false);
      expect(isInLiffBrowser()).toBe(false);
    });

    it("returns true when in LIFF client", () => {
      mockLiff.isInClient.mockReturnValueOnce(true);
      expect(isInLiffBrowser()).toBe(true);
    });
  });

  describe("liffLogin", () => {
    it("calls liff.login when not logged in", () => {
      mockLiff.isLoggedIn.mockReturnValueOnce(false);
      liffLogin();
      expect(mockLiff.login).toHaveBeenCalled();
    });

    it("does not call liff.login when already logged in", () => {
      mockLiff.isLoggedIn.mockReturnValueOnce(true);
      liffLogin();
      expect(mockLiff.login).not.toHaveBeenCalled();
    });
  });

  describe("liffLogout", () => {
    it("calls liff.logout", () => {
      liffLogout();
      expect(mockLiff.logout).toHaveBeenCalled();
    });
  });
});
