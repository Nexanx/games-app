"""Initial schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_url", sa.String(length=1000), nullable=True),
        sa.Column("release_date", sa.Date(), nullable=True),
        sa.Column("genres", sa.JSON(), nullable=False),
        sa.Column("platforms", sa.JSON(), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("external_source", sa.String(length=50), nullable=False),
        sa.Column("external_url", sa.String(length=1000), nullable=True),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_games_id"), "games", ["id"], unique=False)
    op.create_index(op.f("ix_games_title"), "games", ["title"], unique=False)
    op.create_index(op.f("ix_games_external_id"), "games", ["external_id"], unique=False)

    op.create_table(
        "poe_leagues",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("game_version", sa.String(length=20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_poe_leagues_id"), "poe_leagues", ["id"], unique=False)
    op.create_index(op.f("ix_poe_leagues_name"), "poe_leagues", ["name"], unique=False)
    op.create_index(op.f("ix_poe_leagues_game_version"), "poe_leagues", ["game_version"], unique=False)

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_sessions_id"), "chat_sessions", ["id"], unique=False)

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=150), nullable=False),
        sa.Column("value", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index(op.f("ix_settings_id"), "settings", ["id"], unique=False)
    op.create_index(op.f("ix_settings_key"), "settings", ["key"], unique=False)

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
        "poe_characters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("game_version", sa.String(length=20), nullable=False),
        sa.Column("character_class", sa.String(length=100), nullable=True),
        sa.Column("ascendancy", sa.String(length=100), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=True),
        sa.Column("poe_ninja_url", sa.String(length=1000), nullable=True),
        sa.Column("profile_url", sa.String(length=1000), nullable=True),
        sa.Column("build_name", sa.String(length=255), nullable=True),
        sa.Column("main_skill", sa.String(length=255), nullable=True),
        sa.Column("mode", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("playtime_minutes", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["league_id"], ["poe_leagues.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_poe_characters_id"), "poe_characters", ["id"], unique=False)
    op.create_index(op.f("ix_poe_characters_name"), "poe_characters", ["name"], unique=False)
    op.create_index(op.f("ix_poe_characters_game_version"), "poe_characters", ["game_version"], unique=False)
    op.create_index(op.f("ix_poe_characters_status"), "poe_characters", ["status"], unique=False)

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

    op.create_table(
        "poe_currency_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("league_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("icon_url", sa.String(length=1000), nullable=True),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["character_id"], ["poe_characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["league_id"], ["poe_leagues.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("character_id", "name", name="uq_character_currency_name"),
    )
    op.create_index(op.f("ix_poe_currency_stats_id"), "poe_currency_stats", ["id"], unique=False)
    op.create_index(op.f("ix_poe_currency_stats_category"), "poe_currency_stats", ["category"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_id"), "chat_messages", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_messages_id"), table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index(op.f("ix_poe_currency_stats_category"), table_name="poe_currency_stats")
    op.drop_index(op.f("ix_poe_currency_stats_id"), table_name="poe_currency_stats")
    op.drop_table("poe_currency_stats")
    op.drop_index(op.f("ix_game_stats_id"), table_name="game_stats")
    op.drop_table("game_stats")
    op.drop_index(op.f("ix_poe_characters_status"), table_name="poe_characters")
    op.drop_index(op.f("ix_poe_characters_game_version"), table_name="poe_characters")
    op.drop_index(op.f("ix_poe_characters_name"), table_name="poe_characters")
    op.drop_index(op.f("ix_poe_characters_id"), table_name="poe_characters")
    op.drop_table("poe_characters")
    op.drop_index(op.f("ix_backlog_games_status"), table_name="backlog_games")
    op.drop_index(op.f("ix_backlog_games_id"), table_name="backlog_games")
    op.drop_table("backlog_games")
    op.drop_index(op.f("ix_settings_key"), table_name="settings")
    op.drop_index(op.f("ix_settings_id"), table_name="settings")
    op.drop_table("settings")
    op.drop_index(op.f("ix_chat_sessions_id"), table_name="chat_sessions")
    op.drop_table("chat_sessions")
    op.drop_index(op.f("ix_poe_leagues_game_version"), table_name="poe_leagues")
    op.drop_index(op.f("ix_poe_leagues_name"), table_name="poe_leagues")
    op.drop_index(op.f("ix_poe_leagues_id"), table_name="poe_leagues")
    op.drop_table("poe_leagues")
    op.drop_index(op.f("ix_games_external_id"), table_name="games")
    op.drop_index(op.f("ix_games_title"), table_name="games")
    op.drop_index(op.f("ix_games_id"), table_name="games")
    op.drop_table("games")

