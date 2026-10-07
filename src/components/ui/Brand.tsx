import Image from "next/image";
import Link from "next/link";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { listedTemplates } from "@/templates";
import { ORDER_CONTACT, isManualPayments } from "@/lib/payments/mode";

/** The Love, Written app mark (public/logo.png — also the favicon in src/app/icon.png). */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <Image src="/logo.png" alt="" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden />;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 font-display text-xl tracking-tight text-ink ${className}`}>
      <LogoMark size={30} className="transition duration-300 group-hover:-rotate-6 group-hover:scale-110" />
      <span>
        Love<span className="text-rose">,</span> Written
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/50 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link href="/surprises" className="hidden rounded-full px-3 py-2 text-ink-soft transition hover:bg-white/70 hover:text-ink md:inline-block">
            Templates
          </Link>
          <Link href="/#how-it-works" className="hidden rounded-full px-3 py-2 text-ink-soft transition hover:bg-white/70 hover:text-ink md:inline-block">
            How it works
          </Link>
          <Link href="/faq" className="hidden rounded-full px-3 py-2 text-ink-soft transition hover:bg-white/70 hover:text-ink sm:inline-block">
            FAQ
          </Link>
          <Link href="/recover" className="rounded-full px-3 py-2 text-ink-soft transition hover:bg-white/70 hover:text-ink">
            Find my surprise
          </Link>
          <Link
            href="/surprises"
            className="lw-press ml-1 hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 font-medium text-cream hover:bg-rose sm:inline-flex"
          >
            <HeartIcon size={14} /> Pick a Surprise
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const templates = listedTemplates();
  const year = new Date().getFullYear();
  return (
    <footer className="relative isolate overflow-hidden bg-[#2b1d22] text-cream">
      <div aria-hidden className="absolute -left-32 -top-40 -z-10 h-96 w-96 rounded-full bg-rose/30 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 right-0 -z-10 h-80 w-80 rounded-full bg-[#8a5a7a]/30 blur-3xl" />
      <HeartIcon size={220} className="pointer-events-none absolute -right-10 top-10 -z-10 rotate-12 text-white/[0.03]" />

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-display text-3xl tracking-tight">
              <LogoMark size={34} />
              <span>
                Love<span className="text-rose">,</span> Written
              </span>
            </Link>
            <p className="mt-4 max-w-sm leading-relaxed text-cream/65">
              Private, interactive digital surprises made from your words and photos — for the people you love.
            </p>
            {isManualPayments && ORDER_CONTACT.url && (
              <a
                href={ORDER_CONTACT.url}
                target="_blank"
                rel="noopener noreferrer"
                className="lw-press mt-6 inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-deep"
              >
                <Icon.message size={16} /> {ORDER_CONTACT.label}
              </a>
            )}
          </div>

          <FooterColumn title="Surprises">
            {templates.map((t) => (
              <FooterLink key={t.id} href={`/surprises/${t.id}`}>
                {t.name}
              </FooterLink>
            ))}
            <FooterLink href="/surprises">All templates</FooterLink>
          </FooterColumn>

          <FooterColumn title="How it works">
            <FooterLink href="/#how-it-works">The process</FooterLink>
            <FooterLink href="/faq">Pricing &amp; FAQ</FooterLink>
          </FooterColumn>

          <FooterColumn title="Help">
            <FooterLink href="/recover">Find my surprise</FooterLink>
            <FooterLink href="/faq">Questions</FooterLink>
            {ORDER_CONTACT.url && (
              <li>
                <a href={ORDER_CONTACT.url} target="_blank" rel="noopener noreferrer" className="text-cream/65 transition hover:text-cream">
                  Contact us
                </a>
              </li>
            )}
          </FooterColumn>

          <FooterColumn title="Legal">
            <FooterLink href="/privacy">Privacy Notice</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="/terms#acceptable-use">Community rules</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Love, Written. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Made with <HeartIcon size={12} className="text-rose" /> · Surprises stay online for 30 days
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-cream/65 transition hover:text-cream">
        {children}
      </Link>
    </li>
  );
}
