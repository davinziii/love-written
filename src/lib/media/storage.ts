import "server-only";
import { randomUUID } from "node:crypto";
import { mediaBucket } from "@/lib/supabase/admin";

/**
 * Storage layer. Everything that touches the object store goes through here, so moving
 * from Supabase Storage to another provider later means rewriting only this file.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function surpriseFolder(surpriseId: string): string {
  return `surprises/${surpriseId}`;
}

/** Server-generated object name — the customer's filename is never used. */
export function newMediaPath(surpriseId: string): string {
  return `${surpriseFolder(surpriseId)}/${randomUUID()}.webp`;
}

export async function putImage(path: string, buffer: Buffer): Promise<void> {
  const { error } = await mediaBucket().upload(path, buffer, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await mediaBucket().remove(paths);
  if (error) throw new Error(`storage remove failed: ${error.message}`);
}

/** All object paths currently stored for a surprise. */
export async function listSurpriseObjects(surpriseId: string): Promise<string[]> {
  const folder = surpriseFolder(surpriseId);
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await mediaBucket().list(folder, { limit: 100, offset });
    if (error) throw new Error(`storage list failed: ${error.message}`);
    for (const obj of data) if (obj.id) paths.push(`${folder}/${obj.name}`);
    if (data.length < 100) break;
  }
  return paths;
}

/** Short-lived signed URLs for private media. */
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await mediaBucket().createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`signing failed: ${error.message}`);
  for (const item of data) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}
