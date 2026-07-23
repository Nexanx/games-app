import type { Metadata } from "next";

import { BackupManager } from "@/components/backup/BackupManager";

export const metadata: Metadata = {
  title: "Kopia danych"
};

export default function BackupPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Dane i bezpieczeństwo</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Kopia danych</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Eksportuj dane Games Tracker lub przywróć wcześniej utworzoną kopię.
        </p>
      </header>
      <BackupManager />
    </div>
  );
}
