from app.models import BacklogGame, Game
from app.services.backlog_service import reorder_backlog


def test_reorder_backlog_updates_positions(db_session):
    first = Game(title="First", genres=[], platforms=[], external_source="manual")
    second = Game(title="Second", genres=[], platforms=[], external_source="manual")
    db_session.add_all([first, second])
    db_session.flush()
    entry_a = BacklogGame(game_id=first.id, status="to_play", position=0)
    entry_b = BacklogGame(game_id=second.id, status="to_play", position=1)
    db_session.add_all([entry_a, entry_b])
    db_session.commit()

    reordered = reorder_backlog(db_session, [entry_b.id, entry_a.id])

    assert [entry.id for entry in reordered] == [entry_b.id, entry_a.id]
    assert entry_b.position == 0
    assert entry_a.position == 1

