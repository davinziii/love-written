import Link from "next/link";
import { SiteHeader } from "@/components/ui/Brand";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-4xl">Page not found</h1>
        <p className="mt-3 text-ink-soft">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-rose px-6 py-3 font-medium text-white">
          Go home
        </Link>
      </main>
    </>
  );
}
