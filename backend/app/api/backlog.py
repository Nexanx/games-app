from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import asc, desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database.session import get_session
from app.models import BacklogEntry, Game
from app.schemas.games import (
    BacklogBatchCreate,
    BacklogBatchItemResult,
    BacklogBatchRead,
    BacklogEntryCreate,
    BacklogEntryRead,
    BacklogEntryUpdate,
    BacklogReorder,
)
from app.services.backlog_service import (
    BacklogBatchConflictError,
    add_games_to_backlog,
    get_backlog_identity_index,
    is_game_on_backlog,
    reorder_backlog,
)

router = APIRouter()


@router.get("", response_model=list[BacklogEntryRead])
def list_backlog(
    search: str | None = None,
    sort: Literal["position", "added", "title"] = Query("position"),
    direction: Literal["asc", "desc"] = Query("desc"),
    db: Session = Depends(get_session),
) -> list[BacklogEntry]:
    stmt = select(BacklogEntry).options(selectinload(BacklogEntry.game))
    if search or sort == "title":
        stmt = stmt.join(BacklogEntry.game)
    if search:
        stmt = stmt.where(Game.title.ilike(f"%{search}%"))
    if sort == "added":
        order = asc if direction == "asc" else desc
        stmt = stmt.order_by(order(BacklogEntry.created_at), order(BacklogEntry.id))
    elif sort == "title":
        order = asc if direction == "asc" else desc
        stmt = stmt.order_by(order(func.lower(Game.title)), order(BacklogEntry.id))
    else:
        stmt = stmt.order_by(BacklogEntry.position, BacklogEntry.created_at)
    return db.scalars(stmt).all()


@router.post("", response_model=BacklogEntryRead, status_code=201)
def create_backlog_entry(payload: BacklogEntryCreate, db: Session = Depends(get_session)) -> BacklogEntry:
    game = db.get(Game, payload.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if is_game_on_backlog(
        game.title,
        game.external_source,
        game.external_id,
        get_backlog_identity_index(db),
    ):
        raise HTTPException(status_code=409, detail="Game is already on the backlog")

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


@router.post("/batch", response_model=BacklogBatchRead, status_code=201)
def create_backlog_batch(
    payload: BacklogBatchCreate,
    response: Response,
    db: Session = Depends(get_session),
) -> BacklogBatchRead:
    """Append RAWG search selections in one all-or-nothing database operation."""

    try:
        operations = add_games_to_backlog(db, payload.games)
    except BacklogBatchConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "BACKLOG_BATCH_CONFLICT",
                "message": "Lista Do ogrania została zmieniona. Odśwież wyniki i spróbuj ponownie.",
            },
        ) from exc

    added = [operation.entry for operation in operations if operation.status == "added"]
    already_exists = [
        BacklogBatchItemResult(
            title=operation.title,
            external_id=operation.external_id,
            external_source=operation.external_source,
            status="already_exists",
            reason=operation.reason,
            entry=operation.entry,
        )
        for operation in operations
        if operation.status == "already_exists"
    ]
    # The operation is atomic, therefore a successful response has no partial
    # failures.  A database conflict is returned as 409 after a rollback.
    if not added:
        response.status_code = 200
    return BacklogBatchRead(added=added, already_exists=already_exists, failed=[])


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
