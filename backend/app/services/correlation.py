"""
Korelasyon Servisi — XAU / CHF ve diğer varlıklar arası istatistiksel analiz

Kullanılan yöntemler:
  • Pearson korelasyonu    — doğrusal ilişki
  • Spearman korelasyonu   — sıralama tabanlı, doğrusal olmayan ilişkiler için
  • Rolling korelasyon     — zaman içindeki dinamik ilişki
  • Log-return tabanlı     — fiyat değil getiri korelasyonu (finansal standart)
"""
from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd
from scipy import stats
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import PriceHistory


# ---------------------------------------------------------------------------
# Veri çekme
# ---------------------------------------------------------------------------

async def fetch_price_series(
    db: AsyncSession,
    asset_id: int,
    start: datetime,
    end: datetime,
) -> pd.Series:
    """
    Belirli bir varlık için kapanış fiyatı zaman serisini döner.
    Index: timestamp, Values: close fiyatı (Decimal → float)
    """
    rows = await db.execute(
        select(PriceHistory.time, PriceHistory.close)
        .where(
            PriceHistory.asset_id == asset_id,
            PriceHistory.time >= start,
            PriceHistory.time <= end,
        )
        .order_by(PriceHistory.time)
    )
    data = rows.all()
    if not data:
        return pd.Series(dtype=float)

    times  = [r.time for r in data]
    closes = [float(r.close) for r in data]
    return pd.Series(closes, index=pd.DatetimeIndex(times), name=f"asset_{asset_id}")


# ---------------------------------------------------------------------------
# Korelasyon hesaplama
# ---------------------------------------------------------------------------

def _align_and_log_returns(s1: pd.Series, s2: pd.Series) -> tuple[pd.Series, pd.Series]:
    """
    İki seriyi aynı zaman eksenine hizalar ve log getiri alır.
    Log-return: ln(P_t / P_{t-1})
    """
    df = pd.concat([s1, s2], axis=1).dropna()
    if df.empty or len(df) < 2:
        raise ValueError("Korelasyon için yeterli ortak veri yok.")

    log_ret = np.log(df / df.shift(1)).dropna()
    return log_ret.iloc[:, 0], log_ret.iloc[:, 1]


async def compute_correlation(
    db: AsyncSession,
    asset_id_1: int,
    asset_id_2: int,
    start: datetime,
    end: datetime,
    method: str = "pearson",   # "pearson" | "spearman"
) -> dict:
    """
    İki varlık arasındaki korelasyon katsayısını hesaplar.

    Returns:
        {
            "asset_id_1": int,
            "asset_id_2": int,
            "method": str,
            "correlation": float,      # -1.0 … 1.0
            "p_value": float,
            "n_observations": int,
            "interpretation": str
        }
    """
    s1 = await fetch_price_series(db, asset_id_1, start, end)
    s2 = await fetch_price_series(db, asset_id_2, start, end)

    r1, r2 = _align_and_log_returns(s1, s2)

    if method == "spearman":
        corr, p_val = stats.spearmanr(r1, r2)
    else:
        corr, p_val = stats.pearsonr(r1, r2)

    return {
        "asset_id_1":     asset_id_1,
        "asset_id_2":     asset_id_2,
        "method":         method,
        "correlation":    round(float(corr), 6),
        "p_value":        round(float(p_val), 6),
        "n_observations": len(r1),
        "interpretation": _interpret_correlation(float(corr)),
    }


def _interpret_correlation(r: float) -> str:
    abs_r = abs(r)
    direction = "pozitif" if r >= 0 else "negatif"

    if abs_r >= 0.80:
        strength = "çok güçlü"
    elif abs_r >= 0.60:
        strength = "güçlü"
    elif abs_r >= 0.40:
        strength = "orta"
    elif abs_r >= 0.20:
        strength = "zayıf"
    else:
        strength = "ihmal edilebilir"

    return f"{strength} {direction} korelasyon"


# ---------------------------------------------------------------------------
# Rolling (kayan pencere) korelasyon
# ---------------------------------------------------------------------------

async def compute_rolling_correlation(
    db: AsyncSession,
    asset_id_1: int,
    asset_id_2: int,
    start: datetime,
    end: datetime,
    window: int = 30,   # gün
) -> list[dict]:
    """
    Belirli bir pencere boyutunda kayan korelasyon hesaplar.

    Returns:
        [{"date": str, "correlation": float}, ...]
    """
    s1 = await fetch_price_series(db, asset_id_1, start, end)
    s2 = await fetch_price_series(db, asset_id_2, start, end)

    r1, r2 = _align_and_log_returns(s1, s2)

    df = pd.DataFrame({"r1": r1, "r2": r2})
    rolling_corr = df["r1"].rolling(window=window).corr(df["r2"])

    return [
        {"date": idx.strftime("%Y-%m-%d"), "correlation": round(float(val), 6)}
        for idx, val in rolling_corr.dropna().items()
    ]
