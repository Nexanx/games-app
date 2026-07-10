"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CompletedGameForm } from "@/components/games/CompletedGameForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { api } from "@/services/api";
import type { CompletedGameEntry } from "@/types";

export default function EditCompletedGamePage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<CompletedGameEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getCompletedGame(Number(id)).then(setEntry).catch((err) => setError(err.message)); }, [id]);
  if (error) return <ErrorState message={error} />;
  if (!entry) return <LoadingState label="Ładowanie formularza edycji" />;
  return <div className="space-y-5"><Link href={`/completed-games/entry/${entry.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Wróć do szczegółów</Link><header><p className="text-sm font-semibold text-primary">Edycja</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{entry.game.title}</h1></header><Suspense fallback={<LoadingState label="Ładowanie formularza" />}><CompletedGameForm entry={entry} /></Suspense></div>;
}
