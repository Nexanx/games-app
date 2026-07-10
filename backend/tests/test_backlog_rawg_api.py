from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.api import games as games_api
from app.models import BacklogEntry, Game
from app.schemas.games import GameSearchPage, GameSearchResult
from app.services.backlog_service import add_games_to_backlog


def rawg_game(title: str, external_id: str | None, *, source: str = "RAWG") -> GameSearchResult:
    return GameSearchResult(
        title=title,
        cover_url="https://example.com/cover.jpg",
        genres=["RPG"],
        platforms=["PC"],
        external_id=external_id,
        external_source=source,
        external_url="https://rawg.io/games/example",
        source="RAWG",
    )


def rawg_payload(title: str, external_id: str | None, *, source: str = "RAWG") -> dict[str, object]:
    return rawg_game(title, external_id, source=source).model_dump(mode="json")


class FakePagedProvider:
    pages: dict[int, GameSearchPage] = {}
    calls: list[tuple[str, int, int]] = []

    def __init__(self, _settings):
        pass

    async def search(self, query: str, *, page: int = 1, page_size: int = 10) -> GameSearchPage:
        type(self).calls.append((query, page, page_size))
        return type(self).pages[page]


def add_backlog_game(
    db_session,
    title: str,
    *,
    external_id: str | None = None,
    external_source: str = "manual",
) -> BacklogEntry:
    game = Game(
        title=title,
        genres=[],
        platforms=["PC"],
        external_id=external_id,
        external_source=external_source,
    )
    db_session.add(game)
    db_session.flush()
    entry = BacklogEntry(game_id=game.id, position=0)
    db_session.add(entry)
    db_session.commit()
    return entry


def test_rawg_search_hides_backlog_games_by_external_identity(client, db_session, monkeypatch):
    add_backlog_game(db_session, "Already queued", external_id="RAWG-42", external_source="rawg")
    FakePagedProvider.calls = []
    FakePagedProvider.pages = {
        1: GameSearchPage(
            results=[rawg_game("Already queued", "rawg-42"), rawg_game("Available", "43")],
            page=1,
            page_size=10,
            has_next=False,
        )
    }
    monkeypatch.setattr(games_api, "GameProvider", FakePagedProvider)

    response = client.get("/api/games/search", params={"query": "queued", "page": 1, "page_size": 10})

    assert response.status_code == 200
    payload = response.json()
    assert [item["external_id"] for item in payload["results"]] == ["43"]
    assert payload["page"] == 1
    assert payload["page_size"] == 10
    assert payload["has_next"] is False
    assert FakePagedProvider.calls == [("queued", 1, 10)]


def test_rawg_search_uses_title_fallback_when_backlog_entry_has_no_external_id(client, db_session, monkeypatch):
    add_backlog_game(db_session, "Hades II", external_id=None)
    FakePagedProvider.calls = []
    FakePagedProvider.pages = {
        1: GameSearchPage(
            results=[
                rawg_game("Hades-II", None),
                rawg_game("Hades II", "99"),
                rawg_game("Hades III", "100"),
            ],
            page=1,
            page_size=10,
            has_next=False,
        )
    }
    monkeypatch.setattr(games_api, "GameProvider", FakePagedProvider)

    response = client.get("/api/games/search", params={"query": "hades"})

    assert response.status_code == 200
    # When the local record lacks a stable identity, both its no-ID and RAWG
    # variants are hidden by the normalized-title fallback.
    assert [item["external_id"] for item in response.json()["results"]] == ["100"]


def test_rawg_search_builds_non_empty_logical_pages_after_filtering(client, db_session, monkeypatch):
    add_backlog_game(db_session, "Hidden", external_id="1", external_source="RAWG")
    FakePagedProvider.calls = []
    FakePagedProvider.pages = {
        1: GameSearchPage(results=[rawg_game("Hidden", "1")], page=1, page_size=1, has_next=True),
        2: GameSearchPage(results=[rawg_game("Visible", "2")], page=2, page_size=1, has_next=False),
    }
    monkeypatch.setattr(games_api, "GameProvider", FakePagedProvider)

    response = client.get("/api/games/search", params={"query": "test", "page": 1, "page_size": 1})

    assert response.status_code == 200
    assert [item["title"] for item in response.json()["results"]] == ["Visible"]
    assert response.json()["has_next"] is False
    assert FakePagedProvider.calls == [("test", 1, 1), ("test", 2, 1)]


def test_batch_add_creates_multiple_backlog_entries_atomically(client, db_session):
    response = client.post(
        "/api/backlog/batch",
        json={
            "games": [
                rawg_payload("Hades", "101"),
                rawg_payload("Celeste", "102"),
            ]
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert [entry["game"]["title"] for entry in payload["added"]] == ["Hades", "Celeste"]
    assert payload["already_exists"] == []
    assert payload["failed"] == []
    entries = db_session.scalars(select(BacklogEntry).order_by(BacklogEntry.position)).all()
    assert [entry.position for entry in entries] == [0, 1]
    assert db_session.scalar(select(func.count(Game.id))) == 2


def test_batch_add_reuses_existing_external_game_and_reports_duplicate(client, db_session):
    existing = add_backlog_game(db_session, "Hades", external_id="RAWG-101", external_source="rawg")

    response = client.post(
        "/api/backlog/batch",
        json={"games": [rawg_payload("Hades", "rawg-101", source="RAWG")]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["added"] == []
    assert payload["failed"] == []
    assert payload["already_exists"][0]["entry"]["id"] == existing.id
    assert payload["already_exists"][0]["reason"] == "already_on_backlog"
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
    assert db_session.scalar(select(func.count(Game.id))) == 1


def test_batch_add_deduplicates_against_a_manual_backlog_game_without_external_id(client, db_session):
    existing = add_backlog_game(db_session, "Hades-II")

    response = client.post(
        "/api/backlog/batch",
        json={"games": [rawg_payload("Hades II", "101")]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["added"] == []
    assert payload["already_exists"][0]["entry"]["id"] == existing.id
    assert payload["already_exists"][0]["reason"] == "already_on_backlog"
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
    assert db_session.scalar(select(func.count(Game.id))) == 1


def test_batch_add_reuses_a_manual_game_without_external_id_when_title_matches(client, db_session):
    manual_game = Game(title="Hades-II", genres=[], platforms=["PC"], external_source="manual")
    db_session.add(manual_game)
    db_session.commit()

    response = client.post(
        "/api/backlog/batch",
        json={"games": [rawg_payload("Hades II", "101")]},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["added"][0]["game_id"] == manual_game.id
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
    assert db_session.scalar(select(func.count(Game.id))) == 1


def test_batch_add_deduplicates_a_repeated_selected_rawg_game(client, db_session):
    response = client.post(
        "/api/backlog/batch",
        json={"games": [rawg_payload("Hades", "101"), rawg_payload("Hades", "101")]},
    )

    assert response.status_code == 201
    payload = response.json()
    assert len(payload["added"]) == 1
    assert len(payload["already_exists"]) == 1
    assert payload["already_exists"][0]["reason"] == "duplicate_in_request"
    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 1
    assert db_session.scalar(select(func.count(Game.id))) == 1


def test_batch_add_rolls_back_all_new_records_when_commit_fails(db_session, monkeypatch):
    def fail_commit():
        raise RuntimeError("simulated commit failure")

    monkeypatch.setattr(db_session, "commit", fail_commit)

    with pytest.raises(RuntimeError, match="simulated commit failure"):
        add_games_to_backlog(db_session, [rawg_game("Hades", "101"), rawg_game("Celeste", "102")])

    assert db_session.scalar(select(func.count(BacklogEntry.id))) == 0
    assert db_session.scalar(select(func.count(Game.id))) == 0


def test_create_game_reuses_an_existing_rawg_identity(client, db_session):
    existing = Game(
        title="Hades",
        genres=[],
        platforms=["PC"],
        external_id="RAWG-101",
        external_source="rawg",
    )
    db_session.add(existing)
    db_session.commit()

    response = client.post("/api/games", json=rawg_payload("Hades", "rawg-101", source="RAWG"))

    assert response.status_code == 200
    assert response.json()["id"] == existing.id
    assert db_session.scalar(select(func.count(Game.id))) == 1
