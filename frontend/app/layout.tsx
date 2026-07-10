import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#080d16",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className="dark">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
