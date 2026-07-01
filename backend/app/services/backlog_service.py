from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import BacklogGame


def reorder_backlog(session: Session, ordered_ids: list[int]) -> list[BacklogGame]:
    unique_ids = list(dict.fromkeys(ordered_ids))
    entries = session.scalars(select(BacklogGame).where(BacklogGame.id.in_(unique_ids))).all()
    by_id = {entry.id: entry for entry in entries}
    missing = [entry_id for entry_id in unique_ids if entry_id not in by_id]
    if missing:
        raise ValueError(f"Backlog entries not found: {missing}")

    for position, entry_id in enumerate(unique_ids):
        by_id[entry_id].position = position

    session.commit()
    return session.scalars(
        select(BacklogGame)
        .where(BacklogGame.id.in_(unique_ids))
        .options(selectinload(BacklogGame.game))
        .order_by(BacklogGame.position)
    ).all()

