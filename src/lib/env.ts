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
  PRICE_CENTAVOS: z.coerce.number().int().positive().default(19900),
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

/** PayMongo credentials, checked only when a payment feature is actually used. */
export function paymongoSecrets(): { secretKey: string; webhookSecret: string } {
  const { PAYMONGO_SECRET_KEY: secretKey, PAYMONGO_WEBHOOK_SECRET: webhookSecret } = env();
  if (!secretKey || !webhookSecret) {
    throw new Error("PayMongo is not configured: set PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET");
  }
  return { secretKey, webhookSecret };
}

export const isProduction = process.env.NODE_ENV === "production";
