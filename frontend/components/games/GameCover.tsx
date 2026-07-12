"use client";

import { Gamepad2 } from "lucide-react";
import { useMemo, useState } from "react";

import { getGameCoverInitials, getGameCoverSource, type GameCoverVariant } from "@/lib/game-cover";
import { cn } from "@/lib/utils";

export function GameCover({
  src,
  title,
  alt,
  variant = "card",
  className,
  imageClassName,
  priority = false
}: {
  src?: string | null;
  title: string;
  alt?: string;
  variant?: GameCoverVariant;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  const imageSource = useMemo(() => getGameCoverSource(src, variant), [src, variant]);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const isDecorative = alt === "";
  const altText = alt ?? `Okładka gry ${title || "bez tytułu"}`;

  const showFallback = !imageSource || failedSource === imageSource;
  const isReady = imageSource !== null && loadedSource === imageSource;
  const isLoading = imageSource !== null && !isReady && !showFallback;

  return (
    <div
      className={cn(
        "relative isolate aspect-[3/4] overflow-hidden rounded-md border border-border bg-muted",
        className
      )}
    >
      {isLoading ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-background/50 to-muted" aria-hidden="true" />
      ) : null}

      {showFallback ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-800 via-emerald-950 to-amber-950 px-2 text-center"
          role={isDecorative ? undefined : "img"}
          aria-label={isDecorative ? undefined : altText}
          aria-hidden={isDecorative || undefined}
        >
          <Gamepad2 className="h-5 w-5 text-accent" aria-hidden="true" />
          <span className="max-w-full truncate text-xs font-semibold text-muted-foreground">{getGameCoverInitials(title)}</span>
        </div>
      ) : null}

      {imageSource && !showFallback ? (
        <img
          src={imageSource}
          alt={altText}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoadedSource(imageSource)}
          onError={() => setFailedSource(imageSource)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-200",
            isReady ? "opacity-100" : "opacity-0",
            imageClassName
          )}
        />
      ) : null}
    </div>
  );
}
