from app.models import PoeCharacter, PoeCurrencyStat, PoeLeague
from app.services.poe_service import reorder_currency_stats


def test_reorder_currency_stats(db_session):
    league = PoeLeague(name="Loot League", game_version="poe1")
    db_session.add(league)
    db_session.flush()
    character = PoeCharacter(name="Looty", game_version="poe1", level=90, league_id=league.id)
    db_session.add(character)
    db_session.flush()
    chaos = PoeCurrencyStat(character_id=character.id, league_id=league.id, name="Chaos Orb", category="currency", value=100, display_order=0)
    divine = PoeCurrencyStat(character_id=character.id, league_id=league.id, name="Divine Orb", category="currency", value=2, display_order=1)
    db_session.add_all([chaos, divine])
    db_session.commit()

    reordered = reorder_currency_stats(db_session, character.id, [divine.id, chaos.id])

    assert [stat.id for stat in reordered[:2]] == [divine.id, chaos.id]
    assert divine.display_order == 0
    assert chaos.display_order == 1
