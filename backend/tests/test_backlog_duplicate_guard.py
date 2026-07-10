from sqlalchemy import func, select

from app.models import BacklogEntry, Game


def test_manual_creation_and_direct_backlog_api_do_not_create_title_duplicates(client, db_session):
    first_game = client.post(
        "/api/games",
        json={
            "title": "The Witcher 3: Wild Hunt",
            "cover_url": "https://example.invalid/cover.jpg",
            "genres": [],
            "platforms": [],
            "external_source": "manual",
        },
    )
    first_backlog = client.post("/api/backlog", json={"game_id": first_game.json()["id"]})
    same_game = client.post(
        "/api/games",
        json={
            "title": " the-witcher 3 wild hunt ",
            "cover_url": "https://example.invalid/cover.jpg",
            "genres": [],
            "platforms": [],
            "external_source": "manual",
        },
    )
    duplicate_backlog = client.post("/api/backlog", json={"game_id": same_game.json()["id"]})

    assert first_game.status_code == 201
    assert first_backlog.status_code == 201
    assert same_game.status_code == 200
    assert same_game.json()["id"] == first_game.json()["id"]
    assert duplicate_backlog.status_code == 409
    assert db_session.scalar(select(func.count(Game.id))) == 1
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
