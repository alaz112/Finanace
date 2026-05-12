"""
Finance Cache + ML Forecast Server
- PostgreSQL ile fiyat/history cache (rate limit koruması)
- Prophet ile 1-3 günlük tahmin
- CORS açık (Next.js frontend ile çalışır)
"""

import os, time, asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
import pandas as pd
import numpy as np
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from prophet import Prophet

# ─── Config ────────────────────────────────────────────────────────────────
TD_KEY = os.getenv("TWELVE_DATA_API_KEY", "dbe4071a53634adfb69feab61ef7dfb1")
TD_BASE = "https://api.twelvedata.com"
DATABASE_URL = os.getenv("DATABASE_URL", "")

SYMBOLS = ["XAU/USD", "USD/CHF", "MRVL", "AVGO", "ASELS", "YEOTK", "KONTR"]

PRICE_TTL = 60        # saniye
HISTORY_TTL = 300     # saniye

# ─── PostgreSQL init ─────────────────────────────────────────────────────────
class PGConn:
    """SQLite benzeri arayüz sağlayan ince psycopg2 sarmalayıcı."""
    def __init__(self):
        self._conn = psycopg2.connect(
            DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor
        )

    def execute(self, sql: str, params=None):
        cur = self._conn.cursor()
        cur.execute(sql, params or ())
        return cur

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_db() -> PGConn:
    return PGConn()


def init_db():
    conn = get_db()
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS price_cache (
            symbol      TEXT PRIMARY KEY,
            price       DOUBLE PRECISION NOT NULL,
            fetched_at  BIGINT NOT NULL
        )""",
        """
        CREATE TABLE IF NOT EXISTS history_cache (
            symbol      TEXT NOT NULL,
            interval    TEXT NOT NULL,
            data_json   TEXT NOT NULL,
            fetched_at  BIGINT NOT NULL,
            PRIMARY KEY (symbol, interval)
        )""",
        """
        CREATE TABLE IF NOT EXISTS price_history (
            id          BIGSERIAL PRIMARY KEY,
            symbol      TEXT NOT NULL,
            price       DOUBLE PRECISION NOT NULL,
            recorded_at BIGINT NOT NULL
        )""",
        """
        CREATE INDEX IF NOT EXISTS idx_price_history_symbol
            ON price_history(symbol, recorded_at)""",
    ]
    for stmt in stmts:
        conn.execute(stmt)
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
                        "SELECT fetched_at FROM history_cache WHERE symbol=%s AND interval=%s",
                        (symbol, interval)
                    ).fetchone()
                    if row and (now - row["fetched_at"]) < HISTORY_TTL:
                        print(f"[warm_cache] {symbol} {interval} — cache taze, atlandı")
                        continue

                    print(f"[warm_cache] {symbol} {interval} outputsize={outputsize} çekiliyor…")
                    data = await fetch_history_from_td(symbol, interval, outputsize)
                    conn.execute(
                        """
                        INSERT INTO history_cache(symbol, interval, data_json, fetched_at) VALUES(%s, %s, %s, %s)
                        ON CONFLICT (symbol, interval) DO UPDATE SET data_json = EXCLUDED.data_json, fetched_at = EXCLUDED.fetched_at
                        """,
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
            "SELECT price, fetched_at FROM price_cache WHERE symbol=%s", (symbol,)
        ).fetchone()

        if row and (now - row["fetched_at"]) < PRICE_TTL:
            return {"symbol": symbol, "price": row["price"], "cached": True,
                    "age_seconds": now - row["fetched_at"]}

        # Cache miss → fetch
        price = await fetch_price_from_td(symbol)
        conn.execute(
            """
            INSERT INTO price_cache(symbol, price, fetched_at) VALUES(%s, %s, %s)
            ON CONFLICT (symbol) DO UPDATE SET price = EXCLUDED.price, fetched_at = EXCLUDED.fetched_at
            """,
            (symbol, price, now)
        )
        # Geçmişe kaydet (her başarılı çekimde)
        conn.execute(
            "INSERT INTO price_history(symbol, price, recorded_at) VALUES(%s, %s, %s)",
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
            "SELECT data_json, fetched_at FROM history_cache WHERE symbol=%s AND interval=%s",
            (symbol, interval)
        ).fetchone()

        if row and (now - row["fetched_at"]) < HISTORY_TTL:
            return {"symbol": symbol, "interval": interval,
                    "data": json.loads(row["data_json"]), "cached": True}

        data = await fetch_history_from_td(symbol, interval, outputsize)
        data_json = json.dumps(data)
        conn.execute(
            """
            INSERT INTO history_cache(symbol, interval, data_json, fetched_at) VALUES(%s, %s, %s, %s)
            ON CONFLICT (symbol, interval) DO UPDATE SET data_json = EXCLUDED.data_json, fetched_at = EXCLUDED.fetched_at
            """,
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


# ─── MSCI ATVR Tarayıcı ─────────────────────────────────────────────────────

# Temel verileri statik tutuyoruz (quarterly güncellenir, günlük değişmez)
MSCI_BIST_META = {
    "ASELS": {
        "name":             "Aselsan Elektronik",
        "free_float_ratio": 0.35,
        "float_mcap_tl":    18_000_000_000,   # ~18 Milyar TL
        "total_mcap_tl":    52_000_000_000,
    },
    "YEOTK": {
        "name":             "Yeo Teknoloji",
        "free_float_ratio": 0.34,
        "float_mcap_tl":    1_200_000_000,
        "total_mcap_tl":    3_500_000_000,
    },
    "KONTR": {
        "name":             "Kontrolmatik",
        "free_float_ratio": 0.32,
        "float_mcap_tl":    800_000_000,
        "total_mcap_tl":    2_500_000_000,
    },
}

MSCI_CACHE_TTL = 3600 * 6   # 6 saat (ATVR günlük veriye dayanır, çok sık güncellemeye gerek yok)


async def fetch_bist_ohlcv(symbol: str, outputsize: int = 90) -> list:
    """BIST hissesi için günlük OHLCV verisi çeker (volume dahil)."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{TD_BASE}/time_series",
            params={
                "symbol":     symbol,
                "interval":   "1day",
                "outputsize": outputsize,
                "apikey":     TD_KEY,
            },
        )
    r.raise_for_status()
    data = r.json()
    if data.get("status") == "error":
        raise ValueError(data.get("message", "TD error"))
    values = list(reversed(data.get("values", [])))   # eski → yeni
    result = []
    for v in values:
        close  = float(v.get("close", 0) or 0)
        volume = float(v.get("volume", 0) or 0)
        result.append({
            "date":     v["datetime"].split(" ")[0],
            "close":    close,
            "volume":   volume,
            "value_tl": close * volume,   # günlük TL işlem hacmi
        })
    return result


def _compute_atvr(daily_values_tl: list, float_mcap_tl: float, window: int = 63) -> float:
    if float_mcap_tl <= 0 or not daily_values_tl:
        return 0.0
    import statistics
    w = daily_values_tl[-window:]
    med = statistics.median(w)
    return round(med * 252 / float_mcap_tl * 100, 4)


def _score_and_signal(atvr: float, float_mcap_usd_m: float, ff_ratio: float,
                      close: float, ma50: float) -> tuple:
    """0-100 bileşik puan ve HIGH/MEDIUM/LOW sinyal döner."""
    # Likidite (0-40)
    if atvr >= 40:
        liq = 40.0
    elif atvr >= 15:
        liq = 15.0 + (atvr - 15) / 25 * 25
    elif atvr >= 8:
        liq = (atvr / 15) * 15
    else:
        liq = 0.0

    # Boyut (0-35)
    if float_mcap_usd_m >= 240:
        size = 35.0
    elif float_mcap_usd_m >= 160:
        size = 20.0 + (float_mcap_usd_m - 160) / 80 * 15
    elif float_mcap_usd_m >= 35:
        size = (float_mcap_usd_m / 160) * 20
    else:
        size = 0.0

    # Fiili dolaşım (0-15)
    if ff_ratio >= 0.25:
        ff = 15.0
    elif ff_ratio >= 0.15:
        ff = (ff_ratio - 0.15) / 0.10 * 15
    else:
        ff = 0.0

    # Momentum (0-10)
    mom = 10.0 if (ma50 > 0 and close > ma50) else 0.0

    score = round(liq + size + ff + mom, 1)

    passes_liq  = atvr >= 15.0
    passes_size = float_mcap_usd_m >= 160.0

    if passes_liq and passes_size and score >= 65:
        signal = "HIGH"
    elif (passes_liq or passes_size) and score >= 40:
        signal = "MEDIUM"
    else:
        signal = "LOW"

    return signal, score, passes_liq, passes_size


@app.get("/api/msci/screen")
async def msci_screen():
    """
    BIST hisseleri için canlı MSCI ATVR taraması.
    Sonuçlar 6 saat SQLite'ta önbelleklenir.
    """
    import json, statistics

    CACHE_SYMBOL = "__msci_screen__"
    CACHE_INTERVAL = "msci"
    now = int(time.time())
    conn = get_db()

    try:
        # ─ Cache kontrolü
        row = conn.execute(
            "SELECT data_json, fetched_at FROM history_cache WHERE symbol=%s AND interval=%s",
            (CACHE_SYMBOL, CACHE_INTERVAL),
        ).fetchone()
        if row and (now - row["fetched_at"]) < MSCI_CACHE_TTL:
            cached = json.loads(row["data_json"])
            cached["cached"] = True
            cached["cache_age_minutes"] = round((now - row["fetched_at"]) / 60, 1)
            return cached
    except Exception:
        pass
    finally:
        conn.close()

    # ─ USD/TRY kuru
    try:
        usdtry = await fetch_price_from_td("USD/TRY")
    except Exception:
        usdtry = 38.0   # fallback

    results = []
    for symbol, meta in MSCI_BIST_META.items():
        try:
            series = await fetch_bist_ohlcv(symbol, outputsize=90)
            await asyncio.sleep(0.8)   # rate limit koruması

            if len(series) < 20:
                raise ValueError(f"Yetersiz veri: {len(series)} gün")

            closes     = [s["close"] for s in series]
            values_tl  = [s["value_tl"] for s in series]

            ma50  = round(sum(closes[-50:]) / len(closes[-50:]), 4) if len(closes) >= 50 \
                    else round(sum(closes) / len(closes), 4)
            close = closes[-1]

            float_mcap_tl    = meta["float_mcap_tl"]
            float_mcap_usd_m = (float_mcap_tl / usdtry) / 1_000_000
            total_mcap_usd_m = (meta["total_mcap_tl"] / usdtry) / 1_000_000

            atvr = _compute_atvr(values_tl, float_mcap_tl)
            signal, score, passes_liq, passes_size = _score_and_signal(
                atvr, float_mcap_usd_m, meta["free_float_ratio"], close, ma50
            )

            med_daily = round(float(pd.Series(values_tl[-63:]).median()), 0)

            results.append({
                "symbol":            symbol,
                "name":              meta["name"],
                "signal":            signal,
                "score":             score,
                "atvr_pct":          round(atvr, 2),
                "float_mcap_usd_m":  round(float_mcap_usd_m, 1),
                "total_mcap_usd_m":  round(total_mcap_usd_m, 1),
                "free_float_pct":    round(meta["free_float_ratio"] * 100, 1),
                "passes_liquidity":  passes_liq,
                "passes_min_size":   passes_size,
                "current_price_tl":  round(close, 2),
                "ma50_tl":           round(ma50, 2),
                "above_ma50":        close > ma50,
                "median_daily_value_tl": med_daily,
                "data_days":         len(series),
            })
        except Exception as exc:
            results.append({
                "symbol":  symbol,
                "name":    meta.get("name", symbol),
                "signal":  "ERROR",
                "error":   str(exc),
            })

    # Skora göre sırala (ERROR'lar sona)
    results.sort(key=lambda x: x.get("score", -1), reverse=True)

    response = {
        "results":      results,
        "screened_at":  datetime.now(timezone.utc).isoformat(),
        "usd_try_rate": round(usdtry, 2),
        "cached":       False,
    }

    # ─ Cache'e yaz
    conn2 = get_db()
    try:
        conn2.execute(
            """
            INSERT INTO history_cache(symbol, interval, data_json, fetched_at) VALUES(%s, %s, %s, %s)
            ON CONFLICT (symbol, interval) DO UPDATE SET data_json = EXCLUDED.data_json, fetched_at = EXCLUDED.fetched_at
            """,
            (CACHE_SYMBOL, CACHE_INTERVAL, json.dumps(response), now),
        )
        conn2.commit()
    except Exception:
        pass
    finally:
        conn2.close()

    return response


# ─── Database Viewer ─────────────────────────────────────────────────────────

@app.get("/api/db/tables")
def db_tables():
    """Tüm tabloları, şemalarını ve satır sayılarını döner."""
    conn = get_db()
    try:
        tables = conn.execute(
            "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        ).fetchall()
        result = []
        for t in tables:
            name = t["name"]
            try:
                count = conn.execute(f'SELECT COUNT(*) AS c FROM "{name}"').fetchone()["c"]
            except Exception:
                count = 0
            cols = conn.execute(
                """
                SELECT column_name AS name, data_type AS type
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s
                ORDER BY ordinal_position
                """,
                (name,)
            ).fetchall()
            result.append({
                "name":    name,
                "rows":    count,
                "columns": [{"name": c["name"], "type": c["type"] or "text"} for c in cols],
            })
        return {"tables": result}
    finally:
        conn.close()


@app.post("/api/db/query")
async def db_query(request: Request):
    """
    Kullanıcının gönderdiği SQL sorgusunu çalıştırır.
    Güvenlik: Sadece SELECT ifadelerine izin verilir.
    """
    import re
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz JSON gövdesi")

    sql = (body.get("sql") or "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL boş olamaz")

    # Yalnızca SELECT'e izin ver (WITH … SELECT dahil)
    normalized = re.sub(r"\s+", " ", sql.upper().lstrip())
    if not (normalized.startswith("SELECT") or normalized.startswith("WITH")):
        raise HTTPException(status_code=400, detail="Sadece SELECT sorguları çalıştırılabilir")

    # Tehlikeli anahtar kelimeleri engelle
    dangerous = re.compile(
        r"\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|REPLACE|ATTACH|DETACH|COPY|TRUNCATE|GRANT|REVOKE)\b",
        re.IGNORECASE,
    )
    if dangerous.search(sql):
        raise HTTPException(status_code=400, detail="Bu işlem güvenlik nedeniyle engellendi")

    # LIMIT yoksa otomatik ekle
    if "LIMIT" not in sql.upper():
        sql = sql.rstrip(";") + " LIMIT 500"

    conn = get_db()
    try:
        cursor = conn.execute(sql)
        rows = cursor.fetchall()
        columns = [d[0] for d in cursor.description] if cursor.description else []
        return {
            "columns": columns,
            "rows":    [dict(r) for r in rows],
            "count":   len(rows),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        conn.close()
