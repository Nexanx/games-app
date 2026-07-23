"use client";

import { useEffect, useState, type ReactNode } from "react";

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("games-tracker-sidebar-collapsed") === "true");
    } catch {
      // The navigation remains usable when storage is unavailable.
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem("games-tracker-sidebar-collapsed", String(next));
      } catch {
        // Persisting this visual preference is optional.
      }
      return next;
    });
  }

  return (
    <>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <main
        className={cn(
          "min-h-screen px-4 pb-24 pt-5 transition-[margin] duration-200 sm:px-6 lg:px-8 lg:pb-10",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
      <MobileBottomNav />
      <PwaRegister />
    </>
  );
}
