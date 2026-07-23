import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AnalyticsHistory } from "@/components/analytics/AnalyticsHistory";
import { Button } from "@/components/ui/button";

export default function AnalyticsHistoryPage() {
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-primary">Statystyki ukończeń</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Analizy — Cała historia</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Wieloletnie podsumowanie ukończonych gier oraz czasu postaci z lig Path of Exile. Każdy wykres zachowuje jedną jednostkę i pozwala przejść do danych konkretnego roku.</p></div><Link href="/analytics"><Button variant="secondary"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Analiza bieżącego roku</Button></Link></header>
    <AnalyticsHistory />
  </div>;
}
