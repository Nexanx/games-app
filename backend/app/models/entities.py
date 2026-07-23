from datetime import date, datetime
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Game(Base, TimestampMixin):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(String(1000))
    release_date: Mapped[date | None] = mapped_column(Date)
    genres: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    platforms: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(255), index=True)
    external_source: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    external_url: Mapped[str | None] = mapped_column(String(1000))
    external_ratings: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    external_ratings_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        Index(
            "ix_games_external_identity_normalized",
            func.lower(func.trim(external_source)),
            func.lower(func.trim(external_id)),
        ),
    )

    backlog_entry: Mapped["BacklogEntry | None"] = relationship(back_populates="game", cascade="all, delete-orphan")
    completed_entries: Mapped[list["CompletedGameEntry"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )


class BacklogEntry(Base, TimestampMixin):
    __tablename__ = "backlog_entries"
    __table_args__ = (Index("ix_backlog_entries_position_created", "position", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), unique=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    preferred_platform: Mapped[str | None] = mapped_column(String(150))
    note: Mapped[str | None] = mapped_column(Text)

    game: Mapped[Game] = relationship(back_populates="backlog_entry")


class CompletedGameEntry(Base, TimestampMixin):
    __tablename__ = "completed_game_entries"
    __table_args__ = (
        CheckConstraint("playtime_hours >= 0", name="ck_completed_game_playtime_non_negative"),
        CheckConstraint("rating IS NULL OR (rating >= 0 AND rating <= 10)", name="ck_completed_game_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    completion_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    playtime_hours: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    rating: Mapped[float | None] = mapped_column(Float)
    platform: Mapped[str | None] = mapped_column(String(150))
    review: Mapped[str | None] = mapped_column(Text)

    game: Mapped[Game] = relationship(back_populates="completed_entries")
    custom_statistics: Mapped[list["CustomStatistic"]] = relationship(
        back_populates="completed_game_entry", cascade="all, delete-orphan", order_by="CustomStatistic.id"
    )


class GameRecommendationFeedback(Base, TimestampMixin):
    __tablename__ = "game_recommendation_feedback"
    __table_args__ = (
        CheckConstraint("verdict IN ('positive', 'negative')", name="ck_game_recommendation_feedback_verdict"),
        UniqueConstraint(
            "external_source",
            "external_id",
            name="uq_game_recommendation_feedback_external_identity",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    external_source: Mapped[str] = mapped_column(String(50), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    verdict: Mapped[str] = mapped_column(String(20), nullable=False)
    genres: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    platforms: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)


class GameDiscoveryPreferences(Base, TimestampMixin):
    __tablename__ = "game_discovery_preferences"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_game_discovery_preferences_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    platforms: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    genres: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)


class HiddenGameRelease(Base, TimestampMixin):
    __tablename__ = "hidden_game_releases"
    __table_args__ = (
        UniqueConstraint(
            "external_source",
            "external_id",
            name="uq_hidden_game_releases_external_identity",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    external_source: Mapped[str] = mapped_column(String(50), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    game_payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class CustomStatistic(Base, TimestampMixin):
    __tablename__ = "custom_statistics"
    __table_args__ = (
        CheckConstraint("value_type IN ('text', 'number', 'boolean')", name="ck_custom_statistic_value_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    completed_game_entry_id: Mapped[int] = mapped_column(
        ForeignKey("completed_game_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), default="text", nullable=False)

    completed_game_entry: Mapped[CompletedGameEntry] = relationship(back_populates="custom_statistics")


class PoeLeague(Base, TimestampMixin):
    __tablename__ = "poe_leagues"
    __table_args__ = (Index("ix_poe_leagues_name_version", "name", "game_version", unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    game_version: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    characters: Mapped[list["PoeCharacter"]] = relationship(back_populates="league")
    currency_stats: Mapped[list["PoeCurrencyStat"]] = relationship(back_populates="league")


class PoeCharacter(Base, TimestampMixin):
    __tablename__ = "poe_characters"
    __table_args__ = (Index("ix_poe_characters_league_id", "league_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    game_version: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    character_class: Mapped[str | None] = mapped_column(String(100))
    ascendancy: Mapped[str | None] = mapped_column(String(100))
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    league_id: Mapped[int | None] = mapped_column(ForeignKey("poe_leagues.id", ondelete="SET NULL"))
    poe_ninja_url: Mapped[str | None] = mapped_column(String(1000))
    profile_url: Mapped[str | None] = mapped_column(String(1000))
    build_name: Mapped[str | None] = mapped_column(String(255))
    main_skill: Mapped[str | None] = mapped_column(String(255))
    mode: Mapped[str | None] = mapped_column(String(100))
    playtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    snapshot_source: Mapped[str] = mapped_column(String(40), default="manual", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    league: Mapped[PoeLeague | None] = relationship(back_populates="characters")
    currency_stats: Mapped[list["PoeCurrencyStat"]] = relationship(back_populates="character", cascade="all, delete-orphan")
    equipment: Mapped[list["PoeEquipmentItem"]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="PoeEquipmentItem.display_order",
    )


class PoeEquipmentItem(Base, TimestampMixin):
    __tablename__ = "poe_equipment_items"
    __table_args__ = (
        UniqueConstraint("character_id", "slot", name="uq_poe_equipment_character_slot"),
        Index("ix_poe_equipment_character_order", "character_id", "display_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    character_id: Mapped[int] = mapped_column(ForeignKey("poe_characters.id", ondelete="CASCADE"), nullable=False)
    slot: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    base_type: Mapped[str | None] = mapped_column(String(255))
    rarity: Mapped[str | None] = mapped_column(String(40))
    item_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    character: Mapped[PoeCharacter] = relationship(back_populates="equipment")


class PoeCurrencyStat(Base, TimestampMixin):
    __tablename__ = "poe_currency_stats"
    __table_args__ = (
        UniqueConstraint("character_id", "name", name="uq_character_currency_name"),
        Index("ix_poe_currency_stats_character_order", "character_id", "display_order", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    character_id: Mapped[int] = mapped_column(ForeignKey("poe_characters.id", ondelete="CASCADE"), nullable=False)
    league_id: Mapped[int | None] = mapped_column(ForeignKey("poe_leagues.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="custom", nullable=False, index=True)
    icon_url: Mapped[str | None] = mapped_column(String(1000))
    value: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    character: Mapped[PoeCharacter] = relationship(back_populates="currency_stats")
    league: Mapped[PoeLeague | None] = relationship(back_populates="currency_stats")


class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), default="Nowa rozmowa", nullable=False)

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_session_created", "session_id", "created_at", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped[ChatSession] = relationship(back_populates="messages")
