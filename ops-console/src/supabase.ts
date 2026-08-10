import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(
  supabaseUrl: string,
  publishableKey: string,
): SupabaseClient {
  if (client === null) {
    client = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
      },
    });
  }

  return client;
}
