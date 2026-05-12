"""
Finance Cache + ML Forecast Server
- SQLite ile fiyat/history cache (rate limit koruması)
- Prophet ile 1-3 günlük tahmin
- CORS açık (Next.js frontend ile çalışır)
"""

import os, sqlite3, time, asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from prophet import Prophet

# ─── Config ────────────────────────────────────────────────────────────────
TD_KEY = os.getenv("TWELVE_DATA_API_KEY", "dbe4071a53634adfb69feab61ef7dfb1")
TD_BASE = "https://api.twelvedata.com"
DB_PATH = os.path.join(os.path.dirname(__file__), "finance_cache.db")

SYMBOLS = ["XAU/USD", "USD/CHF", "MRVL", "AVGO", "ASELS", "YEOTK", "KONTR"]

PRICE_TTL = 60        # saniye
HISTORY_TTL = 300     # saniye

# ─── SQLite init ────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS price_cache (
            symbol      TEXT PRIMARY KEY,
            price       REAL NOT NULL,
            fetched_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS history_cache (
            symbol      TEXT NOT NULL,
            interval    TEXT NOT NULL,
            data_json   TEXT NOT NULL,
            fetched_at  INTEGER NOT NULL,
            PRIMARY KEY (symbol, interval)
        );

        CREATE TABLE IF NOT EXISTS price_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol      TEXT NOT NULL,
            price       REAL NOT NULL,
            recorded_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_price_history_symbol
            ON price_history(symbol, recorded_at);
    """)
    conn.commit()
    conn.close()

# ─── Twelve Data helpers ───────────────────────────────────────────────────
async def fetch_price_from_td(symbol: str) -> float:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{TD_BASE}/price",
            params={"symbol": symbol, "apikey": TD_KEY}
        )
    r.raise_for_status()
    data = r.json()
    if "price" not in data:
        raise ValueError(f"No price in response: {data}")
    return float(data["price"])

async def fetch_history_from_td(symbol: str, interval: str, outputsize: int) -> list:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{TD_BASE}/time_series",
            params={"symbol": symbol, "interval": interval,
                    "outputsize": outputsize, "apikey": TD_KEY}
        )
    r.raise_for_status()
    data = r.json()
    if data.get("status") == "error":
        raise ValueError(data.get("message", "TD error"))
    values = data.get("values", [])
    # Reverse: eski → yeni
    values = list(reversed(values))
    # Dedupe
    seen = set()
    result = []
    for v in values:
        dt = v["datetime"]
        key = dt.split(" ")[0] if interval in ("1day", "1week") else dt
        if key not in seen:
            seen.add(key)
            result.append({
                "time": key,
                "open":  float(v["open"]),
                "high":  float(v["high"]),
                "low":   float(v["low"]),
                "close": float(v["close"]),
            })
    return result

# ─── Startup cache warm-up ──────────────────────────────────────────────────
# (symbol, interval, outputsize)
WARM_JOBS = [
    ("1day",  365),   # 1 yıl günlük
    ("1h",    720),   # 1 ay saatlik  (30 × 24)
    ("1week", 104),   # ~2 yıl haftalık (bonus)
]

async def warm_cache():
    """Sunucu başlayınca 4 sembol × 3 interval = 12 istek → SQLite cache doldur."""
    import json
    await asyncio.sleep(3)          # FastAPI tamamen ayağa kalksın
    now = int(time.time())
    conn = get_db()
    try:
        for symbol in SYMBOLS:
            for interval, outputsize in WARM_JOBS:
                try:
                    # Cache'te taze veri varsa atla
                    row = conn.execute(
                        "SELECT fetched_at FROM history_cache WHERE symbol=? AND interval=?",
                        (symbol, interval)
                    ).fetchone()
                    if row and (now - row["fetched_at"]) < HISTORY_TTL:
                        print(f"[warm_cache] {symbol} {interval} — cache taze, atlandı")
                        continue

                    print(f"[warm_cache] {symbol} {interval} outputsize={outputsize} çekiliyor…")
                    data = await fetch_history_from_td(symbol, interval, outputsize)
                    conn.execute(
                        "INSERT OR REPLACE INTO history_cache(symbol,interval,data_json,fetched_at) "
                        "VALUES(?,?,?,?)",
                        (symbol, interval, json.dumps(data), int(time.time()))
                    )
                    conn.commit()
                    print(f"[warm_cache] {symbol} {interval} — {len(data)} mum kaydedildi ✓")
                    await asyncio.sleep(1.5)   # ~40 req/dk — Grow plan 55 req/dk limitinin altında
                except Exception as e:
                    print(f"[warm_cache] {symbol} {interval} HATA: {e}")
    finally:
        conn.close()
    print("[warm_cache] tamamlandı")


# ─── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(warm_cache())   # arka planda başlat, sunucuyu bloklamaz
    yield

# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="Finance Cache Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/price/{symbol:path}")
async def get_price(symbol: str):
    now = int(time.time())
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT price, fetched_at FROM price_cache WHERE symbol=?", (symbol,)
        ).fetchone()

        if row and (now - row["fetched_at"]) < PRICE_TTL:
            return {"symbol": symbol, "price": row["price"], "cached": True,
                    "age_seconds": now - row["fetched_at"]}

        # Cache miss → fetch
        price = await fetch_price_from_td(symbol)
        conn.execute(
            "INSERT OR REPLACE INTO price_cache(symbol,price,fetched_at) VALUES(?,?,?)",
            (symbol, price, now)
        )
        # Geçmişe kaydet (her başarılı çekimde)
        conn.execute(
            "INSERT INTO price_history(symbol,price,recorded_at) VALUES(?,?,?)",
            (symbol, price, now)
        )
        conn.commit()
        return {"symbol": symbol, "price": price, "cached": False, "age_seconds": 0}
    except Exception as e:
        # Cache'te eski veri varsa onu döndür
        if row:
            return {"symbol": symbol, "price": row["price"], "cached": True,
                    "age_seconds": now - row["fetched_at"], "stale": True}
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        conn.close()


@app.get("/api/history/{symbol:path}")
async def get_history(
    symbol: str,
    interval: str = Query("1day"),
    outputsize: int = Query(90),
):
    import json
    now = int(time.time())
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT data_json, fetched_at FROM history_cache WHERE symbol=? AND interval=?",
            (symbol, interval)
        ).fetchone()

        if row and (now - row["fetched_at"]) < HISTORY_TTL:
            return {"symbol": symbol, "interval": interval,
                    "data": json.loads(row["data_json"]), "cached": True}

        data = await fetch_history_from_td(symbol, interval, outputsize)
        data_json = json.dumps(data)
        conn.execute(
            "INSERT OR REPLACE INTO history_cache(symbol,interval,data_json,fetched_at) VALUES(?,?,?,?)",
            (symbol, interval, data_json, now)
        )
        conn.commit()
        return {"symbol": symbol, "interval": interval, "data": data, "cached": False}
    except Exception as e:
        if row:
            import json as _json
            return {"symbol": symbol, "interval": interval,
                    "data": _json.loads(row["data_json"]), "cached": True, "stale": True}
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        conn.close()


@app.get("/api/forecast/{symbol:path}")
async def get_forecast(
    symbol: str,
    days: int = Query(3, ge=1, le=7),
):
    """
    SQLite'taki geçmiş fiyatları + Twelve Data 90 günlük veriyi kullanarak
    Prophet ile 1-7 günlük tahmin üretir.
    """
    import json

    # Önce 90 günlük history çek (cache'den veya API'den)
    history_resp = await get_history(symbol, interval="1day", outputsize=90)
    candles = history_resp["data"]

    if len(candles) < 10:
        raise HTTPException(status_code=422, detail="Yeterli veri yok (min 10 gün)")

    # DataFrame hazırla
    df = pd.DataFrame(candles)
    df["ds"] = pd.to_datetime(df["time"])
    df["y"] = df["close"]
    df = df[["ds", "y"]].sort_values("ds").drop_duplicates("ds")

    # Prophet eğit
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        changepoint_prior_scale=0.05,
        interval_width=0.80,
    )
    model.fit(df)

    # Tahmin
    future = model.make_future_dataframe(periods=days)
    forecast = model.predict(future)

    # Son `days` satır = gelecek tahminler
    future_rows = forecast.tail(days)[["ds", "yhat", "yhat_lower", "yhat_upper"]]

    last_close = float(df["y"].iloc[-1])
    predictions = []
    for _, row in future_rows.iterrows():
        pred_price = max(float(row["yhat"]), 0.0001)
        change_pct = ((pred_price - last_close) / last_close) * 100
        predictions.append({
            "date":       row["ds"].strftime("%Y-%m-%d"),
            "price":      round(pred_price, 4),
            "lower":      round(max(float(row["yhat_lower"]), 0.0001), 4),
            "upper":      round(float(row["yhat_upper"]), 4),
            "change_pct": round(change_pct, 2),
        })

    # Model metriği: son 10 günlük MAE (backtesting)
    train_pred = forecast[forecast["ds"].isin(df["ds"])].tail(10)
    actual = df[df["ds"].isin(train_pred["ds"])]["y"].values
    predicted = train_pred["yhat"].values[:len(actual)]
    mae = float(np.mean(np.abs(actual - predicted))) if len(actual) > 0 else None

    return {
        "symbol":      symbol,
        "last_close":  last_close,
        "predictions": predictions,
        "mae":         round(mae, 4) if mae else None,
        "training_days": len(df),
        "model":       "prophet",
    }
