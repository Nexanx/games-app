from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database.session import get_session
from app.models import BacklogEntry, Game
from app.schemas.games import BacklogEntryCreate, BacklogEntryRead, BacklogEntryUpdate, BacklogReorder
from app.services.backlog_service import reorder_backlog

router = APIRouter()


@router.get("", response_model=list[BacklogEntryRead])
def list_backlog(
    search: str | None = None,
    sort: str = Query("position", pattern="^(position|added)$"),
    db: Session = Depends(get_session),
) -> list[BacklogEntry]:
    stmt = select(BacklogEntry).options(selectinload(BacklogEntry.game))
    if search:
        stmt = stmt.join(BacklogEntry.game).where(Game.title.ilike(f"%{search}%"))
    if sort == "added":
        stmt = stmt.order_by(desc(BacklogEntry.created_at))
    else:
        stmt = stmt.order_by(BacklogEntry.position, BacklogEntry.created_at)
    return db.scalars(stmt).all()


@router.post("", response_model=BacklogEntryRead, status_code=201)
def create_backlog_entry(payload: BacklogEntryCreate, db: Session = Depends(get_session)) -> BacklogEntry:
    if not db.get(Game, payload.game_id):
        raise HTTPException(status_code=404, detail="Game not found")

    data = payload.model_dump()
    if data["position"] == 0:
        max_position = db.scalar(select(func.max(BacklogEntry.position)))
        data["position"] = 0 if max_position is None else max_position + 1
    entry = BacklogEntry(**data)
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Game is already on the backlog") from exc
    return _get_entry(db, entry.id)


@router.post("/reorder", response_model=list[BacklogEntryRead])
def reorder(payload: BacklogReorder, db: Session = Depends(get_session)) -> list[BacklogEntry]:
    try:
        return reorder_backlog(db, payload.ordered_ids)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{entry_id}", response_model=BacklogEntryRead)
def get_backlog_entry(entry_id: int, db: Session = Depends(get_session)) -> BacklogEntry:
    return _get_entry(db, entry_id)


@router.patch("/{entry_id}", response_model=BacklogEntryRead)
def update_backlog_entry(
    entry_id: int, payload: BacklogEntryUpdate, db: Session = Depends(get_session)
) -> BacklogEntry:
    entry = db.get(BacklogEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    return _get_entry(db, entry.id)


@router.delete("/{entry_id}", status_code=204)
def delete_backlog_entry(entry_id: int, db: Session = Depends(get_session)) -> None:
    entry = db.get(BacklogEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    db.delete(entry)
    db.commit()


def _get_entry(db: Session, entry_id: int) -> BacklogEntry:
    entry = db.scalars(
        select(BacklogEntry).options(selectinload(BacklogEntry.game)).where(BacklogEntry.id == entry_id)
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    return entry
