from datetime import date, datetime, timezone

from sqlalchemy import func, select

from app.models import (
    BacklogEntry,
    ChatMessage,
    ChatSession,
    CompletedGameEntry,
    CustomStatistic,
    Game,
    PoeCharacter,
    PoeCurrencyStat,
    PoeLeague,
)


def seed_backup_data(db_session):
    game = Game(
        title="Backup Game",
        genres=["RPG"],
        platforms=["PC"],
        external_id="123",
        external_source="RAWG",
    )
    db_session.add(game)
    db_session.flush()
    db_session.add(BacklogEntry(game_id=game.id, position=0, preferred_platform="PC", note="Do ogrania"))
    completed = CompletedGameEntry(
        game_id=game.id,
        completion_date=date(2026, 7, 10),
        playtime_hours=25.5,
        rating=9,
        platform="PC",
        review="Świetna gra",
    )
    db_session.add(completed)
    db_session.flush()
    db_session.add(CustomStatistic(completed_game_entry_id=completed.id, name="Śmierci", value="42", value_type="number"))
    league = PoeLeague(name="Mercenaries", game_version="poe1", status="active")
    db_session.add(league)
    db_session.flush()
    character = PoeCharacter(name="Ranger", game_version="poe1", level=91, league_id=league.id, status="active")
    db_session.add(character)
    db_session.flush()
    db_session.add(PoeCurrencyStat(character_id=character.id, league_id=league.id, name="Chaos Orb", category="currency", value=12))
    session = ChatSession(title="Pytanie o grę")
    db_session.add(session)
    db_session.flush()
    db_session.add(ChatMessage(session_id=session.id, role="user", content="Podsumuj grę"))
    db_session.commit()


def test_export_and_replace_import_restore_relations_without_secrets(client, db_session):
    seed_backup_data(db_session)

    exported = client.get("/api/backup/export")
    payload = exported.json()
    db_session.add(Game(title="Temporary", genres=[], platforms=[], external_source="manual"))
    db_session.commit()

    imported = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert exported.status_code == 200
    assert payload["format_version"] == 1
    assert "OPENAI_API_KEY" not in exported.text
    assert imported.status_code == 200
    assert imported.json()["restored"]["games"] == 1
    assert db_session.scalar(select(func.count(Game.id))) == 1
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
    assert db_session.scalar(select(func.count(CompletedGameEntry.id))) == 1
    assert db_session.scalar(select(func.count(CustomStatistic.id))) == 1
    assert db_session.scalar(select(func.count(PoeCharacter.id))) == 1
    assert db_session.scalar(select(func.count(ChatMessage.id))) == 1
    restored_completed = db_session.scalar(select(CompletedGameEntry))
    restored_statistic = db_session.scalar(select(CustomStatistic))
    assert restored_completed.playtime_hours == 25.5
    assert restored_statistic.completed_game_entry_id == restored_completed.id


def test_invalid_import_never_replaces_existing_data(client, db_session):
    seed_backup_data(db_session)
    original_count = db_session.scalar(select(func.count(Game.id)))
    payload = client.get("/api/backup/export").json()
    payload["data"]["backlog_entries"][0]["game_id"] = 999999

    response = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert response.status_code == 422
    assert db_session.scalar(select(func.count(Game.id))) == original_count
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1


def test_unsupported_backup_format_is_rejected_before_database_changes(client, db_session):
    now = datetime.now(timezone.utc).isoformat()
    db_session.add(Game(title="Existing", genres=[], platforms=[], external_source="manual"))
    db_session.commit()
    response = client.post(
        "/api/backup/import",
        json={"mode": "replace", "backup": {"format_version": 2, "exported_at": now, "data": {}}},
    )

    assert response.status_code == 422
    assert db_session.scalar(select(func.count(Game.id))) == 1
