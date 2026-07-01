from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class GameBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = None
    release_date: date | None = None
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    external_id: str | None = None
    external_source: str = "manual"
    external_url: str | None = None


class GameCreate(GameBase):
    pass


class GameUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = None
    release_date: date | None = None
    genres: list[str] | None = None
    platforms: list[str] | None = None
    external_id: str | None = None
    external_source: str | None = None
    external_url: str | None = None


class GameRead(GameBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GameSearchResult(GameBase):
    source: str = "RAWG"


class BacklogGameBase(BaseModel):
    status: str = "to_play"
    position: int = 0
    rating: float | None = Field(default=None, ge=0, le=10)
    playtime_minutes: int = Field(default=0, ge=0)
    completion_percent: int = Field(default=0, ge=0, le=100)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None


class BacklogGameCreate(BacklogGameBase):
    game_id: int


class BacklogGameUpdate(BaseModel):
    status: str | None = None
    position: int | None = None
    rating: float | None = Field(default=None, ge=0, le=10)
    playtime_minutes: int | None = Field(default=None, ge=0)
    completion_percent: int | None = Field(default=None, ge=0, le=100)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None


class BacklogGameRead(BacklogGameBase):
    id: int
    game_id: int
    game: GameRead
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BacklogReorder(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1)


class GameStatBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    value: float = 0
    unit: str | None = None
    notes: str | None = None


class GameStatCreate(GameStatBase):
    backlog_game_id: int


class GameStatUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    value: float | None = None
    unit: str | None = None
    notes: str | None = None


class GameStatRead(GameStatBase):
    id: int
    backlog_game_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
