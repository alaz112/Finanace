"""
Price Fetcher Service — Alpha Vantage API üzerinden asenkron fiyat çekme
Cache katmanı: Redis (TTL = CACHE_TTL_SECONDS)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
import structlog

from app.core.config import get_settings

logger   = structlog.get_logger(__name__)
settings = get_settings()

# Redis client (singleton)
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


# ---------------------------------------------------------------------------
# Alpha Vantage çağrıları
# ---------------------------------------------------------------------------

SYMBOL_MAP = {
    "XAUUSD": {"function": "CURRENCY_EXCHANGE_RATE", "from": "XAU", "to": "USD"},
    "USDCHF": {"function": "CURRENCY_EXCHANGE_RATE", "from": "USD", "to": "CHF"},
    "EURCHF": {"function": "CURRENCY_EXCHANGE_RATE", "from": "EUR", "to": "CHF"},
    "XAUCHF": {"function": "CURRENCY_EXCHANGE_RATE", "from": "XAU", "to": "CHF"},
}

CACHE_KEY_PREFIX = "price:"


async def fetch_live_price(symbol: str) -> dict:
    """
    Verilen sembol için güncel fiyatı döner.
    Önce Redis cache kontrol eder, yoksa API'ye gider.

    Returns:
        {
            "symbol": str,
            "price": float,
            "bid": float,
            "ask": float,
            "timestamp": str (ISO-8601),
            "source": "cache" | "api"
        }
    """
    redis = await get_redis()
    cache_key = f"{CACHE_KEY_PREFIX}{symbol}"

    # Cache hit
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        data["source"] = "cache"
        return data

    # API fetch
    mapping = SYMBOL_MAP.get(symbol)
    if not mapping:
        raise ValueError(f"Desteklenmeyen sembol: {symbol}")

    params = {
        "function": mapping["function"],
        "from_currency": mapping["from"],
        "to_currency": mapping["to"],
        "apikey": settings.ALPHA_VANTAGE_API_KEY,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(settings.ALPHA_VANTAGE_BASE_URL, params=params)
        resp.raise_for_status()
        raw = resp.json()

    rate_info = raw.get("Realtime Currency Exchange Rate", {})
    if not rate_info:
        raise RuntimeError(f"Alpha Vantage yanıt beklenen formatta değil: {raw}")

    data = {
        "symbol":    symbol,
        "price":     float(rate_info["5. Exchange Rate"]),
        "bid":       float(rate_info.get("8. Bid Price", rate_info["5. Exchange Rate"])),
        "ask":       float(rate_info.get("9. Ask Price", rate_info["5. Exchange Rate"])),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source":    "api",
    }

    # Cache'e yaz
    await redis.setex(cache_key, settings.CACHE_TTL_SECONDS, json.dumps(data))
    logger.info("price_fetched", symbol=symbol, price=data["price"])
    return data


async def fetch_all_tracked_prices() -> list[dict]:
    """Takip edilen tüm sembollerin güncel fiyatlarını döner."""
    results = []
    for symbol in SYMBOL_MAP:
        try:
            results.append(await fetch_live_price(symbol))
        except Exception as exc:
            logger.warning("price_fetch_failed", symbol=symbol, error=str(exc))
    return results
