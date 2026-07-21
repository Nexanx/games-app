from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import CompletedGameEntry, GameRecommendationFeedback
from app.schemas.games import GameRecommendation, GameSearchResult
from app.services.backlog_service import (
    BacklogIdentityIndex,
    get_backlog_identity_index,
    is_game_on_backlog,
    normalize_external_key,
    normalize_game_title,
)


MINIMUM_RATED_GAMES = 3

GENRE_SLUGS = {
    "action": "action",
    "adventure": "adventure",
    "arcade": "arcade",
    "boardgames": "board-games",
    "card": "card",
    "casual": "casual",
    "educational": "educational",
    "family": "family",
    "fighting": "fighting",
    "indie": "indie",
    "massivelymultiplayer": "massively-multiplayer",
    "platformer": "platformer",
    "puzzle": "puzzle",
    "racing": "racing",
    "roleplayinggamesrpg": "role-playing-games-rpg",
    "roleplayingrpg": "role-playing-games-rpg",
    "rpg": "role-playing-games-rpg",
    "shooter": "shooter",
    "simulation": "simulation",
    "sports": "sports",
    "strategy": "strategy",
}

PLATFORM_FAMILIES = {
    "pc": ("PC", 1),
    "playstation": ("PlayStation", 2),
    "xbox": ("Xbox", 3),
    "ios": ("iOS", 4),
    "macos": ("macOS", 5),
    "linux": ("Linux", 6),
    "nintendo": ("Nintendo", 7),
    "android": ("Android", 8),
    "web": ("Web", 14),
}


@dataclass(frozen=True)
class GenrePreference:
    label: str
    completed_count: int
    average_rating: float
    weight: float


@dataclass(frozen=True)
class RecommendationProfile:
    rated_games_count: int
    personalized: bool
    genre_preferences: dict[str, GenrePreference]
    platform_counts: dict[str, int]
    completed_external_keys: frozenset[tuple[str, str]]
    completed_title_keys: frozenset[str]
    backlog_identities: BacklogIdentityIndex
    feedback_external_keys: frozenset[tuple[str, str]]
    genre_feedback: dict[str, int]
    tag_feedback: dict[str, int]
    platform_feedback: dict[str, int]
    feature_labels: dict[str, str]
    positive_feedback_count: int

    @property
    def genre_slugs(self) -> list[str]:
        keys = set(self.genre_preferences) | {
            key for key, value in self.genre_feedback.items() if value > 0
        }
        ranked = sorted(
            keys,
            key=lambda key: (
                -(
                    (self.genre_preferences[key].weight if key in self.genre_preferences else 0)
                    + max(self.genre_feedback.get(key, 0), 0) * 4
                ),
                self.feature_labels.get(key, key).casefold(),
            ),
        )
        return [GENRE_SLUGS[key] for key in ranked if key in GENRE_SLUGS][:3]

    @property
    def parent_platform_ids(self) -> list[int]:
        keys = set(self.platform_counts) | {
            key for key, value in self.platform_feedback.items() if value > 0
        }
        ranked = sorted(
            keys,
            key=lambda key: (
                -(self.platform_counts.get(key, 0) + max(self.platform_feedback.get(key, 0), 0) * 2),
                key,
            ),
        )
        return [PLATFORM_FAMILIES[key][1] for key in ranked if key in PLATFORM_FAMILIES][:2]


def build_recommendation_profile(session: Session) -> RecommendationProfile:
    entries = session.scalars(
        select(CompletedGameEntry)
        .options(selectinload(CompletedGameEntry.game))
        .order_by(CompletedGameEntry.id)
    ).all()
    rated_entries = [entry for entry in entries if entry.rating is not None]
    average_user_rating = (
        sum(float(entry.rating) for entry in rated_entries if entry.rating is not None) / len(rated_entries)
        if rated_entries
        else 0
    )

    genre_ratings: dict[str, list[float]] = defaultdict(list)
    genre_labels: dict[str, str] = {}
    for entry in rated_entries:
        for genre in dict.fromkeys(entry.game.genres):
            key = normalize_game_title(genre)
            if not key:
                continue
            genre_labels.setdefault(key, genre.strip())
            genre_ratings[key].append(float(entry.rating))

    preference_threshold = max(7.0, average_user_rating)
    preferences: dict[str, GenrePreference] = {}
    for key, ratings in genre_ratings.items():
        average = sum(ratings) / len(ratings)
        if average + 1e-9 < preference_threshold:
            continue
        preferences[key] = GenrePreference(
            label=genre_labels[key],
            completed_count=len(ratings),
            average_rating=round(average, 2),
            weight=round(len(ratings) * max(average - 5, 0.5), 3),
        )

    platform_counts: dict[str, int] = defaultdict(int)
    for entry in entries:
        values = [entry.platform] if entry.platform and entry.platform.strip() else entry.game.platforms
        for value in dict.fromkeys(values):
            family = platform_family(value)
            if family:
                platform_counts[family] += 1

    completed_external_keys = {
        external_key
        for entry in entries
        if (external_key := normalize_external_key(entry.game.external_source, entry.game.external_id))
    }
    feedback_rows = session.scalars(
        select(GameRecommendationFeedback).order_by(GameRecommendationFeedback.id)
    ).all()
    genre_feedback: dict[str, int] = defaultdict(int)
    tag_feedback: dict[str, int] = defaultdict(int)
    platform_feedback: dict[str, int] = defaultdict(int)
    feature_labels = dict(genre_labels)
    positive_feedback_count = 0
    feedback_external_keys: set[tuple[str, str]] = set()
    for feedback in feedback_rows:
        direction = 1 if feedback.verdict == "positive" else -1
        if direction > 0:
            positive_feedback_count += 1
        external_key = normalize_external_key(feedback.external_source, feedback.external_id)
        if external_key:
            feedback_external_keys.add(external_key)
        for genre in dict.fromkeys(feedback.genres):
            key = normalize_game_title(genre)
            if key:
                genre_feedback[key] += direction
                feature_labels.setdefault(key, genre.strip())
        for tag in dict.fromkeys(feedback.tags):
            key = normalize_game_title(tag)
            if key:
                tag_feedback[key] += direction
                feature_labels.setdefault(key, tag.strip())
        for platform in dict.fromkeys(feedback.platforms):
            family = platform_family(platform)
            if family:
                platform_feedback[family] += direction

    personalized_from_history = len(rated_entries) >= MINIMUM_RATED_GAMES and bool(preferences)
    return RecommendationProfile(
        rated_games_count=len(rated_entries),
        personalized=personalized_from_history or positive_feedback_count > 0,
        genre_preferences=preferences,
        platform_counts=dict(platform_counts),
        completed_external_keys=frozenset(completed_external_keys),
        completed_title_keys=frozenset(normalize_game_title(entry.game.title) for entry in entries),
        backlog_identities=get_backlog_identity_index(session),
        feedback_external_keys=frozenset(feedback_external_keys),
        genre_feedback=dict(genre_feedback),
        tag_feedback=dict(tag_feedback),
        platform_feedback=dict(platform_feedback),
        feature_labels=feature_labels,
        positive_feedback_count=positive_feedback_count,
    )


def save_recommendation_feedback(
    session: Session,
    game: GameSearchResult,
    verdict: str,
) -> GameRecommendationFeedback:
    external_key = normalize_external_key(game.external_source, game.external_id)
    if not external_key:
        raise ValueError("Recommendation feedback requires an external game identity.")
    source, identifier = external_key
    feedback = session.scalar(
        select(GameRecommendationFeedback).where(
            GameRecommendationFeedback.external_source == source,
            GameRecommendationFeedback.external_id == identifier,
        )
    )
    values = {
        "title": game.title.strip(),
        "verdict": verdict,
        "genres": _clean_features(game.genres),
        "platforms": _clean_features(game.platforms),
        "tags": _clean_features(game.tags, limit=40),
    }
    if feedback is None:
        feedback = GameRecommendationFeedback(
            external_source=source,
            external_id=identifier,
            **values,
        )
        session.add(feedback)
    else:
        for key, value in values.items():
            setattr(feedback, key, value)
    session.commit()
    session.refresh(feedback)
    return feedback


def delete_recommendation_feedback(
    session: Session,
    external_source: str,
    external_id: str,
) -> bool:
    external_key = normalize_external_key(external_source, external_id)
    if not external_key:
        raise ValueError("Recommendation feedback requires an external game identity.")
    source, identifier = external_key
    feedback = session.scalar(
        select(GameRecommendationFeedback).where(
            GameRecommendationFeedback.external_source == source,
            GameRecommendationFeedback.external_id == identifier,
        )
    )
    if feedback is None:
        return False
    session.delete(feedback)
    session.commit()
    return True


def rank_recommendations(
    profile: RecommendationProfile,
    candidates: list[GameSearchResult],
    *,
    limit: int = 8,
) -> list[GameRecommendation]:
    recommendations: list[GameRecommendation] = []
    seen_external: set[tuple[str, str]] = set()
    seen_titles: set[str] = set()

    for candidate in candidates:
        external_key = normalize_external_key(candidate.external_source, candidate.external_id)
        title_key = normalize_game_title(candidate.title)
        if (
            not external_key
            or not title_key
            or (not candidate.genres and not candidate.platforms)
            or external_key in seen_external
            or title_key in seen_titles
            or external_key in profile.completed_external_keys
            or external_key in profile.feedback_external_keys
            or title_key in profile.completed_title_keys
            or is_game_on_backlog(
                candidate.title,
                candidate.external_source,
                candidate.external_id,
                profile.backlog_identities,
            )
        ):
            continue

        genre_matches = [
            profile.genre_preferences[key]
            for genre in candidate.genres
            if (key := normalize_game_title(genre)) in profile.genre_preferences
        ]
        platform_matches = [
            family
            for value in candidate.platforms
            if (family := platform_family(value)) in profile.platform_counts
        ]
        genre_keys = {
            key for genre in candidate.genres if (key := normalize_game_title(genre))
        }
        tag_keys = {key for tag in candidate.tags if (key := normalize_game_title(tag))}
        feedback_matches = [
            (key, profile.genre_feedback[key], "gatunku")
            for key in genre_keys
            if profile.genre_feedback.get(key)
        ] + [
            (key, profile.tag_feedback[key], "cesze")
            for key in tag_keys
            if profile.tag_feedback.get(key)
        ]
        positive_feedback_matches = [match for match in feedback_matches if match[1] > 0]
        negative_tag_strength = sum(
            -profile.tag_feedback[key]
            for key in tag_keys
            if profile.tag_feedback.get(key, 0) < 0
        )
        strongly_rejected_genre = any(
            profile.genre_feedback.get(key, 0) <= -2 for key in genre_keys
        )

        if profile.personalized and not genre_matches and not positive_feedback_matches:
            continue
        if not positive_feedback_matches and (negative_tag_strength >= 2 or strongly_rejected_genre):
            continue

        score = sum(match.weight for match in genre_matches)
        score += sum(profile.platform_counts[family] * 0.35 for family in set(platform_matches))
        score += sum(profile.genre_feedback.get(key, 0) * 1.75 for key in genre_keys)
        score += sum(profile.tag_feedback.get(key, 0) * 2.5 for key in tag_keys)
        score += sum(
            profile.platform_feedback.get(family, 0) * 0.35 for family in set(platform_matches)
        )
        score += _external_quality_score(candidate)

        if profile.personalized:
            if positive_feedback_matches:
                feature_key, _, feature_kind = sorted(
                    positive_feedback_matches,
                    key=lambda match: (-match[1], profile.feature_labels.get(match[0], match[0]).casefold()),
                )[0]
                feature_label = profile.feature_labels.get(feature_key, feature_key)
                reason = (
                    "Polecana, ponieważ pozytywnie oznaczyłeś podobne gry "
                    f"o {feature_kind} „{feature_label}”."
                )
            else:
                primary = sorted(
                    genre_matches,
                    key=lambda item: (-item.weight, item.label.casefold()),
                )[0]
                reason = (
                    f"Polecana, ponieważ wysoko oceniasz gry z gatunku {primary.label} "
                    f"(średnio {primary.average_rating:.1f}/10) i masz "
                    f"{_completion_count_label(primary.completed_count)} w tej kategorii."
                )
            kind = "personalized"
        else:
            matched_family = sorted(
                set(platform_matches),
                key=lambda family: (-profile.platform_counts[family], family),
            )
            reason = (
                f"Popularna gra na platformę {PLATFORM_FAMILIES[matched_family[0]][0]}, z której korzystasz."
                if matched_family
                else "Popularna gra według danych RAWG."
            )
            kind = "popular"

        recommendations.append(
            GameRecommendation(game=candidate, reason=reason, kind=kind, score=round(score, 3))
        )
        seen_external.add(external_key)
        seen_titles.add(title_key)

    return sorted(
        recommendations,
        key=lambda item: (-item.score, item.game.title.casefold(), item.game.external_id or ""),
    )[:limit]


def genre_slug(value: str | None) -> str | None:
    if not value:
        return None
    key = normalize_game_title(value)
    return GENRE_SLUGS.get(key)


def platform_family(value: str | None) -> str | None:
    normalized = normalize_game_title(value or "")
    if not normalized:
        return None
    if normalized == "pc" or "windows" in normalized:
        return "pc"
    for family in ("playstation", "xbox", "nintendo", "android", "linux", "macos", "ios", "web"):
        if family in normalized:
            return family
    if "macintosh" in normalized or normalized == "mac":
        return "macos"
    return None


def _external_quality_score(game: GameSearchResult) -> float:
    scores = [rating.value / rating.scale for rating in game.external_ratings if rating.scale > 0]
    return max(scores, default=0) * 2


def _clean_features(values: list[str], *, limit: int = 20) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        label = value.strip()
        key = normalize_game_title(label)
        if not key or key in seen:
            continue
        cleaned.append(label[:150])
        seen.add(key)
        if len(cleaned) >= limit:
            break
    return cleaned


def _completion_count_label(value: int) -> str:
    if value == 1:
        return "1 ocenione ukończenie"
    if 2 <= value % 10 <= 4 and not 12 <= value % 100 <= 14:
        return f"{value} ocenione ukończenia"
    return f"{value} ocenionych ukończeń"
