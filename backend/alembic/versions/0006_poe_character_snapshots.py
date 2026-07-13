"""Store final Path of Exile character equipment snapshots.

Revision ID: 0006_poe_character_snapshots
Revises: 0005_poe_query_indexes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0006_poe_character_snapshots"
down_revision: str | None = "0005_poe_query_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "poe_characters",
        sa.Column("snapshot_source", sa.String(length=40), nullable=False, server_default="manual"),
    )
    op.create_table(
        "poe_equipment_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("slot", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("base_type", sa.String(length=255), nullable=True),
        sa.Column("rarity", sa.String(length=40), nullable=True),
        sa.Column("item_text", sa.Text(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["poe_characters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("character_id", "slot", name="uq_poe_equipment_character_slot"),
    )
    op.create_index("ix_poe_equipment_items_id", "poe_equipment_items", ["id"], unique=False)
    op.create_index(
        "ix_poe_equipment_character_order",
        "poe_equipment_items",
        ["character_id", "display_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_poe_equipment_character_order", table_name="poe_equipment_items")
    op.drop_index("ix_poe_equipment_items_id", table_name="poe_equipment_items")
    op.drop_table("poe_equipment_items")
    op.drop_column("poe_characters", "snapshot_source")
