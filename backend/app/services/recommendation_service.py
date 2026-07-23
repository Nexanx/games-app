from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from math import ceil
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    CompletedGameEntry,
    GameDiscoveryPreferences,
    GameRecommendationFeedback,
    HiddenGameRelease,
)
from app.schemas.games import (
    GameDiscoveryPreferencesRead,
    GameDiscoveryPreferencesUpdate,
    GameRecommendation,
    GameReleaseRecommendation,
    GameSearchResult,
    ReleaseMatchLevel,
)
from app.services.backlog_service import (
    BacklogIdentityIndex,
    get_backlog_identity_index,
    is_game_on_backlog,
    normalize_external_key,
    normalize_game_title,
)


MINIMUM_RATED_GAMES = 3


@dataclass(frozen=True)
class RecommendationWeights:
    """One auditable weight set shared by regular and release recommendations.

    Genre history is the strongest signal. Platforms and explicit feedback are
    secondary, while RAWG quality and diversity only refine a personal match.
    Negative history needs repeated evidence before it can apply a full penalty.
    """

    base: float = 8.0
    primary_genre: float = 30.0
    secondary_genre: float = 10.0
    manual_genre: float = 22.0
    platform: float = 18.0
    feedback_genre: float = 10.0
    feedback_tag: float = 8.0
    external_quality: float = 12.0
    negative_genre: float = 24.0
    negative_feedback: float = 18.0
    hidden_pattern: float = 12.0
    discovery_novelty: float = 6.0


@dataclass(frozen=True)
class MatchLevelConfig:
    threshold: float
    cold_start_threshold: float
    genre_share: float
    allow_novelty: bool = False


RECOMMENDATION_WEIGHTS = RecommendationWeights()
MATCH_LEVELS: dict[ReleaseMatchLevel, MatchLevelConfig] = {
    "strict": MatchLevelConfig(threshold=60, cold_start_threshold=32, genre_share=0.50),
    "balanced": MatchLevelConfig(threshold=40, cold_start_threshold=16, genre_share=0.35),
    "discovery": MatchLevelConfig(
        threshold=24,
        cold_start_threshold=10,
        genre_share=0.25,
        allow_novelty=True,
    ),
}

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
class GenreAffinity:
    label: str
    rated_count: int
    average_rating: float
    affinity: float


@dataclass(frozen=True)
class CandidateScore:
    score: float
    reasons: tuple[str, ...]
    has_interest_signal: bool
    unsupported_platform: bool
    strong_negative_signal: bool
    primary_genre_key: str | None


@dataclass(frozen=True)
class RecommendationProfile:
    rated_games_count: int
    personalized: bool
    genre_preferences: dict[str, GenrePreference]
    genre_affinities: dict[str, GenreAffinity]
    platform_counts: dict[str, int]
    completed_external_keys: frozenset[tuple[str, str]]
    completed_titles_without_external_keys: frozenset[str]
    backlog_identities: BacklogIdentityIndex
    feedback_external_keys: frozenset[tuple[str, str]]
    genre_feedback: dict[str, int]
    tag_feedback: dict[str, int]
    platform_feedback: dict[str, int]
    manual_genre_keys: frozenset[str]
    manual_platform_families: frozenset[str]
    hidden_external_keys: frozenset[tuple[str, str]]
    hidden_genre_counts: dict[str, int]
    hidden_tag_counts: dict[str, int]
    feature_labels: dict[str, str]
    positive_feedback_count: int

    @property
    def genre_slugs(self) -> list[str]:
        keys = set(self.genre_preferences) | set(self.manual_genre_keys) | {
            key for key, value in self.genre_feedback.items() if value > 0
        }
        ranked = sorted(
            keys,
            key=lambda key: (
                -(
                    (self.genre_preferences[key].weight if key in self.genre_preferences else 0)
                    + (20 if key in self.manual_genre_keys else 0)
                    + max(self.genre_feedback.get(key, 0), 0) * 4
                ),
                self.feature_labels.get(key, key).casefold(),
            ),
        )
        return [GENRE_SLUGS[key] for key in ranked if key in GENRE_SLUGS][:3]

    @property
    def parent_platform_ids(self) -> list[int]:
        if self.manual_platform_families:
            return [
                PLATFORM_FAMILIES[key][1]
                for key in sorted(self.manual_platform_families)
                if key in PLATFORM_FAMILIES
            ]
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

    @property
    def watched_platform_families(self) -> frozenset[str]:
        if self.manual_platform_families:
            return self.manual_platform_families
        return frozenset(self.platform_counts)


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
    affinities: dict[str, GenreAffinity] = {}
    for key, ratings in genre_ratings.items():
        average = sum(ratings) / len(ratings)
        signals = [_rating_signal(rating) for rating in ratings]
        affinity = sum(signals) / len(signals)
        # One disappointing game is not enough to establish a negative taste.
        if affinity < 0 and len(ratings) < 2:
            affinity = 0
        confidence = min(1.0, len(ratings) / 3)
        affinity *= 0.5 + confidence * 0.5
        affinities[key] = GenreAffinity(
            label=genre_labels[key],
            rated_count=len(ratings),
            average_rating=round(average, 2),
            affinity=round(affinity, 4),
        )
        if average + 1e-9 >= preference_threshold:
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
    completed_titles_without_external_keys = {
        normalize_game_title(entry.game.title)
        for entry in entries
        if not normalize_external_key(entry.game.external_source, entry.game.external_id)
    }
    discovery_preferences = session.get(GameDiscoveryPreferences, 1)
    manual_genre_keys: set[str] = set()
    manual_platform_families: set[str] = set()
    if discovery_preferences is not None:
        for genre in discovery_preferences.genres:
            key = normalize_game_title(genre)
            if key:
                manual_genre_keys.add(key)
                genre_labels.setdefault(key, genre.strip())
        for platform in discovery_preferences.platforms:
            family = platform_family(platform)
            if family:
                manual_platform_families.add(family)

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

    hidden_external_keys: set[tuple[str, str]] = set()
    hidden_genre_counts: dict[str, int] = defaultdict(int)
    hidden_tag_counts: dict[str, int] = defaultdict(int)
    hidden_rows = session.scalars(select(HiddenGameRelease).order_by(HiddenGameRelease.id)).all()
    for hidden in hidden_rows:
        external_key = normalize_external_key(hidden.external_source, hidden.external_id)
        if external_key:
            hidden_external_keys.add(external_key)
        try:
            game = GameSearchResult.model_validate(hidden.game_payload)
        except ValueError:
            continue
        for genre in dict.fromkeys(game.genres):
            key = normalize_game_title(genre)
            if key:
                hidden_genre_counts[key] += 1
                feature_labels.setdefault(key, genre.strip())
        for tag in dict.fromkeys(game.tags):
            key = normalize_game_title(tag)
            if key:
                hidden_tag_counts[key] += 1
                feature_labels.setdefault(key, tag.strip())

    personalized_from_history = len(rated_entries) >= MINIMUM_RATED_GAMES and any(
        affinity.affinity > 0 for affinity in affinities.values()
    )
    return RecommendationProfile(
        rated_games_count=len(rated_entries),
        personalized=(
            personalized_from_history
            or positive_feedback_count > 0
            or bool(manual_genre_keys)
        ),
        genre_preferences=preferences,
        genre_affinities=affinities,
        platform_counts=dict(platform_counts),
        completed_external_keys=frozenset(completed_external_keys),
        completed_titles_without_external_keys=frozenset(completed_titles_without_external_keys),
        backlog_identities=get_backlog_identity_index(session),
        feedback_external_keys=frozenset(feedback_external_keys),
        genre_feedback=dict(genre_feedback),
        tag_feedback=dict(tag_feedback),
        platform_feedback=dict(platform_feedback),
        manual_genre_keys=frozenset(manual_genre_keys),
        manual_platform_families=frozenset(manual_platform_families),
        hidden_external_keys=frozenset(hidden_external_keys),
        hidden_genre_counts=dict(hidden_genre_counts),
        hidden_tag_counts=dict(hidden_tag_counts),
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


def get_discovery_preferences(session: Session) -> GameDiscoveryPreferencesRead:
    preferences = session.get(GameDiscoveryPreferences, 1)
    if preferences is None:
        return GameDiscoveryPreferencesRead()
    return GameDiscoveryPreferencesRead(
        platforms=list(preferences.platforms),
        genres=list(preferences.genres),
    )


def save_discovery_preferences(
    session: Session,
    payload: GameDiscoveryPreferencesUpdate,
) -> GameDiscoveryPreferencesRead:
    preferences = session.get(GameDiscoveryPreferences, 1)
    if preferences is None:
        preferences = GameDiscoveryPreferences(
            id=1,
            platforms=payload.platforms,
            genres=payload.genres,
        )
        session.add(preferences)
    else:
        preferences.platforms = payload.platforms
        preferences.genres = payload.genres
    session.commit()
    return get_discovery_preferences(session)


def hide_game_release(session: Session, game: GameSearchResult) -> HiddenGameRelease:
    external_key = normalize_external_key(game.external_source, game.external_id)
    if not external_key:
        raise ValueError("A hidden release requires an external game identity.")
    source, identifier = external_key
    hidden = session.scalar(
        select(HiddenGameRelease).where(
            HiddenGameRelease.external_source == source,
            HiddenGameRelease.external_id == identifier,
        )
    )
    values = {
        "title": game.title.strip(),
        "game_payload": game.model_copy(
            update={"hidden": True},
        ).model_dump(mode="json"),
    }
    if hidden is None:
        hidden = HiddenGameRelease(
            external_source=source,
            external_id=identifier,
            **values,
        )
        session.add(hidden)
    else:
        hidden.title = values["title"]
        hidden.game_payload = values["game_payload"]
    session.commit()
    session.refresh(hidden)
    return hidden


def unhide_game_release(
    session: Session,
    external_source: str,
    external_id: str,
) -> bool:
    external_key = normalize_external_key(external_source, external_id)
    if not external_key:
        raise ValueError("A hidden release requires an external game identity.")
    source, identifier = external_key
    hidden = session.scalar(
        select(HiddenGameRelease).where(
            HiddenGameRelease.external_source == source,
            HiddenGameRelease.external_id == identifier,
        )
    )
    if hidden is None:
        return False
    session.delete(hidden)
    session.commit()
    return True


def list_hidden_game_releases(session: Session) -> list[GameSearchResult]:
    games: list[GameSearchResult] = []
    for hidden in session.scalars(
        select(HiddenGameRelease).order_by(HiddenGameRelease.created_at.desc(), HiddenGameRelease.id.desc())
    ).all():
        try:
            games.append(
                GameSearchResult.model_validate(hidden.game_payload).model_copy(
                    update={"hidden": True}
                )
            )
        except ValueError:
            continue
    return games


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
            or external_key in profile.hidden_external_keys
            or title_key in profile.completed_titles_without_external_keys
            or is_game_on_backlog(
                candidate.title,
                candidate.external_source,
                candidate.external_id,
                profile.backlog_identities,
            )
        ):
            continue

        scored = score_candidate(profile, candidate)
        if scored.unsupported_platform or scored.strong_negative_signal:
            continue
        if profile.personalized and not scored.has_interest_signal:
            continue

        if profile.personalized:
            reason = scored.reasons[0]
            kind = "personalized"
        else:
            matched_families = sorted(
                profile.watched_platform_families
                & {
                    family
                    for value in candidate.platforms
                    if (family := platform_family(value))
                }
            )
            reason = (
                f"Popularna gra na platformę {PLATFORM_FAMILIES[matched_families[0]][0]}, "
                "z której korzystasz."
                if matched_families
                else "Popularna gra według danych RAWG."
            )
            kind = "popular"

        recommendations.append(
            GameRecommendation(game=candidate, reason=reason, kind=kind, score=scored.score)
        )
        seen_external.add(external_key)
        seen_titles.add(title_key)

    return sorted(
        recommendations,
        key=lambda item: (-item.score, item.game.title.casefold(), item.game.external_id or ""),
    )[:limit]


def rank_release_recommendations(
    profile: RecommendationProfile,
    candidates: list[GameSearchResult],
    *,
    match_level: ReleaseMatchLevel,
    limit: int,
) -> list[GameReleaseRecommendation]:
    config = MATCH_LEVELS[match_level]
    threshold = config.threshold if profile.personalized else config.cold_start_threshold
    ranked: list[GameReleaseRecommendation] = []
    primary_genres: dict[str, str | None] = {}
    seen_external: set[tuple[str, str]] = set()
    seen_titles: set[str] = set()

    for candidate in candidates:
        external_key = normalize_external_key(candidate.external_source, candidate.external_id)
        title_key = normalize_game_title(candidate.title)
        if (
            not external_key
            or not title_key
            or external_key in seen_external
            or title_key in seen_titles
            or external_key in profile.completed_external_keys
            or external_key in profile.hidden_external_keys
            or title_key in profile.completed_titles_without_external_keys
            or is_game_on_backlog(
                candidate.title,
                candidate.external_source,
                candidate.external_id,
                profile.backlog_identities,
            )
        ):
            continue

        scored = score_candidate(
            profile,
            candidate,
            discovery_novelty=config.allow_novelty,
        )
        if scored.unsupported_platform or scored.strong_negative_signal or scored.score < threshold:
            continue

        label: Literal[
            "Bardzo dobre dopasowanie",
            "Dobre dopasowanie",
            "Może Cię zainteresować",
        ]
        if profile.personalized and scored.has_interest_signal and scored.score >= 70:
            label = "Bardzo dobre dopasowanie"
        elif profile.personalized and scored.has_interest_signal and scored.score >= 50:
            label = "Dobre dopasowanie"
        else:
            label = "Może Cię zainteresować"

        ranked.append(
            GameReleaseRecommendation(
                game=candidate,
                score=scored.score,
                match_label=label,
                reasons=list(scored.reasons[:2]),
            )
        )
        primary_genres[external_key[1]] = scored.primary_genre_key
        seen_external.add(external_key)
        seen_titles.add(title_key)

    ranked.sort(
        key=lambda item: (-item.score, item.game.title.casefold(), item.game.external_id or "")
    )
    return _apply_release_diversity(ranked, primary_genres, limit, config.genre_share)


def score_candidate(
    profile: RecommendationProfile,
    candidate: GameSearchResult,
    *,
    discovery_novelty: bool = False,
) -> CandidateScore:
    weights = RECOMMENDATION_WEIGHTS
    genre_keys = {
        key for genre in candidate.genres if (key := normalize_game_title(genre))
    }
    tag_keys = {key for tag in candidate.tags if (key := normalize_game_title(tag))}
    candidate_platforms = {
        family for value in candidate.platforms if (family := platform_family(value))
    }
    watched_platforms = profile.watched_platform_families
    matched_platforms = watched_platforms & candidate_platforms
    unsupported_platform = bool(
        watched_platforms and candidate_platforms and not matched_platforms
    )

    positive_affinities = sorted(
        (
            profile.genre_affinities[key]
            for key in genre_keys
            if key in profile.genre_affinities
            and profile.genre_affinities[key].affinity > 0
        ),
        key=lambda item: (-item.affinity, item.label.casefold()),
    )
    negative_affinities = sorted(
        (
            profile.genre_affinities[key]
            for key in genre_keys
            if key in profile.genre_affinities
            and profile.genre_affinities[key].affinity < 0
        ),
        key=lambda item: (item.affinity, item.label.casefold()),
    )
    primary_affinity = positive_affinities[0] if positive_affinities else None
    primary_genre_key = (
        normalize_game_title(primary_affinity.label)
        if primary_affinity is not None
        else next(iter(sorted(genre_keys)), None)
    )

    score = weights.base
    reasons: list[str] = []
    if primary_affinity is not None:
        score += primary_affinity.affinity * weights.primary_genre
        reasons.append(
            f"Polecana, ponieważ wysoko oceniasz gry z gatunku {primary_affinity.label} "
            f"(średnio {primary_affinity.average_rating:.1f}/10)."
        )
    if len(positive_affinities) > 1:
        score += positive_affinities[1].affinity * weights.secondary_genre
    manual_genre_matches = sorted(profile.manual_genre_keys & genre_keys)
    if manual_genre_matches:
        score += weights.manual_genre
        label = profile.feature_labels.get(manual_genre_matches[0], manual_genre_matches[0])
        reasons.append(f"Pasuje do obserwowanego przez Ciebie gatunku {label}.")

    if matched_platforms:
        score += weights.platform
        platform_label = PLATFORM_FAMILIES[sorted(matched_platforms)[0]][0]
        reasons.append(f"Jest dostępna na obserwowanej platformie {platform_label}.")

    genre_feedback_score = sum(profile.genre_feedback.get(key, 0) for key in genre_keys)
    tag_feedback_score = sum(profile.tag_feedback.get(key, 0) for key in tag_keys)
    platform_feedback_score = sum(
        profile.platform_feedback.get(family, 0) for family in candidate_platforms
    )
    if genre_feedback_score > 0:
        score += min(genre_feedback_score, 4) / 4 * weights.feedback_genre
        matching_genres = sorted(
            key for key in genre_keys if profile.genre_feedback.get(key, 0) > 0
        )
        if matching_genres:
            label = profile.feature_labels.get(matching_genres[0], matching_genres[0])
            reasons.insert(
                0,
                f"Polecana, ponieważ pozytywnie oznaczyłeś podobne gry z gatunku {label}.",
            )
    elif genre_feedback_score < 0:
        score -= min(-genre_feedback_score, 4) / 4 * weights.negative_feedback
    if tag_feedback_score > 0:
        score += min(tag_feedback_score, 4) / 4 * weights.feedback_tag
        matching_tags = sorted(
            key for key in tag_keys if profile.tag_feedback.get(key, 0) > 0
        )
        if matching_tags:
            label = profile.feature_labels.get(matching_tags[0], matching_tags[0])
            reasons.insert(
                0,
                f"Polecana, ponieważ pozytywnie oznaczyłeś podobne gry z cechą „{label}”.",
            )
    elif tag_feedback_score < 0:
        score -= min(-tag_feedback_score, 4) / 4 * weights.negative_feedback
    if platform_feedback_score >= 2:
        score += min(platform_feedback_score, 4) / 4 * (weights.feedback_genre / 2)
    elif platform_feedback_score <= -2:
        score -= min(-platform_feedback_score, 4) / 4 * (weights.negative_feedback / 3)

    if negative_affinities:
        score -= min(
            weights.negative_genre,
            sum(-item.affinity for item in negative_affinities) * weights.negative_genre,
        )

    hidden_pattern_strength = sum(
        max(profile.hidden_genre_counts.get(key, 0) - 1, 0) for key in genre_keys
    ) + 0.5 * sum(
        max(profile.hidden_tag_counts.get(key, 0) - 1, 0) for key in tag_keys
    )
    score -= min(weights.hidden_pattern, hidden_pattern_strength * 2)

    score += _external_quality_score(candidate) * (weights.external_quality / 2)
    has_interest_signal = bool(
        positive_affinities
        or manual_genre_matches
        or genre_feedback_score > 0
        or tag_feedback_score > 0
    )
    if discovery_novelty and matched_platforms and not has_interest_signal:
        score += weights.discovery_novelty
        reasons.append("To propozycja odkrywania poza najczęściej wybieranymi gatunkami.")

    if not reasons:
        if matched_platforms:
            platform_label = PLATFORM_FAMILIES[sorted(matched_platforms)[0]][0]
            reasons.append(
                f"Może Cię zainteresować jako dobrze oceniana premiera na platformę {platform_label}."
            )
        else:
            reasons.append("Może Cię zainteresować na podstawie ocen i popularności w RAWG.")

    strong_negative_signal = bool(
        genre_feedback_score <= -2
        or tag_feedback_score <= -2
        or any(item.affinity <= -0.55 for item in negative_affinities)
    )
    return CandidateScore(
        score=round(max(0.0, min(100.0, score)), 2),
        reasons=tuple(dict.fromkeys(reasons)),
        has_interest_signal=has_interest_signal,
        unsupported_platform=unsupported_platform,
        strong_negative_signal=strong_negative_signal,
        primary_genre_key=primary_genre_key,
    )


def _apply_release_diversity(
    ranked: list[GameReleaseRecommendation],
    primary_genres: dict[str, str | None],
    limit: int,
    genre_share: float,
) -> list[GameReleaseRecommendation]:
    if limit <= 0:
        return []
    per_genre_limit = max(2, ceil(limit * genre_share))
    selected: list[GameReleaseRecommendation] = []
    deferred: list[GameReleaseRecommendation] = []
    genre_counts: dict[str, int] = defaultdict(int)
    for item in ranked:
        key = primary_genres.get(item.game.external_id or "")
        if key and genre_counts[key] >= per_genre_limit:
            deferred.append(item)
            continue
        selected.append(item)
        if key:
            genre_counts[key] += 1
        if len(selected) >= limit:
            return selected

    # Deferred games already passed the same relevance threshold, so filling a
    # sparse page cannot reintroduce unrelated titles.
    selected.extend(deferred[: max(0, limit - len(selected))])
    return selected


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


def _rating_signal(rating: float) -> float:
    """Map the user's 0-10 rating to a bounded preference contribution."""

    if rating >= 9:
        return 1.0
    if rating >= 8:
        return 0.75
    if rating >= 7:
        return 0.45
    if rating >= 6:
        return 0.1
    if rating >= 4:
        return -0.35
    return -0.75


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
