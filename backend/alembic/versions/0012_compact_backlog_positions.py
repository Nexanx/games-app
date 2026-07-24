"""Compact existing backlog positions while preserving their order.

Revision ID: 0012_compact_backlog_positions
Revises: 0011_release_personalization
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0012_compact_backlog_positions"
down_revision: str | None = "0011_release_personalization"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    entry_ids = connection.execute(
        sa.text(
            """
            SELECT id
            FROM backlog_entries
            ORDER BY position, created_at, id
            """
        )
    ).scalars().all()
    if entry_ids:
        connection.execute(
            sa.text(
                """
                UPDATE backlog_entries
                SET position = :position
                WHERE id = :entry_id
                """
            ),
            [
                {"entry_id": entry_id, "position": position}
                for position, entry_id in enumerate(entry_ids)
            ],
        )


def downgrade() -> None:
    # Previous gaps cannot be reconstructed deterministically. Keeping the
    # compact order is safer than inventing positions during a downgrade.
    pass
