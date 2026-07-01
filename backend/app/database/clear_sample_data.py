from sqlalchemy import select

from app.database.session import SessionLocal
from app.models import Game, PoeCharacter, PoeLeague

SAMPLE_GAMES = [
    ("Hades", "Dynamiczny roguelike z krótkimi runami i świetną progresją."),
    ("Disco Elysium", "Narracyjne RPG o śledztwie, wyborach i dziwnych głosach w głowie."),
    ("Elden Ring", "Otwarty action RPG z bossami, eksploracją i buildami."),
]

SAMPLE_CHARACTERS = ["AtlasArchivist", "DreadQuartermaster"]

SAMPLE_LEAGUES = [
    ("Settlers of Kalguur", "Przykładowa liga do testów dashboardu."),
    ("Dawn of the Hunt", "Przykładowa liga PoE 2."),
]


def clear_sample_data() -> None:
    db = SessionLocal()
    deleted = {"games": 0, "characters": 0, "leagues": 0}
    try:
        for title, description in SAMPLE_GAMES:
            games = db.scalars(
                select(Game).where(Game.title == title, Game.description == description)
            ).all()
            for game in games:
                db.delete(game)
                deleted["games"] += 1

        characters = db.scalars(
            select(PoeCharacter).where(PoeCharacter.name.in_(SAMPLE_CHARACTERS))
        ).all()
        for character in characters:
            db.delete(character)
            deleted["characters"] += 1

        db.flush()

        for name, notes in SAMPLE_LEAGUES:
            leagues = db.scalars(
                select(PoeLeague).where(PoeLeague.name == name, PoeLeague.notes == notes)
            ).all()
            for league in leagues:
                db.delete(league)
                deleted["leagues"] += 1

        db.commit()
        print(
            "Removed sample data: "
            f"{deleted['games']} games, {deleted['characters']} characters, {deleted['leagues']} leagues."
        )
    finally:
        db.close()


if __name__ == "__main__":
    clear_sample_data()
