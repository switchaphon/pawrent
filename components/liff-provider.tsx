"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { initializeLiff, getLiffIdToken, isInLiffBrowser, liffLogin, liffLogout } from "@/lib/liff";
import { setAuthToken } from "@/lib/auth-token";
import type { Profile } from "@/lib/types/common";

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  isInLiff: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function LiffProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInLiff, setIsInLiff] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await initializeLiff();
        if (cancelled) return;

        setIsInLiff(isInLiffBrowser());

        const idToken = getLiffIdToken();
        if (!idToken) {
          // In external browser, redirect to LINE Login
          if (!isInLiffBrowser()) {
            liffLogin();
          }
          setLoading(false);
          return;
        }

        // Exchange LINE ID token for Supabase JWT
        const res = await fetch("/api/auth/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setAuthToken(data.access_token);
        setUser(data.user);
      } catch {
        // LIFF init or auth exchange failed
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(() => {
    liffLogout();
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isInLiff, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a LiffProvider");
  }
  return context;
}
