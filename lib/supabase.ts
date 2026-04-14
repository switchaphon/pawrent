import { createBrowserClient } from "@supabase/ssr";
import { getAuthToken } from "./auth-token";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: (url: RequestInfo | URL, init?: RequestInit) => {
        const token = getAuthToken();
        const headers = new Headers(init?.headers);
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return fetch(url, { ...init, headers });
      },
    },
  }
);
