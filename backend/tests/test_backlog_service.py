from app.models import BacklogEntry, Game
from app.services.backlog_service import reorder_backlog


def test_reorder_backlog_updates_positions(db_session):
    first = Game(title="First", genres=[], platforms=[], external_source="manual")
    second = Game(title="Second", genres=[], platforms=[], external_source="manual")
    db_session.add_all([first, second])
    db_session.flush()
    entry_a = BacklogEntry(game_id=first.id, position=0)
    entry_b = BacklogEntry(game_id=second.id, position=1)
    db_session.add_all([entry_a, entry_b])
    db_session.commit()

    reordered = reorder_backlog(db_session, [entry_b.id, entry_a.id])

    assert [entry.id for entry in reordered] == [entry_b.id, entry_a.id]
    assert entry_b.position == 0
    assert entry_a.position == 1


def test_deleting_backlog_entry_compacts_existing_position_gaps(client, db_session):
    games = [
        Game(title=title, genres=[], platforms=[], external_source="manual")
        for title in ("First", "Second", "Third")
    ]
    db_session.add_all(games)
    db_session.flush()
    entries = [
        BacklogEntry(game_id=game.id, position=position)
        for game, position in zip(games, (0, 2, 5), strict=True)
    ]
    db_session.add_all(entries)
    db_session.commit()

    response = client.delete(f"/api/backlog/{entries[0].id}")
    remaining = client.get("/api/backlog").json()

    assert response.status_code == 204
    assert [
        (item["game"]["title"], item["position"])
        for item in remaining
    ] == [("Second", 0), ("Third", 1)]


def test_backlog_sort_direction_supports_added_date_and_title(client, db_session):
    beta = Game(title="Beta", genres=[], platforms=[], external_source="manual")
    alpha = Game(title="Alpha", genres=[], platforms=[], external_source="manual")
    db_session.add_all([beta, alpha])
    db_session.flush()
    db_session.add_all([
        BacklogEntry(game_id=beta.id, position=0),
        BacklogEntry(game_id=alpha.id, position=1),
    ])
    db_session.commit()

    title_ascending = client.get("/api/backlog", params={"sort": "title", "direction": "asc"})
    title_descending = client.get("/api/backlog", params={"sort": "title", "direction": "desc"})
    added_ascending = client.get("/api/backlog", params={"sort": "added", "direction": "asc"})

    assert [item["game"]["title"] for item in title_ascending.json()] == ["Alpha", "Beta"]
    assert [item["game"]["title"] for item in title_descending.json()] == ["Beta", "Alpha"]
    assert [item["game"]["title"] for item in added_ascending.json()] == ["Beta", "Alpha"]
