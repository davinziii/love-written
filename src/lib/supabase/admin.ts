import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use only in server code after the request
 * has been authorized (edit token, webhook signature, cron secret or admin session).
 */
let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const e = env();
    client = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function mediaBucket() {
  return db().storage.from(env().SUPABASE_MEDIA_BUCKET);
}
