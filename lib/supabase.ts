import { createClient } from "@supabase/supabase-js";
import { getAuthToken } from "./auth-token";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    accessToken: async () => {
      return getAuthToken() || "";
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
