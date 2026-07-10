"""Split completed games from the active backlog.

Revision ID: 0002_completed_games_and_backlog
Revises: 0001_initial
Create Date: 2026-07-10 00:00:00.000000
"""

from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime, timezone
import json

import sqlalchemy as sa
from alembic import op

revision: str = "0002_completed_games_and_backlog"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "backlog_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("preferred_platform", sa.String(length=150), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id"),
    )
    op.create_index(op.f("ix_backlog_entries_id"), "backlog_entries", ["id"], unique=False)

    op.create_table(
        "completed_game_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("completion_date", sa.Date(), nullable=False),
        sa.Column("playtime_hours", sa.Float(), nullable=False),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("platform", sa.String(length=150), nullable=True),
        sa.Column("review", sa.Text(), nullable=True),
        *timestamps(),
        sa.CheckConstraint("playtime_hours >= 0", name="ck_completed_game_playtime_non_negative"),
        sa.CheckConstraint(
            "rating IS NULL OR (rating >= 0 AND rating <= 10)", name="ck_completed_game_rating_range"
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_completed_game_entries_id"), "completed_game_entries", ["id"], unique=False)
    op.create_index(
        op.f("ix_completed_game_entries_game_id"), "completed_game_entries", ["game_id"], unique=False
    )
    op.create_index(
        op.f("ix_completed_game_entries_completion_date"),
        "completed_game_entries",
        ["completion_date"],
        unique=False,
    )

    op.create_table(
        "custom_statistics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("completed_game_entry_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        *timestamps(),
        sa.CheckConstraint(
            "value_type IN ('text', 'number', 'boolean')", name="ck_custom_statistic_value_type"
        ),
        sa.ForeignKeyConstraint(
            ["completed_game_entry_id"], ["completed_game_entries.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_custom_statistics_id"), "custom_statistics", ["id"], unique=False)
    op.create_index(
        op.f("ix_custom_statistics_completed_game_entry_id"),
        "custom_statistics",
        ["completed_game_entry_id"],
        unique=False,
    )

    _migrate_existing_game_data()

    op.drop_index(op.f("ix_game_stats_id"), table_name="game_stats")
    op.drop_table("game_stats")
    op.drop_index(op.f("ix_backlog_games_status"), table_name="backlog_games")
    op.drop_index(op.f("ix_backlog_games_id"), table_name="backlog_games")
    op.drop_table("backlog_games")


def downgrade() -> None:
    op.create_table(
        "backlog_games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("playtime_minutes", sa.Integer(), nullable=False),
        sa.Column("completion_percent", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id"),
    )
    op.create_index(op.f("ix_backlog_games_id"), "backlog_games", ["id"], unique=False)
    op.create_index(op.f("ix_backlog_games_status"), "backlog_games", ["status"], unique=False)
    op.create_table(
        "game_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("backlog_game_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["backlog_game_id"], ["backlog_games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_game_stats_id"), "game_stats", ["id"], unique=False)

    _restore_legacy_game_data()

    op.drop_index(op.f("ix_custom_statistics_completed_game_entry_id"), table_name="custom_statistics")
    op.drop_index(op.f("ix_custom_statistics_id"), table_name="custom_statistics")
    op.drop_table("custom_statistics")
    op.drop_index(op.f("ix_completed_game_entries_completion_date"), table_name="completed_game_entries")
    op.drop_index(op.f("ix_completed_game_entries_game_id"), table_name="completed_game_entries")
    op.drop_index(op.f("ix_completed_game_entries_id"), table_name="completed_game_entries")
    op.drop_table("completed_game_entries")
    op.drop_index(op.f("ix_backlog_entries_id"), table_name="backlog_entries")
    op.drop_table("backlog_entries")


def _migrate_existing_game_data() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    games = sa.Table("games", metadata, autoload_with=bind)
    old_backlog = sa.Table("backlog_games", metadata, autoload_with=bind)
    old_stats = sa.Table("game_stats", metadata, autoload_with=bind)
    backlog = sa.Table("backlog_entries", metadata, autoload_with=bind)
    completed = sa.Table("completed_game_entries", metadata, autoload_with=bind)
    statistics = sa.Table("custom_statistics", metadata, autoload_with=bind)

    platforms_by_game = {
        row.id: _as_list(row.platforms)
        for row in bind.execute(sa.select(games.c.id, games.c.platforms)).mappings()
    }
    stats_by_entry: dict[int, list[dict]] = defaultdict(list)
    for row in bind.execute(sa.select(old_stats).order_by(old_stats.c.id)).mappings():
        stats_by_entry[row.backlog_game_id].append(dict(row))

    for row in bind.execute(sa.select(old_backlog).order_by(old_backlog.c.id)).mappings():
        created_at = row.created_at or datetime.now(timezone.utc)
        updated_at = row.updated_at or created_at
        platforms = platforms_by_game.get(row.game_id, [])
        if row.status == "completed":
            completed_at = row.completed_at or created_at
            completion_date = completed_at.date() if hasattr(completed_at, "date") else completed_at
            result = bind.execute(
                completed.insert().values(
                    game_id=row.game_id,
                    completion_date=completion_date,
                    playtime_hours=max(0, row.playtime_minutes or 0) / 60,
                    rating=row.rating,
                    platform=platforms[0] if platforms else None,
                    review=row.notes,
                    created_at=created_at,
                    updated_at=updated_at,
                )
            )
            completed_id = result.inserted_primary_key[0]
            for old_stat in stats_by_entry.get(row.id, []):
                value, value_type = _statistic_value(old_stat)
                bind.execute(
                    statistics.insert().values(
                        completed_game_entry_id=completed_id,
                        name=old_stat["name"],
                        value=value,
                        value_type=value_type,
                        created_at=old_stat["created_at"] or created_at,
                        updated_at=old_stat["updated_at"] or updated_at,
                    )
                )
        else:
            note = _legacy_backlog_note(row, stats_by_entry.get(row.id, []))
            bind.execute(
                backlog.insert().values(
                    game_id=row.game_id,
                    position=max(0, row.position or 0),
                    preferred_platform=platforms[0] if platforms else None,
                    note=note,
                    created_at=created_at,
                    updated_at=updated_at,
                )
            )


def _restore_legacy_game_data() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    backlog = sa.Table("backlog_entries", metadata, autoload_with=bind)
    completed = sa.Table("completed_game_entries", metadata, autoload_with=bind)
    statistics = sa.Table("custom_statistics", metadata, autoload_with=bind)
    old_backlog = sa.Table("backlog_games", metadata, autoload_with=bind)
    old_stats = sa.Table("game_stats", metadata, autoload_with=bind)

    for row in bind.execute(sa.select(backlog)).mappings():
        bind.execute(
            old_backlog.insert().values(
                game_id=row.game_id,
                status="to_play",
                position=row.position,
                rating=None,
                playtime_minutes=0,
                completion_percent=0,
                started_at=None,
                completed_at=None,
                notes=row.note,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )

    for row in bind.execute(sa.select(completed)).mappings():
        completed_at = datetime.combine(row.completion_date, datetime.min.time(), tzinfo=timezone.utc)
        result = bind.execute(
            old_backlog.insert().values(
                game_id=row.game_id,
                status="completed",
                position=0,
                rating=row.rating,
                playtime_minutes=round(max(0, row.playtime_hours or 0) * 60),
                completion_percent=100,
                started_at=None,
                completed_at=completed_at,
                notes=row.review,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )
        old_entry_id = result.inserted_primary_key[0]
        for statistic in bind.execute(
            sa.select(statistics).where(statistics.c.completed_game_entry_id == row.id)
        ).mappings():
            numeric_value = float(statistic.value) if statistic.value_type == "number" else 0
            notes = None if statistic.value_type == "number" else f"Wartość przed migracją: {statistic.value}"
            bind.execute(
                old_stats.insert().values(
                    backlog_game_id=old_entry_id,
                    name=statistic.name,
                    value=numeric_value,
                    unit=None,
                    notes=notes,
                    created_at=statistic.created_at,
                    updated_at=statistic.updated_at,
                )
            )


def _as_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return [str(item) for item in parsed] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _statistic_value(statistic: dict) -> tuple[str, str]:
    numeric = f"{float(statistic['value'] or 0):g}"
    extras = " ".join(part for part in [statistic.get("unit"), statistic.get("notes")] if part)
    return (f"{numeric} {extras}".strip(), "text") if extras else (numeric, "number")


def _legacy_backlog_note(row: sa.RowMapping, statistics: list[dict]) -> str | None:
    parts = [row.notes] if row.notes else []
    legacy = []
    if row.rating is not None:
        legacy.append(f"ocena {row.rating:g}/10")
    if row.playtime_minutes:
        legacy.append(f"czas {row.playtime_minutes / 60:g} godz.")
    if legacy:
        parts.append("Dane zachowane podczas migracji: " + ", ".join(legacy) + ".")
    if statistics:
        rendered = [f"{stat['name']}: {_statistic_value(stat)[0]}" for stat in statistics]
        parts.append("Dawne statystyki: " + "; ".join(rendered) + ".")
    return "\n\n".join(parts) or None
