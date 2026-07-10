from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: int | None = None

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message cannot be blank.")
        return cleaned


class ChatMessageRead(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatSessionRead(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatSessionDetail(ChatSessionRead):
    messages: list[ChatMessageRead]


class ChatResponse(BaseModel):
    session_id: int
    answer: str
    message: ChatMessageRead


class ChatStatusResponse(BaseModel):
    configured: bool
    missing: list[str]
    message: str
