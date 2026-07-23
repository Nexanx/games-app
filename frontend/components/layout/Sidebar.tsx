"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AppLogo } from "@/components/branding/AppLogo";
import { isNavItemActive, navGroups } from "@/components/layout/nav-items";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-background/90 backdrop-blur transition-[width,padding] duration-200 lg:block",
        collapsed ? "w-20 p-3" : "w-64 p-4"
      )}
    >
      <div className="flex h-full flex-col">
        <Link
          href="/"
          className={cn("flex min-h-14 items-center rounded-md", collapsed ? "justify-center" : "gap-3 px-2")}
          aria-label={collapsed ? APP_NAME : undefined}
        >
          <AppLogo className="h-11 w-11" />
          <span className={cn("min-w-0", collapsed && "sr-only")}>
            <span className="block truncate text-sm font-semibold">{APP_NAME}</span>
            <span className="block truncate text-xs text-muted-foreground">gry i statystyki</span>
          </span>
        </Link>
        <nav className="mt-5 flex-1 space-y-4" aria-label="Główna nawigacja">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p
                className={cn(
                  "mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                  collapsed && "sr-only"
                )}
              >
                {group.label}
              </p>
              <div className={cn("space-y-1", collapsed && "border-t border-border pt-2 first:border-t-0 first:pt-0")}>
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={item.label}
                      className={cn(
                        "group relative flex min-h-11 min-w-0 items-center rounded-md text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                        collapsed ? "justify-center px-2" : "gap-3 px-3",
                        active && "bg-primary/12 text-primary"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                      {collapsed ? (
                        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lg group-hover:block group-focus-visible:block">
                          {item.label}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-3 flex min-h-11 items-center rounded-md text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
            collapsed ? "justify-center px-2" : "gap-3 px-3"
          )}
          aria-label={collapsed ? "Rozwiń menu" : "Zwiń menu"}
          title={collapsed ? "Rozwiń menu" : "Zwiń menu"}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
          {!collapsed ? <span>Zwiń menu</span> : null}
        </button>
      </div>
    </aside>
  );
}
