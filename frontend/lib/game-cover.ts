export type GameCoverVariant = "thumbnail" | "card" | "detail";

const rawgWidthByVariant: Record<GameCoverVariant, number> = {
  thumbnail: 200,
  card: 420,
  detail: 640
};

/**
 * RAWG serves image derivatives from the same CDN. Keep URLs from other
 * sources untouched and never resize an already resized RAWG image.
 */
export function getGameCoverSource(url: string | null | undefined, variant: GameCoverVariant = "card") {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "media.rawg.io" || !parsed.pathname.startsWith("/media/") || parsed.pathname.startsWith("/media/resize/")) {
      return url;
    }

    parsed.pathname = parsed.pathname.replace(
      "/media/",
      `/media/resize/${rawgWidthByVariant[variant]}/-/`
    );
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getGameCoverInitials(title: string) {
  const initials = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("pl-PL");

  return initials || "GR";
}
