"use client";

import { useActionState } from "react";
import { Logo } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { loginAction } from "@/app/admin/login/actions";

/** Admin sign-in form. `setupProblems` lists missing server settings (names only). */
export function LoginForm({ setupProblems }: { setupProblems: string[] }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-[1.75rem] bg-paper p-8 ring-1 ring-line">
        <Logo />
        <h1 className="font-display text-2xl">Admin sign in</h1>
        {setupProblems.length > 0 && (
          <div role="alert" className="rounded-2xl bg-[#fff4e0] p-4 text-sm">
            <p className="font-medium">The server isn&rsquo;t fully set up yet.</p>
            <p className="mt-1 text-ink-soft">Missing or invalid environment variables:</p>
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {setupProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">Add them in Vercel → Settings → Environment Variables, then redeploy.</p>
          </div>
        )}
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-xl border border-line px-3 py-2.5" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-line px-3 py-2.5" />
        </label>
        <Button type="submit" busy={pending} className="w-full">
          Sign in
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </main>
  );
}
