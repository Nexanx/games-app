import pytest

from app.chatbot.llm_bot import ChatbotConfigurationError, OpenAICompatibleChatbot
from app.core.config import Settings
from app.models import BacklogGame, Game, PoeCharacter


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
    db_session.add(BacklogGame(game_id=game.id, status="completed", position=0, playtime_minutes=120))
    db_session.add(PoeCharacter(name="SecondAge", game_version="poe2", level=77))
    db_session.commit()

    settings = Settings(openai_api_key="test-key", openai_model="gemini-3.5-flash")
    context = OpenAICompatibleChatbot(db_session, settings)._build_context()

    assert context["games"][0]["title"] == "Finished"
    assert context["games"][0]["status"] == "completed"
    assert context["poe_characters"][0]["name"] == "SecondAge"

