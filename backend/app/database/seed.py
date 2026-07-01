from datetime import date, datetime, timezone

from sqlalchemy import select

from app.database.session import SessionLocal, engine
from app.models import BacklogGame, Game, PoeCharacter, PoeCurrencyStat, PoeLeague, Setting


def seed() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Game.id).limit(1)):
            return

        games = [
            Game(
                title="Hades",
                description="Dynamiczny roguelike z krótkimi runami i świetną progresją.",
                genres=["Action", "Roguelike"],
                platforms=["PC", "Switch"],
                release_date=date(2020, 9, 17),
                external_source="manual",
            ),
            Game(
                title="Disco Elysium",
                description="Narracyjne RPG o śledztwie, wyborach i dziwnych głosach w głowie.",
                genres=["RPG", "Narrative"],
                platforms=["PC"],
                release_date=date(2019, 10, 15),
                external_source="manual",
            ),
            Game(
                title="Elden Ring",
                description="Otwarty action RPG z bossami, eksploracją i buildami.",
                genres=["Action RPG"],
                platforms=["PC", "PlayStation"],
                release_date=date(2022, 2, 25),
                external_source="manual",
            ),
        ]
        db.add_all(games)
        db.flush()

        db.add_all(
            [
                BacklogGame(game_id=games[0].id, status="completed", position=0, rating=9.5, playtime_minutes=2100, completion_percent=100, completed_at=datetime.now(timezone.utc)),
                BacklogGame(game_id=games[1].id, status="playing", position=1, rating=9.0, playtime_minutes=480, completion_percent=35),
                BacklogGame(game_id=games[2].id, status="to_play", position=2, playtime_minutes=0, completion_percent=0),
            ]
        )

        settlers = PoeLeague(
            name="Settlers of Kalguur",
            game_version="poe1",
            start_date=date(2024, 7, 26),
            status="completed",
            notes="Przykładowa liga do testów dashboardu.",
        )
        dawn = PoeLeague(
            name="Dawn of the Hunt",
            game_version="poe2",
            start_date=date(2025, 4, 4),
            status="active",
            notes="Przykładowa liga PoE 2.",
        )
        db.add_all([settlers, dawn])
        db.flush()

        char1 = PoeCharacter(
            name="AtlasArchivist",
            game_version="poe1",
            character_class="Witch",
            ascendancy="Elementalist",
            level=97,
            league_id=settlers.id,
            build_name="Ignite Mapper",
            main_skill="Fire Trap",
            mode="trade softcore",
            status="ended",
            playtime_minutes=5220,
            notes="Dobry mapper, średni bossing.",
        )
        char2 = PoeCharacter(
            name="DreadQuartermaster",
            game_version="poe2",
            character_class="Mercenary",
            ascendancy="Witchhunter",
            level=83,
            league_id=dawn.id,
            build_name="Grenade Crossbow",
            main_skill="Explosive Grenade",
            mode="trade softcore",
            status="active",
            playtime_minutes=1680,
            notes="Seedowy przykład dla PoeTooltipCard.",
        )
        db.add_all([char1, char2])
        db.flush()

        db.add_all(
            [
                PoeCurrencyStat(character_id=char1.id, league_id=settlers.id, name="Divine Orb", category="currency", value=18, display_order=0),
                PoeCurrencyStat(character_id=char1.id, league_id=settlers.id, name="Chaos Orb", category="currency", value=940, display_order=1),
                PoeCurrencyStat(character_id=char1.id, league_id=settlers.id, name="Scarabs", category="scarabs", value=311, display_order=2),
                PoeCurrencyStat(character_id=char2.id, league_id=dawn.id, name="Divine Orb", category="currency", value=4, display_order=0),
                PoeCurrencyStat(character_id=char2.id, league_id=dawn.id, name="Exalted Orb", category="currency", value=21, display_order=1),
                PoeCurrencyStat(character_id=char2.id, league_id=dawn.id, name="Maps", category="maps", value=86, display_order=2),
            ]
        )
        db.add(Setting(key="theme", value={"mode": "dark"}))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
