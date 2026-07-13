export const analyticsSections = ["summary", "trends", "calendar", "heatmap", "compare", "forecast", "report"] as const;
export type AnalyticsSection = typeof analyticsSections[number];

export function parseAnalyticsSection(value: string | null): AnalyticsSection {
  return analyticsSections.includes(value as AnalyticsSection) ? value as AnalyticsSection : "summary";
}

export function analyticsSectionUrl(year: number, section: AnalyticsSection, source?: Pick<URLSearchParams, "toString">) {
  const params = new URLSearchParams(source?.toString() ?? "");
  if (section === "summary") params.delete("section");
  else params.set("section", section);
  const query = params.toString();
  return `/analytics/${year}${query ? `?${query}` : ""}`;
}

export function allYearDateKeys(year: number) {
  const result: string[] = [];
  const current = new Date(year, 0, 1);
  while (current.getFullYear() === year) {
    result.push(`${year}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`);
    current.setDate(current.getDate() + 1);
  }
  return result;
}

export function heatIntensityLevel(value: number, maximum: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || value <= 0 || maximum <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil(value / maximum * 4)));
}

export function normalizePair(left: number, right: number) {
  const maximum = Math.max(left, right, 1);
  return { left: left / maximum * 100, right: right / maximum * 100 };
}

export function percentageChangeLabel(previous: number | null | undefined, percentage: number | null | undefined) {
  if (percentage != null && Number.isFinite(percentage)) {
    return `${percentage > 0 ? "+" : ""}${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(percentage)}%`;
  }
  return previous === 0 ? "Brak wartości bazowej do obliczenia zmiany procentowej." : "Brak danych";
}
