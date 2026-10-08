"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { LogoMark } from "@/components/ui/Brand";
import { LinkPending } from "@/components/ui/LinkPending";

export interface AttentionCounts {
  failedPublish: number;
  openReports: number;
  cleanupFailed: number;
  photobooth?: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

/**
 * Admin layout chrome: sidebar (drawer on mobile) + top header.
 * Every count shown here is real data passed from the server layout.
 */
export function AdminShell({
  children,
  email,
  attention,
  logout,
}: {
  children: ReactNode;
  email: string | null;
  attention: AttentionCounts;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const main: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "home" },
    { href: "/admin/surprises", label: "Surprises", icon: "gift" },
    { href: "/admin/orders", label: "Orders", icon: "receipt" },
    { href: "/admin/templates", label: "Templates", icon: "layers" },
    { href: "/admin/photobooth", label: "Photobooth", icon: "image", badge: attention.photobooth },
  ];
  const attentionNav: NavItem[] = [
    { href: "/admin/failed-publish", label: "Failed Publish", icon: "alert", badge: attention.failedPublish },
    { href: "/admin/reports", label: "Reports", icon: "flag", badge: attention.openReports },
    { href: "/admin/cleanup", label: "Cleanup", icon: "trash", badge: attention.cleanupFailed },
  ];
  const general: NavItem[] = [
    { href: "/admin/settings", label: "Settings", icon: "settings" },
    { href: "/admin/help", label: "Help", icon: "help" },
  ];

  const total = attention.failedPublish + attention.openReports + attention.cleanupFailed + (attention.photobooth ?? 0);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-6 p-5">
      <Link href="/admin" className="flex items-center gap-2.5 px-2 font-display text-xl">
        <LogoMark size={36} className="shadow-[0_8px_18px_-8px_rgba(196,72,106,0.8)] rounded-[22%]" />
        <span>
          Love<span className="text-rose">,</span> Written
        </span>
      </Link>
      <NavGroup title="Main" items={main} isActive={isActive} />
      <NavGroup title="Needs attention" items={attentionNav} isActive={isActive} />
      <NavGroup title="General" items={general} isActive={isActive}>
        <form action={logout}>
          <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-ink-soft transition hover:bg-white hover:text-ink">
            <Icon.logout size={18} /> Logout
          </button>
        </form>
      </NavGroup>
    </nav>
  );

  return (
    <div className="min-h-svh bg-canvas text-ink lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh overflow-y-auto lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/40 backdrop-blur-sm" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside
            className="animate-fade-up absolute inset-y-0 left-0 w-72 overflow-y-auto bg-canvas shadow-2xl"
            // Close the drawer when a link inside it is followed.
            onClickCapture={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          >
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 p-2 sm:p-3 lg:py-3 lg:pl-0 lg:pr-3">
        <div className="min-h-[calc(100svh-1.5rem)] rounded-[1.75rem] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]">
          <header className="flex items-center gap-3 border-b border-black/[0.05] px-4 py-3 sm:px-6">
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-soft text-ink-soft lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Icon.menu size={19} />
            </button>
            <form action="/admin/search" className="relative flex-1 sm:max-w-md">
              <label htmlFor="admin-search" className="sr-only">
                Search orders
              </label>
              <Icon.search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                id="admin-search"
                name="q"
                placeholder="Search order no., customer or reference"
                className="h-10 w-full rounded-full bg-soft pl-11 pr-4 text-sm outline-none ring-1 ring-transparent transition placeholder:text-ink-soft/70 focus:bg-white focus:ring-rose/40"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Notifications attention={attention} total={total} />
              <div className="hidden items-center gap-2.5 rounded-full bg-soft py-1 pl-1 pr-4 sm:flex">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-medium uppercase text-cream" aria-hidden>
                  {(email ?? "A").slice(0, 1)}
                </span>
                <span className="max-w-40 truncate text-sm">
                  <span className="block text-xs text-ink-soft">Admin</span>
                  {email}
                </span>
              </div>
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavGroup({
  title,
  items,
  isActive,
  children,
}: {
  title: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft/70">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const Glyph = Icon[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                  active ? "bg-white font-medium text-ink shadow-sm" : "text-ink-soft hover:bg-white/70 hover:text-ink"
                }`}
              >
                <span className={`transition ${active ? "text-rose" : "group-hover:text-rose"}`}>
                  <Glyph size={18} />
                </span>
                {item.label}
                <LinkPending className="ml-auto text-rose" />
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-rose px-2 py-0.5 text-[11px] font-semibold text-white">{item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {children && <li>{children}</li>}
      </ul>
    </div>
  );
}

function Notifications({ attention, total }: { attention: AttentionCounts; total: number }) {
  const items = [
    { href: "/admin/failed-publish", n: attention.failedPublish, text: "paid surprise(s) failed to publish" },
    { href: "/admin/reports", n: attention.openReports, text: "open customer report(s)" },
    { href: "/admin/cleanup", n: attention.cleanupFailed, text: "deletion(s) need a retry" },
    { href: "/admin/photobooth?view=attention", n: attention.photobooth ?? 0, text: "photobooth(s) need attention" },
  ].filter((i) => i.n > 0);

  return (
    <details className="relative">
      <summary
        className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-soft text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden"
        aria-label={total ? `${total} items need attention` : "No notifications"}
      >
        <Icon.bell size={18} />
        {total > 0 && <span className="lw-pop absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose ring-2 ring-white" />}
      </summary>
      <div className="animate-fade-up absolute right-0 z-30 mt-2 w-72 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5">
        {items.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-ink-soft">
            <Icon.check size={16} className="text-success" /> All clear — nothing needs attention.
          </p>
        ) : (
          items.map((i) => (
            <Link key={i.href} href={i.href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-soft">
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-petal px-2 text-xs font-semibold text-rose">{i.n}</span>
              {i.text}
            </Link>
          ))
        )}
      </div>
    </details>
  );
}
