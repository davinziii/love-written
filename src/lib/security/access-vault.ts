import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Admin-viewable copy of a customer's private link + recovery code.
 *
 * Edit tokens and recovery codes are still checked against their one-way hashes; this is
 * only so an admin can re-send the link for an unpublished surprise. It's encrypted with
 * AES-256-GCM using a key derived (HKDF) from APP_HASH_PEPPER, so a database leak alone
 * reveals nothing. Requires migration 0004 — every call here is best-effort, so the app
 * keeps working (without the admin copy) before that migration runs.
 */

const VERSION = "v1";

function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", env().APP_HASH_PEPPER, "love-written", "edit-access-v1", 32));
}

/** Encrypt a short secret (AES-256-GCM, authenticated). */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${iv.toString("base64url")}.${body.toString("base64url")}`;
}

/** Decrypt sealSecret() output; null if missing, tampered with or unreadable. */
export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [version, ivPart, bodyPart] = sealed.split(".");
  if (version !== VERSION || !ivPart || !bodyPart) return null;
  try {
    const body = Buffer.from(bodyPart, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function sealAccess(editToken: string, recoveryCode: string): string {
  return sealSecret(JSON.stringify({ t: editToken, c: recoveryCode }));
}

export function openAccess(sealed: string | null | undefined): { editToken: string; recoveryCode: string } | null {
  const plain = openSecret(sealed);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as { t?: unknown; c?: unknown };
    return typeof parsed.t === "string" && typeof parsed.c === "string" ? { editToken: parsed.t, recoveryCode: parsed.c } : null;
  } catch {
    return null;
  }
}

/** Store (or clear, with null) the admin copy. Never throws. */
export async function saveAccess(surpriseId: string, access: { editToken: string; recoveryCode: string } | null): Promise<void> {
  try {
    const { error } = await db()
      .from("surprises")
      .update({ edit_access_enc: access ? sealAccess(access.editToken, access.recoveryCode) : null })
      .eq("id", surpriseId);
    if (error) log.warn("access_vault_save_failed", { surpriseId, message: error.message });
  } catch (err) {
    log.warn("access_vault_save_failed", { surpriseId, message: err instanceof Error ? err.message : String(err) });
  }
}

/** Read the admin copy. Returns null if missing, unreadable, or the column doesn't exist yet. */
export async function loadAccess(surpriseId: string): Promise<{ editToken: string; recoveryCode: string } | null> {
  try {
    const { data, error } = await db().from("surprises").select("edit_access_enc").eq("id", surpriseId).maybeSingle();
    if (error || !data) return null;
    return openAccess((data as { edit_access_enc: string | null }).edit_access_enc);
  } catch {
    return null;
  }
}
