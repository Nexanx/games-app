import pytest

from app.chatbot.llm_bot import ChatbotConfigurationError, OpenAICompatibleChatbot
from app.core.config import Settings
from datetime import date

from app.models import CompletedGameEntry, Game, PoeCharacter


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

