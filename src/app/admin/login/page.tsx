"use client";

import { useActionState } from "react";
import { Logo } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-[1.75rem] bg-paper p-8 ring-1 ring-line">
        <Logo />
        <h1 className="font-display text-2xl">Admin sign in</h1>
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
