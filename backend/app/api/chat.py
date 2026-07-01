from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.chatbot.intent_bot import IntentBasedChatbot
from app.database.session import get_session
from app.models import ChatMessage, ChatSession
from app.schemas.chat import ChatRequest, ChatResponse, ChatSessionDetail, ChatSessionRead

router = APIRouter()


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
    answer = IntentBasedChatbot(db).answer(payload.message)
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

