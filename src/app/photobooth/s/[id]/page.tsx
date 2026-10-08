import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoothApp } from "@/components/photobooth/BoothApp";

export const metadata: Metadata = {
  title: "Your photobooth",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; payment?: string }> };

/**
 * A participant's private photobooth. The credential is the #k=… part of the link, which
 * never reaches this server render — the browser sends it with each API call instead.
 */
export default async function PhotoboothSessionPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const q = await searchParams;
  return <BoothApp sessionId={id} justPaid={q.paid === "1"} cancelled={q.payment === "cancelled"} />;
}
