"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { fetchHistory } from "@/lib/api";
import AnalysisModal from "@/components/ui/AnalysisModal";

const INTERVALS = ["1min", "5min", "15min", "1h", "1day", "1week"];

interface Props {
  defaultSymbol: string;
  symbols: string[];
}

interface ForecastPrediction {
  date: string;
  price: number;
  lower: number;
  upper: number;
  change_pct: number;
}

interface ForecastData {
  symbol: string;
  last_close: number;
  predictions: ForecastPrediction[];
  mae: number | null;
  training_days: number;
}

const SYMBOL_META: Record<string, { name: string; color: string }> = {
  "XAU/USD": { name: "Altın", color: "#FF9500" },
  "USD/CHF": { name: "Swiss Franc", color: "#FF3B30" },
  MRVL: { name: "Marvell", color: "#5856D6" },
  AVGO: { name: "Broadcom", color: "#34C759" },
  ASELS: { name: "Aselsan", color: "#0A84FF" },
  YEOTK: { name: "Yeo Teknoloji", color: "#FF9F0A" },
  KONTR: { name: "Kontrolmatik", color: "#30D158" },
};

export default function ChartPanel({ defaultSymbol, symbols }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState("1day");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const containerWidth = chartRef.current.getBoundingClientRect().width || chartRef.current.offsetWidth || 600;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#6E6E73",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.04)" },
        horzLines: { color: "rgba(0,0,0,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(0,0,0,0.2)", width: 1 },
        horzLine: { color: "rgba(0,0,0,0.2)", width: 1 },
      },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.06)" },
      timeScale: { borderColor: "rgba(0,0,0,0.06)", timeVisible: true, secondsVisible: false },
      autoSize: true,
      width: containerWidth,
      height: 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34C759",
      downColor: "#FF3B30",
      borderUpColor: "#34C759",
      borderDownColor: "#FF3B30",
      wickUpColor: "#34C759",
      wickDownColor: "#FF3B30",
    });

    setLoading(true);
    setError(null);
    setForecast(null);
    setForecastError(null);

    fetchHistory(symbol, interval, 200)
      .then((data) => {
        candleSeries.setData(
          data.map((d) => ({
            time: d.time as any,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        );

        // fitContent'i bir sonraki frame'e ertele (layout hesaplanmış olsun)
        requestAnimationFrame(() => chart.timeScale().fitContent());
      })
      .catch((err) => {
        setError("Veri yüklenemedi. API limiti aşılmış olabilir.");
        console.error(err);
      })
      .finally(() => setLoading(false));

    const handleResize = () => {
      if (chartRef.current)
        chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, interval]);

  const meta = SYMBOL_META[symbol] ?? { name: symbol, color: "#007AFF" };

  return (
    <div className="bg-white rounded-apple p-5 shadow-apple">
      {/* Üst kontroller */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 bg-apple-bg rounded-[10px] p-1">
          {symbols.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className="transition-all px-3 py-1.5 rounded-lg text-[13px] font-medium"
              style={{
                background: symbol === s ? "#FFFFFF" : "transparent",
                color: symbol === s ? "#1D1D1F" : "#6E6E73",
                boxShadow: symbol === s ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={{
                background: interval === iv ? "#007AFF" : "transparent",
                color: interval === iv ? "#FFFFFF" : "#6E6E73",
              }}
            >
              {iv}
            </button>
          ))}
        </div>

        {/* Butonlar */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setForecast(null);
              setForecastError(null);
              setForecastLoading(true);
              fetch(`/api/forecast/${encodeURIComponent(symbol)}?days=3`)
                .then(r => r.json())
                .then(d => {
                  if (d.error) throw new Error(d.error);
                  setForecast(d);
                })
                .catch(e => setForecastError(e.message))
                .finally(() => setForecastLoading(false));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all"
            style={{ background: forecastLoading ? "#E5E5EA" : "#5856D6", color: "#FFFFFF" }}
          >
            {forecastLoading ? (
              <div className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: "#fff", borderTopColor: "transparent" }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 18l5-5 4 4 9-9" />
              </svg>
            )}
            3 Günlük Tahmin
          </button>

          <button
            onClick={() => setShowSummary(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold"
            style={{ background: "#F5F5F7", color: "#1D1D1F" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            Günlük Özet
          </button>
        </div>
      </div>

      {/* Grafik alanı */}
      <div className="relative rounded-[10px] overflow-hidden" style={{ background: "#FAFAFA" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <div
              className="w-7 h-7 rounded-full border-2 animate-spin"
              style={{ borderColor: "#007AFF", borderTopColor: "transparent" }}
            />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-[13px] text-apple-secondary">{error}</p>
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>

      {/* Forecast Kartları */}
      {forecastError && (
        <div className="mt-4 p-3 rounded-[12px] text-[13px]" style={{ background: "#FFECEC", color: "#FF3B30" }}>
          {forecastError}
        </div>
      )}
      {forecast && !forecastError && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold" style={{ color: "#6E6E73" }}>
              AI TAHMİN · Prophet Model · {forecast.training_days} gün verisi
              {forecast.mae != null && ` · MAE ${forecast.mae.toFixed(2)}`}
            </p>
            <button onClick={() => setForecast(null)} className="text-[11px]" style={{ color: "#AEAEB2" }}>Kapat ✕</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {forecast.predictions.map((p) => (
              <div
                key={p.date}
                className="rounded-[14px] p-3"
                style={{
                  background: p.change_pct >= 0 ? "#E3F9E9" : "#FFECEC",
                  border: `0.5px solid ${p.change_pct >= 0 ? "#34C75930" : "#FF3B3030"}`
                }}
              >
                <p className="text-[11px] font-medium mb-1" style={{ color: "#6E6E73" }}>
                  {new Date(p.date + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="text-[16px] font-bold" style={{ color: "#1D1D1F" }}>
                  {p.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
                <p className="text-[12px] font-semibold mt-0.5" style={{ color: p.change_pct >= 0 ? "#34C759" : "#FF3B30" }}>
                  {p.change_pct >= 0 ? "+" : ""}{p.change_pct.toFixed(2)}%
                </p>
                <p className="text-[10px] mt-1" style={{ color: "#AEAEB2" }}>
                  {p.lower.toLocaleString("en-US", { maximumFractionDigits: 2 })} – {p.upper.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Günlük Özet Modal */}
      {showSummary && (
        <AnalysisModal
          symbol={symbol}
          name={meta.name}
          color={meta.color}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
