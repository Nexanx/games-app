"use client";

import type { ReactNode } from "react";

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="min-h-screen px-4 pb-24 pt-5 sm:px-6 lg:ml-72 lg:px-8 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
      <MobileBottomNav />
    </>
  );
}

