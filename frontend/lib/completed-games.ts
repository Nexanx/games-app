import type { CompletedGameEntry, CompletedGamesYear } from "@/types";

export const polishMonthNames = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień"
];

export type CompletedGamesMonthGroup = {
  month: number;
  label: string;
  entries: CompletedGameEntry[];
};

export function groupCompletedGamesByMonth(entries: CompletedGameEntry[]): CompletedGamesMonthGroup[] {
  const grouped = new Map<number, CompletedGameEntry[]>();
  [...entries]
    .sort((left, right) => right.completion_date.localeCompare(left.completion_date))
    .forEach((entry) => {
      const month = Number(entry.completion_date.slice(5, 7));
      grouped.set(month, [...(grouped.get(month) ?? []), entry]);
    });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => right - left)
    .map(([month, monthEntries]) => ({ month, label: polishMonthNames[month - 1], entries: monthEntries }));
}

export function getAvailableYearNavigation(currentYear: number, years: CompletedGamesYear[]) {
  const orderedYears = years.map((item) => item.year).sort((left, right) => right - left);
  const index = orderedYears.indexOf(currentYear);
  return {
    newerYear: index > 0 ? orderedYears[index - 1] : null,
    olderYear: index >= 0 && index < orderedYears.length - 1 ? orderedYears[index + 1] : null
  };
}

export function todayAsInputValue(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
