from datetime import date, datetime, timezone

import pytest

from app.models import CompletedGameEntry, Game
from app.schemas.games import ExternalRating, GameSearchResult
from app.services.game_rating_service import backfill_external_ratings


class FakeProvider:
    async def get_game(self, external_id: str) -> GameSearchResult:
        if external_id == "missing-meta":
            ratings = [ExternalRating(source="RAWG", value=4.1, scale=5, count=10)]
        else:
            ratings = [
                ExternalRating(source="RAWG", value=4.4, scale=5, count=123),
                ExternalRating(source="Metacritic", value=83, scale=100),
            ]
        return GameSearchResult(
            title="Provider game",
            external_id=external_id,
            external_source="RAWG",
            external_ratings=ratings,
            external_ratings_updated_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
        )

    async def search(self, query: str, *, page: int, page_size: int):
        raise AssertionError("RAWG ID should be preferred over title search")


@pytest.mark.anyio
async def test_backfill_uses_rawg_ids_and_does_not_change_user_rating(db_session):
    rated = Game(title="Rated", external_source="RAWG", external_id="rated", genres=[], platforms=[])
    missing_meta = Game(title="Missing meta", external_source="RAWG", external_id="missing-meta", genres=[], platforms=[])
    db_session.add_all([rated, missing_meta])
    db_session.flush()
    completion = CompletedGameEntry(
        game_id=rated.id,
        completion_date=date(2026, 7, 21),
        playtime_hours=8,
        rating=9,
    )
    db_session.add(completion)
    db_session.commit()

    report = await backfill_external_ratings(db_session, FakeProvider())

    assert report.total == 2
    assert report.updated == 2
    assert report.with_metacritic == 1
    assert [item.game_id for item in report.without_metacritic] == [missing_meta.id]
    assert rated.external_ratings[1] == {"source": "Metacritic", "value": 83.0, "scale": 100.0, "count": None}
    assert completion.rating == 9


@pytest.mark.anyio
async def test_backfill_skips_an_existing_metacritic_value_by_default(db_session):
    game = Game(
        title="Already populated",
        external_source="RAWG",
        external_id="existing",
        genres=[],
        platforms=[],
        external_ratings=[{"source": "Metacritic", "value": 90, "scale": 100, "count": None}],
    )
    db_session.add(game)
    db_session.commit()

    report = await backfill_external_ratings(db_session, FakeProvider())

    assert report.skipped_existing == 1
    assert report.updated == 0
    assert game.external_ratings[0]["value"] == 90
