/// <summary>
/// Matriks IQ — MSCI EM Rebalancing Momentum Stratejisi
/// =====================================================
/// Mantık:
///   1. Python MSCI tarayıcısından gelen "HIGH" sinyalini okur.
///   2. Hisse 50 günlük hareketli ortalamanın üzerindeyse (momentum onayı)
///      duyuru tarihinden 15 gün önce market order ile alım yapar.
///   3. Duyuru günü veya rebalancing uygulama günü kar satışı yapar.
///
/// Matriks IQ Platformu kurulum:
///   Araçlar → Strateji → Yeni → bu dosyayı yapıştır
/// </summary>

using System;
using System.Collections.Generic;
using MatriksIQ;

namespace MSCI_Rebalancing
{
    public class MSCIRebalancingStrategy : StrategyBase
    {
        // ─── Parametreler (Matriks UI'dan değiştirilebilir) ────────────────────

        [StrategyParameter("MA Periyodu", DefaultValue = 50, MinValue = 10, MaxValue = 200)]
        public int MaPeriod { get; set; }

        [StrategyParameter("Alım Gün Öncesi", DefaultValue = 15, MinValue = 1, MaxValue = 30)]
        public int DaysBeforeAnnouncement { get; set; }

        [StrategyParameter("Lot Büyüklüğü", DefaultValue = 100, MinValue = 1, MaxValue = 100000)]
        public int LotSize { get; set; }

        [StrategyParameter("Duyuru Tarihi (YYYY-MM-DD)", DefaultValue = "2026-05-30")]
        public string AnnouncementDateStr { get; set; }

        [StrategyParameter("Rebalancing Tarihi (YYYY-MM-DD)", DefaultValue = "2026-06-02")]
        public string RebalancingDateStr { get; set; }

        [StrategyParameter("MSCI Sinyali (HIGH/MEDIUM/LOW)", DefaultValue = "HIGH")]
        public string MsciSignal { get; set; }

        // ─── İç durum değişkenleri ─────────────────────────────────────────────

        private DateTime _announcementDate;
        private DateTime _rebalancingDate;
        private DateTime _entryDate;         // Duyuru - 15 gün

        private bool _positionOpen = false;
        private bool _entryExecuted = false;
        private bool _exitExecuted = false;

        private Queue<double> _maBuffer;     // MA hesabı için kayan pencere

        // ─── Strateji başlangıcı ───────────────────────────────────────────────

        public override void OnStrategyStart()
        {
            // Tarih parse
            if (!DateTime.TryParse(AnnouncementDateStr, out _announcementDate))
                LogError($"Geçersiz duyuru tarihi: {AnnouncementDateStr}");

            if (!DateTime.TryParse(RebalancingDateStr, out _rebalancingDate))
                LogError($"Geçersiz rebalancing tarihi: {RebalancingDateStr}");

            // Alım tarihi = duyurudan DaysBeforeAnnouncement iş günü önce
            _entryDate = SubtractTradingDays(_announcementDate, DaysBeforeAnnouncement);

            _maBuffer = new Queue<double>(MaPeriod + 1);
            _positionOpen = false;
            _entryExecuted = false;
            _exitExecuted = false;

            LogInfo($"Strateji başlatıldı | Sembol: {Symbol}");
            LogInfo($"MSCI Sinyali  : {MsciSignal}");
            LogInfo($"Duyuru Tarihi : {_announcementDate:dd.MM.yyyy}");
            LogInfo($"Planlanan Alım: {_entryDate:dd.MM.yyyy} ({DaysBeforeAnnouncement} gün önce)");
            LogInfo($"Çıkış Tarihi  : {_rebalancingDate:dd.MM.yyyy} (Rebalancing)");
        }

        // ─── Her bar'da çalışır ────────────────────────────────────────────────

        public override void OnDataUpdate(BarData bar)
        {
            if (bar == null) return;

            double close = bar.Close;
            DateTime barDate = bar.Date.Date;

            // ── MA güncelle
            _maBuffer.Enqueue(close);
            if (_maBuffer.Count > MaPeriod)
                _maBuffer.Dequeue();

            double ma50 = CalculateMA(_maBuffer);

            // ── MSCI sinyali HIGH değilse işlem yapma
            if (!MsciSignal.Equals("HIGH", StringComparison.OrdinalIgnoreCase))
            {
                LogDebug($"[{barDate:dd.MM.yyyy}] MSCI sinyali HIGH değil ({MsciSignal}), bekleniyor...");
                return;
            }

            // ── Yetersiz bar sayısı — MA henüz hazır değil
            if (_maBuffer.Count < MaPeriod)
            {
                LogDebug($"[{barDate:dd.MM.yyyy}] MA için yeterli bar yok ({_maBuffer.Count}/{MaPeriod})");
                return;
            }

            // ── ALIŞ KOŞULLARI
            if (!_entryExecuted && !_positionOpen)
            {
                bool isEntryDay     = barDate >= _entryDate && barDate < _announcementDate;
                bool priceAboveMa50 = close > ma50;

                if (isEntryDay && priceAboveMa50)
                {
                    LogInfo($"[{barDate:dd.MM.yyyy}] 🟢 ALIŞ SİNYALİ");
                    LogInfo($"  Fiyat: {close:F2} > MA{MaPeriod}: {ma50:F2}");
                    LogInfo($"  Duyuruya kalan: {(_announcementDate - barDate).Days} gün");

                    bool orderSent = SendMarketOrder(
                        symbol:    Symbol,
                        direction: OrderDirection.Buy,
                        quantity:  LotSize,
                        comment:   $"MSCI_ENTRY | MA{MaPeriod}={ma50:F2} | Ent={barDate:dd.MM.yyyy}"
                    );

                    if (orderSent)
                    {
                        _positionOpen  = true;
                        _entryExecuted = true;
                        LogInfo($"  ✅ Market order gönderildi — {LotSize} lot");
                    }
                    else
                    {
                        LogError("  ❌ Order gönderilemedi!");
                    }
                }
                else if (isEntryDay && !priceAboveMa50)
                {
                    LogInfo($"[{barDate:dd.MM.yyyy}] ⚠️  Momentum yok — Fiyat ({close:F2}) ≤ MA{MaPeriod} ({ma50:F2}), alım yapılmıyor");
                }
            }

            // ── SATIŞ KOŞULLARI (duyuru günü VEYA rebalancing günü)
            if (_positionOpen && !_exitExecuted)
            {
                bool isAnnouncementDay  = barDate == _announcementDate.Date;
                bool isRebalancingDay   = barDate >= _rebalancingDate.Date;
                bool isStopLossHit      = close < ma50 * 0.95;   // MA50'nin %5 altı — stop-loss

                string exitReason = null;
                if (isAnnouncementDay)  exitReason = "DUYURU_GUNU";
                else if (isRebalancingDay) exitReason = "REBALANCING";
                else if (isStopLossHit)    exitReason = "STOP_LOSS";

                if (exitReason != null)
                {
                    LogInfo($"[{barDate:dd.MM.yyyy}] 🔴 SATIŞ SİNYALİ — Sebep: {exitReason}");
                    LogInfo($"  Çıkış Fiyatı: {close:F2}");

                    bool orderSent = SendMarketOrder(
                        symbol:    Symbol,
                        direction: OrderDirection.Sell,
                        quantity:  LotSize,
                        comment:   $"MSCI_EXIT | {exitReason} | {barDate:dd.MM.yyyy}"
                    );

                    if (orderSent)
                    {
                        _positionOpen = false;
                        _exitExecuted = true;
                        LogInfo($"  ✅ Satış order gönderildi — {LotSize} lot");
                    }
                    else
                    {
                        LogError("  ❌ Satış order gönderilemedi!");
                    }
                }
            }
        }

        // ─── Strateji bitişi ───────────────────────────────────────────────────

        public override void OnStrategyEnd()
        {
            if (_positionOpen)
            {
                LogWarning("⚠️  Strateji kapandı ancak açık pozisyon var! Manuel kontrol edin.");
            }
            else
            {
                LogInfo("Strateji tamamlandı. Açık pozisyon yok.");
            }
        }

        // ─── Yardımcı metodlar ─────────────────────────────────────────────────

        /// <summary>Basit hareketli ortalama hesaplar.</summary>
        private static double CalculateMA(Queue<double> buffer)
        {
            if (buffer.Count == 0) return 0;
            double sum = 0;
            foreach (double v in buffer) sum += v;
            return sum / buffer.Count;
        }

        /// <summary>
        /// Belirtilen tarihten N iş günü öncesini döner.
        /// Basit yaklaşım: haftasonu ve resmi tatiller hariç.
        /// </summary>
        private static DateTime SubtractTradingDays(DateTime date, int tradingDays)
        {
            // Türkiye resmi tatilleri (yıl bağımsız ay-gün çiftleri)
            var holidays = new HashSet<(int month, int day)>
            {
                (1,  1),  // Yılbaşı
                (4, 23),  // Ulusal Egemenlik ve Çocuk Bayramı
                (5,  1),  // Emek ve Dayanışma Günü
                (5, 19),  // Atatürk'ü Anma, Gençlik ve Spor Bayramı
                (8, 30),  // Zafer Bayramı
                (10,29),  // Cumhuriyet Bayramı
            };

            DateTime current = date.AddDays(-1);
            int counted = 0;

            while (counted < tradingDays)
            {
                bool isWeekend = current.DayOfWeek == DayOfWeek.Saturday
                              || current.DayOfWeek == DayOfWeek.Sunday;
                bool isHoliday = holidays.Contains((current.Month, current.Day));

                if (!isWeekend && !isHoliday)
                    counted++;

                if (counted < tradingDays)
                    current = current.AddDays(-1);
            }
            return current.Date;
        }

        // ─── Loglama wrapperları ───────────────────────────────────────────────

        private void LogInfo(string msg)    => Print($"[INFO]  {msg}");
        private void LogWarning(string msg) => Print($"[WARN]  {msg}");
        private void LogError(string msg)   => Print($"[ERROR] {msg}");
        private void LogDebug(string msg)   => Print($"[DEBUG] {msg}");
    }
}
