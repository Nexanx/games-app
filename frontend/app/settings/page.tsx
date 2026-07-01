"use client";

import { useEffect, useState } from "react";
import { Save, Server, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import type { Setting } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSettings()
      .then((data) => {
        setSettings(data);
        const savedNote = data.find((item) => item.key === "private_note")?.value;
        if (typeof savedNote === "string") {
          setNote(savedNote);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Nie udało się pobrać ustawień"))
      .finally(() => setLoading(false));
  }, []);

  async function saveNote() {
    setMessage(null);
    try {
      const saved = await api.upsertSetting({ key: "private_note", value: note });
      setSettings((current) => [...current.filter((item) => item.key !== saved.key), saved]);
      setMessage("Ustawienie zapisane.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nie udało się zapisać ustawienia");
    }
  }

  if (loading) {
    return <LoadingState label="Ładowanie ustawień" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Konfiguracja</p>
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Ustawienia</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Prywatna aplikacja jednoosobowa. Brak logowania, rejestracji, ról i systemu kont.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" aria-hidden="true" />
              Połączenie API
            </CardTitle>
            <CardDescription>Frontend rozmawia wyłącznie z backendem FastAPI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Adres API: {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"}</p>
            <p>CORS ograniczasz po stronie backendu przez `FRONTEND_URL`.</p>
            <p>Klucze RAWG, IGDB i OpenAI są czytane tylko z `.env` backendu.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
              Tryb prywatny
            </CardTitle>
            <CardDescription>Założenie MVP: lokalny komputer albo prywatny serwer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Chatbot nie wykonuje promptów jako SQL i nie modyfikuje danych.</p>
            <p>Integracje mają fallbacki, więc aplikacja działa bez kluczy API.</p>
            <p>Zapis trwały jest w PostgreSQL.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Instalacja na telefonie</CardTitle>
          <CardDescription>PWA działa najlepiej po HTTPS albo przez prywatny VPN/reverse proxy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Na Androidzie przycisk instalacji pojawi się, gdy przeglądarka uzna aplikację za gotową do instalacji.</p>
          <p>Na iPhonie użyj Safari: Udostępnij, a potem “Do ekranu początkowego”.</p>
          <InstallPwaButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prywatna notatka</CardTitle>
          <CardDescription>Przykład ustawienia zapisywanego w tabeli `settings`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Np. aktualne cele backlogu albo plan na ligę" />
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button onClick={saveNote}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Zapisz
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zapisane klucze ustawień</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {settings.map((setting) => (
            <div key={setting.id} className="rounded-md bg-muted p-3 text-sm">
              <p className="font-semibold">{setting.key}</p>
              <p className="mt-1 truncate text-muted-foreground">{JSON.stringify(setting.value)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
