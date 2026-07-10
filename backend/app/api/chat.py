import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.chatbot.llm_bot import (
    ChatbotConfigurationError,
    ChatbotErrorCode,
    ChatbotServiceError,
    OpenAICompatibleChatbot,
    missing_llm_configuration,
)
from app.core.config import get_settings
from app.database.session import get_session
from app.models import ChatMessage, ChatSession
from app.schemas.chat import ChatErrorDetail, ChatRequest, ChatResponse, ChatSessionDetail, ChatSessionRead, ChatStatusResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _chatbot_configuration_status() -> ChatStatusResponse:
    settings = get_settings()
    missing = missing_llm_configuration(settings)

    configured = not missing
    message = (
        "Chatbot jest skonfigurowany."
        if configured
        else "Chatbot nie jest skonfigurowany. Uzupełnij OPENAI_API_KEY i OPENAI_MODEL w pliku .env backendu."
    )
    return ChatStatusResponse(configured=configured, missing=missing, message=message)


def _chatbot_error_detail(error: ChatbotServiceError) -> dict:
    missing = error.missing if isinstance(error, ChatbotConfigurationError) else None
    return ChatErrorDetail(
        code=error.code.value,
        message=error.safe_message,
        error_id=error.error_id,
        missing=missing,
    ).model_dump(exclude_none=True)


@router.get("/status", response_model=ChatStatusResponse)
def chatbot_status() -> ChatStatusResponse:
    return _chatbot_configuration_status()


@router.post(
    "",
    response_model=ChatResponse,
    responses={
        429: {"model": ChatErrorDetail},
        500: {"model": ChatErrorDetail},
        502: {"model": ChatErrorDetail},
        503: {"model": ChatErrorDetail},
        504: {"model": ChatErrorDetail},
    },
)
def chat(payload: ChatRequest, db: Session = Depends(get_session)) -> ChatResponse:
    request_id = uuid4().hex
    chat_session = db.get(ChatSession, payload.session_id) if payload.session_id else None
    if payload.session_id and not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    if not chat_session:
        title = payload.message.strip()[:60] or "Nowa rozmowa"
        chat_session = ChatSession(title=title)
        db.add(chat_session)
        db.flush()

    db.add(ChatMessage(session_id=chat_session.id, role="user", content=payload.message))
    try:
        answer = OpenAICompatibleChatbot(db, get_settings()).answer(
            payload.message,
            chat_session.id,
            error_id=request_id,
        )
    except ChatbotServiceError as exc:
        db.rollback()
        logger.warning("Chatbot request failed: error_id=%s code=%s", exc.error_id, exc.code.value)
        raise HTTPException(
            status_code=exc.status_code,
            detail=_chatbot_error_detail(exc),
        ) from None
    except Exception as exc:
        db.rollback()
        error = ChatbotServiceError(ChatbotErrorCode.INTERNAL_ERROR, error_id=request_id)
        logger.error(
            "Chatbot internal error: error_id=%s exception_type=%s",
            error.error_id,
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=error.status_code,
            detail=_chatbot_error_detail(error),
        ) from None
    assistant_message = ChatMessage(session_id=chat_session.id, role="assistant", content=answer)
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    return ChatResponse(session_id=chat_session.id, answer=answer, message=assistant_message)


@router.get("/sessions", response_model=list[ChatSessionRead])
def list_sessions(db: Session = Depends(get_session)) -> list[ChatSession]:
    return db.scalars(select(ChatSession).order_by(desc(ChatSession.updated_at))).all()


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session_detail(session_id: int, db: Session = Depends(get_session)) -> ChatSession:
    session = db.scalars(
        select(ChatSession).options(selectinload(ChatSession.messages)).where(ChatSession.id == session_id)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_session)) -> None:
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.delete(session)
    db.commit()
