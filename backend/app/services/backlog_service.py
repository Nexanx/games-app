from collections.abc import Iterable
from dataclasses import dataclass
import unicodedata

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import BacklogEntry, Game
from app.schemas.games import GameSearchResult


ExternalGameKey = tuple[str, str]


class BacklogBatchConflictError(RuntimeError):
    """The backlog changed while an atomic batch add was being committed."""


@dataclass(frozen=True)
class BacklogIdentityIndex:
    external_keys: frozenset[ExternalGameKey]
    title_keys: frozenset[str]
    titles_without_external_keys: frozenset[str]


@dataclass
class BacklogBatchOperation:
    entry: BacklogEntry
    status: str
    title: str
    external_id: str | None
    external_source: str
    reason: str | None = None


def normalize_external_key(external_source: str | None, external_id: str | None) -> ExternalGameKey | None:
    source = (external_source or "").strip().casefold()
    identifier = (external_id or "").strip().casefold()
    if not source or not identifier:
        return None
    return source, identifier


def normalize_game_title(title: str) -> str:
    """Compare manually entered titles despite case, whitespace and punctuation."""

    normalized = unicodedata.normalize("NFKD", title).casefold()
    return "".join(character for character in normalized if character.isalnum())


def get_backlog_identity_index(session: Session) -> BacklogIdentityIndex:
    rows = session.execute(
        select(Game.external_source, Game.external_id, Game.title).join(
            BacklogEntry, BacklogEntry.game_id == Game.id
        )
    ).all()
    external_keys: set[ExternalGameKey] = set()
    title_keys: set[str] = set()
    titles_without_external_keys: set[str] = set()
    for external_source, external_id, title in rows:
        external_key = normalize_external_key(external_source, external_id)
        if external_key:
            external_keys.add(external_key)
        else:
            titles_without_external_keys.add(normalize_game_title(title))
        title_keys.add(normalize_game_title(title))
    return BacklogIdentityIndex(
        frozenset(external_keys),
        frozenset(title_keys),
        frozenset(titles_without_external_keys),
    )


def is_game_on_backlog(
    title: str,
    external_source: str | None,
    external_id: str | None,
    identities: BacklogIdentityIndex,
) -> bool:
    external_key = normalize_external_key(external_source, external_id)
    if external_key:
        # A provider ID is authoritative when both records have one.  The
        # normalized title is only a safe fallback when the local entry lacks
        # a stable identity altogether.
        return (
            external_key in identities.external_keys
            or normalize_game_title(title) in identities.titles_without_external_keys
        )
    return normalize_game_title(title) in identities.title_keys


def filter_games_not_on_backlog(
    games: Iterable[GameSearchResult], identities: BacklogIdentityIndex
) -> list[GameSearchResult]:
    return [
        game
        for game in games
        if not is_game_on_backlog(game.title, game.external_source, game.external_id, identities)
    ]


def find_game_by_external_identity(
    session: Session, external_source: str | None, external_id: str | None
) -> Game | None:
    external_key = normalize_external_key(external_source, external_id)
    if not external_key:
        return None
    source, identifier = external_key
    return session.scalars(
        select(Game)
        .where(
            and_(
                func.lower(func.trim(Game.external_source)) == source,
                func.lower(func.trim(Game.external_id)) == identifier,
            )
        )
        .order_by(Game.id)
    ).first()


def find_game_by_title_without_external_identity(session: Session, title: str) -> Game | None:
    title_key = normalize_game_title(title)
    return next(
        (
            game
            for game in session.scalars(select(Game).where(Game.external_id.is_(None)).order_by(Game.id)).all()
            if normalize_game_title(game.title) == title_key
        ),
        None,
    )


def add_games_to_backlog(session: Session, games: list[GameSearchResult]) -> list[BacklogBatchOperation]:
    """Create or reuse games and append every non-duplicate item atomically.

    Existing active backlog entries are represented in the returned operation
    list instead of causing the whole selection to fail.  All newly created
    games and entries share one database commit; an integrity failure rolls
    back the complete batch.
    """

    existing_entries = session.scalars(
        select(BacklogEntry).options(selectinload(BacklogEntry.game)).order_by(BacklogEntry.id)
    ).all()
    backlog_by_external: dict[ExternalGameKey, BacklogEntry] = {}
    backlog_by_title: dict[str, BacklogEntry] = {}
    backlog_without_external_by_title: dict[str, BacklogEntry] = {}
    for entry in existing_entries:
        external_key = normalize_external_key(entry.game.external_source, entry.game.external_id)
        if external_key:
            backlog_by_external.setdefault(external_key, entry)
        title_key = normalize_game_title(entry.game.title)
        backlog_by_title.setdefault(title_key, entry)
        if not external_key:
            backlog_without_external_by_title.setdefault(title_key, entry)

    existing_games = _find_candidate_games(session, games)
    games_by_external: dict[ExternalGameKey, Game] = {}
    games_by_title: dict[str, Game] = {}
    games_without_external_by_title: dict[str, Game] = {}
    for game in existing_games:
        external_key = normalize_external_key(game.external_source, game.external_id)
        if external_key:
            games_by_external.setdefault(external_key, game)
        title_key = normalize_game_title(game.title)
        games_by_title.setdefault(title_key, game)
        if not external_key:
            games_without_external_by_title.setdefault(title_key, game)

    max_position = session.scalar(select(func.max(BacklogEntry.position)))
    next_position = 0 if max_position is None else int(max_position) + 1
    operations: list[BacklogBatchOperation] = []

    for game_input in games:
        external_key = normalize_external_key(game_input.external_source, game_input.external_id)
        title_key = normalize_game_title(game_input.title)
        existing_entry = (
            backlog_by_external.get(external_key)
            or backlog_without_external_by_title.get(title_key)
            if external_key
            else backlog_by_title.get(title_key)
        )
        if existing_entry:
            _apply_external_ratings(existing_entry.game, game_input)
            operations.append(
                BacklogBatchOperation(
                    entry=existing_entry,
                    status="already_exists",
                    title=game_input.title,
                    external_id=game_input.external_id,
                    external_source=game_input.external_source,
                    reason="already_on_backlog" if existing_entry.id else "duplicate_in_request",
                )
            )
            continue

        game = (
            games_by_external.get(external_key) or games_without_external_by_title.get(title_key)
            if external_key
            else games_by_title.get(title_key)
        )
        if not game:
            game = Game(
                title=game_input.title,
                description=game_input.description,
                cover_url=game_input.cover_url,
                release_date=game_input.release_date,
                genres=game_input.genres,
                platforms=game_input.platforms,
                external_id=game_input.external_id,
                external_source=game_input.external_source,
                external_url=game_input.external_url,
                external_ratings=_external_rating_payload(game_input),
                external_ratings_updated_at=game_input.external_ratings_updated_at,
            )
            session.add(game)
            if external_key:
                games_by_external[external_key] = game
            else:
                games_by_title[title_key] = game
                games_without_external_by_title[title_key] = game
            games_by_title.setdefault(title_key, game)
        else:
            _apply_external_ratings(game, game_input)

        entry = BacklogEntry(
            game=game,
            position=next_position,
            preferred_platform=game_input.platforms[0] if game_input.platforms else None,
        )
        next_position += 1
        session.add(entry)
        if external_key:
            backlog_by_external[external_key] = entry
        else:
            backlog_without_external_by_title[title_key] = entry
        backlog_by_title.setdefault(title_key, entry)
        operations.append(
            BacklogBatchOperation(
                entry=entry,
                status="added",
                title=game_input.title,
                external_id=game_input.external_id,
                external_source=game_input.external_source,
            )
        )

    try:
        session.flush()
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise BacklogBatchConflictError("A selected game was added to the backlog concurrently.") from exc
    except Exception:
        session.rollback()
        raise

    entry_ids = [operation.entry.id for operation in operations]
    loaded_entries = session.scalars(
        select(BacklogEntry)
        .where(BacklogEntry.id.in_(entry_ids))
        .options(selectinload(BacklogEntry.game))
    ).all()
    entries_by_id = {entry.id: entry for entry in loaded_entries}
    for operation in operations:
        operation.entry = entries_by_id[operation.entry.id]
    return operations


def _external_rating_payload(game_input: GameSearchResult) -> list[dict]:
    return [rating.model_dump(mode="json") for rating in game_input.external_ratings]


def _apply_external_ratings(game: Game, game_input: GameSearchResult) -> None:
    if not game_input.external_ratings:
        return
    game.external_ratings = _external_rating_payload(game_input)
    game.external_ratings_updated_at = game_input.external_ratings_updated_at


def _find_candidate_games(session: Session, game_inputs: list[GameSearchResult]) -> list[Game]:
    external_conditions = []
    title_keys: set[str] = set()
    for game_input in game_inputs:
        external_key = normalize_external_key(game_input.external_source, game_input.external_id)
        if external_key:
            source, identifier = external_key
            external_conditions.append(
                and_(
                    func.lower(func.trim(Game.external_source)) == source,
                    func.lower(func.trim(Game.external_id)) == identifier,
                )
            )
        # A title is only used as a fallback to a local game with no stable
        # external identity.  It never overrides a different provider ID.
        title_keys.add(normalize_game_title(game_input.title))

    candidates: list[Game] = []
    if external_conditions:
        candidates.extend(
            session.scalars(select(Game).where(or_(*external_conditions)).order_by(Game.id)).all()
        )
    if title_keys:
        # There is no portable SQL function that also removes punctuation and
        # diacritics. Normalize titles in Python, then retain only local games
        # without a stable identity as safe fallback candidates.
        candidates.extend(
            game
            for game in session.scalars(select(Game).where(Game.external_id.is_(None)).order_by(Game.id)).all()
            if normalize_game_title(game.title) in title_keys
        )
    return candidates


def reorder_backlog(session: Session, ordered_ids: list[int]) -> list[BacklogEntry]:
    unique_ids = list(dict.fromkeys(ordered_ids))
    entries = session.scalars(select(BacklogEntry).where(BacklogEntry.id.in_(unique_ids))).all()
    by_id = {entry.id: entry for entry in entries}
    missing = [entry_id for entry_id in unique_ids if entry_id not in by_id]
    if missing:
        raise ValueError(f"Backlog entries not found: {missing}")

    for position, entry_id in enumerate(unique_ids):
        by_id[entry_id].position = position

    session.commit()
    return session.scalars(
        select(BacklogEntry)
        .where(BacklogEntry.id.in_(unique_ids))
        .options(selectinload(BacklogEntry.game))
        .order_by(BacklogEntry.position)
    ).all()


def remove_backlog_entry_and_compact(
    session: Session,
    entry: BacklogEntry,
) -> None:
    """Remove one queue item and keep all remaining positions contiguous.

    Ordering by the stored position first preserves the user's chosen order.
    The additional columns make recovery deterministic if older operations
    already left duplicate positions or gaps in the queue.
    """

    remaining_entries = session.scalars(
        select(BacklogEntry)
        .where(BacklogEntry.id != entry.id)
        .order_by(BacklogEntry.position, BacklogEntry.created_at, BacklogEntry.id)
        .with_for_update()
    ).all()
    session.delete(entry)
    for position, remaining_entry in enumerate(remaining_entries):
        remaining_entry.position = position
