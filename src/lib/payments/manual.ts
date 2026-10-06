import "server-only";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { log } from "@/lib/log";
import { track } from "@/lib/analytics/server";
import {
  generateOrderNumber,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  randomToken,
  sha256Hex,
} from "@/lib/security/tokens";
import { getTemplate } from "@/templates";

/**
 * Manual payment provider (launch workflow).
 *
 * The admin confirms a payment received outside the app (GCash, Maya, bank transfer),
 * then this creates the surprise + PAID order + payment record in one database
 * transaction and returns a private customization link for the customer.
 */

export const MANUAL_PAYMENT_CHANNELS = ["gcash", "maya", "bank_transfer", "other"] as const;
export type ManualPaymentChannel = (typeof MANUAL_PAYMENT_CHANNELS)[number];

export interface ManualOrderInput {
  templateId: string;
  amountCentavos: number;
  channel: ManualPaymentChannel;
  paymentReference?: string;
  customerLabel?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface IssuedAccess {
  surpriseId: string;
  orderNumber: string;
  /** Present only when new credentials were issued (they are never stored in plain text). */
  customizationLink: string | null;
  recoveryCode: string | null;
  replayed: boolean;
}

function newCredentials() {
  const editToken = randomToken();
  const recoveryCode = generateRecoveryCode();
  return {
    editToken,
    recoveryCode,
    editTokenHash: sha256Hex(editToken),
    recoveryCodeHash: hashRecoveryCode(env().APP_HASH_PEPPER, normalizeRecoveryCode(recoveryCode)!),
  };
}

/**
 * The customer's private link. Credentials travel in the URL *fragment* (after `#`):
 * browsers never send it to the server, so it can't leak into server logs or Referer
 * headers. The studio stores it on the device and removes it from the address bar.
 */
export function customizationLink(surpriseId: string, editToken: string, recoveryCode: string): string {
  const site = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const fragment = new URLSearchParams({ access: editToken, code: recoveryCode }).toString();
  return `${site}/studio/${surpriseId}#${fragment}`;
}

export async function createManualOrder(input: ManualOrderInput, adminId: string): Promise<IssuedAccess> {
  const template = getTemplate(input.templateId);
  if (!template) throw Errors.badRequest("Choose a valid template.");

  const creds = newCredentials();
  const { data, error } = await db().rpc("create_manual_order", {
    p_template_id: template.id,
    p_schema_version: template.schemaVersion,
    p_edit_token_hash: creds.editTokenHash,
    p_recovery_code_hash: creds.recoveryCodeHash,
    p_order_number: generateOrderNumber(),
    p_amount_centavos: input.amountCentavos,
    p_idempotency_key: input.idempotencyKey,
    p_customer_label: input.customerLabel?.trim() ?? "",
    p_payment_channel: input.channel,
    p_payment_reference: input.paymentReference?.trim() ?? "",
    p_notes: input.notes?.trim() ?? "",
    p_admin: adminId,
  });
  if (error) throw new Error(`create manual order: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as
    | { surprise_id: string; order_number: string; replayed: boolean; credentials_issued: boolean }
    | undefined;
  if (!row) throw new Error("create manual order: no result");

  log.info("manual_order_created", { surpriseId: row.surprise_id, orderNumber: row.order_number, adminId, replayed: row.replayed });
  if (!row.replayed) {
    await track("payment_successful", { templateId: template.id, surpriseId: row.surprise_id });
  }

  return {
    surpriseId: row.surprise_id,
    orderNumber: row.order_number,
    customizationLink: row.credentials_issued ? customizationLink(row.surprise_id, creds.editToken, creds.recoveryCode) : null,
    recoveryCode: row.credentials_issued ? creds.recoveryCode : null,
    replayed: row.replayed,
  };
}

/**
 * Issue a fresh customization link + recovery code (e.g. the customer lost both).
 * The previous link and code stop working immediately.
 */
export async function reissueAccess(surpriseId: string, adminId: string): Promise<IssuedAccess> {
  const creds = newCredentials();
  const { data, error } = await db()
    .from("surprises")
    .update({ edit_token_hash: creds.editTokenHash, recovery_code_hash: creds.recoveryCodeHash })
    .eq("id", surpriseId)
    .neq("stage", "DELETED")
    .select("id");
  if (error) throw new Error(`reissue access: ${error.message}`);
  if (!data?.length) throw Errors.notFound();

  const { data: order } = await db()
    .from("orders")
    .select("order_number")
    .eq("surprise_id", surpriseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  log.warn("access_reissued", { surpriseId, adminId });
  return {
    surpriseId,
    orderNumber: (order?.order_number as string | undefined) ?? "",
    customizationLink: customizationLink(surpriseId, creds.editToken, creds.recoveryCode),
    recoveryCode: creds.recoveryCode,
    replayed: false,
  };
}
