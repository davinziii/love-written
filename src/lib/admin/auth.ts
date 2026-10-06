import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/auth";
import { db } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

export interface AdminUser {
  id: string;
  email: string | null;
}

/** Returns the admin or null. Checks the Supabase Auth session AND the admin_users allowlist. */
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser(); // validated with Supabase, not just the cookie
  if (error || !data.user) return null;
  const { data: row } = await db().from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!row) {
    log.warn("admin_access_denied", { userId: data.user.id });
    return null;
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
