"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "./routes";
import { NavIcon } from "./NavIcon";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
    <div data-app-shell className="flex min-h-full flex-col md:flex-row">
      <a
        href="#main"
        className="focus:bg-accent focus:text-accent-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="border-border bg-surface sticky top-0 z-30 flex items-center justify-between gap-2 border-b px-4 py-3 md:hidden">
        <span className="font-semibold tracking-tight">EngThai Trainer</span>
        <ThemeToggle />
      </header>

      <nav
        aria-label="Main"
        className="border-border bg-surface hidden w-60 shrink-0 border-r p-3 md:flex md:flex-col md:gap-1"
      >
        <div className="px-3 pt-2 pb-4">
          <p className="font-semibold tracking-tight">EngThai Trainer</p>
          <p className="text-muted text-xs" lang="th">
            ฝึกประโยคอังกฤษ–ไทย
          </p>
        </div>
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="mt-auto px-1 pt-4">
          <ThemeToggle />
        </div>
      </nav>

      <main id="main" className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>

      <nav
        aria-label="Main"
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
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
