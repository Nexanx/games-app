from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


BACKUP_FORMAT_VERSION = 2


class BackupGame(BaseModel):
    id: int = Field(..., gt=0)
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = None
    release_date: date | None = None
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    external_id: str | None = None
    external_source: str = "manual"
    external_url: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupBacklogEntry(BaseModel):
    id: int = Field(..., gt=0)
    game_id: int = Field(..., gt=0)
    position: int = Field(..., ge=0)
    preferred_platform: str | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupCompletedGameEntry(BaseModel):
    id: int = Field(..., gt=0)
    game_id: int = Field(..., gt=0)
    completion_date: date
    playtime_hours: float = Field(..., ge=0)
    rating: float | None = Field(default=None, ge=0, le=10)
    platform: str | None = None
    review: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupCustomStatistic(BaseModel):
    id: int = Field(..., gt=0)
    completed_game_entry_id: int = Field(..., gt=0)
    name: str = Field(..., min_length=1, max_length=150)
    value: str
    value_type: Literal["text", "number", "boolean"] = "text"
    created_at: datetime
    updated_at: datetime


class BackupPoeLeague(BaseModel):
    id: int = Field(..., gt=0)
    name: str = Field(..., min_length=1, max_length=255)
    game_version: str
    start_date: date | None = None
    end_date: date | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupPoeCharacter(BaseModel):
    id: int = Field(..., gt=0)
    name: str = Field(..., min_length=1, max_length=255)
    game_version: str
    character_class: str | None = None
    ascendancy: str | None = None
    level: int = Field(..., ge=1)
    league_id: int | None = Field(default=None, gt=0)
    poe_ninja_url: str | None = None
    profile_url: str | None = None
    build_name: str | None = None
    main_skill: str | None = None
    mode: str | None = None
    status: str
    playtime_minutes: int = Field(..., ge=0)
    snapshot_source: str = "manual"
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupPoeCurrencyStatistic(BaseModel):
    id: int = Field(..., gt=0)
    character_id: int = Field(..., gt=0)
    league_id: int | None = Field(default=None, gt=0)
    name: str = Field(..., min_length=1, max_length=150)
    category: str
    icon_url: str | None = None
    value: float
    display_order: int = Field(..., ge=0)
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class BackupPoeEquipmentItem(BaseModel):
    id: int = Field(..., gt=0)
    character_id: int = Field(..., gt=0)
    slot: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=255)
    base_type: str | None = None
    rarity: str | None = None
    item_text: str = Field(..., min_length=1)
    display_order: int = Field(..., ge=0)
    created_at: datetime
    updated_at: datetime


class BackupChatSession(BaseModel):
    id: int = Field(..., gt=0)
    title: str = Field(..., min_length=1, max_length=255)
    created_at: datetime
    updated_at: datetime


class BackupChatMessage(BaseModel):
    id: int = Field(..., gt=0)
    session_id: int = Field(..., gt=0)
    role: str = Field(..., min_length=1, max_length=30)
    content: str
    created_at: datetime


class BackupData(BaseModel):
    games: list[BackupGame] = Field(default_factory=list)
    backlog_entries: list[BackupBacklogEntry] = Field(default_factory=list)
    completed_game_entries: list[BackupCompletedGameEntry] = Field(default_factory=list)
    custom_statistics: list[BackupCustomStatistic] = Field(default_factory=list)
    poe_leagues: list[BackupPoeLeague] = Field(default_factory=list)
    poe_characters: list[BackupPoeCharacter] = Field(default_factory=list)
    poe_currency_statistics: list[BackupPoeCurrencyStatistic] = Field(default_factory=list)
    poe_equipment_items: list[BackupPoeEquipmentItem] = Field(default_factory=list)
    chat_sessions: list[BackupChatSession] = Field(default_factory=list)
    chat_messages: list[BackupChatMessage] = Field(default_factory=list)
    settings: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_references(self) -> "BackupData":
        _ensure_unique_ids("games", self.games)
        _ensure_unique_ids("backlog_entries", self.backlog_entries)
        _ensure_unique_ids("completed_game_entries", self.completed_game_entries)
        _ensure_unique_ids("custom_statistics", self.custom_statistics)
        _ensure_unique_ids("poe_leagues", self.poe_leagues)
        _ensure_unique_ids("poe_characters", self.poe_characters)
        _ensure_unique_ids("poe_currency_statistics", self.poe_currency_statistics)
        _ensure_unique_ids("poe_equipment_items", self.poe_equipment_items)
        _ensure_unique_ids("chat_sessions", self.chat_sessions)
        _ensure_unique_ids("chat_messages", self.chat_messages)

        game_ids = {item.id for item in self.games}
        completed_ids = {item.id for item in self.completed_game_entries}
        league_ids = {item.id for item in self.poe_leagues}
        character_ids = {item.id for item in self.poe_characters}
        session_ids = {item.id for item in self.chat_sessions}
        if any(item.game_id not in game_ids for item in self.backlog_entries):
            raise ValueError("Backlog entry refers to a missing game.")
        if len({item.game_id for item in self.backlog_entries}) != len(self.backlog_entries):
            raise ValueError("A game can only appear once in the active backlog.")
        if any(item.game_id not in game_ids for item in self.completed_game_entries):
            raise ValueError("Completed entry refers to a missing game.")
        if any(item.completed_game_entry_id not in completed_ids for item in self.custom_statistics):
            raise ValueError("Custom statistic refers to a missing completed entry.")
        if any(item.league_id is not None and item.league_id not in league_ids for item in self.poe_characters):
            raise ValueError("PoE character refers to a missing league.")
        if any(item.character_id not in character_ids for item in self.poe_currency_statistics):
            raise ValueError("PoE statistic refers to a missing character.")
        if any(item.character_id not in character_ids for item in self.poe_equipment_items):
            raise ValueError("PoE equipment item refers to a missing character.")
        if any(item.league_id is not None and item.league_id not in league_ids for item in self.poe_currency_statistics):
            raise ValueError("PoE statistic refers to a missing league.")
        if any(item.session_id not in session_ids for item in self.chat_messages):
            raise ValueError("Chat message refers to a missing session.")
        return self


class BackupDocument(BaseModel):
    format_version: Literal[1, BACKUP_FORMAT_VERSION] = BACKUP_FORMAT_VERSION
    exported_at: datetime
    app_name: str = "Games Tracker"
    data: BackupData


class BackupImportRequest(BaseModel):
    mode: Literal["replace"] = "replace"
    backup: BackupDocument


class BackupImportResult(BaseModel):
    mode: Literal["replace"]
    restored: dict[str, int]


def _ensure_unique_ids(label: str, items: list[BaseModel]) -> None:
    ids = [item.id for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError(f"Duplicate IDs in {label}.")
