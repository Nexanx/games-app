from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.chatbot.llm_bot import ChatbotConfigurationError, ChatbotRequestError, OpenAICompatibleChatbot
from app.core.config import get_settings
from app.database.session import get_session
from app.models import ChatMessage, ChatSession
from app.schemas.chat import ChatRequest, ChatResponse, ChatSessionDetail, ChatSessionRead, ChatStatusResponse

router = APIRouter()


def _chatbot_configuration_status() -> ChatStatusResponse:
    settings = get_settings()
    missing = []
    if not settings.openai_api_key:
        missing.append("OPENAI_API_KEY")
    if not settings.openai_model:
        missing.append("OPENAI_MODEL")

    configured = not missing
    message = (
        "Chatbot jest skonfigurowany."
        if configured
        else "Chatbot nie jest skonfigurowany. Uzupełnij OPENAI_API_KEY i OPENAI_MODEL w pliku .env backendu."
    )
    return ChatStatusResponse(configured=configured, missing=missing, message=message)


@router.get("/status", response_model=ChatStatusResponse)
def chatbot_status() -> ChatStatusResponse:
    return _chatbot_configuration_status()


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_session)) -> ChatResponse:
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
        answer = OpenAICompatibleChatbot(db, get_settings()).answer(payload.message, chat_session.id)
    except ChatbotConfigurationError as exc:
        db.rollback()
        status = _chatbot_configuration_status()
        raise HTTPException(
            status_code=503,
            detail={
                "code": "CHATBOT_LLM_NOT_CONFIGURED",
                "message": status.message,
                "missing": status.missing,
            },
        ) from exc
    except ChatbotRequestError as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail={
                "code": "CHATBOT_LLM_REQUEST_FAILED",
                "message": "Nie udało się uzyskać odpowiedzi chatbota. Sprawdź konfigurację usługi i spróbuj ponownie.",
            },
        ) from exc
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
