"""
Price Fetcher Service — Twelve Data API
Anlık fiyat + geçmiş OHLCV verisi
Cache: Redis (TTL = CACHE_TTL_SECONDS)
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

_redis: aioredis.Redis | None = None

# Twelve Data sembol haritası
TRACKED_SYMBOLS = {
    "XAU/USD": {"type": "commodity"},
    "USD/CHF": {"type": "forex"},
    "MRVL":    {"type": "stock", "exchange": "NASDAQ"},
    "AVGO":    {"type": "stock", "exchange": "NASDAQ"},
}

CACHE_KEY_PRICE   = "price:"
CACHE_KEY_HISTORY = "history:"


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def fetch_live_price(symbol: str) -> dict:
    if symbol not in TRACKED_SYMBOLS:
        raise ValueError(f"Desteklenmeyen sembol: {symbol}")

    redis = await get_redis()
    cache_key = f"{CACHE_KEY_PRICE}{symbol}"

    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        data["source"] = "cache"
        return data

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.TWELVE_DATA_BASE_URL}/price",
            params={"symbol": symbol, "apikey": settings.TWELVE_DATA_API_KEY},
        )
        resp.raise_for_status()
        raw = resp.json()

    if "price" not in raw:
        raise RuntimeError(f"Twelve Data yanıtı beklenmedik: {raw}")

    data = {
        "symbol":    symbol,
        "price":     float(raw["price"]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source":    "api",
    }

    await redis.setex(cache_key, settings.CACHE_TTL_SECONDS, json.dumps(data))
    logger.info("price_fetched", symbol=symbol, price=data["price"])
    return data


async def fetch_all_tracked_prices() -> list[dict]:
    results = []
    for symbol in TRACKED_SYMBOLS:
        try:
            results.append(await fetch_live_price(symbol))
        except Exception as exc:
            logger.warning("price_fetch_failed", symbol=symbol, error=str(exc))
            results.append({"symbol": symbol, "price": None, "error": str(exc)})
    return results


async def fetch_historical(
    symbol: str,
    interval: str = "1day",
    outputsize: int = 90,
) -> list[dict]:
    if symbol not in TRACKED_SYMBOLS:
        raise ValueError(f"Desteklenmeyen sembol: {symbol}")

    redis = await get_redis()
    cache_key = f"{CACHE_KEY_HISTORY}{symbol}:{interval}:{outputsize}"

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{settings.TWELVE_DATA_BASE_URL}/time_series",
            params={
                "symbol":     symbol,
                "interval":   interval,
                "outputsize": outputsize,
                "apikey":     settings.TWELVE_DATA_API_KEY,
            },
        )
        resp.raise_for_status()
        raw = resp.json()

    if raw.get("status") == "error":
        raise RuntimeError(raw.get("message", "Twelve Data hatası"))

    candles = []
    for bar in reversed(raw.get("values", [])):
        candles.append({
            "time":   bar["datetime"],
            "open":   float(bar["open"]),
            "high":   float(bar["high"]),
            "low":    float(bar["low"]),
            "close":  float(bar["close"]),
            "volume": float(bar.get("volume", 0)),
        })

    await redis.setex(cache_key, 300, json.dumps(candles))
    logger.info("historical_fetched", symbol=symbol, interval=interval, bars=len(candles))
    return candles
