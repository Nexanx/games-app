from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ExternalRating(BaseModel):
    source: Literal["RAWG", "Metacritic"]
    value: float = Field(..., ge=0)
    scale: float = Field(..., gt=0)
    count: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_scale(self) -> "ExternalRating":
        if self.value > self.scale:
            raise ValueError("External rating value cannot exceed its scale")
        return self


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
    external_ratings: list[ExternalRating] = Field(default_factory=list)
    external_ratings_updated_at: datetime | None = None


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
    external_ratings: list[ExternalRating] | None = None
    external_ratings_updated_at: datetime | None = None


class GameRead(GameBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GameSearchResult(GameBase):
    external_source: str = "RAWG"
    source: str = "RAWG"


class GameSearchPage(BaseModel):
    """A client page of games that can still be added to the backlog."""

    results: list[GameSearchResult] = Field(default_factory=list)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    has_next: bool = False


class BacklogEntryBase(BaseModel):
    position: int = Field(default=0, ge=0)
    preferred_platform: str | None = Field(default=None, max_length=150)
    note: str | None = None


class BacklogEntryCreate(BacklogEntryBase):
    game_id: int


class BacklogEntryUpdate(BaseModel):
    position: int | None = Field(default=None, ge=0)
    preferred_platform: str | None = Field(default=None, max_length=150)
    note: str | None = None


class BacklogEntryRead(BacklogEntryBase):
    id: int
    game_id: int
    game: GameRead
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BacklogBatchCreate(BaseModel):
    games: list[GameSearchResult] = Field(..., min_length=1, max_length=50)


class BacklogBatchItemResult(BaseModel):
    title: str
    external_id: str | None = None
    external_source: str
    status: Literal["added", "already_exists"]
    reason: Literal["already_on_backlog", "duplicate_in_request"] | None = None
    entry: BacklogEntryRead


class BacklogBatchFailure(BaseModel):
    title: str
    external_id: str | None = None
    external_source: str
    reason: str


class BacklogBatchRead(BaseModel):
    added: list[BacklogEntryRead] = Field(default_factory=list)
    already_exists: list[BacklogBatchItemResult] = Field(default_factory=list)
    failed: list[BacklogBatchFailure] = Field(default_factory=list)


class BacklogReorder(BaseModel):
    ordered_ids: list[int] = Field(..., min_length=1)


StatisticValueType = Literal["text", "number", "boolean"]


class CustomStatisticBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    value: str
    value_type: StatisticValueType = "text"

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("value", mode="before")
    @classmethod
    def stringify_value(cls, value: object) -> str:
        if isinstance(value, bool):
            return "true" if value else "false"
        return str(value)

    @model_validator(mode="after")
    def validate_typed_value(self) -> "CustomStatisticBase":
        if self.value_type == "number":
            try:
                float(self.value.replace(",", "."))
            except ValueError as exc:
                raise ValueError("Wartość statystyki liczbowej musi być liczbą") from exc
        elif self.value_type == "boolean" and self.value.lower() not in {"true", "false"}:
            raise ValueError("Wartość logiczna musi mieć wartość true albo false")
        return self


class CustomStatisticInput(CustomStatisticBase):
    pass


class CustomStatisticCreate(CustomStatisticBase):
    completed_game_entry_id: int


class CustomStatisticUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    value: str | None = None
    value_type: StatisticValueType | None = None


class CustomStatisticRead(CustomStatisticBase):
    id: int
    completed_game_entry_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompletedGameEntryBase(BaseModel):
    completion_date: date = Field(default_factory=date.today)
    playtime_hours: float = Field(default=0, ge=0)
    rating: float | None = Field(default=None, ge=0, le=10)
    platform: str | None = Field(default=None, max_length=150)
    review: str | None = None


class CompletedGameEntryCreate(CompletedGameEntryBase):
    game_id: int
    backlog_entry_id: int | None = None
    custom_statistics: list[CustomStatisticInput] = Field(default_factory=list)


class CompletedGameEntryUpdate(BaseModel):
    completion_date: date | None = None
    playtime_hours: float | None = Field(default=None, ge=0)
    rating: float | None = Field(default=None, ge=0, le=10)
    platform: str | None = Field(default=None, max_length=150)
    review: str | None = None
    custom_statistics: list[CustomStatisticInput] | None = None


class CompletedGameEntryRead(CompletedGameEntryBase):
    id: int
    game_id: int
    game: GameRead
    custom_statistics: list[CustomStatisticRead]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompletedGamesYearRead(BaseModel):
    year: int
    completed_games_count: int
