import json
import logging
from enum import Enum
from typing import Any
from uuid import uuid4

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.models import BacklogEntry, ChatMessage, CompletedGameEntry, Game, PoeCharacter, PoeCurrencyStat, PoeLeague

logger = logging.getLogger(__name__)


class ChatbotErrorCode(str, Enum):
    NOT_CONFIGURED = "llm_not_configured"
    AUTH_ERROR = "llm_auth_error"
    TIMEOUT = "llm_timeout"
    RATE_LIMITED = "llm_rate_limited"
    PROVIDER_UNAVAILABLE = "llm_provider_unavailable"
    NETWORK_ERROR = "llm_network_error"
    INVALID_RESPONSE = "llm_invalid_response"
    INTERNAL_ERROR = "llm_internal_error"


SAFE_ERROR_MESSAGES: dict[ChatbotErrorCode, str] = {
    ChatbotErrorCode.NOT_CONFIGURED: "Chatbot nie został jeszcze skonfigurowany.",
    ChatbotErrorCode.AUTH_ERROR: "Dostawca modelu odrzucił konfigurację dostępu.",
    ChatbotErrorCode.TIMEOUT: "Model nie odpowiedział w wymaganym czasie. Spróbuj ponownie.",
    ChatbotErrorCode.RATE_LIMITED: "Dostawca modelu chwilowo ograniczył liczbę zapytań. Spróbuj później.",
    ChatbotErrorCode.PROVIDER_UNAVAILABLE: "Usługa chatbota jest obecnie niedostępna.",
    ChatbotErrorCode.NETWORK_ERROR: "Nie udało się połączyć z usługą chatbota. Spróbuj ponownie.",
    ChatbotErrorCode.INVALID_RESPONSE: "Dostawca modelu zwrócił nieprawidłową odpowiedź.",
    ChatbotErrorCode.INTERNAL_ERROR: "Wystąpił wewnętrzny błąd chatbota. Spróbuj ponownie.",
}


ERROR_STATUS_CODES: dict[ChatbotErrorCode, int] = {
    ChatbotErrorCode.NOT_CONFIGURED: 503,
    ChatbotErrorCode.AUTH_ERROR: 502,
    ChatbotErrorCode.TIMEOUT: 504,
    ChatbotErrorCode.RATE_LIMITED: 429,
    ChatbotErrorCode.PROVIDER_UNAVAILABLE: 503,
    ChatbotErrorCode.NETWORK_ERROR: 503,
    ChatbotErrorCode.INVALID_RESPONSE: 502,
    ChatbotErrorCode.INTERNAL_ERROR: 500,
}


def missing_llm_configuration(settings: Settings) -> list[str]:
    missing = []
    if not settings.openai_api_key:
        missing.append("OPENAI_API_KEY")
    if not settings.openai_model:
        missing.append("OPENAI_MODEL")
    return missing


class ChatbotServiceError(RuntimeError):
    def __init__(self, code: ChatbotErrorCode, *, error_id: str | None = None):
        self.code = code
        self.error_id = error_id or uuid4().hex
        self.safe_message = SAFE_ERROR_MESSAGES[code]
        self.status_code = ERROR_STATUS_CODES[code]
        super().__init__(code.value)


class ChatbotConfigurationError(ChatbotServiceError):
    def __init__(self, missing: list[str], *, error_id: str | None = None):
        self.missing = missing
        super().__init__(ChatbotErrorCode.NOT_CONFIGURED, error_id=error_id)


class ChatbotProviderError(ChatbotServiceError):
    pass


class ChatbotRequestError(ChatbotProviderError):
    """Backward-compatible generic provider failure."""

    def __init__(self, message: str = "LLM provider request failed.", *, error_id: str | None = None):
        super().__init__(ChatbotErrorCode.PROVIDER_UNAVAILABLE, error_id=error_id)


class OpenAICompatibleChatbot:
    def __init__(self, session: Session, settings: Settings):
        self.session = session
        self.settings = settings

    def answer(self, question: str, session_id: int | None = None, *, error_id: str | None = None) -> str:
        request_id = error_id or uuid4().hex
        missing = missing_llm_configuration(self.settings)
        if missing:
            raise ChatbotConfigurationError(missing, error_id=request_id)

        base_url = (self.settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
        endpoint = f"{base_url}/chat/completions"
        context = self._build_context()

        messages = [
            {
                "role": "system",
                "content": (
                    "Jesteś prywatnym asystentem aplikacji do gier i Path of Exile. "
                    "Odpowiadasz po polsku, krótko i konkretnie. Korzystaj wyłącznie z danych "
                    "w przekazanym kontekście JSON oraz historii tej rozmowy. Jeśli brakuje danych, powiedz to wprost. "
                    "Nie wymyślaj rekordów, nie sugeruj wykonywania SQL i nie modyfikuj danych."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Kontekst danych aplikacji:\n"
                    f"{json.dumps(context, ensure_ascii=False)}\n\n"
                    "Odpowiadaj tylko na podstawie tego kontekstu i historii rozmowy poniżej."
                ),
            },
        ]
        conversation_messages = self._build_conversation_messages(session_id)
        if conversation_messages:
            messages.extend(conversation_messages)
        else:
            messages.append({"role": "user", "content": question})

        payload = {
            "model": self.settings.openai_model,
            "temperature": 0.2,
            "messages": messages,
        }

        try:
            with httpx.Client(timeout=self.settings.llm_request_timeout_seconds) as client:
                response = client.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {self.settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise self._provider_error(ChatbotErrorCode.TIMEOUT, request_id, exc) from exc
        except httpx.HTTPStatusError as exc:
            code = self._code_for_provider_status(exc.response.status_code)
            raise self._provider_error(code, request_id, exc, provider_status=exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise self._provider_error(ChatbotErrorCode.NETWORK_ERROR, request_id, exc) from exc

        try:
            data = response.json()
        except ValueError as exc:
            raise self._provider_error(ChatbotErrorCode.INVALID_RESPONSE, request_id, exc) from exc
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise self._provider_error(ChatbotErrorCode.INVALID_RESPONSE, request_id, exc) from exc

        if not isinstance(content, str) or not content.strip():
            raise self._provider_error(ChatbotErrorCode.INVALID_RESPONSE, request_id)
        return content.strip()

    @staticmethod
    def _code_for_provider_status(status_code: int) -> ChatbotErrorCode:
        if status_code in {401, 403}:
            return ChatbotErrorCode.AUTH_ERROR
        if status_code == 429:
            return ChatbotErrorCode.RATE_LIMITED
        return ChatbotErrorCode.PROVIDER_UNAVAILABLE

    @staticmethod
    def _provider_error(
        code: ChatbotErrorCode,
        error_id: str,
        exc: Exception | None = None,
        *,
        provider_status: int | None = None,
    ) -> ChatbotProviderError:
        logger.warning(
            "LLM provider request failed: error_id=%s code=%s exception_type=%s provider_status=%s",
            error_id,
            code.value,
            type(exc).__name__ if exc else None,
            provider_status,
        )
        return ChatbotProviderError(code, error_id=error_id)

    def _build_conversation_messages(self, session_id: int | None) -> list[dict[str, str]]:
        if not session_id:
            return []

        rows = self.session.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(desc(ChatMessage.created_at), desc(ChatMessage.id))
            .limit(12)
        ).all()

        return [
            {"role": message.role if message.role in {"user", "assistant"} else "user", "content": message.content}
            for message in reversed(rows)
        ]

    def _build_context(self) -> dict[str, Any]:
        backlog_entries = self.session.scalars(
            select(BacklogEntry)
            .options(selectinload(BacklogEntry.game))
            .join(BacklogEntry.game)
            .order_by(BacklogEntry.position, Game.title)
            .limit(80)
        ).all()
        completed_entries = self.session.scalars(
            select(CompletedGameEntry)
            .options(
                selectinload(CompletedGameEntry.game),
                selectinload(CompletedGameEntry.custom_statistics),
            )
            .order_by(desc(CompletedGameEntry.completion_date), desc(CompletedGameEntry.created_at))
            .limit(80)
        ).all()

        characters = self.session.scalars(
            select(PoeCharacter)
            .options(selectinload(PoeCharacter.league))
            .order_by(desc(PoeCharacter.updated_at))
            .limit(80)
        ).all()

        leagues = self.session.scalars(select(PoeLeague).order_by(desc(PoeLeague.start_date), PoeLeague.name).limit(30)).all()

        currency_totals = self.session.execute(
            select(
                PoeCurrencyStat.name,
                PoeCurrencyStat.category,
                func.coalesce(func.sum(PoeCurrencyStat.value), 0).label("total_value"),
            )
            .group_by(PoeCurrencyStat.name, PoeCurrencyStat.category)
            .order_by(desc("total_value"))
            .limit(40)
        ).all()

        return {
            "backlog": [
                {
                    "title": entry.game.title,
                    "position": entry.position,
                    "preferred_platform": entry.preferred_platform,
                    "note": entry.note,
                    "genres": entry.game.genres,
                    "platforms": entry.game.platforms,
                }
                for entry in backlog_entries
            ],
            "completed_games": [
                {
                    "title": entry.game.title,
                    "completion_date": entry.completion_date.isoformat(),
                    "playtime_hours": entry.playtime_hours,
                    "rating": entry.rating,
                    "platform": entry.platform,
                    "review": entry.review,
                    "genres": entry.game.genres,
                    "statistics": [
                        {"name": statistic.name, "value": statistic.value, "type": statistic.value_type}
                        for statistic in entry.custom_statistics
                    ],
                }
                for entry in completed_entries
            ],
            "poe_leagues": [
                {
                    "name": league.name,
                    "game_version": league.game_version,
                    "status": league.status,
                    "start_date": league.start_date.isoformat() if league.start_date else None,
                    "end_date": league.end_date.isoformat() if league.end_date else None,
                }
                for league in leagues
            ],
            "poe_characters": [
                {
                    "name": character.name,
                    "game_version": character.game_version,
                    "character_class": character.character_class,
                    "ascendancy": character.ascendancy,
                    "level": character.level,
                    "league": character.league.name if character.league else None,
                    "status": character.status,
                    "playtime_minutes": character.playtime_minutes,
                    "build_name": character.build_name,
                    "main_skill": character.main_skill,
                    "mode": character.mode,
                }
                for character in characters
            ],
            "poe_currency_totals": [
                {"name": row.name, "category": row.category, "value": float(row.total_value or 0)}
                for row in currency_totals
            ],
        }

