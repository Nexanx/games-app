import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CompletedGameForm } from "@/components/games/CompletedGameForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function NewCompletedGamePage() {
  return (
    <div className="space-y-5">
      <Link href="/completed-games" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Wróć do historii</Link>
      <header><p className="text-sm font-semibold text-primary">Nowy wpis</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Dodaj ukończoną grę</h1></header>
      <Suspense fallback={<LoadingState label="Ładowanie formularza" />}><CompletedGameForm /></Suspense>
    </div>
  );
}
