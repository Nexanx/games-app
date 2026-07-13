from app.models import PoeCharacter, PoeCurrencyStat, PoeEquipmentItem
from tests.test_poe_build import encode_pob


def create_league(client, *, name="Test League", game_version="poe1"):
    response = client.post(
        "/api/poe/leagues",
        json={"name": name, "game_version": game_version, "status": "active"},
    )
    assert response.status_code == 201
    return response.json()


def create_character(client, league_id: int):
    response = client.post(
        "/api/poe/characters",
        json={
            "name": "Arc Witch",
            "game_version": "poe1",
            "league_id": league_id,
            "level": 92,
            "status": "active",
            "playtime_minutes": 600,
            "poe_ninja_url": "https://poe.ninja/builds/test/character/account/Arc-Witch",
            "profile_url": "https://www.pathofexile.com/account/view-profile/example",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_poe_crud_keeps_relations_and_returns_user_facing_conflicts(client, db_session):
    assert client.get("/api/poe/characters").json() == []
    league = create_league(client)
    duplicate_league = client.post(
        "/api/poe/leagues",
        json={"name": "Test League", "game_version": "poe1", "status": "active"},
    )
    assert duplicate_league.status_code == 409

    character = create_character(client, league["id"])
    listed = client.get("/api/poe/characters", params={"game_version": "poe1", "search": "Arc"})
    assert listed.status_code == 200
    assert listed.json()[0]["league"]["name"] == "Test League"

    first = client.post(
        f"/api/poe/characters/{character['id']}/stats",
        json={"name": "Divine Orb", "category": "currency", "value": 3},
    )
    assert first.status_code == 201
    assert first.json()["league_id"] == league["id"]
    duplicate_stat = client.post(
        f"/api/poe/characters/{character['id']}/stats",
        json={"name": "Divine Orb", "category": "currency", "value": 4},
    )
    assert duplicate_stat.status_code == 409
    assert "już istnieje" in duplicate_stat.json()["detail"]

    patched = client.patch(
        f"/api/poe/stats/{first.json()['id']}",
        json={"value": 5, "notes": "Po bossie"},
    )
    assert patched.status_code == 200
    assert patched.json()["value"] == 5

    character_patch = client.patch(
        f"/api/poe/characters/{character['id']}",
        json={"level": 93, "notes": "Gotowa do map"},
    )
    assert character_patch.status_code == 200
    assert character_patch.json()["level"] == 93

    deleted = client.delete(f"/api/poe/characters/{character['id']}")
    assert deleted.status_code == 204
    assert db_session.query(PoeCharacter).count() == 0
    assert db_session.query(PoeCurrencyStat).count() == 0
    assert client.get(f"/api/poe/characters/{character['id']}/stats").status_code == 404


def test_poe_rejects_mismatched_leagues_and_untrusted_import_urls(client):
    league = create_league(client, game_version="poe1")

    mismatch = client.post(
        "/api/poe/characters",
        json={
            "name": "Wrong Realm",
            "game_version": "poe2",
            "league_id": league["id"],
            "level": 1,
            "status": "active",
            "playtime_minutes": 0,
        },
    )
    assert mismatch.status_code == 422
    assert "tej samej wersji" in mismatch.json()["detail"]

    invalid_import = client.post(
        "/api/poe/characters/import-pob",
        json={
            "name": "Unsafe import",
            "code": encode_pob(),
            "poe_ninja_url": "https://example.com/builds/test/character/fake",
        },
    )
    assert invalid_import.status_code == 422

    invalid_profile = client.post(
        "/api/poe/characters",
        json={
            "name": "Unsafe Link",
            "game_version": "poe1",
            "level": 1,
            "status": "active",
            "playtime_minutes": 0,
            "profile_url": "javascript:alert(1)",
        },
    )
    assert invalid_profile.status_code == 422

    character = create_character(client, league["id"])
    invalid_icon = client.post(
        f"/api/poe/characters/{character['id']}/stats",
        json={"name": "Unsafe icon", "category": "currency", "value": 1, "icon_url": "javascript:alert(1)"},
    )
    assert invalid_icon.status_code == 422


def test_pob_import_creates_final_character_and_equipment_snapshot(client, db_session):
    league = create_league(client)
    preview = client.post("/api/poe/pob/preview", json={"code": encode_pob()})
    assert preview.status_code == 200
    assert preview.json()["equipment_count"] == 2
    assert "equipment" not in preview.json()

    imported = client.post(
        "/api/poe/characters/import-pob",
        json={
            "name": "Final Witch",
            "league_id": league["id"],
            "code": encode_pob(),
            "poe_ninja_url": "https://poe.ninja/builds/test/character/account/final-witch",
            "playtime_minutes": 1234,
        },
    )
    assert imported.status_code == 201
    character = imported.json()
    assert character["name"] == "Final Witch"
    assert character["status"] == "ended"
    assert character["snapshot_source"] == "poe_ninja_pob"
    assert character["level"] == 96
    assert character["ascendancy"] == "Elementalist"

    equipment = client.get(f"/api/poe/characters/{character['id']}/equipment")
    assert equipment.status_code == 200
    assert [item["slot"] for item in equipment.json()] == ["Helmet", "Body Armour"]

    client.delete(f"/api/poe/characters/{character['id']}")
    assert db_session.query(PoeEquipmentItem).count() == 0


def test_league_update_prevents_duplicates_and_version_mismatch(client):
    first = create_league(client, name="First")
    second = create_league(client, name="Second")
    create_character(client, first["id"])

    duplicate = client.patch(f"/api/poe/leagues/{second['id']}", json={"name": "First"})
    assert duplicate.status_code == 409
    incompatible = client.patch(f"/api/poe/leagues/{first['id']}", json={"game_version": "poe2"})
    assert incompatible.status_code == 409
    invalid_period = client.patch(
        f"/api/poe/leagues/{second['id']}",
        json={"start_date": "2026-08-01", "end_date": "2026-07-01"},
    )
    assert invalid_period.status_code == 422


def test_deleting_league_preserves_character_and_drop_data(client, db_session):
    league = create_league(client)
    character = create_character(client, league["id"])
    stat = client.post(
        f"/api/poe/characters/{character['id']}/stats",
        json={"name": "Mirror Shard", "category": "currency", "value": 1},
    )
    assert stat.status_code == 201

    deleted = client.delete(f"/api/poe/leagues/{league['id']}")

    assert deleted.status_code == 204
    db_session.expire_all()
    preserved_character = db_session.get(PoeCharacter, character["id"])
    preserved_stat = db_session.get(PoeCurrencyStat, stat.json()["id"])
    assert preserved_character is not None
    assert preserved_character.league_id is None
    assert preserved_stat is not None
    assert preserved_stat.league_id is None
