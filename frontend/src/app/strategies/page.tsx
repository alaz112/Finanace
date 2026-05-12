"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── Strateji içerikleri ─────────────────────────────────────────────────── */

const PYTHON_CODE = `"""
MSCI ATVR (Annualized Traded Value Ratio)
Borsa İstanbul Likidite & Boyut Tarayıcı
"""

# ─── Sabitler ────────────────────────────────────────────
TRADING_DAYS_PER_YEAR  = 252
ATVR_WINDOW_DAYS       = 63    # ~3 ay
ATVR_MIN_THRESHOLD_EM  = 15.0  # %15 ATVR eşiği (MSCI EM)
GLOBAL_MIN_SIZE_USD_M  = 160.0 # $160M float MCAP minimum

# ─── ATVR Formülü ────────────────────────────────────────
# ATVR = (Medyan Günlük Hacim × 252) / Float MCAP × 100
#
# Son 63 iş günü (3 aylık) medyan günlük TL hacmi alınır.
# Float MCAP = Toplam MCAP × Fiili Dolaşım Oranı

def compute_atvr(daily_volumes_tl: list, float_mcap_tl: float) -> float:
    window = daily_volumes_tl[-63:]
    median_daily = statistics.median(window)
    return (median_daily * 252) / float_mcap_tl * 100

# ─── Puan Bileşenleri (0–100) ────────────────────────────
#
#   Likidite  (ATVR ≥ %15)     → 0–40 puan
#   Boyut     (MCAP ≥ $160M)   → 0–35 puan
#   Dolaşım   (Free Float ≥ %15) → 0–15 puan
#   Momentum  (Fiyat > MA50)   → 0–10 puan

# ─── Giriş Olasılığı Sınıflandırması ────────────────────
#
#   HIGH   → Likidite ✓ + Boyut ✓ + Skor ≥ 65
#   MEDIUM → Likidite ✓ veya Boyut ✓ + Skor ≥ 40
#   LOW    → Diğer tüm durumlar

# ─── Örnek Kullanım ──────────────────────────────────────
screener = MSCIScreener(usd_try_rate=32.50)

result = screener.analyze(StockData(
    symbol              = "ASELS",
    name                = "Aselsan Elektronik",
    daily_traded_value_tl = [...],   # Son 120 günlük hacim
    float_market_cap_tl = 18_000_000_000,
    total_market_cap_tl = 52_000_000_000,
    free_float_ratio    = 0.35,
    close_price_tl      = 432.0,
    ma50_tl             = 410.0,
    announcement_date   = "2026-05-30",
))

# ─── Toplu Tarama ────────────────────────────────────────
df = screener.screen([stock1, stock2, stock3])
# → Skor'a göre sıralı DataFrame döner

candidates = screener.high_probability_candidates(stocks)
# → Sadece HIGH sinyalliler`;

const CSHARP_CODE = `/// Matriks IQ — MSCI EM Rebalancing Momentum Stratejisi
///
/// Akış:
///  1. Python MSCI tarayıcısı "HIGH" sinyal üretir
///  2. Fiyat > MA50 (Momentum onayı)
///  3. Duyurudan 15 iş günü önce → BUY
///  4. Duyuru günü veya Rebalancing günü → SELL

public class MSCIRebalancingStrategy : StrategyBase
{
    // ─── Parametreler (Matriks UI'dan ayarlanır) ─────────
    [StrategyParameter("MA Periyodu",      DefaultValue = 50)]
    public int    MaPeriod              { get; set; }

    [StrategyParameter("Alım Gün Öncesi", DefaultValue = 15)]
    public int    DaysBeforeAnnouncement { get; set; }

    [StrategyParameter("Lot Büyüklüğü",   DefaultValue = 100)]
    public int    LotSize               { get; set; }

    [StrategyParameter("Duyuru Tarihi",   DefaultValue = "2026-05-30")]
    public string AnnouncementDateStr   { get; set; }

    [StrategyParameter("Rebalancing",     DefaultValue = "2026-06-02")]
    public string RebalancingDateStr    { get; set; }

    [StrategyParameter("MSCI Sinyali",    DefaultValue = "HIGH")]
    public string MsciSignal            { get; set; }

    // ─── OnDataUpdate: Her barda çalışır ─────────────────
    public override void OnDataUpdate(BarData bar)
    {
        double ma50 = CalculateMA(_maBuffer);

        // MSCI sinyali HIGH değilse bekle
        if (!MsciSignal.Equals("HIGH")) return;

        // ── ALIŞ: Alım penceresi + Momentum onayı
        bool isEntryWindow  = bar.Date >= _entryDate
                           && bar.Date <  _announcementDate;
        bool priceAboveMa50 = bar.Close > ma50;

        if (!_positionOpen && isEntryWindow && priceAboveMa50)
        {
            SendMarketOrder(Symbol, OrderDirection.Buy, LotSize,
                $"MSCI_ENTRY | MA50={ma50:F2}");
            _positionOpen = true;
        }

        // ── SATIŞ: Duyuru / Rebalancing / Stop-Loss
        if (_positionOpen)
        {
            bool exitNow =
                bar.Date == _announcementDate  ||  // Duyuru günü
                bar.Date >= _rebalancingDate   ||  // Rebalancing günü
                bar.Close < ma50 * 0.95;           // Stop-loss: MA50 − %5

            if (exitNow)
            {
                SendMarketOrder(Symbol, OrderDirection.Sell, LotSize,
                    "MSCI_EXIT");
                _positionOpen = false;
            }
        }
    }

    // ─── Kurulum: Matriks IQ ─────────────────────────────
    // Araçlar → Strateji Editörü → Yeni → Yapıştır → Derle
}`;

const FLOW_STEPS = [
  {
    step: "01",
    title: "Veri Toplama",
    desc: "Günlük TL hacim, fiili dolaşım MCAP ve fiyat verisi alınır (son 63 iş günü).",
    color: "#0A84FF",
  },
  {
    step: "02",
    title: "ATVR Hesabı",
    desc: "Medyan günlük hacim × 252 / Float MCAP × 100 formülü ile yıllık likidite oranı hesaplanır.",
    color: "#5856D6",
  },
  {
    step: "03",
    title: "Boyut Kontrolü",
    desc: "USD bazında Float MCAP, MSCI Global Minimum Size ($160M) eşiğiyle kıyaslanır.",
    color: "#FF9F0A",
  },
  {
    step: "04",
    title: "Puanlama",
    desc: "Likidite + Boyut + Dolaşım + Momentum bileşenlerinden 0–100 bileşik skor üretilir.",
    color: "#30D158",
  },
  {
    step: "05",
    title: "Sinyal Üretimi",
    desc: "Skor ≥ 65 ve tüm eşikler karşılandıysa → HIGH sinyal. Matriks'e gönderilir.",
    color: "#FF453A",
  },
  {
    step: "06",
    title: "Matriks IQ Alım",
    desc: "HIGH sinyal + Fiyat > MA50 koşulunda, duyurudan 15 iş günü önce pozisyon açılır.",
    color: "#FF9500",
  },
  {
    step: "07",
    title: "Çıkış",
    desc: "Duyuru günü veya rebalancing uygulandığında kar satışı yapılır. Stop-loss: MA50 − %5.",
    color: "#64D2FF",
  },
];

const SCORE_COMPONENTS = [
  { label: "Likidite (ATVR ≥ %15)", max: 40, color: "#0A84FF" },
  { label: "Boyut (Float MCAP ≥ $160M)", max: 35, color: "#5856D6" },
  { label: "Fiili Dolaşım (≥ %15)", max: 15, color: "#30D158" },
  { label: "Momentum (Fiyat > MA50)", max: 10, color: "#FF9F0A" },
];

/* ─── Yardımcı bileşenler ─────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
      style={{
        background: copied ? "#E3F9E9" : "#F5F5F7",
        color: copied ? "#30D158" : "#6E6E73",
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          Kopyalandı
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          Kopyala
        </>
      )}
    </button>
  );
}

function CodeBlock({
  code,
  language,
  title,
}: {
  code: string;
  language: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = code.split("\n");
  const previewLines = 20;
  const displayLines = expanded ? lines : lines.slice(0, previewLines);

  return (
    <div
      className="rounded-[16px] overflow-hidden"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: "#1C1C1E" }}
      >
        <div className="flex items-center gap-3">
          {/* macOS trafik lambası */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#FF5F57" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#28C840" }} />
          </div>
          <span className="text-[12px] font-medium" style={{ color: "#8E8E93" }}>
            {title}
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: language === "python" ? "#3A3A4A" : "#2A3A2A",
              color: language === "python" ? "#5AC8FA" : "#30D158",
            }}
          >
            {language === "python" ? "Python" : "C#"}
          </span>
        </div>
        <CopyButton text={code} />
      </div>

      {/* Kod */}
      <div
        style={{
          background: "#141414",
          position: "relative",
          maxHeight: expanded ? "none" : "380px",
          overflow: "hidden",
        }}
      >
        <pre
          className="text-[12.5px] leading-[1.7] p-5 overflow-x-auto"
          style={{ margin: 0, fontFamily: "'SF Mono', 'Fira Code', 'Menlo', monospace" }}
        >
          {displayLines.map((line, i) => (
            <div key={i} className="flex">
              <span
                className="select-none mr-5 text-right shrink-0"
                style={{ color: "#3A3A4A", width: "28px", fontSize: "11px", paddingTop: "1px" }}
              >
                {i + 1}
              </span>
              <span style={{ color: "#E0E0E0" }}>{renderLine(line, language)}</span>
            </div>
          ))}
        </pre>

        {/* Fade + expand butonu */}
        {!expanded && lines.length > previewLines && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-4 pt-16"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #141414)",
            }}
          >
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium"
              style={{ background: "#2C2C2E", color: "#AEAEB2" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              {lines.length - previewLines} satır daha göster
            </button>
          </div>
        )}
        {expanded && (
          <div className="flex justify-center pb-4">
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium"
              style={{ background: "#2C2C2E", color: "#AEAEB2" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 15l-6-6-6 6" /></svg>
              Daralt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Basit sözdizimi renklendirme ────────────────────────────────────────── */
function renderLine(line: string, lang: string) {
  if (lang === "python") {
    return <PythonLine line={line} />;
  }
  return <CSharpLine line={line} />;
}

function PythonLine({ line }: { line: string }) {
  const keywords = /\b(def|class|return|import|from|if|else|elif|for|in|not|and|or|True|False|None|self|async|await|yield|with|as|pass|raise|try|except|finally)\b/g;
  const strings = /("""[\s\S]*?"""|"[^"]*"|'[^']*')/g;
  const comments = /(#.*)$/;
  const numbers = /\b(\d+[_\d]*\.?\d*)\b/g;
  const builtins = /\b(print|len|list|dict|str|int|float|bool|range|enumerate|zip|map|filter|round|abs|max|min|sum|type|isinstance)\b/g;
  const decorators = /(@\w+)/g;

  // Yorumlar
  const commentMatch = line.match(comments);
  if (commentMatch) {
    const idx = line.indexOf(commentMatch[1]);
    const before = line.slice(0, idx);
    return (
      <>
        <PythonInline text={before} />
        <span style={{ color: "#5C7A5C", fontStyle: "italic" }}>{commentMatch[1]}</span>
      </>
    );
  }

  return <PythonInline text={line} />;
}

function PythonInline({ text }: { text: string }) {
  const tokens = text.split(/(\b(?:def|class|return|import|from|if|else|elif|for|in|not|and|or|True|False|None|self|async|await|yield|with|as|pass|raise|try|except|finally)\b|"[^"]*"|'[^']*'|"""[\s\S]*?"""|\b\d+\.?\d*\b|@\w+)/g);
  return (
    <>
      {tokens.map((token, i) => {
        if (/^(def|class|return|import|from|if|else|elif|for|in|not|and|or|True|False|None|self|async|await|yield|with|as|pass|raise|try|except|finally)$/.test(token))
          return <span key={i} style={{ color: "#CF8EF4" }}>{token}</span>;
        if (/^["']/.test(token))
          return <span key={i} style={{ color: "#FC6A5D" }}>{token}</span>;
        if (/^@/.test(token))
          return <span key={i} style={{ color: "#FFA14F" }}>{token}</span>;
        if (/^\d/.test(token))
          return <span key={i} style={{ color: "#D9C97C" }}>{token}</span>;
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}

function CSharpLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (trimmed.startsWith("///") || trimmed.startsWith("//"))
    return <span style={{ color: "#5C7A5C", fontStyle: "italic" }}>{line}</span>;

  const tokens = line.split(/(\b(?:public|private|protected|override|class|void|bool|string|int|double|new|return|if|else|using|namespace|this|true|false|null|var|static|readonly|async|await|base)\b|"[^"]*"|\b\d+\.?\d*\b|\[[\w\s,"=]+\])/g);
  return (
    <>
      {tokens.map((token, i) => {
        if (/^(public|private|protected|override|class|void|bool|string|int|double|new|return|if|else|using|namespace|this|true|false|null|var|static|readonly|async|await|base)$/.test(token))
          return <span key={i} style={{ color: "#CF8EF4" }}>{token}</span>;
        if (/^"/.test(token))
          return <span key={i} style={{ color: "#FC6A5D" }}>{token}</span>;
        if (/^\[/.test(token))
          return <span key={i} style={{ color: "#FFA14F" }}>{token}</span>;
        if (/^\d/.test(token))
          return <span key={i} style={{ color: "#D9C97C" }}>{token}</span>;
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}

/* ─── Ana Sayfa ───────────────────────────────────────────────────────────── */

export default function StrategiesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"flow" | "python" | "csharp">("flow");

  useEffect(() => {
    if (sessionStorage.getItem("auth") !== "1") {
      router.replace("/login");
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("auth");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F7" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-apple-separator px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/kurtlogo.png" alt="Logo" className="h-12 w-auto" />
          <div className="flex items-center gap-1 text-[13px]">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{ color: "#6E6E73" }}
            >
              Portföy
            </Link>
            <span style={{ color: "#D1D1D6" }}>/</span>
            <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ color: "#1D1D1F" }}>
              Stratejiler
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-apple-greenBg">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-green" />
            <span className="text-[11px] font-medium text-apple-green">Canlı</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-[12px] text-apple-secondary hover:text-apple-label transition-colors px-2 py-1 rounded-lg hover:bg-black/5"
          >
            Çıkış
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* Başlık */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-[12px] flex items-center justify-center"
              style={{ background: "#EEF0FF" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3h18v18H3z" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
              </svg>
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-apple-label">
              MSCI Stratejileri
            </h1>
          </div>
          <p className="text-[14px] text-apple-secondary ml-12">
            MSCI EM Rebalancing • ATVR Tarayıcı • Matriks IQ Algoritması
          </p>
        </div>

        {/* Tab Seçici */}
        <div
          className="flex gap-1 p-1 rounded-[14px] mb-6 w-fit"
          style={{ background: "#E5E5EA" }}
        >
          {[
            { id: "flow", label: "Akış Diyagramı", icon: "⚡" },
            { id: "python", label: "Python Tarayıcı", icon: "🐍" },
            { id: "csharp", label: "Matriks IQ (C#)", icon: "⚙️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "#FFFFFF" : "transparent",
                color: activeTab === tab.id ? "#1D1D1F" : "#6E6E73",
                boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Akış Diyagramı ─────────────────────────────────────────── */}
        {activeTab === "flow" && (
          <div className="space-y-5">
            {/* Strateji özeti kartı */}
            <div
              className="rounded-[20px] p-6"
              style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.05)" }}
            >
              <h2 className="text-[17px] font-bold text-apple-label mb-1">Strateji Özeti</h2>
              <p className="text-[13px] text-apple-secondary mb-5">
                MSCI Emerging Markets yarı-yıllık endeks revizyonuna giriş adayı hisseleri tespit ederek,
                duyuru öncesinde momentum-onaylı alım pozisyonu açar ve rebalancing günü çıkar.
              </p>

              {/* Puan bileşenleri */}
              <div className="space-y-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#AEAEB2" }}>
                  Bileşik Skor (0–100)
                </p>
                {SCORE_COMPONENTS.map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px]" style={{ color: "#1D1D1F" }}>{c.label}</span>
                      <span className="text-[12px] font-semibold" style={{ color: c.color }}>
                        {c.max} puan
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "#F2F2F7" }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{ background: c.color, width: `${c.max}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Eşik kartları */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  { label: "ATVR Eşiği", value: "≥ %15", sub: "MSCI EM minimum", color: "#0A84FF" },
                  { label: "Float MCAP", value: "$160M+", sub: "Global Min Size", color: "#5856D6" },
                  { label: "Alım Penceresi", value: "−15 gün", sub: "Duyuru öncesi", color: "#FF9500" },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-[14px] p-4 text-center"
                    style={{ background: "#F5F5F7" }}
                  >
                    <p className="text-[22px] font-bold mb-0.5" style={{ color: card.color }}>
                      {card.value}
                    </p>
                    <p className="text-[12px] font-semibold text-apple-label">{card.label}</p>
                    <p className="text-[11px] text-apple-secondary mt-0.5">{card.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Akış adımları */}
            <div
              className="rounded-[20px] p-6"
              style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.05)" }}
            >
              <h2 className="text-[17px] font-bold text-apple-label mb-5">Algoritma Akışı</h2>
              <div className="relative">
                {/* Dikey çizgi */}
                <div
                  className="absolute left-[21px] top-0 bottom-0 w-px"
                  style={{ background: "rgba(0,0,0,0.06)" }}
                />
                <div className="space-y-5">
                  {FLOW_STEPS.map((s, idx) => (
                    <div key={s.step} className="flex gap-4 relative">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 z-10"
                        style={{ background: s.color, color: "#FFFFFF" }}
                      >
                        {s.step}
                      </div>
                      <div className="pt-2.5">
                        <p className="text-[14px] font-semibold text-apple-label">{s.title}</p>
                        <p className="text-[13px] text-apple-secondary mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Python ─────────────────────────────────────────────────── */}
        {activeTab === "python" && (
          <div className="space-y-5">
            {/* Bilgi kartları */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  title: "ATVR Formülü",
                  body: "Medyan Günlük Hacim (63 gün) × 252 / Float MCAP × 100",
                  icon: "∑",
                  color: "#0A84FF",
                  bg: "#E5F3FF",
                },
                {
                  title: "Veri Gereksinimleri",
                  body: "Günlük TL hacim (min. 63 gün), Float MCAP, Free Float Oranı, Fiyat, MA50",
                  icon: "📊",
                  color: "#5856D6",
                  bg: "#EEECFF",
                },
                {
                  title: "Çıktı",
                  body: "HIGH / MEDIUM / LOW sinyal + 0-100 bileşik skor + sinyal açıklamaları",
                  icon: "🎯",
                  color: "#30D158",
                  bg: "#E3F9E9",
                },
                {
                  title: "Bağımlılıklar",
                  body: "Python 3.9+ · pandas · statistics (standart kütüphane)",
                  icon: "📦",
                  color: "#FF9F0A",
                  bg: "#FFF4E0",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[16px] p-4"
                  style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[14px]"
                      style={{ background: card.bg, color: card.color }}
                    >
                      {card.icon}
                    </div>
                    <span className="text-[13px] font-semibold text-apple-label">{card.title}</span>
                  </div>
                  <p className="text-[12.5px] text-apple-secondary leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>

            <CodeBlock code={PYTHON_CODE} language="python" title="msci_atvr.py" />
          </div>
        )}

        {/* ── TAB: C# Matriks ──────────────────────────────────────────────── */}
        {activeTab === "csharp" && (
          <div className="space-y-5">
            {/* Kurulum adımları */}
            <div
              className="rounded-[20px] p-6"
              style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.05)" }}
            >
              <h2 className="text-[17px] font-bold text-apple-label mb-4">Matriks IQ Kurulum</h2>
              <div className="space-y-3">
                {[
                  { num: "1", text: "Matriks IQ'yu açın → Araçlar menüsü" },
                  { num: "2", text: "Strateji Editörü → Yeni Strateji seçin" },
                  { num: "3", text: "Aşağıdaki kodu editöre yapıştırın" },
                  { num: "4", text: "Derle → Hata yoksa 'Stratejiye Ekle' tıklayın" },
                  { num: "5", text: "Parametreleri (Duyuru Tarihi, Lot vb.) UI'dan ayarlayın" },
                  { num: "6", text: "MSCI Sinyali alanına Python tarayıcısının çıktısını girin (HIGH/MEDIUM/LOW)" },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                      style={{ background: "#5856D6", color: "#FFFFFF" }}
                    >
                      {step.num}
                    </div>
                    <p className="text-[13.5px] text-apple-label">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Parametreler tablosu */}
            <div
              className="rounded-[20px] overflow-hidden"
              style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.05)" }}
            >
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-[17px] font-bold text-apple-label">Parametreler</h2>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: "#F5F5F7" }}>
                    <th className="text-left px-6 py-2.5 font-semibold" style={{ color: "#AEAEB2" }}>Parametre</th>
                    <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#AEAEB2" }}>Varsayılan</th>
                    <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#AEAEB2" }}>Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "MaPeriod", def: "50", desc: "Hareketli ortalama periyodu (gün)" },
                    { name: "DaysBeforeAnnouncement", def: "15", desc: "Duyurudan kaç iş günü önce alım yapılsın" },
                    { name: "LotSize", def: "100", desc: "Her işlemde alım/satım lot sayısı" },
                    { name: "AnnouncementDateStr", def: "2026-05-30", desc: "MSCI duyuru tarihi (YYYY-MM-DD)" },
                    { name: "RebalancingDateStr", def: "2026-06-02", desc: "Endeks uygulanma tarihi" },
                    { name: "MsciSignal", def: "HIGH", desc: "Python tarayıcısından gelen sinyal" },
                  ].map((row, i) => (
                    <tr
                      key={row.name}
                      style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}
                    >
                      <td className="px-6 py-3 font-mono text-[12px]" style={{ color: "#5856D6" }}>{row.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "#FF9F0A" }}>{row.def}</td>
                      <td className="px-4 py-3" style={{ color: "#6E6E73" }}>{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <CodeBlock code={CSHARP_CODE} language="csharp" title="matriks_iq_msci.cs" />
          </div>
        )}
      </main>
    </div>
  );
}
