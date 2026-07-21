from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.game_provider import GameProvider, GameProviderConfigurationError, GameProviderRequestError
from app.models import Game
from app.schemas.games import GameSearchResult
from app.services.backlog_service import normalize_game_title


@dataclass(frozen=True)
class BackfillIssue:
    game_id: int
    title: str
    reason: str


@dataclass
class ExternalRatingBackfillReport:
    total: int = 0
    skipped_existing: int = 0
    updated: int = 0
    with_metacritic: int = 0
    without_metacritic: list[BackfillIssue] = field(default_factory=list)
    failed: list[BackfillIssue] = field(default_factory=list)


async def backfill_external_ratings(
    session: Session,
    provider: GameProvider,
    *,
    refresh_existing: bool = False,
) -> ExternalRatingBackfillReport:
    """Refresh stored provider ratings without changing user completion ratings.

    RAWG IDs are used whenever present. A manual game is updated only when an
    exact normalized title is found, avoiding an unsafe best-effort match.
    Each successful game is committed independently so a later provider error
    cannot roll back earlier updates.
    """

    games = session.scalars(select(Game).order_by(Game.id)).all()
    report = ExternalRatingBackfillReport(total=len(games))
    for game in games:
        if not refresh_existing and _has_metacritic(game.external_ratings):
            report.skipped_existing += 1
            continue

        try:
            result = await _provider_result(provider, game)
        except (GameProviderConfigurationError, GameProviderRequestError, ValueError) as exc:
            report.failed.append(BackfillIssue(game.id, game.title, str(exc)))
            continue

        if result is None:
            report.failed.append(BackfillIssue(game.id, game.title, "Nie znaleziono jednoznacznego dopasowania RAWG."))
            continue

        game.external_ratings = [rating.model_dump(mode="json") for rating in result.external_ratings]
        game.external_ratings_updated_at = result.external_ratings_updated_at
        try:
            session.commit()
        except Exception as exc:
            session.rollback()
            report.failed.append(BackfillIssue(game.id, game.title, f"Nie udało się zapisać danych: {exc}"))
            continue

        report.updated += 1
        if _has_metacritic(game.external_ratings):
            report.with_metacritic += 1
        else:
            report.without_metacritic.append(
                BackfillIssue(game.id, game.title, "RAWG nie udostępnia wyniku Metacritic dla tej gry.")
            )

    return report


async def _provider_result(provider: GameProvider, game: Game) -> GameSearchResult | None:
    if (game.external_source or "").strip().casefold() == "rawg" and game.external_id:
        result = await provider.get_game(game.external_id)
        if (result.external_id or "").strip() != game.external_id.strip():
            return None
        return result

    page = await provider.search(game.title, page=1, page_size=10)
    title_key = normalize_game_title(game.title)
    return next((result for result in page.results if normalize_game_title(result.title) == title_key), None)


def _has_metacritic(ratings: list[dict] | None) -> bool:
    return any(
        rating.get("source") == "Metacritic"
        and isinstance(rating.get("value"), (int, float))
        and rating["value"] > 0
        for rating in (ratings or [])
    )
