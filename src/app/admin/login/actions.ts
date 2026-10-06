"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ipKey } from "@/lib/security/request";
import { getAdmin } from "@/lib/admin/auth";
import { log } from "@/lib/log";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function loginAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (!(await checkRateLimit("adminLogin", ipKey(await headers())))) {
    return { error: "Too many attempts. Please wait 15 minutes." };
  }
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log.warn("admin_login_failed");
    return { error: "Those details didn't work." };
  }
  if (!(await getAdmin())) {
    await supabase.auth.signOut();
    return { error: "This account is not an administrator." };
  }
  log.info("admin_login");
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
