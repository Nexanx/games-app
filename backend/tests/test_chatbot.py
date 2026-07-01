from app.chatbot.intent_bot import IntentBasedChatbot
from app.models import BacklogGame, Game, PoeCharacter


def test_chatbot_counts_completed_games(db_session):
    game = Game(title="Finished", genres=[], platforms=[], external_source="manual")
    db_session.add(game)
    db_session.flush()
    db_session.add(BacklogGame(game_id=game.id, status="completed", position=0))
    db_session.commit()

    answer = IntentBasedChatbot(db_session).answer("Ile gier ukończyłem?")

    assert "1" in answer
    assert "ukończonych" in answer


def test_chatbot_lists_poe2_characters(db_session):
    db_session.add(PoeCharacter(name="SecondAge", game_version="poe2", level=77))
    db_session.commit()

    answer = IntentBasedChatbot(db_session).answer("Pokaż postacie z PoE 2")

    assert "SecondAge" in answer

