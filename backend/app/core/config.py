from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Games & Path of Exile Tracker"
    database_url: str = "postgresql+psycopg://games:games@localhost:5432/games_app"
    rawg_api_key: str | None = None
    igdb_client_id: str | None = None
    igdb_client_secret: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    frontend_url: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

