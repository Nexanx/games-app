import logging
from datetime import date

import httpx
import pytest
from pydantic import ValidationError

from app.api import chat as chat_api
from app.chatbot import llm_bot
from app.chatbot.llm_bot import (
    ChatbotConfigurationError,
    ChatbotErrorCode,
    ChatbotProviderError,
    OpenAICompatibleChatbot,
)
from app.core.config import Settings

from app.models import ChatMessage, ChatSession, CompletedGameEntry, Game, PoeCharacter


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
    assert detail["code"] == "llm_not_configured"
    assert detail["error_id"]
    assert detail["missing"] == ["OPENAI_API_KEY"]
    assert detail["message"] == "Chatbot nie został jeszcze skonfigurowany."
    assert db_session.query(ChatMessage).count() == 0


def test_chat_endpoint_saves_mocked_answer(client, db_session, monkeypatch):
    monkeypatch.setattr(chat_api, "get_settings", lambda: Settings(openai_api_key="test-key", openai_model="gemini-3.5-flash"))
    monkeypatch.setattr(
        chat_api.OpenAICompatibleChatbot,
        "answer",
        lambda _self, message, _session_id=None, **_: f"Odpowiedź: {message}",
    )

    response = client.post("/api/chat", json={"message": "Podsumuj rok 2026"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Odpowiedź: Podsumuj rok 2026"
    assert payload["message"]["role"] == "assistant"
    assert db_session.query(ChatMessage).count() == 2


def test_chat_rejects_blank_message(client):
    response = client.post("/api/chat", json={"message": "   "})

    assert response.status_code == 422


def _provider_response(status_code: int = 200, *, data: object | None = None, content: bytes | None = None) -> httpx.Response:
    request = httpx.Request("POST", "https://provider.example/v1/chat/completions")
    if content is not None:
        return httpx.Response(status_code, content=content, request=request)
    return httpx.Response(
        status_code,
        json=data if data is not None else {"choices": [{"message": {"content": "Gotowe"}}]},
        request=request,
    )


def _stub_http_client(monkeypatch, *, response: httpx.Response | None = None, exception: Exception | None = None) -> dict:
    captured: dict = {}

    class StubClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def post(self, url, **kwargs):
            captured["url"] = url
            captured["request_kwargs"] = kwargs
            if exception is not None:
                raise exception
            assert response is not None
            return response

    monkeypatch.setattr(llm_bot.httpx, "Client", StubClient)
    return captured


def test_llm_timeout_uses_configured_value_and_never_logs_api_key(db_session, monkeypatch, caplog):
    request = httpx.Request("POST", "https://provider.example/v1/chat/completions")
    captured = _stub_http_client(
        monkeypatch,
        exception=httpx.ReadTimeout("provider timeout for test-api-key", request=request),
    )
    chatbot = OpenAICompatibleChatbot(
        db_session,
        Settings(openai_api_key="test-api-key", openai_model="test-model", llm_request_timeout_seconds=12.5),
    )

    caplog.set_level(logging.WARNING, logger=llm_bot.__name__)
    with pytest.raises(ChatbotProviderError) as raised:
        chatbot.answer("Podsumuj gry", error_id="timeout-error-id")

    assert raised.value.code == ChatbotErrorCode.TIMEOUT
    assert raised.value.status_code == 504
    assert raised.value.error_id == "timeout-error-id"
    assert captured["timeout"] == 12.5
    assert "test-api-key" not in caplog.text


@pytest.mark.parametrize(
    ("provider_status", "expected_code", "expected_http_status"),
    [
        (401, ChatbotErrorCode.AUTH_ERROR, 502),
        (403, ChatbotErrorCode.AUTH_ERROR, 502),
        (429, ChatbotErrorCode.RATE_LIMITED, 429),
        (500, ChatbotErrorCode.PROVIDER_UNAVAILABLE, 503),
    ],
)
def test_llm_maps_provider_statuses_to_safe_error_categories(
    db_session,
    monkeypatch,
    provider_status,
    expected_code,
    expected_http_status,
):
    _stub_http_client(monkeypatch, response=_provider_response(provider_status))
    chatbot = OpenAICompatibleChatbot(db_session, Settings(openai_api_key="test-key", openai_model="test-model"))

    with pytest.raises(ChatbotProviderError) as raised:
        chatbot.answer("Pytanie", error_id="provider-error-id")

    assert raised.value.code == expected_code
    assert raised.value.status_code == expected_http_status
    assert raised.value.error_id == "provider-error-id"


def test_llm_maps_network_error_to_safe_category(db_session, monkeypatch):
    request = httpx.Request("POST", "https://provider.example/v1/chat/completions")
    _stub_http_client(monkeypatch, exception=httpx.ConnectError("network unavailable", request=request))
    chatbot = OpenAICompatibleChatbot(db_session, Settings(openai_api_key="test-key", openai_model="test-model"))

    with pytest.raises(ChatbotProviderError) as raised:
        chatbot.answer("Pytanie")

    assert raised.value.code == ChatbotErrorCode.NETWORK_ERROR
    assert raised.value.status_code == 503


@pytest.mark.parametrize(
    "response",
    [
        _provider_response(content=b'{"choices":'),
        _provider_response(data={"choices": []}),
        _provider_response(data={"choices": [{"message": {"content": "   "}}]}),
    ],
)
def test_llm_rejects_invalid_provider_responses(db_session, monkeypatch, response):
    _stub_http_client(monkeypatch, response=response)
    chatbot = OpenAICompatibleChatbot(db_session, Settings(openai_api_key="test-key", openai_model="test-model"))

    with pytest.raises(ChatbotProviderError) as raised:
        chatbot.answer("Pytanie")

    assert raised.value.code == ChatbotErrorCode.INVALID_RESPONSE
    assert raised.value.status_code == 502


def test_llm_timeout_setting_must_be_positive():
    with pytest.raises(ValidationError):
        Settings(llm_request_timeout_seconds=0)


def test_llm_timeout_defaults_to_sixty_seconds():
    assert Settings.model_fields["llm_request_timeout_seconds"].default == 60.0


def test_chat_provider_error_returns_safe_contract_and_rolls_back(client, db_session, monkeypatch, caplog):
    monkeypatch.setattr(
        chat_api,
        "get_settings",
        lambda: Settings(openai_api_key="test-api-key", openai_model="test-model"),
    )

    def fail_with_rate_limit(_self, _message, _session_id=None, *, error_id=None):
        raise ChatbotProviderError(ChatbotErrorCode.RATE_LIMITED, error_id=error_id)

    monkeypatch.setattr(chat_api.OpenAICompatibleChatbot, "answer", fail_with_rate_limit)
    caplog.set_level(logging.WARNING)

    response = client.post("/api/chat", json={"message": "Podsumuj rok 2026"})

    assert response.status_code == 429
    detail = response.json()["detail"]
    assert detail["code"] == "llm_rate_limited"
    assert detail["error_id"]
    assert "Dostawca modelu chwilowo ograniczył" in detail["message"]
    assert "test-api-key" not in response.text
    assert "test-api-key" not in caplog.text
    assert db_session.query(ChatMessage).count() == 0
    assert db_session.query(ChatSession).count() == 0


def test_chat_internal_error_returns_safe_contract_without_secret(client, db_session, monkeypatch, caplog):
    monkeypatch.setattr(
        chat_api,
        "get_settings",
        lambda: Settings(openai_api_key="test-api-key", openai_model="test-model"),
    )

    def fail_unexpectedly(*_, **__):
        raise RuntimeError("test-api-key must not be exposed")

    monkeypatch.setattr(chat_api.OpenAICompatibleChatbot, "answer", fail_unexpectedly)
    caplog.set_level(logging.ERROR)

    response = client.post("/api/chat", json={"message": "Podsumuj rok 2026"})

    assert response.status_code == 500
    detail = response.json()["detail"]
    assert detail["code"] == "llm_internal_error"
    assert detail["error_id"]
    assert "test-api-key" not in response.text
    assert "test-api-key" not in caplog.text
    assert db_session.query(ChatMessage).count() == 0
    assert db_session.query(ChatSession).count() == 0

