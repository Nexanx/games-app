from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from app.integrations.poe_leagues import PoeLeagueCandidate
from app.models import PoeLeague


def upsert_poe_leagues(db: Session, candidates: list[PoeLeagueCandidate]) -> tuple[int, int, list[PoeLeague]]:
    created = 0
    updated = 0
    synced: list[PoeLeague] = []
    unique_candidates: dict[tuple[str, str], PoeLeagueCandidate] = {}
    for candidate in candidates:
        unique_candidates.setdefault((candidate.name, candidate.game_version), candidate)

    if not unique_candidates:
        return 0, 0, []

    existing = db.scalars(
        select(PoeLeague).where(
            tuple_(PoeLeague.name, PoeLeague.game_version).in_(list(unique_candidates))
        )
    ).all()
    by_identity = {(league.name, league.game_version): league for league in existing}

    for key, candidate in unique_candidates.items():
        league = by_identity.get(key)
        if not league:
            league = PoeLeague(
                name=candidate.name,
                game_version=candidate.game_version,
                start_date=candidate.start_date,
                end_date=candidate.end_date,
                status=candidate.status,
                notes=candidate.notes,
            )
            db.add(league)
            created += 1
        else:
            changed = False
            for field in ("start_date", "end_date", "status"):
                value = getattr(candidate, field)
                if getattr(league, field) != value:
                    setattr(league, field, value)
                    changed = True
            if not league.notes and candidate.notes:
                league.notes = candidate.notes
                changed = True
            if changed:
                updated += 1

        synced.append(league)

    db.commit()
    return created, updated, synced
