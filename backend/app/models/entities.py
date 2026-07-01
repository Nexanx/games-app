from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
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

    backlog_entry: Mapped["BacklogGame | None"] = relationship(back_populates="game", cascade="all, delete-orphan")


class BacklogGame(Base, TimestampMixin):
    __tablename__ = "backlog_games"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="to_play", index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rating: Mapped[float | None] = mapped_column(Float)
    playtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    game: Mapped[Game] = relationship(back_populates="backlog_entry")
    stats: Mapped[list["GameStat"]] = relationship(back_populates="backlog_game", cascade="all, delete-orphan")


class GameStat(Base, TimestampMixin):
    __tablename__ = "game_stats"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    backlog_game_id: Mapped[int] = mapped_column(ForeignKey("backlog_games.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)

    backlog_game: Mapped[BacklogGame] = relationship(back_populates="stats")


class PoeLeague(Base, TimestampMixin):
    __tablename__ = "poe_leagues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    game_version: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    characters: Mapped[list["PoeCharacter"]] = relationship(back_populates="league")
    currency_stats: Mapped[list["PoeCurrencyStat"]] = relationship(back_populates="league")


class PoeCharacter(Base, TimestampMixin):
    __tablename__ = "poe_characters"

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
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False, index=True)
    playtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    league: Mapped[PoeLeague | None] = relationship(back_populates="characters")
    currency_stats: Mapped[list["PoeCurrencyStat"]] = relationship(back_populates="character", cascade="all, delete-orphan")


class PoeCurrencyStat(Base, TimestampMixin):
    __tablename__ = "poe_currency_stats"
    __table_args__ = (UniqueConstraint("character_id", "name", name="uq_character_currency_name"),)

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

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    value: Mapped[dict[str, Any] | list[Any] | str | int | float | bool | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

