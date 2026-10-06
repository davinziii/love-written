"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { reissueAccessAction, type IssueResult } from "@/app/admin/(dash)/actions";
import { IssuedAccessCard } from "./IssuedAccessCard";

/** "Customer lost their link" → issue a new private link + recovery code. */
export function ReissueAccess({ surpriseId }: { surpriseId: string }) {
  const [state, action, pending] = useActionState<IssueResult | null, FormData>(reissueAccessAction, null);
  if (state?.ok && state.access) return <IssuedAccessCard access={state.access} />;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Issue a new private link? The customer's current link and recovery code will stop working.")) e.preventDefault();
      }}
      className="inline-flex flex-col gap-2"
    >
      <input type="hidden" name="surpriseId" value={surpriseId} />
      <Button type="submit" variant="secondary" busy={pending} className="px-4 py-2 text-sm">
        New customer link
      </Button>
      {state && !state.ok && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}
