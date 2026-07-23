"""Add release discovery preferences and persistent hidden releases.

Revision ID: 0011_release_personalization
Revises: 0010_archive_poe_statuses
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0011_release_personalization"
down_revision: str | None = "0010_archive_poe_statuses"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "game_discovery_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("platforms", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("genres", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("id = 1", name="ck_game_discovery_preferences_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "hidden_game_releases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_source", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("game_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "external_source",
            "external_id",
            name="uq_hidden_game_releases_external_identity",
        ),
    )
    op.create_index(
        op.f("ix_hidden_game_releases_id"),
        "hidden_game_releases",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_hidden_game_releases_id"), table_name="hidden_game_releases")
    op.drop_table("hidden_game_releases")
    op.drop_table("game_discovery_preferences")
