"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "./routes";
import { NavIcon } from "./NavIcon";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      <NavIcon path={item.icon} className="size-5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.primary);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface px-4 py-3 md:hidden">
        <span className="font-semibold tracking-tight">EngThai Trainer</span>
      </header>

      <nav
        aria-label="Main"
        className="hidden w-60 shrink-0 border-r border-border bg-surface p-3 md:flex md:flex-col md:gap-1"
      >
        <div className="px-3 pb-4 pt-2">
          <p className="font-semibold tracking-tight">EngThai Trainer</p>
          <p className="text-xs text-muted" lang="th">
            ฝึกประโยคอังกฤษ–ไทย
          </p>
        </div>
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <main id="main" className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
                active ? "text-accent font-medium" : "text-muted"
              }`}
            >
              <NavIcon path={item.icon} className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
