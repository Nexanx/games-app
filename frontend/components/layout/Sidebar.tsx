"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-background/85 p-4 backdrop-blur lg:block">
      <div className="flex h-full flex-col">
        <Link href="/" className="flex min-h-14 items-center gap-3 rounded-md px-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Games & PoE</span>
            <span className="text-xs text-muted-foreground">private tracker</span>
          </span>
        </Link>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
          Prywatna aplikacja bez kont, logowania i ról. Dane zapisuje lokalny backend FastAPI.
        </div>
      </div>
    </aside>
  );
}

