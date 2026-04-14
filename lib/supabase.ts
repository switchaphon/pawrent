import { createClient } from "@supabase/supabase-js";
import { getAuthToken } from "./auth-token";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    accessToken: async () => {
      const token = getAuthToken();
      console.log("[supabase] accessToken called, hasToken:", !!token);
      return token || "";
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
