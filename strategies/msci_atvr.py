"""
MSCI ATVR (Annualized Traded Value Ratio) — Borsa İstanbul Likidite & Boyut Tarayıcı
======================================================================================
Kullanım:
    from msci_atvr import MSCIScreener, StockData
    import pandas as pd

    screener = MSCIScreener(usd_try_rate=32.50)
    result = screener.analyze(stock)
    print(result)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import List

import pandas as pd


# ─── Sabitler ──────────────────────────────────────────────────────────────────

TRADING_DAYS_PER_YEAR = 252
TRADING_DAYS_PER_QUARTER = 63         # ~3 ay
ATVR_WINDOW_DAYS = TRADING_DAYS_PER_QUARTER

# MSCI Emerging Markets minimum likidite eşiği (%)
ATVR_MIN_THRESHOLD_EM = 15.0          # %15 ATVR

# MSCI Global Minimum Size (Float Adjusted Market Cap, USD milyon)
# Kaynak: MSCI May 2024 Semi-Annual Index Review metodoloji notu
GLOBAL_MIN_SIZE_USD_M = 160.0         # $160M
SMALL_CAP_MIN_SIZE_USD_M = 35.0       # $35M (MSCI Small Cap alt sınır)

# Giriş olasılığı eşikleri
HIGH_ENTRY_ATVR = 20.0                # ATVR >= %20 → güçlü likidite
MEDIUM_ENTRY_ATVR = 15.0              # ATVR >= %15 → minimum eşik

HIGH_ENTRY_MCAP_MULT = 1.50           # Global Min Size * 1.5x üzeriyse güçlü büyüklük
MEDIUM_ENTRY_MCAP_MULT = 1.00         # Global Min Size üzerinde


# ─── Tip Tanımları ─────────────────────────────────────────────────────────────

class EntryProbability(Enum):
    HIGH   = "High"
    MEDIUM = "Medium"
    LOW    = "Low"


@dataclass
class StockData:
    """Tek bir hissenin ham verisi."""
    symbol: str
    name: str

    # Günlük TL cinsinden işlem hacmi (son 3 ay) — liste uzunluğu >= 63 olmalı
    daily_traded_value_tl: List[float]

    # Anlık fiili dolaşımdaki piyasa değeri (TL)
    float_market_cap_tl: float

    # Toplam piyasa değeri (TL) — büyüklük puanlaması için
    total_market_cap_tl: float

    # Fiili dolaşım oranı (0-1 arası, ör: 0.35 = %35)
    free_float_ratio: float

    # Güncel kapanış fiyatı (TL)
    close_price_tl: float

    # 50 günlük hareketli ortalama (TL) — momentum kontrolü için
    ma50_tl: float = 0.0

    # MSCI rebalancing/duyuru tarihi (opsiyonel, iso string "2024-09-13")
    announcement_date: str | None = None


@dataclass
class ATVRResult:
    """ATVR hesaplama sonucu."""
    symbol: str
    name: str

    atvr_pct: float               # Yıllıklandırılmış işlem hacmi oranı (%)
    median_daily_value_tl: float  # Medyan günlük hacim (TL)
    float_mcap_usd_m: float       # Fiili dolaşım piyasa değeri (USD milyon)
    total_mcap_usd_m: float       # Toplam piyasa değeri (USD milyon)
    free_float_ratio: float

    passes_liquidity: bool        # ATVR >= %15 mi?
    passes_min_size: bool         # Float MCAP >= Global Min Size mi?

    entry_probability: EntryProbability
    score: float                  # 0-100 arası bileşik puan
    signals: List[str] = field(default_factory=list)

    def __str__(self) -> str:
        prob_color = {
            EntryProbability.HIGH:   "✅",
            EntryProbability.MEDIUM: "⚠️ ",
            EntryProbability.LOW:    "❌",
        }[self.entry_probability]

        lines = [
            f"{'─'*56}",
            f"  {self.symbol} — {self.name}",
            f"{'─'*56}",
            f"  ATVR                : {self.atvr_pct:>8.2f}%  (eşik: {ATVR_MIN_THRESHOLD_EM:.0f}%)",
            f"  Fiili Dolaşım MCAP  : ${self.float_mcap_usd_m:>8.1f}M  (min: ${GLOBAL_MIN_SIZE_USD_M:.0f}M)",
            f"  Toplam MCAP         : ${self.total_mcap_usd_m:>8.1f}M",
            f"  Fiili Dolaşım Oranı : {self.free_float_ratio*100:>7.1f}%",
            f"  Likidite Geçti      : {'EVET' if self.passes_liquidity else 'HAYIR'}",
            f"  Boyut Geçti         : {'EVET' if self.passes_min_size else 'HAYIR'}",
            f"  Bileşik Puan        : {self.score:>7.1f}/100",
            f"  Giriş Olasılığı     : {prob_color} {self.entry_probability.value}",
        ]
        if self.signals:
            lines.append(f"  Sinyaller           :")
            for sig in self.signals:
                lines.append(f"    • {sig}")
        lines.append(f"{'─'*56}")
        return "\n".join(lines)


# ─── Ana Tarayıcı Sınıfı ──────────────────────────────────────────────────────

class MSCIScreener:
    """
    MSCI ATVR metodolojisini simüle eder ve BIST hisselerini tarar.

    Parameters
    ----------
    usd_try_rate : float
        USD/TRY kuru (ör: 32.50)
    atvr_window : int
        ATVR hesaplamasında kullanılacak işlem günü sayısı (varsayılan: 63 = 3 ay)
    """

    def __init__(self, usd_try_rate: float, atvr_window: int = ATVR_WINDOW_DAYS):
        if usd_try_rate <= 0:
            raise ValueError("usd_try_rate pozitif olmalı")
        self.usd_try_rate = usd_try_rate
        self.atvr_window = atvr_window

    # ── Yardımcı dönüşümler ────────────────────────────────────────────────────

    def _tl_to_usd_m(self, value_tl: float) -> float:
        """TL cinsinden değeri USD milyona çevirir."""
        return (value_tl / self.usd_try_rate) / 1_000_000

    # ── ATVR Hesabı ────────────────────────────────────────────────────────────

    def compute_atvr(
        self,
        daily_traded_value_tl: List[float],
        float_market_cap_tl: float,
    ) -> float:
        """
        ATVR hesaplar.

        Formula (MSCI metodolojisi):
            ATVR = (Medyan Günlük Hacim × Yıllık İşlem Günü) / Float MCAP × 100

        Son `atvr_window` günlük medyan kullanılır.

        Returns
        -------
        float : ATVR yüzdesi
        """
        if float_market_cap_tl <= 0:
            return 0.0

        window = daily_traded_value_tl[-self.atvr_window:]
        if not window:
            return 0.0

        median_daily = float(pd.Series(window).median())
        atvr = (median_daily * TRADING_DAYS_PER_YEAR) / float_market_cap_tl * 100
        return round(atvr, 4)

    # ── Giriş Puanı ────────────────────────────────────────────────────────────

    def _score_entry(
        self,
        atvr: float,
        float_mcap_usd_m: float,
        free_float_ratio: float,
        close_tl: float,
        ma50_tl: float,
    ) -> tuple[EntryProbability, float, List[str]]:
        """
        0-100 arası bileşik puan hesaplar ve giriş olasılığı döner.

        Puan bileşenleri:
          - Likidite (ATVR)    : 0-40 puan
          - Boyut (Float MCAP) : 0-35 puan
          - Dolaşım Oranı      : 0-15 puan
          - Momentum (MA50)    : 0-10 puan
        """
        signals: List[str] = []

        # ── 1. Likidite puanı (0-40)
        if atvr >= 40:
            liq_score = 40.0
        elif atvr >= ATVR_MIN_THRESHOLD_EM:
            # %15-40 arasını lineer ölçekle
            liq_score = 15.0 + (atvr - ATVR_MIN_THRESHOLD_EM) / (40 - ATVR_MIN_THRESHOLD_EM) * 25
        elif atvr >= 8:
            liq_score = (atvr / ATVR_MIN_THRESHOLD_EM) * 15
        else:
            liq_score = 0.0

        if atvr >= HIGH_ENTRY_ATVR:
            signals.append(f"Güçlü likidite: ATVR {atvr:.1f}% (eşik: {ATVR_MIN_THRESHOLD_EM}%)")
        elif atvr >= ATVR_MIN_THRESHOLD_EM:
            signals.append(f"Minimum likidite eşiği karşılandı: ATVR {atvr:.1f}%")
        else:
            signals.append(f"Likidite yetersiz: ATVR {atvr:.1f}% < {ATVR_MIN_THRESHOLD_EM}%")

        # ── 2. Boyut puanı (0-35)
        min_size = GLOBAL_MIN_SIZE_USD_M
        if float_mcap_usd_m >= min_size * HIGH_ENTRY_MCAP_MULT:
            size_score = 35.0
            signals.append(f"Güçlü büyüklük: ${float_mcap_usd_m:.0f}M (min. {HIGH_ENTRY_MCAP_MULT:.1f}x = ${min_size*HIGH_ENTRY_MCAP_MULT:.0f}M)")
        elif float_mcap_usd_m >= min_size:
            ratio = (float_mcap_usd_m - min_size) / (min_size * HIGH_ENTRY_MCAP_MULT - min_size)
            size_score = 20.0 + ratio * 15
            signals.append(f"Global Min Size üzerinde: ${float_mcap_usd_m:.0f}M")
        elif float_mcap_usd_m >= SMALL_CAP_MIN_SIZE_USD_M:
            size_score = (float_mcap_usd_m / min_size) * 20
            signals.append(f"Small Cap aralığında: ${float_mcap_usd_m:.0f}M (Standard Index altı)")
        else:
            size_score = 0.0
            signals.append(f"Boyut yetersiz: ${float_mcap_usd_m:.0f}M < ${SMALL_CAP_MIN_SIZE_USD_M:.0f}M")

        # ── 3. Fiili dolaşım oranı puanı (0-15)
        # MSCI minimum free float: %15. %25 üzeri tam puan.
        if free_float_ratio >= 0.25:
            ff_score = 15.0
        elif free_float_ratio >= 0.15:
            ff_score = (free_float_ratio - 0.15) / (0.25 - 0.15) * 15
        else:
            ff_score = 0.0
            signals.append(f"Düşük fiili dolaşım: %{free_float_ratio*100:.1f} (MSCI min: %15)")

        # ── 4. Momentum puanı (0-10)
        if ma50_tl > 0 and close_tl > ma50_tl:
            momentum_score = 10.0
            signals.append(f"Momentum onayı: Fiyat ({close_tl:.2f}) > MA50 ({ma50_tl:.2f})")
        else:
            momentum_score = 0.0
            if ma50_tl > 0:
                signals.append(f"Momentum yok: Fiyat ({close_tl:.2f}) ≤ MA50 ({ma50_tl:.2f})")

        total_score = round(liq_score + size_score + ff_score + momentum_score, 2)

        # ── Olasılık sınıflandırması
        passes_liq = atvr >= ATVR_MIN_THRESHOLD_EM
        passes_size = float_mcap_usd_m >= GLOBAL_MIN_SIZE_USD_M

        if passes_liq and passes_size and total_score >= 65:
            probability = EntryProbability.HIGH
        elif (passes_liq or passes_size) and total_score >= 40:
            probability = EntryProbability.MEDIUM
        else:
            probability = EntryProbability.LOW

        return probability, total_score, signals

    # ── Ana Analiz ─────────────────────────────────────────────────────────────

    def analyze(self, stock: StockData) -> ATVRResult:
        """Tek bir hisseyi analiz eder."""
        atvr = self.compute_atvr(
            stock.daily_traded_value_tl,
            stock.float_market_cap_tl,
        )

        float_mcap_usd_m = self._tl_to_usd_m(stock.float_market_cap_tl)
        total_mcap_usd_m = self._tl_to_usd_m(stock.total_market_cap_tl)

        window = stock.daily_traded_value_tl[-self.atvr_window:]
        median_daily = float(pd.Series(window).median()) if window else 0.0

        probability, score, signals = self._score_entry(
            atvr=atvr,
            float_mcap_usd_m=float_mcap_usd_m,
            free_float_ratio=stock.free_float_ratio,
            close_tl=stock.close_price_tl,
            ma50_tl=stock.ma50_tl,
        )

        return ATVRResult(
            symbol=stock.symbol,
            name=stock.name,
            atvr_pct=atvr,
            median_daily_value_tl=median_daily,
            float_mcap_usd_m=float_mcap_usd_m,
            total_mcap_usd_m=total_mcap_usd_m,
            free_float_ratio=stock.free_float_ratio,
            passes_liquidity=atvr >= ATVR_MIN_THRESHOLD_EM,
            passes_min_size=float_mcap_usd_m >= GLOBAL_MIN_SIZE_USD_M,
            entry_probability=probability,
            score=score,
            signals=signals,
        )

    def screen(self, stocks: List[StockData]) -> pd.DataFrame:
        """
        Birden fazla hisseyi tarar, sıralı DataFrame döner.

        Returns
        -------
        pd.DataFrame : Sonuçlar, skora göre azalan sırada
        """
        results = [self.analyze(s) for s in stocks]
        rows = []
        for r in results:
            rows.append({
                "Sembol": r.symbol,
                "Şirket": r.name,
                "ATVR (%)": r.atvr_pct,
                "Float MCAP ($M)": round(r.float_mcap_usd_m, 1),
                "Toplam MCAP ($M)": round(r.total_mcap_usd_m, 1),
                "Fiili Dolaşım (%)": round(r.free_float_ratio * 100, 1),
                "Likidite ✓": r.passes_liquidity,
                "Boyut ✓": r.passes_min_size,
                "Skor": r.score,
                "Giriş Olasılığı": r.entry_probability.value,
            })
        df = pd.DataFrame(rows).sort_values("Skor", ascending=False).reset_index(drop=True)
        return df

    def high_probability_candidates(self, stocks: List[StockData]) -> List[ATVRResult]:
        """Sadece HIGH giriş olasılıklı hisseleri döner."""
        return [self.analyze(s) for s in stocks if self.analyze(s).entry_probability == EntryProbability.HIGH]


# ─── Demo ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import random

    random.seed(42)
    USD_TRY = 32.50

    def _mock_volume(base: float, days: int = 120) -> List[float]:
        """Gerçekçi günlük hacim serisi oluşturur (±30% rastgele dalgalanma)."""
        return [base * (0.7 + random.random() * 0.6) for _ in range(days)]

    demo_stocks = [
        StockData(
            symbol="ASELS",
            name="Aselsan Elektronik",
            daily_traded_value_tl=_mock_volume(850_000_000),    # ~850M TL/gün ortalama
            float_market_cap_tl=18_000_000_000,                 # 18 Milyar TL float MCAP
            total_market_cap_tl=52_000_000_000,
            free_float_ratio=0.35,
            close_price_tl=432.0,
            ma50_tl=410.0,
            announcement_date="2026-05-30",
        ),
        StockData(
            symbol="YEOTK",
            name="Yeo Teknoloji",
            daily_traded_value_tl=_mock_volume(45_000_000),     # ~45M TL/gün (küçük hacim)
            float_market_cap_tl=1_200_000_000,
            total_market_cap_tl=3_500_000_000,
            free_float_ratio=0.34,
            close_price_tl=86.25,
            ma50_tl=95.0,                                        # Fiyat MA50 altında
            announcement_date="2026-05-30",
        ),
        StockData(
            symbol="KONTR",
            name="Kontrolmatik",
            daily_traded_value_tl=_mock_volume(18_000_000),
            float_market_cap_tl=800_000_000,
            total_market_cap_tl=2_200_000_000,
            free_float_ratio=0.36,
            close_price_tl=10.35,
            ma50_tl=9.80,
            announcement_date="2026-05-30",
        ),
    ]

    screener = MSCIScreener(usd_try_rate=USD_TRY)

    print("\n" + "="*56)
    print("  MSCI EM ATVR Tarayıcı — Borsa İstanbul")
    print("  USD/TRY kuru:", USD_TRY)
    print("="*56)

    for stock in demo_stocks:
        result = screener.analyze(stock)
        print(result)

    print("\n  📊 Özet Tablo")
    print("="*56)
    df = screener.screen(demo_stocks)
    print(df.to_string(index=False))
