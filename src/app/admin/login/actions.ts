"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth";
import { db } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ipKey } from "@/lib/security/request";
import { log, errorMessage } from "@/lib/log";
import { describeSetupError } from "@/lib/env";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function loginAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  try {
    if (!(await checkRateLimit("adminLogin", ipKey(await headers())))) {
      return { error: "Too many attempts. Please wait 15 minutes." };
    }
    const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) return { error: "Enter your email and password." };

    const supabase = await authClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      log.warn("admin_login_failed", { reason: error?.message });
      return { error: "Those details didn't work." };
    }

    // Check the allowlist with the user we just signed in (not a re-read of the cookie).
    const { data: admin, error: adminError } = await db()
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (adminError) throw new Error(`admin_users lookup: ${adminError.message}`);
    if (!admin) {
      await supabase.auth.signOut();
      return { error: "This account is not an administrator." };
    }
    log.info("admin_login", { userId: data.user.id });
  } catch (err) {
    log.error("admin_login_error", { error: errorMessage(err) });
    return { error: describeSetupError(err) };
  }
  redirect("/admin"); // outside try: redirect works by throwing
}

export async function logoutAction() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
