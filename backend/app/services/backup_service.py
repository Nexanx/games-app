from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    BacklogEntry,
    ChatMessage,
    ChatSession,
    CompletedGameEntry,
    CustomStatistic,
    Game,
    PoeCharacter,
    PoeCurrencyStat,
    PoeLeague,
)
from app.schemas.backup import (
    BackupBacklogEntry,
    BackupChatMessage,
    BackupChatSession,
    BackupCompletedGameEntry,
    BackupCustomStatistic,
    BackupData,
    BackupDocument,
    BackupGame,
    BackupImportResult,
    BackupPoeCharacter,
    BackupPoeCurrencyStatistic,
    BackupPoeLeague,
)


def export_backup(db: Session) -> BackupDocument:
    return BackupDocument(
        exported_at=datetime.now(timezone.utc),
        data=BackupData(
            games=[BackupGame.model_validate(item, from_attributes=True) for item in db.scalars(select(Game).order_by(Game.id))],
            backlog_entries=[
                BackupBacklogEntry.model_validate(item, from_attributes=True)
                for item in db.scalars(select(BacklogEntry).order_by(BacklogEntry.position, BacklogEntry.id))
            ],
            completed_game_entries=[
                BackupCompletedGameEntry.model_validate(item, from_attributes=True)
                for item in db.scalars(select(CompletedGameEntry).order_by(CompletedGameEntry.id))
            ],
            custom_statistics=[
                BackupCustomStatistic.model_validate(item, from_attributes=True)
                for item in db.scalars(select(CustomStatistic).order_by(CustomStatistic.id))
            ],
            poe_leagues=[
                BackupPoeLeague.model_validate(item, from_attributes=True)
                for item in db.scalars(select(PoeLeague).order_by(PoeLeague.id))
            ],
            poe_characters=[
                BackupPoeCharacter.model_validate(item, from_attributes=True)
                for item in db.scalars(select(PoeCharacter).order_by(PoeCharacter.id))
            ],
            poe_currency_statistics=[
                BackupPoeCurrencyStatistic.model_validate(item, from_attributes=True)
                for item in db.scalars(select(PoeCurrencyStat).order_by(PoeCurrencyStat.id))
            ],
            chat_sessions=[
                BackupChatSession.model_validate(item, from_attributes=True)
                for item in db.scalars(select(ChatSession).order_by(ChatSession.id))
            ],
            chat_messages=[
                BackupChatMessage.model_validate(item, from_attributes=True)
                for item in db.scalars(select(ChatMessage).order_by(ChatMessage.id))
            ],
            # Settings are intentionally empty: the active application has no settings model and backups never contain secrets.
            settings={},
        ),
    )


def replace_with_backup(db: Session, data: BackupData) -> BackupImportResult:
    """Replace user-owned records in one transaction after schema/reference validation."""
    try:
        _delete_existing_records(db)
        restored = _restore_records(db, data)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return BackupImportResult(mode="replace", restored=restored)


def _delete_existing_records(db: Session) -> None:
    # Explicit child-first deletes also work with SQLite test databases that do not enable FK cascades.
    for model in (
        ChatMessage,
        ChatSession,
        PoeCurrencyStat,
        PoeCharacter,
        PoeLeague,
        CustomStatistic,
        CompletedGameEntry,
        BacklogEntry,
        Game,
    ):
        db.execute(delete(model))
    db.flush()


def _restore_records(db: Session, data: BackupData) -> dict[str, int]:
    game_ids: dict[int, int] = {}
    completed_ids: dict[int, int] = {}
    league_ids: dict[int, int] = {}
    character_ids: dict[int, int] = {}
    session_ids: dict[int, int] = {}

    for item in data.games:
        entity = Game(
            title=item.title,
            description=item.description,
            cover_url=item.cover_url,
            release_date=item.release_date,
            genres=item.genres,
            platforms=item.platforms,
            external_id=item.external_id,
            external_source=item.external_source,
            external_url=item.external_url,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        db.add(entity)
        db.flush()
        game_ids[item.id] = entity.id

    for item in data.backlog_entries:
        db.add(
            BacklogEntry(
                game_id=game_ids[item.game_id],
                position=item.position,
                preferred_platform=item.preferred_platform,
                note=item.note,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    for item in data.completed_game_entries:
        entity = CompletedGameEntry(
            game_id=game_ids[item.game_id],
            completion_date=item.completion_date,
            playtime_hours=item.playtime_hours,
            rating=item.rating,
            platform=item.platform,
            review=item.review,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        db.add(entity)
        db.flush()
        completed_ids[item.id] = entity.id

    for item in data.custom_statistics:
        db.add(
            CustomStatistic(
                completed_game_entry_id=completed_ids[item.completed_game_entry_id],
                name=item.name,
                value=item.value,
                value_type=item.value_type,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    for item in data.poe_leagues:
        entity = PoeLeague(
            name=item.name,
            game_version=item.game_version,
            start_date=item.start_date,
            end_date=item.end_date,
            status=item.status,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        db.add(entity)
        db.flush()
        league_ids[item.id] = entity.id

    for item in data.poe_characters:
        entity = PoeCharacter(
            name=item.name,
            game_version=item.game_version,
            character_class=item.character_class,
            ascendancy=item.ascendancy,
            level=item.level,
            league_id=league_ids.get(item.league_id) if item.league_id else None,
            poe_ninja_url=item.poe_ninja_url,
            profile_url=item.profile_url,
            build_name=item.build_name,
            main_skill=item.main_skill,
            mode=item.mode,
            status=item.status,
            playtime_minutes=item.playtime_minutes,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        db.add(entity)
        db.flush()
        character_ids[item.id] = entity.id

    for item in data.poe_currency_statistics:
        db.add(
            PoeCurrencyStat(
                character_id=character_ids[item.character_id],
                league_id=league_ids.get(item.league_id) if item.league_id else None,
                name=item.name,
                category=item.category,
                icon_url=item.icon_url,
                value=item.value,
                display_order=item.display_order,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    for item in data.chat_sessions:
        entity = ChatSession(title=item.title, created_at=item.created_at, updated_at=item.updated_at)
        db.add(entity)
        db.flush()
        session_ids[item.id] = entity.id

    for item in data.chat_messages:
        db.add(
            ChatMessage(
                session_id=session_ids[item.session_id],
                role=item.role,
                content=item.content,
                created_at=item.created_at,
            )
        )
    db.flush()
    return {
        "games": len(data.games),
        "backlog_entries": len(data.backlog_entries),
        "completed_game_entries": len(data.completed_game_entries),
        "custom_statistics": len(data.custom_statistics),
        "poe_leagues": len(data.poe_leagues),
        "poe_characters": len(data.poe_characters),
        "poe_currency_statistics": len(data.poe_currency_statistics),
        "chat_sessions": len(data.chat_sessions),
        "chat_messages": len(data.chat_messages),
    }
