"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StudioState } from "@/lib/studio-types";
import type { CustomerData } from "@/templates/schema";
import { isStyleField, type FieldDef } from "@/templates/types";
import { getTemplate } from "@/templates";
import { canEdit } from "@/lib/lifecycle";
import { api, ClientApiError } from "@/lib/client/api";
import { getLocalDraft, putLocalDraft } from "@/lib/client/drafts";
import { prepareImage, ImagePrepError } from "@/lib/client/image";
import type { ImageState } from "@/components/editor/ImageFieldControl";

export type Phase = "loading" | "unauthorized" | "not_found" | "error" | "ready";
export type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "invalid";
export interface Reveal {
  mode: "now" | "schedule";
  scheduledFor: string | null;
}

const SAVE_DEBOUNCE_MS = 900;
const SAVE_RETRY_MS = 5000;

/**
 * All studio state in one place: loading with the edit token from this device,
 * debounced autosave (mirrored to localStorage so nothing is lost offline) and uploads.
 */
export function useStudio(surpriseId: string) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<StudioState | null>(null);
  const [data, setData] = useState<CustomerData>({ content: {}, style: {} });
  const [reveal, setRevealState] = useState<Reveal>({ mode: "now", scheduledFor: null });
  const [images, setImages] = useState<Record<string, ImageState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [recoveryCode, setRecoveryCode] = useState<string | undefined>();

  const token = useRef<string | null>(null);
  const latest = useRef({ data, reveal });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  latest.current = { data, reveal };

  const template = state ? getTemplate(state.templateId) : undefined;

  const applyState = useCallback((s: StudioState, opts: { keepLocalData: boolean }) => {
    setState(s);
    if (!opts.keepLocalData) {
      setData({ content: s.content, style: s.style });
      setRevealState({ mode: s.revealMode, scheduledFor: s.scheduledFor });
    }
    setImages((prev) => {
      const next: Record<string, ImageState> = {};
      for (const [field, url] of Object.entries(s.media)) next[field] = { url };
      // keep in-flight uploads
      for (const [field, img] of Object.entries(prev)) if (img.uploading) next[field] = img;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    adoptAccessFromLink(surpriseId);
    const local = getLocalDraft(surpriseId);
    if (!local?.editToken) {
      setPhase("unauthorized");
      return;
    }
    token.current = local.editToken;
    setRecoveryCode(local.recoveryCode);
    try {
      const s = await api<StudioState>(`/api/surprises/${surpriseId}`, { editToken: local.editToken });
      const restoreLocal = Boolean(local.dirty && local.content && canEdit(s.stage));
      applyState(s, { keepLocalData: false });
      if (restoreLocal) {
        setData({ content: local.content ?? {}, style: local.style ?? s.style });
        dirty.current = true;
      }
      putLocalDraft({ surpriseId, templateId: s.templateId, editToken: local.editToken, content: s.content, style: s.style, dirty: restoreLocal });
      setPhase("ready");
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) setPhase("unauthorized");
      else if (err instanceof ClientApiError && err.status === 404) setPhase("not_found");
      else setPhase("error");
    }
  }, [surpriseId, applyState]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Re-read server state (after payment, publish, etc.). */
  const refresh = useCallback(async () => {
    if (!token.current) return null;
    const s = await api<StudioState>(`/api/surprises/${surpriseId}`, { editToken: token.current });
    applyState(s, { keepLocalData: dirty.current && canEdit(s.stage) });
    return s;
  }, [surpriseId, applyState]);

  const doSave = useCallback(async (): Promise<boolean> => {
    if (!dirty.current || !token.current) return true;
    dirty.current = false;
    const snapshot = latest.current;
    setSaveStatus("saving");
    try {
      await api(`/api/surprises/${surpriseId}`, {
        method: "PATCH",
        editToken: token.current,
        body: { content: snapshot.data.content, style: snapshot.data.style, reveal: snapshot.reveal },
      });
      if (!dirty.current) putLocalDraft({ surpriseId, templateId: state?.templateId ?? "", editToken: token.current, dirty: false });
      setErrors({});
      setSaveStatus("saved");
      return true;
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 422) {
        setErrors(err.fields ?? {});
        setSaveStatus("invalid");
        return false;
      }
      if (err instanceof ClientApiError && (err.code === "LOCKED" || err.status === 401)) {
        setSaveStatus("idle");
        void refresh().catch(() => undefined);
        return false;
      }
      // Network / server trouble: keep it dirty and retry. The local copy is safe.
      dirty.current = true;
      setSaveStatus("retrying");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_RETRY_MS);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surpriseId, state?.templateId, refresh]);

  /** Save now (serialized so saves never overlap or arrive out of order). */
  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(doSave, doSave);
    return chain.current;
  }, [doSave]);

  const markDirty = useCallback(
    (next: CustomerData) => {
      dirty.current = true;
      if (token.current && state) {
        putLocalDraft({ surpriseId, templateId: state.templateId, editToken: token.current, content: next.content, style: next.style, dirty: true });
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush, state, surpriseId],
  );

  const setField = useCallback(
    (field: FieldDef, value: string) => {
      const prev = latest.current.data;
      const bucket = isStyleField(field) ? "style" : "content";
      const next = { ...prev, [bucket]: { ...prev[bucket], [field.id]: value } };
      latest.current = { ...latest.current, data: next };
      setData(next);
      markDirty(next);
      setErrors((prev) => {
        if (!prev[field.id]) return prev;
        const { [field.id]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [markDirty],
  );

  const setReveal = useCallback(
    (next: Reveal) => {
      setRevealState(next);
      latest.current = { ...latest.current, reveal: next };
      markDirty(latest.current.data);
    },
    [markDirty],
  );

  const uploadImage = useCallback(
    async (field: FieldDef, file: File) => {
      if (!token.current) return;
      const previous = images[field.id];
      const preview = URL.createObjectURL(file);
      setImages((p) => ({ ...p, [field.id]: { url: preview, uploading: true } }));
      try {
        const blob = await prepareImage(file);
        const form = new FormData();
        form.append("fieldId", field.id);
        form.append("file", blob, "photo");
        const res = await api<{ url: string | null }>(`/api/surprises/${surpriseId}/media`, {
          method: "POST",
          editToken: token.current,
          body: form,
        });
        setImages((p) => ({ ...p, [field.id]: { url: res.url ?? preview } }));
        setErrors((prev) => {
          const { [field.id]: _removed, ...rest } = prev;
          return rest;
        });
      } catch (err) {
        const message =
          err instanceof ImagePrepError || err instanceof ClientApiError
            ? err.message
            : "We couldn't upload that photo. Please try again.";
        setImages((p) => ({ ...p, [field.id]: { url: previous?.url, error: message } }));
        URL.revokeObjectURL(preview);
      }
    },
    [images, surpriseId],
  );

  const removeImage = useCallback(
    async (field: FieldDef) => {
      if (!token.current) return;
      const previous = images[field.id];
      setImages((p) => ({ ...p, [field.id]: { uploading: true, url: previous?.url } }));
      try {
        await api(`/api/surprises/${surpriseId}/media?fieldId=${encodeURIComponent(field.id)}`, {
          method: "DELETE",
          editToken: token.current,
        });
        setImages((p) => {
          const { [field.id]: _removed, ...rest } = p;
          return rest;
        });
      } catch (err) {
        setImages((p) => ({
          ...p,
          [field.id]: { url: previous?.url, error: err instanceof ClientApiError ? err.message : "Couldn't remove the photo." },
        }));
      }
    },
    [images, surpriseId],
  );

  // Save before the tab closes, if possible.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  const imageFieldsPresent = useMemo(
    () => new Set(Object.entries(images).filter(([, v]) => v.url && !v.uploading).map(([k]) => k)),
    [images],
  );
  const imageUrls = useMemo(
    () => Object.fromEntries(Object.entries(images).map(([k, v]) => [k, v.url])),
    [images],
  );
  const uploading = Object.values(images).some((i) => i.uploading);

  return {
    phase,
    state,
    template,
    data,
    reveal,
    images,
    imageUrls,
    imageFieldsPresent,
    uploading,
    errors,
    setErrors,
    saveStatus,
    recoveryCode,
    editToken: () => token.current,
    reload: load,
    refresh,
    flush,
    setField,
    setReveal,
    uploadImage,
    removeImage,
  };
}

export type Studio = ReturnType<typeof useStudio>;

/**
 * Private customization links (manual workflow) look like
 *   /studio/<id>#access=<edit token>&code=<recovery code>
 * The fragment never reaches the server. Save it on this device, then strip it from the
 * address bar so it isn't left in history or accidentally shared in a screenshot.
 */
function adoptAccessFromLink(surpriseId: string) {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const editToken = params.get("access");
  if (!editToken || !/^[A-Za-z0-9_-]{43}$/.test(editToken)) return;
  const code = params.get("code") ?? undefined;
  const existing = getLocalDraft(surpriseId);
  putLocalDraft({
    surpriseId,
    templateId: existing?.templateId ?? "",
    editToken,
    recoveryCode: code,
    // A newer link replaces any old credentials on this device; local edits made with an
    // old token can't be saved anyway, so don't try to restore them.
    dirty: existing?.editToken === editToken ? existing.dirty : false,
  });
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
