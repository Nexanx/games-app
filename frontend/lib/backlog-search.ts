import type { BacklogEntry, GameSearchResult } from "@/types";

type IdentifiableGame = {
  title: string;
  external_id?: string | null;
  external_source?: string | null;
  source?: string | null;
};

export type BacklogBatchItem = Partial<IdentifiableGame> & {
  message?: string;
};

export type NormalizedBacklogBatchResult = {
  added: BacklogBatchItem[];
  already_exists: BacklogBatchItem[];
  failed: BacklogBatchItem[];
};

export function normalizeGameTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getExternalGameKey(game: IdentifiableGame) {
  const source = (game.external_source || game.source || "").trim().toLocaleLowerCase("pl-PL");
  const externalId = game.external_id?.trim().toLocaleLowerCase("pl-PL");

  return source && externalId ? `${source}:${externalId}` : null;
}

export function getSearchResultKey(game: IdentifiableGame) {
  return getExternalGameKey(game) ?? `title:${normalizeGameTitle(game.title)}`;
}

/**
 * Prefer a stable external ID. A normalized title is used only if at least one
 * side has no external ID, which protects manually added games without making
 * unrelated games with different RAWG IDs collide.
 */
export function isGameAlreadyInBacklog(result: GameSearchResult, entries: BacklogEntry[]) {
  const resultExternalKey = getExternalGameKey(result);
  const resultTitle = normalizeGameTitle(result.title);

  return entries.some((entry) => {
    const backlogExternalKey = getExternalGameKey(entry.game);
    if (resultExternalKey && backlogExternalKey) {
      return resultExternalKey === backlogExternalKey;
    }

    return resultTitle !== "" && resultTitle === normalizeGameTitle(entry.game.title);
  });
}

export function filterSearchResultsForBacklog(results: GameSearchResult[], entries: BacklogEntry[]) {
  return results.filter((result) => !isGameAlreadyInBacklog(result, entries));
}

export function toggleSearchSelection(
  selected: Record<string, GameSearchResult>,
  game: GameSearchResult
) {
  const key = getSearchResultKey(game);
  if (selected[key]) {
    const { [key]: _, ...rest } = selected;
    return rest;
  }

  return { ...selected, [key]: game };
}

export function getBatchSelectionKeys(
  items: BacklogBatchItem[],
  selected: Record<string, GameSearchResult>
) {
  const keys = new Set<string>();

  items.forEach((item) => {
    if (!item.title) return;

    const itemExternalKey = getExternalGameKey({ ...item, title: item.title });
    const itemTitle = normalizeGameTitle(item.title);

    Object.entries(selected).forEach(([key, game]) => {
      const gameExternalKey = getExternalGameKey(game);
      if (itemExternalKey && gameExternalKey === itemExternalKey) {
        keys.add(key);
        return;
      }

      if (!itemExternalKey && itemTitle && normalizeGameTitle(game.title) === itemTitle) {
        keys.add(key);
      }
    });
  });

  return keys;
}

export function getBatchFeedback(result: NormalizedBacklogBatchResult) {
  const parts: string[] = [];
  if (result.added.length) {
    parts.push(`Dodano do listy: ${result.added.length}.`);
  }
  if (result.already_exists.length) {
    parts.push(`Już na liście: ${result.already_exists.length}.`);
  }
  if (result.failed.length) {
    const failedTitles = result.failed.map((item) => item.title).filter(Boolean).join(", ");
    parts.push(`Nie udało się dodać: ${failedTitles || result.failed.length}.`);
  }

  return parts.join(" ") || "Nie zmieniono listy Do ogrania.";
}
