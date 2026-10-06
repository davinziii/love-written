import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioApp } from "@/components/studio/StudioApp";

export const metadata: Metadata = {
  title: "Your surprise",
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ surpriseId: string }> };

/** Customer studio. All data is loaded client-side with this device's edit token. */
export default async function StudioPage({ params }: Props) {
  const { surpriseId } = await params;
  return (
    <Suspense>
      <StudioApp surpriseId={surpriseId} />
    </Suspense>
  );
}
