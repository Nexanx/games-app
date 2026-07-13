import React from "react";
import Link from "next/link";
import { BarChart3, CalendarRange, FileText, Flame, GitCompareArrows, Sparkles } from "lucide-react";

import { cn } from "../../lib/utils";
import { analyticsSections, type AnalyticsSection } from "../../lib/analytics-sections";

export { analyticsSections };
export type { AnalyticsSection };

const items: Array<{ value: AnalyticsSection; label: string; icon: typeof BarChart3 }> = [
  { value: "summary", label: "Podsumowanie", icon: BarChart3 },
  { value: "trends", label: "Trendy", icon: CalendarRange },
  { value: "heatmap", label: "Heatmapa", icon: Flame },
  { value: "compare", label: "Porównanie miesięcy", icon: GitCompareArrows },
  { value: "forecast", label: "Prognozy", icon: Sparkles },
  { value: "report", label: "Raport roczny", icon: FileText }
];

export function AnalyticsSectionNav({ year, active }: { year: number; active: AnalyticsSection }) {
  return (
    <nav aria-label="Sekcje analizy" className="min-w-0 rounded-lg border border-border bg-card/70 p-2">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
        {items.map(({ value, label, icon: Icon }) => (
          <Link
            key={value}
            href={`/analytics/${year}${value === "summary" ? "" : `?section=${value}`}`}
            scroll={false}
            aria-current={active === value ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-center text-sm font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
