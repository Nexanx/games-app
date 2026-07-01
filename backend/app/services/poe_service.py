from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PoeCurrencyStat


def reorder_currency_stats(session: Session, character_id: int, ordered_ids: list[int]) -> list[PoeCurrencyStat]:
    unique_ids = list(dict.fromkeys(ordered_ids))
    stats = session.scalars(
        select(PoeCurrencyStat).where(PoeCurrencyStat.character_id == character_id, PoeCurrencyStat.id.in_(unique_ids))
    ).all()
    by_id = {stat.id: stat for stat in stats}
    missing = [stat_id for stat_id in unique_ids if stat_id not in by_id]
    if missing:
        raise ValueError(f"Currency stats not found for character {character_id}: {missing}")

    for order, stat_id in enumerate(unique_ids):
        by_id[stat_id].display_order = order

    session.commit()
    return session.scalars(
        select(PoeCurrencyStat)
        .where(PoeCurrencyStat.character_id == character_id)
        .order_by(PoeCurrencyStat.display_order, PoeCurrencyStat.name)
    ).all()

