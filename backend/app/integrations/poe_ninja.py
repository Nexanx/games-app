from urllib.parse import parse_qs, unquote, urlparse

from app.schemas.poe import PoeNinjaImportResult


class PoeNinjaService:
    """Conservative poe.ninja importer.

    poe.ninja pages are not treated as a guaranteed API here. The importer only
    extracts stable hints from the URL and leaves the data editable by hand.
    """

    def import_from_url(self, url: str) -> PoeNinjaImportResult:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        path_parts = [unquote(part) for part in parsed.path.split("/") if part]

        raw_name = path_parts[-1] if path_parts else None
        name = raw_name.replace("-", " ").replace("_", " ").strip() if raw_name else None
        if name and name.lower() in {"builds", "characters"}:
            name = None

        league_name = query.get("league", [None])[0]
        game_version = "poe2" if "poe2" in parsed.netloc.lower() or "poe2" in parsed.path.lower() else "poe1"

        return PoeNinjaImportResult(
            name=name.title() if name else None,
            game_version=game_version,
            league_name=league_name,
            poe_ninja_url=url,
            notes=(
                "Zaimportowano bez scrapingu: uzupełniono tylko dane możliwe do bezpiecznego "
                "odczytania z linku. Resztę pól możesz wpisać ręcznie."
            ),
        )

