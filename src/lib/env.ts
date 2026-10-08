import "server-only";
import { z } from "zod";

/**
 * Server environment. Secrets are read lazily (so `next build` works without them)
 * and are only importable from server code thanks to `server-only`.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_MEDIA_BUCKET: z.string().default("surprise-media"),
  // Optional so the site works before PayMongo is set up; required by paymongoSecrets().
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  PAYMONGO_MODE: z.enum(["test", "live"]).default("test"),
  PAYMONGO_PAYMENT_METHODS: z.string().default("gcash,paymaya,qrph,card"),
  PRICE_CENTAVOS: z.coerce.number().int().positive().default(9900),
  PHOTOBOOTH_PRICE_CENTAVOS: z.coerce.number().int().positive().default(5000),
  APP_HASH_PEPPER: z.string().min(24, "APP_HASH_PEPPER must be at least 24 characters"),
  CRON_SECRET: z.string().min(16),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  LW_FAULT_INJECT_PUBLISH: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Missing or invalid environment variables: ${names}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/**
 * Names of environment variables that are missing or invalid (never their values).
 * Used to show the site owner a clear setup message instead of a crash.
 */
export function envProblems(): string[] {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => {
    const name = i.path.join(".");
    if (name === "NEXT_PUBLIC_SITE_URL" || name.endsWith("_URL")) return `${name} (must be a full address starting with https://)`;
    if (name === "APP_HASH_PEPPER") return `${name} (at least 24 characters)`;
    if (name === "CRON_SECRET") return `${name} (at least 16 characters)`;
    return name;
  });
}

/** A safe, actionable explanation of a server setup failure for the admin. */
export function describeSetupError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith("Missing or invalid environment variables")) {
    return `Server setup is incomplete. Check these environment variables: ${envProblems().join(", ")}. After changing them on Vercel, redeploy.`;
  }
  if (/rate_limit_hit|admin_users|relation .* does not exist|Could not find the (function|table)/i.test(message)) {
    return "The database isn't fully set up. Run supabase/migrations/0001_init.sql (and 0002) in the Supabase SQL Editor.";
  }
  if (/Invalid API key|JWT|apikey/i.test(message)) {
    return "Supabase rejected the API keys. Check NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY match your project, then redeploy.";
  }
  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(message)) {
    return "The server couldn't reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL is your project's URL (https://xxxx.supabase.co).";
  }
  return "Sign-in failed because of a server error. Check Vercel → your project → Logs for “admin_login_error”.";
}

/** PayMongo credentials, checked only when a payment feature is actually used. */
export function paymongoSecrets(): { secretKey: string; webhookSecret: string } {
  const { PAYMONGO_SECRET_KEY: secretKey, PAYMONGO_WEBHOOK_SECRET: webhookSecret } = env();
  if (!secretKey || !webhookSecret) {
    throw new Error("PayMongo is not configured: set PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET");
  }
  return { secretKey, webhookSecret };
}

export const isProduction = process.env.NODE_ENV === "production";
