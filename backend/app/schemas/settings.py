from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SettingUpsert(BaseModel):
    key: str = Field(..., min_length=1, max_length=150)
    value: Any = None


class SettingRead(SettingUpsert):
    id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

