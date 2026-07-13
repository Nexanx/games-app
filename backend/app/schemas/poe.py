from datetime import date, datetime
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _is_poe_ninja_url(value: str) -> bool:
    if not _is_http_url(value):
        return False
    hostname = (urlparse(value).hostname or "").lower()
    return hostname == "poe.ninja" or hostname.endswith(".poe.ninja") or hostname == "poe2.ninja"


class PoeLeagueBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    game_version: str = Field(..., pattern="^poe[12]$")
    start_date: date | None = None
    end_date: date | None = None
    status: str = "active"
    notes: str | None = None


class PoeLeagueCreate(PoeLeagueBase):
    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in {"active", "completed", "planned"}:
            raise ValueError("Nieobsługiwany status ligi.")
        return value


class PoeLeagueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    game_version: str | None = Field(default=None, pattern="^poe[12]$")
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"active", "completed", "planned"}:
            raise ValueError("Nieobsługiwany status ligi.")
        return value


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
    status: str = "ended"
    playtime_minutes: int = Field(default=0, ge=0)
    snapshot_source: str = Field(default="manual", pattern="^(manual|pob|poe_ninja_pob)$")
    notes: str | None = None


class PoeCharacterCreate(PoeCharacterBase):
    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in {"active", "ended", "rip", "test", "deleted"}:
            raise ValueError("Nieobsługiwany status postaci.")
        return value

    @field_validator("poe_ninja_url")
    @classmethod
    def validate_poe_ninja_url(cls, value: str | None) -> str | None:
        if value and not _is_poe_ninja_url(value):
            raise ValueError("Link poe.ninja musi prowadzić do domeny poe.ninja.")
        return value

    @field_validator("profile_url")
    @classmethod
    def validate_profile_url(cls, value: str | None) -> str | None:
        if value and not _is_http_url(value):
            raise ValueError("Link profilu musi być poprawnym adresem HTTP lub HTTPS.")
        return value


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
    snapshot_source: str | None = Field(default=None, pattern="^(manual|pob|poe_ninja_pob)$")
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"active", "ended", "rip", "test", "deleted"}:
            raise ValueError("Nieobsługiwany status postaci.")
        return value

    @field_validator("poe_ninja_url")
    @classmethod
    def validate_poe_ninja_url(cls, value: str | None) -> str | None:
        if value and not _is_poe_ninja_url(value):
            raise ValueError("Link poe.ninja musi prowadzić do domeny poe.ninja.")
        return value

    @field_validator("profile_url")
    @classmethod
    def validate_profile_url(cls, value: str | None) -> str | None:
        if value and not _is_http_url(value):
            raise ValueError("Link profilu musi być poprawnym adresem HTTP lub HTTPS.")
        return value


class PoeCharacterRead(PoeCharacterBase):
    id: int
    league: PoeLeagueRead | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoeEquipmentItemBase(BaseModel):
    slot: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=255)
    base_type: str | None = Field(default=None, max_length=255)
    rarity: str | None = Field(default=None, max_length=40)
    item_text: str = Field(..., min_length=1, max_length=20_000)
    display_order: int = Field(default=0, ge=0)


class PoeEquipmentItemRead(PoeEquipmentItemBase):
    id: int
    character_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoeBuildCodeRequest(BaseModel):
    code: str = Field(..., min_length=20, max_length=2_000_000)


class PoeBuildPreview(BaseModel):
    game_version: str = Field(..., pattern="^poe[12]$")
    character_class: str | None = None
    ascendancy: str | None = None
    level: int = Field(..., ge=1, le=100)
    equipment_count: int = Field(..., ge=0)


class PoeCharacterPobImport(PoeBuildCodeRequest):
    name: str = Field(..., min_length=1, max_length=255)
    league_id: int | None = None
    poe_ninja_url: str | None = None
    status: str = Field(default="ended", pattern="^(active|ended|rip|test|deleted)$")
    playtime_minutes: int = Field(default=0, ge=0)
    notes: str | None = None

    @field_validator("poe_ninja_url")
    @classmethod
    def validate_poe_ninja_url(cls, value: str | None) -> str | None:
        if value and not _is_poe_ninja_url(value):
            raise ValueError("Link źródłowy musi prowadzić do domeny poe.ninja.")
        return value


class PoeCurrencyStatBase(BaseModel):
    league_id: int | None = None
    name: str = Field(..., min_length=1, max_length=150)
    category: str = "custom"
    icon_url: str | None = None
    value: float = 0
    display_order: int = 0
    notes: str | None = None


class PoeCurrencyStatCreate(PoeCurrencyStatBase):
    @field_validator("icon_url")
    @classmethod
    def validate_icon_url(cls, value: str | None) -> str | None:
        if value and not _is_http_url(value):
            raise ValueError("Link ikony musi być poprawnym adresem HTTP lub HTTPS.")
        return value


class PoeCurrencyStatUpdate(BaseModel):
    league_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = None
    icon_url: str | None = None
    value: float | None = None
    display_order: int | None = None
    notes: str | None = None

    @field_validator("icon_url")
    @classmethod
    def validate_icon_url(cls, value: str | None) -> str | None:
        if value and not _is_http_url(value):
            raise ValueError("Link ikony musi być poprawnym adresem HTTP lub HTTPS.")
        return value


class PoeCurrencyStatRead(PoeCurrencyStatBase):
    id: int
    character_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoeStatsReorder(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1)
