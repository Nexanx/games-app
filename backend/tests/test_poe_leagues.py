from datetime import date

import pytest
from sqlalchemy import event

from app.core.config import Settings
from app.integrations.poe_leagues import (
    PoeLeagueCandidate,
    PoeLeagueProvider,
    PoeLeagueProviderConfigurationError,
)
from app.models import PoeLeague
from app.services.poe_league_service import upsert_poe_leagues


def test_upsert_poe_leagues_creates_and_updates(db_session):
    existing = PoeLeague(name="Mercenaries", game_version="poe1", status="active")
    db_session.add(existing)
    db_session.commit()

    created, updated, leagues = upsert_poe_leagues(
        db_session,
        [
            PoeLeagueCandidate(
                name="Mercenaries",
                game_version="poe1",
                start_date=date(2025, 6, 13),
                end_date=date(2025, 10, 1),
                status="completed",
            ),
            PoeLeagueCandidate(
                name="Dawn of the Hunt",
                game_version="poe2",
                start_date=date(2025, 4, 4),
                end_date=None,
                status="active",
            ),
        ],
    )

    assert created == 1
    assert updated == 1
    assert {league.name for league in leagues} == {"Mercenaries", "Dawn of the Hunt"}
    assert existing.status == "completed"
    assert existing.start_date == date(2025, 6, 13)


def test_upsert_poe_leagues_loads_existing_rows_in_one_query(db_session):
    db_session.add(PoeLeague(name="Existing", game_version="poe1", status="active"))
    db_session.commit()
    statements: list[str] = []

    def capture_select(_, __, statement, ___, ____, _____):
        if statement.lstrip().upper().startswith("SELECT") and "poe_leagues" in statement:
            statements.append(statement)

    event.listen(db_session.get_bind(), "before_cursor_execute", capture_select)
    try:
        upsert_poe_leagues(
            db_session,
            [
                PoeLeagueCandidate("Existing", "poe1", None, None, "active"),
                PoeLeagueCandidate("New One", "poe1", None, None, "planned"),
                PoeLeagueCandidate("New Two", "poe2", None, None, "active"),
                PoeLeagueCandidate("New Two", "poe2", None, None, "active"),
            ],
        )
    finally:
        event.remove(db_session.get_bind(), "before_cursor_execute", capture_select)

    assert len(statements) == 1
    assert db_session.query(PoeLeague).count() == 3


@pytest.mark.anyio
async def test_poe_league_provider_requires_token():
    provider = PoeLeagueProvider(Settings(poe_api_token=None))

    with pytest.raises(PoeLeagueProviderConfigurationError):
        await provider.fetch("poe1")


@pytest.mark.anyio
async def test_poe_league_provider_reuses_one_client_and_never_calls_real_api(monkeypatch):
    calls: list[dict] = []
    instances = 0

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"leagues": [{"id": "Test League", "startAt": "2026-01-01T00:00:00Z"}]}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            nonlocal instances
            instances += 1
            assert kwargs["timeout"] == 15

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def get(self, url, **kwargs):
            calls.append({"url": url, **kwargs})
            return FakeResponse()

    monkeypatch.setattr("app.integrations.poe_leagues.httpx.AsyncClient", FakeAsyncClient)

    result = await PoeLeagueProvider(Settings(poe_api_token="secret-token")).fetch()

    assert instances == 1
    assert [call["params"]["realm"] for call in calls] == ["pc", "poe2"]
    assert all(call["headers"]["Authorization"] == "Bearer secret-token" for call in calls)
    assert [item.game_version for item in result] == ["poe1", "poe2"]
