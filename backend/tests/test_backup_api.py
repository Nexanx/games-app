from datetime import date, datetime, timezone

from sqlalchemy import func, select

from app.models import (
    BacklogEntry,
    ChatMessage,
    ChatSession,
    CompletedGameEntry,
    CustomStatistic,
    Game,
    GameDiscoveryPreferences,
    GameRecommendationFeedback,
    HiddenGameRelease,
    PoeCharacter,
    PoeCurrencyStat,
    PoeEquipmentItem,
    PoeLeague,
)


def seed_backup_data(db_session):
    game = Game(
        title="Backup Game",
        genres=["RPG"],
        platforms=["PC"],
        external_id="123",
        external_source="RAWG",
        external_ratings=[{"source": "RAWG", "value": 4.4, "scale": 5, "count": 123}],
        external_ratings_updated_at=datetime(2026, 7, 21, tzinfo=timezone.utc),
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
    league = PoeLeague(name="Mercenaries", game_version="poe1")
    db_session.add(league)
    db_session.flush()
    character = PoeCharacter(name="Ranger", game_version="poe1", level=91, league_id=league.id)
    db_session.add(character)
    db_session.flush()
    db_session.add(PoeCurrencyStat(character_id=character.id, league_id=league.id, name="Chaos Orb", category="currency", value=12))
    db_session.add(
        PoeEquipmentItem(
            character_id=character.id,
            slot="Helmet",
            name="Crown of the Inward Eye",
            base_type="Prophet Crown",
            rarity="unique",
            item_text="Rarity: UNIQUE\nCrown of the Inward Eye\nProphet Crown",
        )
    )
    session = ChatSession(title="Pytanie o grę")
    db_session.add(session)
    db_session.flush()
    db_session.add(ChatMessage(session_id=session.id, role="user", content="Podsumuj grę"))
    db_session.add(
        GameRecommendationFeedback(
            external_source="rawg",
            external_id="999",
            title="Suggested Game",
            verdict="negative",
            genres=["RPG"],
            platforms=["PC"],
            tags=["Space"],
        )
    )
    db_session.add(
        GameDiscoveryPreferences(
            id=1,
            platforms=["PC"],
            genres=["RPG"],
        )
    )
    db_session.add(
        HiddenGameRelease(
            external_source="rawg",
            external_id="1000",
            title="Hidden Release",
            game_payload={
                "title": "Hidden Release",
                "genres": ["RPG"],
                "platforms": ["PC"],
                "external_id": "1000",
                "external_source": "RAWG",
                "source": "RAWG",
            },
        )
    )
    db_session.commit()


def test_export_and_replace_import_restore_relations_without_secrets(client, db_session):
    seed_backup_data(db_session)

    exported = client.get("/api/backup/export")
    payload = exported.json()
    db_session.add(Game(title="Temporary", genres=[], platforms=[], external_source="manual"))
    db_session.commit()

    imported = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert exported.status_code == 200
    assert payload["format_version"] == 5
    assert "OPENAI_API_KEY" not in exported.text
    assert imported.status_code == 200
    assert imported.json()["restored"]["games"] == 1
    assert db_session.scalar(select(func.count(Game.id))) == 1
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
    assert db_session.scalar(select(func.count(CompletedGameEntry.id))) == 1
    assert db_session.scalar(select(func.count(CustomStatistic.id))) == 1
    assert db_session.scalar(select(func.count(PoeCharacter.id))) == 1
    assert db_session.scalar(select(func.count(PoeEquipmentItem.id))) == 1
    assert db_session.scalar(select(func.count(ChatMessage.id))) == 1
    assert db_session.scalar(select(func.count(GameRecommendationFeedback.id))) == 1
    assert db_session.scalar(select(func.count(GameDiscoveryPreferences.id))) == 1
    assert db_session.scalar(select(func.count(HiddenGameRelease.id))) == 1
    restored_completed = db_session.scalar(select(CompletedGameEntry))
    restored_game = db_session.scalar(select(Game))
    restored_statistic = db_session.scalar(select(CustomStatistic))
    assert restored_completed.playtime_hours == 25.5
    assert restored_game.external_ratings == [{"source": "RAWG", "value": 4.4, "scale": 5.0, "count": 123}]
    assert restored_statistic.completed_game_entry_id == restored_completed.id
    assert db_session.scalar(select(GameRecommendationFeedback)).tags == ["Space"]
    assert db_session.get(GameDiscoveryPreferences, 1).platforms == ["PC"]
    assert db_session.scalar(select(HiddenGameRelease)).title == "Hidden Release"


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
        json={"mode": "replace", "backup": {"format_version": 99, "exported_at": now, "data": {}}},
    )

    assert response.status_code == 422
    assert db_session.scalar(select(func.count(Game.id))) == 1


def test_version_one_backup_remains_importable_without_snapshot_fields(client, db_session):
    seed_backup_data(db_session)
    payload = client.get("/api/backup/export").json()
    payload["format_version"] = 1
    payload["data"].pop("poe_equipment_items")
    for character in payload["data"]["poe_characters"]:
        character.pop("snapshot_source")

    response = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert response.status_code == 200
    assert response.json()["restored"]["poe_equipment_items"] == 0
    restored_character = db_session.scalar(select(PoeCharacter))
    assert restored_character.snapshot_source == "manual"
    assert db_session.scalar(select(func.count(PoeEquipmentItem.id))) == 0


def test_version_two_backup_remains_importable_without_recommendation_feedback(client, db_session):
    seed_backup_data(db_session)
    payload = client.get("/api/backup/export").json()
    payload["format_version"] = 2
    payload["data"].pop("recommendation_feedback")

    response = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert response.status_code == 200
    assert response.json()["restored"]["recommendation_feedback"] == 0
    assert db_session.scalar(select(func.count(GameRecommendationFeedback.id))) == 0


def test_version_three_backup_with_legacy_poe_statuses_remains_importable(client, db_session):
    seed_backup_data(db_session)
    payload = client.get("/api/backup/export").json()
    payload["format_version"] = 3
    payload["data"]["poe_leagues"][0]["status"] = "active"
    payload["data"]["poe_characters"][0]["status"] = "ended"

    response = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert response.status_code == 200
    assert db_session.scalar(select(func.count(PoeLeague.id))) == 1
    assert db_session.scalar(select(func.count(PoeCharacter.id))) == 1


def test_version_four_backup_remains_importable_without_release_preferences(client, db_session):
    seed_backup_data(db_session)
    payload = client.get("/api/backup/export").json()
    payload["format_version"] = 4
    payload["data"].pop("discovery_preferences")
    payload["data"].pop("hidden_game_releases")

    response = client.post("/api/backup/import", json={"mode": "replace", "backup": payload})

    assert response.status_code == 200
    assert response.json()["restored"]["discovery_preferences"] == 0
    assert response.json()["restored"]["hidden_game_releases"] == 0
    assert db_session.scalar(select(func.count(GameDiscoveryPreferences.id))) == 0
    assert db_session.scalar(select(func.count(HiddenGameRelease.id))) == 0
