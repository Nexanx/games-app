from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PoeLeagueBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    game_version: str = Field(..., pattern="^poe[12]$")
    start_date: date | None = None
    end_date: date | None = None
    status: str = "active"
    notes: str | None = None


class PoeLeagueCreate(PoeLeagueBase):
    pass


class PoeLeagueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    game_version: str | None = Field(default=None, pattern="^poe[12]$")
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    notes: str | None = None


class PoeLeagueRead(PoeLeagueBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoeLeagueSyncRequest(BaseModel):
    game_version: str | None = Field(default=None, pattern="^poe[12]$")


class PoeLeagueSyncResult(BaseModel):
    created: int
    updated: int
    leagues: list[PoeLeagueRead]
    source: str = "official_pathofexile_api"


class PoeCharacterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    game_version: str = Field(..., pattern="^poe[12]$")
    character_class: str | None = None
    ascendancy: str | None = None
    level: int = Field(default=1, ge=1, le=100)
    league_id: int | None = None
    poe_ninja_url: str | None = None
    profile_url: str | None = None
    build_name: str | None = None
    main_skill: str | None = None
    mode: str | None = None
    status: str = "active"
    playtime_minutes: int = Field(default=0, ge=0)
    notes: str | None = None


class PoeCharacterCreate(PoeCharacterBase):
    pass


class PoeCharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    game_version: str | None = Field(default=None, pattern="^poe[12]$")
    character_class: str | None = None
    ascendancy: str | None = None
    level: int | None = Field(default=None, ge=1, le=100)
    league_id: int | None = None
    poe_ninja_url: str | None = None
    profile_url: str | None = None
    build_name: str | None = None
    main_skill: str | None = None
    mode: str | None = None
    status: str | None = None
    playtime_minutes: int | None = Field(default=None, ge=0)
    notes: str | None = None


class PoeCharacterRead(PoeCharacterBase):
    id: int
    league: PoeLeagueRead | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoeCurrencyStatBase(BaseModel):
    league_id: int | None = None
    name: str = Field(..., min_length=1, max_length=150)
    category: str = "custom"
    icon_url: str | None = None
    value: float = 0
    display_order: int = 0
    notes: str | None = None


class PoeCurrencyStatCreate(PoeCurrencyStatBase):
    pass


class PoeCurrencyStatUpdate(BaseModel):
    league_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = None
    icon_url: str | None = None
    value: float | None = None
    display_order: int | None = None
    notes: str | None = None


class PoeCurrencyStatRead(PoeCurrencyStatBase):
    id: int
    character_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoeStatsReorder(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1)


class PoeNinjaImportRequest(BaseModel):
    url: str = Field(..., min_length=5)


class PoeNinjaImportResult(BaseModel):
    name: str | None = None
    game_version: str = "poe1"
    character_class: str | None = None
    ascendancy: str | None = None
    level: int | None = None
    league_name: str | None = None
    league_id: int | None = None
    poe_ninja_url: str
    profile_url: str | None = None
    build_name: str | None = None
    main_skill: str | None = None
    mode: str | None = None
    status: str = "manual_review"
    notes: str
