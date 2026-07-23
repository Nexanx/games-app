"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, X } from "lucide-react";

import { isNavItemActive, mobileMoreGroups, mobilePrimaryItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileMoreGroups.some((group) =>
    group.items.some((item) => isNavItemActive(pathname, item.href))
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-label="Zamknij menu Więcej"
        />
      ) : null}
      {moreOpen ? (
        <section
          id="mobile-more-menu"
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-2xl lg:hidden"
          aria-label="Więcej obszarów"
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold">Więcej</h2>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Zamknij menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {mobileMoreGroups.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 min-w-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                        active && "bg-primary/12 text-primary"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden" aria-label="Nawigacja mobilna">
        <div className="grid grid-cols-5 gap-0.5">
        {mobilePrimaryItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-muted-foreground transition sm:text-[11px]",
                active && "bg-primary/12 text-primary"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full truncate px-1">{item.href === "/poe" ? "PoE" : item.label}</span>
            </Link>
          );
        })}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            className={cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-muted-foreground transition sm:text-[11px]",
              (moreOpen || moreActive) && "bg-primary/12 text-primary"
            )}
          >
            <Ellipsis className="h-5 w-5" aria-hidden="true" />
            <span>Więcej</span>
          </button>
      </div>
    </nav>
    </>
  );
}
