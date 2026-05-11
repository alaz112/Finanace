"""
WebSocket Manager — Anlık fiyat yayını
Her bağlı istemciye WS_PRICE_INTERVAL_SECONDS aralıkla fiyat gönderir.
"""
from __future__ import annotations

import asyncio
import json
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog

from app.core.config import get_settings
from app.services.price_fetcher import fetch_live_price, TRACKED_SYMBOLS

logger   = structlog.get_logger(__name__)
settings = get_settings()

ws_router = APIRouter()

# symbol -> aktif WebSocket bağlantıları
_connections: Dict[str, Set[WebSocket]] = {s: set() for s in TRACKED_SYMBOLS}


async def _broadcast(symbol: str):
    """Belirli bir sembolü dinleyen tüm istemcilere fiyat gönderir."""
    sockets = _connections.get(symbol, set()).copy()
    if not sockets:
        return
    try:
        data = await fetch_live_price(symbol)
        message = json.dumps(data)
    except Exception as exc:
        logger.warning("ws_price_error", symbol=symbol, error=str(exc))
        return

    dead = set()
    for ws in sockets:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)

    _connections[symbol] -= dead


async def _price_loop():
    """Arka plan görevi: tüm sembolleri periyodik yayınlar."""
    while True:
        for symbol in list(TRACKED_SYMBOLS.keys()):
            if _connections.get(symbol):
                await _broadcast(symbol)
        await asyncio.sleep(settings.WS_PRICE_INTERVAL_SECONDS)


# Uygulama başlarken arka plan görevini başlat
_loop_task: asyncio.Task | None = None


@ws_router.on_event("startup")  # type: ignore[attr-defined]
async def start_price_loop():
    global _loop_task
    _loop_task = asyncio.create_task(_price_loop())


@ws_router.websocket("/ws/prices/{symbol}")
async def price_stream(websocket: WebSocket, symbol: str):
    """
    ws://host/ws/prices/XAU%2FUSD  gibi bağlanılır.
    Bağlantı kurulunca hemen anlık fiyat gönderir, sonra periyodik yayına katılır.
    """
    symbol = symbol.upper().replace("%2F", "/")
    if symbol not in TRACKED_SYMBOLS:
        await websocket.close(code=4004, reason=f"Bilinmeyen sembol: {symbol}")
        return

    await websocket.accept()
    _connections[symbol].add(websocket)
    logger.info("ws_connected", symbol=symbol)

    # İlk anlık fiyatı hemen gönder
    await _broadcast(symbol)

    try:
        while True:
            # İstemciden ping/mesaj bekle (bağlantı canlı mı kontrol et)
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections[symbol].discard(websocket)
        logger.info("ws_disconnected", symbol=symbol)
