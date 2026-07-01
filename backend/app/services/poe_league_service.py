from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.poe_leagues import PoeLeagueCandidate
from app.models import PoeLeague


def get_or_create_league_by_name(db: Session, name: str, game_version: str, notes: str | None = None) -> PoeLeague:
    league = db.scalar(select(PoeLeague).where(PoeLeague.name == name, PoeLeague.game_version == game_version))
    if league:
        return league

    league = PoeLeague(name=name, game_version=game_version, status="active", notes=notes)
    db.add(league)
    db.commit()
    db.refresh(league)
    return league


def upsert_poe_leagues(db: Session, candidates: list[PoeLeagueCandidate]) -> tuple[int, int, list[PoeLeague]]:
    created = 0
    updated = 0
    synced: list[PoeLeague] = []
    seen: set[tuple[str, str]] = set()

    for candidate in candidates:
        key = (candidate.name, candidate.game_version)
        if key in seen:
            continue
        seen.add(key)

        league = db.scalar(
            select(PoeLeague).where(
                PoeLeague.name == candidate.name,
                PoeLeague.game_version == candidate.game_version,
            )
        )
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
    for league in synced:
        db.refresh(league)
    return created, updated, synced
