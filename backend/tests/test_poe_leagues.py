from datetime import date

import pytest

from app.core.config import Settings
from app.integrations.poe_leagues import (
    PoeLeagueCandidate,
    PoeLeagueProvider,
    PoeLeagueProviderConfigurationError,
)
from app.integrations.poe_ninja import PoeNinjaService
from app.models import PoeLeague
from app.services.poe_league_service import get_or_create_league_by_name, upsert_poe_leagues


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


def test_get_or_create_league_by_name_reuses_existing(db_session):
    league = PoeLeague(name="Standard", game_version="poe1", status="active")
    db_session.add(league)
    db_session.commit()

    result = get_or_create_league_by_name(db_session, "Standard", "poe1")

    assert result.id == league.id
    assert db_session.query(PoeLeague).count() == 1


def test_poe_ninja_import_extracts_league_from_path():
    result = PoeNinjaService().import_from_url("https://poe.ninja/builds/mercenaries/character/account/Example")

    assert result.league_name == "Mercenaries"


@pytest.mark.anyio
async def test_poe_league_provider_requires_token():
    provider = PoeLeagueProvider(Settings(poe_api_token=None))

    with pytest.raises(PoeLeagueProviderConfigurationError):
        await provider.fetch("poe1")
