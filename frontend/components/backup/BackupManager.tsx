"use client";

import { useRef, useState } from "react";
import { Download, ShieldAlert, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api";
import type { BackupDocument, BackupImportResult } from "@/types";

export function BackupManager({ onImported }: { onImported?: () => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadBackup() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `games-tracker-backup-${backup.exported_at.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Kopia zapasowa została pobrana.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się utworzyć kopii zapasowej.");
    } finally {
      setExporting(false);
    }
  }

  async function importBackup(file: File) {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const raw = await file.text();
      let backup: BackupDocument;
      try {
        backup = JSON.parse(raw) as BackupDocument;
      } catch {
        throw new Error("Wybrany plik nie jest poprawnym plikiem JSON.");
      }
      if (!window.confirm("Import zastąpi bieżące dane aplikacji. Tej operacji nie można cofnąć. Kontynuować?")) {
        return;
      }
      const result = await api.importBackup({ mode: "replace", backup });
      setMessage(formatImportMessage(result));
      await onImported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się przywrócić kopii zapasowej.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kopia zapasowa</CardTitle>
        <CardDescription>Eksport obejmuje dane aplikacji, ale nie zawiera kluczy API, tokenów ani ustawień środowiska.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Import działa w bezpiecznym trybie zastąpienia: sprawdza plik przed zmianą danych, a następnie odtwarza całą kopię w jednej transakcji.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={downloadBackup} disabled={exporting || importing}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? "Przygotowywanie…" : "Pobierz kopię JSON"}
          </Button>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={exporting || importing}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {importing ? "Przywracanie…" : "Przywróć z pliku"}
          </Button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Wybierz plik kopii zapasowej JSON"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBackup(file);
            }}
          />
        </div>
        {message ? <p className="text-sm text-emerald-300" role="status">{message}</p> : null}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function formatImportMessage(result: BackupImportResult) {
  const restored = result.restored;
  return `Przywrócono ${restored.games} gier, ${restored.backlog_entries} pozycji Do ogrania i ${restored.completed_game_entries} ukończonych wpisów.`;
}
