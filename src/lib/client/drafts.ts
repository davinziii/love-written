"use client";

/**
 * Browser-side draft memory. A CONVENIENCE layer only — the server is authoritative.
 *
 * Stores, per surprise: its id, the customer's own edit token (their credential for this
 * one surprise; never a server secret), the recovery code, and a copy of unsaved text so
 * nothing is lost if a save fails. Photos are not stored here.
 */
export interface LocalDraft {
  surpriseId: string;
  templateId: string;
  editToken: string;
  recoveryCode?: string;
  content?: Record<string, string>;
  style?: Record<string, string>;
  /** true while local text has changes the server hasn't confirmed yet */
  dirty?: boolean;
  updatedAt: number;
}

const KEY = "lw:drafts:v1";
const MAX_DRAFTS = 10;

function readAll(): LocalDraft[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalDraft[]).filter((d) => d && typeof d.surpriseId === "string") : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: LocalDraft[]) {
  try {
    const trimmed = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_DRAFTS);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // storage full or blocked — the server copy still exists
  }
}

export function getLocalDraft(surpriseId: string): LocalDraft | undefined {
  return readAll().find((d) => d.surpriseId === surpriseId);
}

export function putLocalDraft(draft: Omit<LocalDraft, "updatedAt"> & { updatedAt?: number }) {
  const others = readAll().filter((d) => d.surpriseId !== draft.surpriseId);
  const previous = getLocalDraft(draft.surpriseId);
  writeAll([...others, { ...previous, ...draft, updatedAt: draft.updatedAt ?? Date.now() }]);
}

export function removeLocalDraft(surpriseId: string) {
  writeAll(readAll().filter((d) => d.surpriseId !== surpriseId));
}

export function latestLocalDraft(templateId?: string): LocalDraft | undefined {
  return readAll()
    .filter((d) => !templateId || d.templateId === templateId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
