import type { Metadata } from "next";
import { connection } from "next/server";
import { envProblems } from "@/lib/env";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  await connection();
  return <LoginForm setupProblems={envProblems()} />;
}
