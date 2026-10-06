import type { Metadata } from "next";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { attentionCounts } from "@/lib/admin/queries";
import { AdminShell } from "@/components/admin/AdminShell";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const admin = await requireAdmin();
  const attention = await attentionCounts();
  return (
    <AdminShell email={admin.email} attention={attention} logout={logoutAction}>
      {children}
    </AdminShell>
  );
}
