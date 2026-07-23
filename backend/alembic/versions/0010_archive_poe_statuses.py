"""Archive and remove unused Path of Exile status fields.

Revision ID: 0010_archive_poe_statuses
Revises: 0009_recommendation_feedback
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0010_archive_poe_statuses"
down_revision: str | None = "0009_recommendation_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "poe_status_archive",
        sa.Column("entity_kind", sa.String(length=20), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("entity_kind", "entity_id"),
    )
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "INSERT INTO poe_status_archive (entity_kind, entity_id, status) "
            "SELECT 'league', id, status FROM poe_leagues"
        )
    )
    connection.execute(
        sa.text(
            "INSERT INTO poe_status_archive (entity_kind, entity_id, status) "
            "SELECT 'character', id, status FROM poe_characters"
        )
    )
    op.drop_index("ix_poe_characters_status", table_name="poe_characters")
    op.drop_column("poe_characters", "status")
    op.drop_column("poe_leagues", "status")


def downgrade() -> None:
    op.add_column(
        "poe_leagues",
        sa.Column("status", sa.String(length=40), nullable=False, server_default="active"),
    )
    op.add_column(
        "poe_characters",
        sa.Column("status", sa.String(length=40), nullable=False, server_default="ended"),
    )
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "UPDATE poe_leagues SET status = COALESCE((SELECT status FROM poe_status_archive "
            "WHERE entity_kind = 'league' AND entity_id = poe_leagues.id), 'active')"
        )
    )
    connection.execute(
        sa.text(
            "UPDATE poe_characters SET status = COALESCE((SELECT status FROM poe_status_archive "
            "WHERE entity_kind = 'character' AND entity_id = poe_characters.id), 'ended')"
        )
    )
    op.create_index("ix_poe_characters_status", "poe_characters", ["status"], unique=False)
    op.drop_table("poe_status_archive")
