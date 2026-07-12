"""Add indexes used by backlog ordering and chat history queries.

Revision ID: 0004_query_path_indexes
Revises: 0003_external_game_identity
"""

from collections.abc import Sequence

from alembic import op


revision: str = "0004_query_path_indexes"
down_revision: str | None = "0003_external_game_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_backlog_entries_position_created",
        "backlog_entries",
        ["position", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_chat_messages_session_created",
        "chat_messages",
        ["session_id", "created_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_session_created", table_name="chat_messages")
    op.drop_index("ix_backlog_entries_position_created", table_name="backlog_entries")
