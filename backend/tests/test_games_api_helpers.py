from app.api.games import _merge_provider_data, _select_cover_result
from app.schemas.games import GameSearchResult


def test_select_cover_result_prefers_exact_title_match() -> None:
    other = GameSearchResult(title="Hades II", cover_url="https://example.com/hades-2.jpg")
    exact = GameSearchResult(title="Hades", cover_url="https://example.com/hades.jpg")

    assert _select_cover_result([other, exact], "hades") == exact


def test_select_cover_result_ignores_results_without_cover() -> None:
    no_cover = GameSearchResult(title="Hades")
    with_cover = GameSearchResult(title="Hades II", cover_url="https://example.com/hades-2.jpg")

    assert _select_cover_result([no_cover, with_cover], "Hades") == with_cover


def test_merge_provider_data_fills_missing_manual_fields() -> None:
    data = {
        "title": "Hades",
        "description": None,
        "cover_url": None,
        "release_date": None,
        "genres": [],
        "platforms": [],
        "external_id": None,
        "external_source": "manual",
        "external_url": None,
    }
    result = GameSearchResult(
        title="Hades",
        cover_url="https://example.com/hades.jpg",
        genres=["Action"],
        platforms=["PC"],
        external_id="123",
        external_source="RAWG",
        external_url="https://rawg.io/games/hades",
    )

    merged = _merge_provider_data(data, result)

    assert merged["cover_url"] == "https://example.com/hades.jpg"
    assert merged["genres"] == ["Action"]
    assert merged["platforms"] == ["PC"]
    assert merged["external_id"] == "123"
    assert merged["external_source"] == "RAWG"
    assert merged["external_url"] == "https://rawg.io/games/hades"
