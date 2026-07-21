import { NO_EXTERNAL_RATING_LABEL, externalRatingLabel, externalRatingsFetchedLabel } from "@/lib/external-ratings";
import type { ExternalRating } from "@/types";

export function ExternalRatings({
  ratings,
  updatedAt,
  compact = false,
  sources
}: {
  ratings?: ExternalRating[] | null;
  updatedAt?: string | null;
  compact?: boolean;
  sources?: ExternalRating["source"][];
}) {
  const validRatings = (ratings ?? []).filter(
    (rating) => (!sources || sources.includes(rating.source)) && rating.scale > 0 && rating.value > 0 && rating.value <= rating.scale
  );
  if (!validRatings.length) {
    return <p className="text-xs text-muted-foreground">{NO_EXTERNAL_RATING_LABEL}</p>;
  }

  const fetchedLabel = externalRatingsFetchedLabel(updatedAt);
  return (
    <div className={compact ? "space-y-0.5 text-xs text-muted-foreground" : "space-y-2"}>
      {validRatings.map((rating) => (
        <p key={rating.source} className={compact ? undefined : "text-sm text-muted-foreground"}>
          {externalRatingLabel(rating)}
        </p>
      ))}
      {!compact && fetchedLabel ? <p className="text-xs text-muted-foreground">{fetchedLabel}</p> : null}
    </div>
  );
}
