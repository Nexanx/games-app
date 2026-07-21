"""Store external game rating snapshots.

Revision ID: 0008_game_external_ratings
Revises: 0007_poe_league_identity
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0008_game_external_ratings"
down_revision: str | None = "0007_poe_league_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column("external_ratings", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.add_column("games", sa.Column("external_ratings_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "external_ratings_updated_at")
    op.drop_column("games", "external_ratings")
