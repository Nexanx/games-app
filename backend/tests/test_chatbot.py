import pytest

from app.api import chat as chat_api
from app.chatbot.llm_bot import ChatbotConfigurationError, OpenAICompatibleChatbot
from app.core.config import Settings
from datetime import date

from app.models import ChatMessage, CompletedGameEntry, Game, PoeCharacter


def test_llm_chatbot_requires_api_key(db_session):
    settings = Settings(openai_api_key=None, openai_model="gemini-3.5-flash")

    with pytest.raises(ChatbotConfigurationError):
        OpenAICompatibleChatbot(db_session, settings).answer("Ile gier ukończyłem?")


def test_llm_chatbot_requires_model(db_session):
    settings = Settings(openai_api_key="test-key", openai_model=None)

    with pytest.raises(ChatbotConfigurationError):
        OpenAICompatibleChatbot(db_session, settings).answer("Ile gier ukończyłem?")


def test_llm_context_uses_safe_application_snapshot(db_session):
    game = Game(title="Finished", genres=["RPG"], platforms=["PC"], external_source="manual")
    db_session.add(game)
    db_session.flush()
    db_session.add(CompletedGameEntry(game_id=game.id, completion_date=date(2026, 7, 10), playtime_hours=2))
    db_session.add(PoeCharacter(name="SecondAge", game_version="poe2", level=77))
    db_session.commit()

    settings = Settings(openai_api_key="test-key", openai_model="gemini-3.5-flash")
    context = OpenAICompatibleChatbot(db_session, settings)._build_context()

    assert context["completed_games"][0]["title"] == "Finished"
    assert context["completed_games"][0]["playtime_hours"] == 2
    assert context["poe_characters"][0]["name"] == "SecondAge"


def test_chat_status_reports_missing_configuration(client, monkeypatch):
    monkeypatch.setattr(chat_api, "get_settings", lambda: Settings(openai_api_key=None, openai_model=None))

    response = client.get("/api/chat/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["configured"] is False
    assert payload["missing"] == ["OPENAI_API_KEY", "OPENAI_MODEL"]
    assert "Chatbot nie jest skonfigurowany" in payload["message"]


def test_chat_missing_configuration_returns_friendly_error(client, db_session, monkeypatch):
    monkeypatch.setattr(chat_api, "get_settings", lambda: Settings(openai_api_key=None, openai_model="gemini-3.5-flash"))

    response = client.post("/api/chat", json={"message": "Ile gier ukończyłem?"})

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["code"] == "CHATBOT_LLM_NOT_CONFIGURED"
    assert "Chatbot nie jest skonfigurowany" in detail["message"]
    assert db_session.query(ChatMessage).count() == 0


def test_chat_endpoint_saves_mocked_answer(client, db_session, monkeypatch):
    monkeypatch.setattr(chat_api, "get_settings", lambda: Settings(openai_api_key="test-key", openai_model="gemini-3.5-flash"))
    monkeypatch.setattr(chat_api.OpenAICompatibleChatbot, "answer", lambda _self, message, _session_id=None: f"Odpowiedź: {message}")

    response = client.post("/api/chat", json={"message": "Podsumuj rok 2026"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Odpowiedź: Podsumuj rok 2026"
    assert payload["message"]["role"] == "assistant"
    assert db_session.query(ChatMessage).count() == 2


def test_chat_rejects_blank_message(client):
    response = client.post("/api/chat", json={"message": "   "})

    assert response.status_code == 422

