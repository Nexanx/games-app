"""Store explicit recommendation feedback.

Revision ID: 0009_recommendation_feedback
Revises: 0008_game_external_ratings
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0009_recommendation_feedback"
down_revision: str | None = "0008_game_external_ratings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "game_recommendation_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_source", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("verdict", sa.String(length=20), nullable=False),
        sa.Column("genres", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("platforms", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "verdict IN ('positive', 'negative')",
            name="ck_game_recommendation_feedback_verdict",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "external_source",
            "external_id",
            name="uq_game_recommendation_feedback_external_identity",
        ),
    )
    op.create_index(
        op.f("ix_game_recommendation_feedback_id"),
        "game_recommendation_feedback",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_game_recommendation_feedback_id"), table_name="game_recommendation_feedback")
    op.drop_table("game_recommendation_feedback")
