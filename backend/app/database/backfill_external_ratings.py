import argparse
import asyncio

from app.core.config import get_settings
from app.database.session import SessionLocal
from app.integrations.game_provider import GameProvider
from app.services.game_rating_service import backfill_external_ratings


async def run(*, refresh_existing: bool) -> int:
    settings = get_settings()
    provider = GameProvider(settings)
    with SessionLocal() as session:
        report = await backfill_external_ratings(session, provider, refresh_existing=refresh_existing)

    print(f"Sprawdzono: {report.total}")
    print(f"Pominięto istniejące wyniki Metacritic: {report.skipped_existing}")
    print(f"Zaktualizowano dane zewnętrzne: {report.updated}")
    print(f"Zapisano wynik Metacritic: {report.with_metacritic}")
    print(f"RAWG bez wyniku Metacritic: {len(report.without_metacritic)}")
    for issue in report.without_metacritic:
        print(f"  - #{issue.game_id} {issue.title}: {issue.reason}")
    print(f"Błędy: {len(report.failed)}")
    for issue in report.failed:
        print(f"  - #{issue.game_id} {issue.title}: {issue.reason}")
    return 1 if report.failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Uzupełnia lokalne oceny RAWG i Metacritic dla istniejących gier.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Odśwież także gry, które mają już zapisany wynik Metacritic.",
    )
    args = parser.parse_args()
    return asyncio.run(run(refresh_existing=args.refresh_existing))


if __name__ == "__main__":
    raise SystemExit(main())
