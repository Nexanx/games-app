import type { ExternalRating } from "@/types";

export const NO_EXTERNAL_RATING_LABEL = "Brak oceny zewnętrznej";

export function externalRatingForSource(
  ratings: ExternalRating[] | null | undefined,
  source: ExternalRating["source"]
) {
  return (ratings ?? []).find(
    (rating) => rating.source === source && rating.scale > 0 && rating.value > 0 && rating.value <= rating.scale
  );
}

export function metacriticValueLabel(ratings?: ExternalRating[] | null) {
  const rating = externalRatingForSource(ratings, "Metacritic");
  return rating
    ? `${formatRatingNumber(rating.value)}/${formatRatingNumber(rating.scale)}`
    : NO_EXTERNAL_RATING_LABEL;
}

export function externalRatingLabel(rating: ExternalRating) {
  const value = formatRatingNumber(rating.value);
  const scale = formatRatingNumber(rating.scale);
  const source = rating.source === "RAWG" ? "Ocena zewnętrzna · RAWG" : "Metacritic";
  const votes = rating.source === "RAWG"
    ? ` · ${rating.count == null ? "brak liczby głosów" : votesLabel(rating.count)}`
    : "";
  return `${source}: ${value}/${scale}${votes}`;
}

export function externalRatingsFetchedLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Dane pobrane ${new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(date)}.`;
}

function formatRatingNumber(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
}

function votesLabel(count: number) {
  const formatted = new Intl.NumberFormat("pl-PL").format(count);
  if (count === 1) return `${formatted} głos`;
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return `${formatted} głosy`;
  return `${formatted} głosów`;
}
