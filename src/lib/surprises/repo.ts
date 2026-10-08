import "server-only";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import type { MediaRow, OrderRow, PaymentRow, PublishOperationRow, SurpriseRow } from "@/lib/db-types";
import { UNIQUE_VIOLATION } from "@/lib/db-types";
import { draftExpiryFrom } from "@/lib/lifecycle";
import { getTemplate } from "@/templates";
import type { CustomerData } from "@/templates/schema";
import {
  EDIT_TOKEN_PATTERN,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  PUBLIC_TOKEN_PATTERN,
  randomToken,
  safeEqual,
  sha256Hex,
} from "@/lib/security/tokens";
import { signedUrls } from "@/lib/media/storage";
import { saveAccess } from "@/lib/security/access-vault";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getSurprise(id: string): Promise<SurpriseRow | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db().from("surprises").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`load surprise: ${error.message}`);
  return data as SurpriseRow | null;
}

export async function getSurpriseByPublicToken(token: string): Promise<SurpriseRow | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return null;
  const { data, error } = await db().from("surprises").select("*").eq("public_token", token).maybeSingle();
  if (error) throw new Error(`load surprise by token: ${error.message}`);
  return data as SurpriseRow | null;
}

/**
 * Edit authorization: the caller must hold the surprise's edit token.
 * The public viewing token never grants this.
 */
export async function authorizeEdit(id: string, editToken: string | null): Promise<SurpriseRow> {
  if (!editToken || !EDIT_TOKEN_PATTERN.test(editToken)) throw Errors.unauthorized();
  const row = await getSurprise(id);
  if (!row) throw Errors.notFound();
  if (!safeEqual(row.edit_token_hash, sha256Hex(editToken))) throw Errors.unauthorized();
  return row;
}

export async function createDraft(templateId: string) {
  const template = getTemplate(templateId);
  // Hidden templates keep working for existing surprises but can't start new ones.
  if (!template || !template.listed) throw Errors.badRequest("That template isn't available.");
  const pepper = env().APP_HASH_PEPPER;

  // A recovery-code hash collision is astronomically unlikely; retry once anyway.
  for (let attempt = 0; attempt < 2; attempt++) {
    const editToken = randomToken();
    const recoveryCode = generateRecoveryCode();
    const { data, error } = await db()
      .from("surprises")
      .insert({
        template_id: template.id,
        schema_version: template.schemaVersion,
        edit_token_hash: sha256Hex(editToken),
        recovery_code_hash: hashRecoveryCode(pepper, normalizeRecoveryCode(recoveryCode)!),
        draft_expires_at: draftExpiryFrom(new Date()).toISOString(),
      })
      .select("*")
      .single();
    if (!error) {
      await saveAccess((data as SurpriseRow).id, { editToken, recoveryCode });
      return { row: data as SurpriseRow, editToken, recoveryCode };
    }
    if (error.code !== UNIQUE_VIOLATION) throw new Error(`create draft: ${error.message}`);
  }
  throw new Error("create draft: could not allocate recovery code");
}

/** Redeem a recovery code: issues a fresh edit token (the previous one stops working). */
export async function redeemRecoveryCode(code: string) {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return null;
  const hash = hashRecoveryCode(env().APP_HASH_PEPPER, normalized);
  const { data, error } = await db()
    .from("surprises")
    .select("id, template_id, stage")
    .eq("recovery_code_hash", hash)
    .maybeSingle();
  if (error) throw new Error(`recover: ${error.message}`);
  if (!data || data.stage === "DELETED") return null;

  const editToken = randomToken();
  const { error: updError } = await db()
    .from("surprises")
    .update({ edit_token_hash: sha256Hex(editToken) })
    .eq("id", data.id);
  if (updError) throw new Error(`recover rotate: ${updError.message}`);
  await saveAccess(data.id as string, { editToken, recoveryCode: `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8)}` });
  return { surpriseId: data.id as string, templateId: data.template_id as string, editToken };
}

/**
 * Record that the customer (not an admin) opened their surprise. Drives the 60-day rule for
 * unpublished paid surprises. Written at most once an hour to keep reads cheap.
 */
export async function touchCustomerActivity(row: SurpriseRow): Promise<void> {
  if (Date.now() - new Date(row.last_customer_activity_at).getTime() < 3_600_000) return;
  await db().from("surprises").update({ last_customer_activity_at: new Date().toISOString() }).eq("id", row.id);
}

export function customerData(row: SurpriseRow): CustomerData {
  return { content: row.content ?? {}, style: row.style ?? {} };
}

export async function getMedia(surpriseId: string): Promise<MediaRow[]> {
  const { data, error } = await db().from("media").select("*").eq("surprise_id", surpriseId);
  if (error) throw new Error(`load media: ${error.message}`);
  return (data ?? []) as MediaRow[];
}

export function mediaFieldSet(media: MediaRow[]): Set<string> {
  return new Set(media.map((m) => m.field_id));
}

/** field id → short-lived signed URL */
export async function mediaUrlsByField(media: MediaRow[]): Promise<Record<string, string>> {
  const urls = await signedUrls(media.map((m) => m.storage_path));
  const out: Record<string, string> = {};
  for (const m of media) {
    const url = urls.get(m.storage_path);
    if (url) out[m.field_id] = url;
  }
  return out;
}

export async function latestOrder(surpriseId: string): Promise<OrderRow | null> {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("surprise_id", surpriseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load order: ${error.message}`);
  return data as OrderRow | null;
}

export async function paidOrderWithPayment(
  surpriseId: string,
): Promise<{ order: OrderRow; payment: PaymentRow | null } | null> {
  const { data: order, error } = await db()
    .from("orders")
    .select("*")
    .eq("surprise_id", surpriseId)
    .eq("status", "PAID")
    .maybeSingle();
  if (error) throw new Error(`load paid order: ${error.message}`);
  if (!order) return null;
  const { data: payment } = await db()
    .from("payments")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { order: order as OrderRow, payment: (payment as PaymentRow | null) ?? null };
}

export async function latestPublishOperation(surpriseId: string): Promise<PublishOperationRow | null> {
  const { data, error } = await db()
    .from("publish_operations")
    .select("*")
    .eq("surprise_id", surpriseId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load publish op: ${error.message}`);
  return data as PublishOperationRow | null;
}

export function publicUrl(token: string | null): string | null {
  return token ? `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/s/${token}` : null;
}
