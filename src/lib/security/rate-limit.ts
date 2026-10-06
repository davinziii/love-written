import "server-only";
import { db } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { log } from "@/lib/log";
import { LIMITS, type LimitName } from "./limits";

/**
 * Postgres-backed fixed-window rate limiter (free, works across serverless instances).
 * `failOpen` keeps low-risk endpoints available if the limiter itself is unavailable.
 */
export async function checkRateLimit(
  name: LimitName,
  subject: string,
  { failOpen = false }: { failOpen?: boolean } = {},
): Promise<boolean> {
  const { max, windowSec } = LIMITS[name];
  const { data, error } = await db().rpc("rate_limit_hit", {
    p_key: `${name}:${subject}`,
    p_window_seconds: windowSec,
    p_max: max,
  });
  if (error) {
    log.error("rate_limit_unavailable", { name, error: error.message });
    return failOpen;
  }
  return data === true;
}

export async function enforceRateLimit(name: LimitName, subject: string, opts?: { failOpen?: boolean }) {
  if (!(await checkRateLimit(name, subject, opts))) {
    log.warn("rate_limited", { name });
    throw Errors.rateLimited();
  }
}
