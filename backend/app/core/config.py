from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Finance Tracker API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 gün

    # PostgreSQL (TimescaleDB)
    DATABASE_URL: str  # asyncpg sürücüsü: postgresql+asyncpg://...

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 30  # Fiyat cache süresi (saniye)

    # Alpha Vantage
    ALPHA_VANTAGE_API_KEY: str
    ALPHA_VANTAGE_BASE_URL: str = "https://www.alphavantage.co/query"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # WebSocket
    WS_PRICE_INTERVAL_SECONDS: int = 10  # Fiyat yayın aralığı


@lru_cache
def get_settings() -> Settings:
    return Settings()
