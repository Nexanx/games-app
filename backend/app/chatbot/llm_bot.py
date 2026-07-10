import json
from typing import Any

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.models import BacklogEntry, CompletedGameEntry, Game, PoeCharacter, PoeCurrencyStat, PoeLeague


class ChatbotConfigurationError(RuntimeError):
    pass


class ChatbotRequestError(RuntimeError):
    pass


class OpenAICompatibleChatbot:
    def __init__(self, session: Session, settings: Settings):
        self.session = session
        self.settings = settings

    def answer(self, question: str) -> str:
        if not self.settings.openai_api_key:
            raise ChatbotConfigurationError("OPENAI_API_KEY is not configured.")
        if not self.settings.openai_model:
            raise ChatbotConfigurationError("OPENAI_MODEL is not configured.")

        base_url = (self.settings.openai_base_url or "https://api.openai.com/v1").rstrip("/")
        endpoint = f"{base_url}/chat/completions"
        context = self._build_context()

        payload = {
            "model": self.settings.openai_model,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Jesteś prywatnym asystentem aplikacji do gier i Path of Exile. "
                        "Odpowiadasz po polsku, krótko i konkretnie. Korzystaj wyłącznie z danych "
                        "w przekazanym kontekście JSON. Jeśli brakuje danych, powiedz to wprost. "
                        "Nie wymyślaj rekordów, nie sugeruj wykonywania SQL i nie modyfikuj danych."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Kontekst danych aplikacji:\n"
                        f"{json.dumps(context, ensure_ascii=False)}\n\n"
                        f"Pytanie użytkownika: {question}"
                    ),
                },
            ],
        }

        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {self.settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ChatbotRequestError("LLM provider request failed.") from exc

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ChatbotRequestError("LLM provider returned an unexpected response.") from exc

        if not isinstance(content, str) or not content.strip():
            raise ChatbotRequestError("LLM provider returned an empty response.")
        return content.strip()

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

