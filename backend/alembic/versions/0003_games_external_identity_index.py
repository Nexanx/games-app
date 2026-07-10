"""Add an index for normalized external game identities.

Revision ID: 0003_external_game_identity
Revises: 0002_completed_games_and_backlog
Create Date: 2026-07-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0003_external_game_identity"
down_revision: str | None = "0002_completed_games_and_backlog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # RAWG deduplication compares case- and whitespace-normalized source/ID
    # pairs. A plain btree on external_id cannot support those predicates.
    op.create_index(
        "ix_games_external_identity_normalized",
        "games",
        [sa.text("lower(trim(external_source))"), sa.text("lower(trim(external_id))")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_games_external_identity_normalized", table_name="games")
