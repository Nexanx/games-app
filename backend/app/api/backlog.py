from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.database.session import get_session
from app.models import BacklogGame, Game, GameStat
from app.schemas.games import (
    BacklogGameCreate,
    BacklogGameRead,
    BacklogGameUpdate,
    BacklogReorder,
    GameStatCreate,
    GameStatRead,
    GameStatUpdate,
)
from app.services.backlog_service import reorder_backlog

router = APIRouter()


@router.get("", response_model=list[BacklogGameRead])
def list_backlog(
    status: str | None = None,
    search: str | None = None,
    sort: str = Query("position", pattern="^(position|added|rating|playtime|completed)$"),
    db: Session = Depends(get_session),
) -> list[BacklogGame]:
    stmt = select(BacklogGame).options(selectinload(BacklogGame.game))
    if search:
        stmt = stmt.join(BacklogGame.game).where(Game.title.ilike(f"%{search}%"))
    if status:
        stmt = stmt.where(BacklogGame.status == status)

    if sort == "added":
        stmt = stmt.order_by(desc(BacklogGame.created_at))
    elif sort == "rating":
        stmt = stmt.order_by(desc(BacklogGame.rating), BacklogGame.position)
    elif sort == "playtime":
        stmt = stmt.order_by(desc(BacklogGame.playtime_minutes), BacklogGame.position)
    elif sort == "completed":
        stmt = stmt.order_by(desc(BacklogGame.completed_at), BacklogGame.position)
    else:
        stmt = stmt.order_by(BacklogGame.position, BacklogGame.created_at)
    return db.scalars(stmt).all()


@router.post("", response_model=BacklogGameRead, status_code=201)
def create_backlog_entry(payload: BacklogGameCreate, db: Session = Depends(get_session)) -> BacklogGame:
    game = db.get(Game, payload.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if payload.position == 0:
        max_position = db.scalar(select(func.max(BacklogGame.position))) or -1
        payload.position = max_position + 1
    entry = BacklogGame(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return db.scalars(
        select(BacklogGame).options(selectinload(BacklogGame.game)).where(BacklogGame.id == entry.id)
    ).one()


@router.get("/{entry_id}", response_model=BacklogGameRead)
def get_backlog_entry(entry_id: int, db: Session = Depends(get_session)) -> BacklogGame:
    entry = db.scalars(
        select(BacklogGame).options(selectinload(BacklogGame.game)).where(BacklogGame.id == entry_id)
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    return entry


@router.patch("/{entry_id}", response_model=BacklogGameRead)
def update_backlog_entry(entry_id: int, payload: BacklogGameUpdate, db: Session = Depends(get_session)) -> BacklogGame:
    entry = db.get(BacklogGame, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    return db.scalars(
        select(BacklogGame).options(selectinload(BacklogGame.game)).where(BacklogGame.id == entry.id)
    ).one()


@router.delete("/{entry_id}", status_code=204)
def delete_backlog_entry(entry_id: int, db: Session = Depends(get_session)) -> None:
    entry = db.get(BacklogGame, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    db.delete(entry)
    db.commit()


@router.post("/reorder", response_model=list[BacklogGameRead])
def reorder(payload: BacklogReorder, db: Session = Depends(get_session)) -> list[BacklogGame]:
    try:
        return reorder_backlog(db, payload.ordered_ids)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{entry_id}/mark-completed", response_model=BacklogGameRead)
def mark_completed(entry_id: int, db: Session = Depends(get_session)) -> BacklogGame:
    return _mark_status(db, entry_id, "completed", completed=True)


@router.post("/{entry_id}/mark-playing", response_model=BacklogGameRead)
def mark_playing(entry_id: int, db: Session = Depends(get_session)) -> BacklogGame:
    return _mark_status(db, entry_id, "playing", started=True)


@router.post("/{entry_id}/mark-abandoned", response_model=BacklogGameRead)
def mark_abandoned(entry_id: int, db: Session = Depends(get_session)) -> BacklogGame:
    return _mark_status(db, entry_id, "abandoned")


@router.get("/{entry_id}/stats", response_model=list[GameStatRead])
def list_game_stats(entry_id: int, db: Session = Depends(get_session)) -> list[GameStat]:
    return db.scalars(select(GameStat).where(GameStat.backlog_game_id == entry_id).order_by(GameStat.name)).all()


@router.post("/{entry_id}/stats", response_model=GameStatRead, status_code=201)
def create_game_stat(entry_id: int, payload: GameStatCreate, db: Session = Depends(get_session)) -> GameStat:
    if entry_id != payload.backlog_game_id:
        raise HTTPException(status_code=400, detail="Path entry id must match payload backlog_game_id")
    if not db.get(BacklogGame, entry_id):
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    stat = GameStat(**payload.model_dump())
    db.add(stat)
    db.commit()
    db.refresh(stat)
    return stat


@router.patch("/stats/{stat_id}", response_model=GameStatRead)
def update_game_stat(stat_id: int, payload: GameStatUpdate, db: Session = Depends(get_session)) -> GameStat:
    stat = db.get(GameStat, stat_id)
    if not stat:
        raise HTTPException(status_code=404, detail="Game stat not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(stat, key, value)
    db.commit()
    db.refresh(stat)
    return stat


@router.delete("/stats/{stat_id}", status_code=204)
def delete_game_stat(stat_id: int, db: Session = Depends(get_session)) -> None:
    stat = db.get(GameStat, stat_id)
    if not stat:
        raise HTTPException(status_code=404, detail="Game stat not found")
    db.delete(stat)
    db.commit()


def _mark_status(
    db: Session, entry_id: int, status: str, *, started: bool = False, completed: bool = False
) -> BacklogGame:
    entry = db.get(BacklogGame, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Backlog entry not found")
    now = datetime.now(timezone.utc)
    entry.status = status
    if started and not entry.started_at:
        entry.started_at = now
    if completed:
        entry.completed_at = now
        entry.completion_percent = 100
    db.commit()
    return db.scalars(
        select(BacklogGame).options(selectinload(BacklogGame.game)).where(BacklogGame.id == entry.id)
    ).one()

