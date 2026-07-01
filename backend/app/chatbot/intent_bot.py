import unicodedata

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import BacklogGame, Game, PoeCharacter, PoeCurrencyStat, PoeLeague


def _normalize(text: str) -> str:
    text = text.lower().replace("ł", "l").replace("Ł", "l")
    return "".join(char for char in unicodedata.normalize("NFKD", text) if not unicodedata.combining(char))


class IntentBasedChatbot:
    def __init__(self, session: Session):
        self.session = session

    def answer(self, question: str) -> str:
        text = _normalize(question)

        if "najwiecej czasu" in text or "najdluzej" in text:
            return self._longest_game()
        if "najlepiej ocen" in text or "top ocen" in text:
            return self._best_rated_games()
        if "nie ukoncz" in text or "jeszcze nie ogral" in text:
            return self._unfinished_games()
        if "ile" in text and ("ukoncz" in text or "ograne" in text):
            return self._count_games("completed", "ukończonych gier")
        if "ile" in text and "do ogrania" in text:
            return self._count_games("to_play", "gier do ogrania")
        if "poe 2" in text or "path of exile 2" in text:
            if "czas" in text:
                return self._poe_playtime("poe2", "PoE 2")
            return self._characters_for_version("poe2", "PoE 2")
        if "poe 1" in text or "path of exile 1" in text:
            if "czas" in text:
                return self._poe_playtime("poe1", "PoE 1")
            return self._characters_for_version("poe1", "PoE 1")
        if "divine" in text:
            return self._currency_total("Divine Orb")
        if "ostatniej lidze" in text or "ostatnia liga" in text:
            return self._latest_league_summary()
        if "najbardziej oplacal" in text:
            return self._most_profitable_league()
        if "podsumuj" in text and "path of exile" in text or "podsumuj" in text and "poe" in text:
            return self._poe_summary()
        if "porownaj" in text and "poe" in text:
            return self._compare_poe_versions()

        return (
            "Nie rozpoznałem jeszcze tej intencji. Spróbuj zapytać np. o liczbę ukończonych gier, "
            "gry do ogrania, najdłuższą grę, postacie z PoE 2 albo Divine Orby w ostatniej lidze."
        )

    def _count_games(self, status: str, label: str) -> str:
        count = self.session.scalar(select(func.count()).select_from(BacklogGame).where(BacklogGame.status == status)) or 0
        return f"Masz {count} {label}."

    def _longest_game(self) -> str:
        entry = self.session.scalars(
            select(BacklogGame).options(selectinload(BacklogGame.game)).order_by(desc(BacklogGame.playtime_minutes))
        ).first()
        if not entry:
            return "Nie masz jeszcze żadnych gier w backlogu."
        hours = entry.playtime_minutes // 60
        minutes = entry.playtime_minutes % 60
        return f"Najwięcej czasu zajęła gra {entry.game.title}: {hours}h {minutes}min."

    def _best_rated_games(self) -> str:
        entries = self.session.scalars(
            select(BacklogGame)
            .options(selectinload(BacklogGame.game))
            .where(BacklogGame.rating.is_not(None))
            .order_by(desc(BacklogGame.rating))
            .limit(5)
        ).all()
        if not entries:
            return "Nie masz jeszcze ocenionych gier."
        lines = [f"{entry.game.title} ({entry.rating}/10)" for entry in entries]
        return "Najlepiej ocenione gry: " + ", ".join(lines) + "."

    def _unfinished_games(self) -> str:
        entries = self.session.scalars(
            select(BacklogGame)
            .options(selectinload(BacklogGame.game))
            .join(BacklogGame.game)
            .where(BacklogGame.status != "completed")
            .order_by(BacklogGame.position, Game.title)
            .limit(10)
        ).all()
        if not entries:
            return "Wygląda na to, że nie masz nieukończonych gier."
        return "Nieukończone gry: " + ", ".join(entry.game.title for entry in entries) + "."

    def _characters_for_version(self, version: str, label: str) -> str:
        characters = self.session.scalars(
            select(PoeCharacter).where(PoeCharacter.game_version == version).order_by(desc(PoeCharacter.level))
        ).all()
        if not characters:
            return f"Nie masz jeszcze postaci z {label}."
        names = [f"{character.name} lvl {character.level}" for character in characters[:8]]
        return f"Postacie z {label}: " + ", ".join(names) + "."

    def _poe_playtime(self, version: str, label: str) -> str:
        total = self.session.scalar(
            select(func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0)).where(PoeCharacter.game_version == version)
        )
        return f"Łączny czas gry w {label}: {int(total or 0) // 60}h {int(total or 0) % 60}min."

    def _latest_league(self) -> PoeLeague | None:
        return self.session.scalars(select(PoeLeague).order_by(desc(PoeLeague.start_date), desc(PoeLeague.created_at))).first()

    def _currency_total(self, name: str) -> str:
        latest_league = self._latest_league()
        stmt = select(func.coalesce(func.sum(PoeCurrencyStat.value), 0)).where(PoeCurrencyStat.name.ilike(f"%{name}%"))
        if latest_league:
            stmt = stmt.where(PoeCurrencyStat.league_id == latest_league.id)
        total = self.session.scalar(stmt) or 0
        suffix = f" w lidze {latest_league.name}" if latest_league else ""
        return f"Masz zapisane {float(total):g}x {name}{suffix}."

    def _latest_league_summary(self) -> str:
        latest_league = self._latest_league()
        if not latest_league:
            return "Nie masz jeszcze zapisanej żadnej ligi."
        character_count = self.session.scalar(
            select(func.count()).select_from(PoeCharacter).where(PoeCharacter.league_id == latest_league.id)
        )
        total_playtime = self.session.scalar(
            select(func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0)).where(
                PoeCharacter.league_id == latest_league.id
            )
        )
        return (
            f"Ostatnia liga to {latest_league.name} ({latest_league.game_version}). "
            f"Masz w niej {character_count or 0} postaci i {int(total_playtime or 0) // 60}h "
            f"{int(total_playtime or 0) % 60}min czasu gry."
        )

    def _most_profitable_league(self) -> str:
        row = self.session.execute(
            select(PoeLeague.name, func.sum(PoeCurrencyStat.value).label("total_value"))
            .join(PoeCurrencyStat, PoeCurrencyStat.league_id == PoeLeague.id)
            .group_by(PoeLeague.id, PoeLeague.name)
            .order_by(desc("total_value"))
            .limit(1)
        ).first()
        if not row:
            return "Nie mam jeszcze statystyk walut przypisanych do lig."
        return f"Najbardziej opłacalna według sumy wpisanych dropów była liga {row.name}: {float(row.total_value or 0):g}."

    def _poe_summary(self) -> str:
        character_count = self.session.scalar(select(func.count()).select_from(PoeCharacter)) or 0
        stat_count = self.session.scalar(select(func.count()).select_from(PoeCurrencyStat)) or 0
        top = self.session.execute(
            select(PoeCurrencyStat.name, func.sum(PoeCurrencyStat.value).label("total_value"))
            .group_by(PoeCurrencyStat.name)
            .order_by(desc("total_value"))
            .limit(3)
        ).all()
        top_text = ", ".join(f"{row.name}: {float(row.total_value or 0):g}" for row in top) or "brak dropów"
        return f"Masz {character_count} postaci PoE i {stat_count} wpisanych statystyk. Największe wartości: {top_text}."

    def _compare_poe_versions(self) -> str:
        poe1_time = self.session.scalar(
            select(func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0)).where(PoeCharacter.game_version == "poe1")
        )
        poe2_time = self.session.scalar(
            select(func.coalesce(func.sum(PoeCharacter.playtime_minutes), 0)).where(PoeCharacter.game_version == "poe2")
        )
        poe1_chars = self.session.scalar(select(func.count()).select_from(PoeCharacter).where(PoeCharacter.game_version == "poe1"))
        poe2_chars = self.session.scalar(select(func.count()).select_from(PoeCharacter).where(PoeCharacter.game_version == "poe2"))
        return (
            f"PoE 1: {poe1_chars or 0} postaci, {int(poe1_time or 0) // 60}h {int(poe1_time or 0) % 60}min. "
            f"PoE 2: {poe2_chars or 0} postaci, {int(poe2_time or 0) // 60}h {int(poe2_time or 0) % 60}min."
        )

