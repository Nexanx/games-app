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

export type CompletedYearFilters = {
  month?: number;
  platforms: string[];
  genres: string[];
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  playtimeMin?: number;
  playtimeMax?: number;
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

export function currentCompletedGamesYear(now = new Date()) {
  return now.getFullYear();
}

export function ratingAfterWheel(current: string, deltaY: number) {
  if (deltaY === 0) return current;
  const parsed = Number(current.replace(",", "."));
  const base = current === "" || !Number.isFinite(parsed) ? (deltaY < 0 ? 0 : 0.5) : parsed;
  const next = Math.min(10, Math.max(0, Math.round((base + (deltaY < 0 ? 0.5 : -0.5)) * 2) / 2));
  return String(next);
}

export function completedYearFiltersFromSearchParams(params: Pick<URLSearchParams, "get" | "getAll">): CompletedYearFilters {
  const month = parseMonth(params.get("month"));
  const ratingMin = parseRating(params.get("rating_min"));
  const ratingMax = parseRating(params.get("rating_max"));
  return {
    month,
    platforms: uniqueValues(params.getAll("platform")),
    genres: uniqueValues(params.getAll("genre")),
    ratingMin,
    ratingMax,
    dateFrom: parseDate(params.get("date_from")),
    dateTo: parseDate(params.get("date_to")),
    playtimeMin: parseNonNegativeNumber(params.get("playtime_min")),
    playtimeMax: parseNonNegativeNumber(params.get("playtime_max"))
  };
}

export function completedYearFiltersToSearchParams(filters: CompletedYearFilters) {
  const params = new URLSearchParams();
  if (filters.month !== undefined) params.set("month", String(filters.month));
  uniqueValues(filters.platforms).forEach((platform) => params.append("platform", platform));
  uniqueValues(filters.genres).forEach((genre) => params.append("genre", genre));
  if (filters.ratingMin !== undefined) params.set("rating_min", String(filters.ratingMin));
  if (filters.ratingMax !== undefined) params.set("rating_max", String(filters.ratingMax));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.playtimeMin !== undefined) params.set("playtime_min", String(filters.playtimeMin));
  if (filters.playtimeMax !== undefined) params.set("playtime_max", String(filters.playtimeMax));
  return params;
}

export function hasCompletedYearFilters(filters: CompletedYearFilters) {
  return Boolean(
    filters.month !== undefined
      || filters.platforms.length
      || filters.genres.length
      || filters.ratingMin !== undefined
      || filters.ratingMax !== undefined
      || filters.dateFrom
      || filters.dateTo
      || filters.playtimeMin !== undefined
      || filters.playtimeMax !== undefined
  );
}

export function getCompletedYearFiltersError(filters: CompletedYearFilters) {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return "Data początkowa nie może być późniejsza niż data końcowa.";
  }
  if (filters.ratingMin !== undefined && filters.ratingMax !== undefined && filters.ratingMin > filters.ratingMax) {
    return "Minimalna ocena nie może być większa niż maksymalna.";
  }
  if (filters.playtimeMin !== undefined && filters.playtimeMax !== undefined && filters.playtimeMin > filters.playtimeMax) {
    return "Minimalny czas gry nie może być większy niż maksymalny.";
  }
  return null;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseRating(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : undefined;
}

function parseNonNegativeNumber(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseDate(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)) ? value : undefined;
}

export function getYearNavigation(currentYear: number, years: CompletedGamesYear[]) {
  if (years.some((item) => item.year === currentYear)) {
    return getAvailableYearNavigation(currentYear, years);
  }
  const orderedYears = years.map((item) => item.year).sort((left, right) => right - left);
  return {
    newerYear: orderedYears.filter((item) => item > currentYear).at(-1) ?? null,
    olderYear: orderedYears.find((item) => item < currentYear) ?? null
  };
}

function parseMonth(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : undefined;
}
