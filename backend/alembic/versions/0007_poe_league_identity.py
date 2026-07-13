"""Enforce one league identity per Path of Exile version.

Revision ID: 0007_poe_league_identity
Revises: 0006_poe_character_snapshots
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text


revision: str = "0007_poe_league_identity"
down_revision: str | None = "0006_poe_character_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    duplicate = op.get_bind().execute(
        text(
            "SELECT name, game_version FROM poe_leagues "
            "GROUP BY name, game_version HAVING COUNT(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicate:
        raise RuntimeError(
            "Nie można włączyć unikalności lig PoE: istnieją duplikaty nazwy i wersji gry. "
            "Migracja nie zmieniła ani nie usunęła danych."
        )
    op.drop_index("ix_poe_leagues_name_version", table_name="poe_leagues")
    op.create_index(
        "ix_poe_leagues_name_version",
        "poe_leagues",
        ["name", "game_version"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_poe_leagues_name_version", table_name="poe_leagues")
    op.create_index(
        "ix_poe_leagues_name_version",
        "poe_leagues",
        ["name", "game_version"],
        unique=False,
    )
