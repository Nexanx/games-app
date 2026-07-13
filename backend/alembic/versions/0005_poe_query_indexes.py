"""Add indexes used by Path of Exile list and detail queries.

Revision ID: 0005_poe_query_indexes
Revises: 0004_query_path_indexes
"""

from collections.abc import Sequence

from alembic import op


revision: str = "0005_poe_query_indexes"
down_revision: str | None = "0004_query_path_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_poe_leagues_name_version",
        "poe_leagues",
        ["name", "game_version"],
        unique=False,
    )
    op.create_index(
        "ix_poe_characters_league_id",
        "poe_characters",
        ["league_id"],
        unique=False,
    )
    op.create_index(
        "ix_poe_currency_stats_character_order",
        "poe_currency_stats",
        ["character_id", "display_order", "name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_poe_currency_stats_character_order", table_name="poe_currency_stats")
    op.drop_index("ix_poe_characters_league_id", table_name="poe_characters")
    op.drop_index("ix_poe_leagues_name_version", table_name="poe_leagues")
