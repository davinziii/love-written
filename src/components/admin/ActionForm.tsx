"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/admin/(dash)/actions";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** A single admin action button: disabled while running, shows the result inline. */
export function ActionForm({
  action,
  fields,
  label,
  variant = "secondary",
  confirmText,
  children,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  confirmText?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex flex-col gap-2"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <Button type="submit" variant={variant} busy={pending} className="px-4 py-2 text-sm">
        {label}
      </Button>
      {state && <span className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</span>}
    </form>
  );
}
