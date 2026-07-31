import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";

// True only once the real project credentials have been filled in.
export const supabaseConfigured =
  /^https:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

// Session is persisted in AsyncStorage so the user stays signed in across
// launches. No URL-based session detection on native.
export const supabase = createClient(
  supabaseConfigured ? SUPABASE_URL : "https://placeholder.supabase.co",
  supabaseConfigured ? SUPABASE_ANON_KEY : "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
