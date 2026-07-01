import pytest

from app.core.config import Settings
from app.integrations.game_provider import GameProvider, GameProviderConfigurationError


@pytest.mark.anyio
async def test_game_provider_requires_rawg_key():
    provider = GameProvider(Settings(rawg_api_key=None))

    with pytest.raises(GameProviderConfigurationError):
        await provider.search("Hades")

