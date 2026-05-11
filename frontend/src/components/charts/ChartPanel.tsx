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

const SYMBOL_META: Record<string, { name: string; color: string }> = {
  "XAU/USD": { name: "Altın", color: "#FF9500" },
  "USD/CHF": { name: "Swiss Franc", color: "#FF3B30" },
  MRVL: { name: "Marvell", color: "#5856D6" },
  AVGO: { name: "Broadcom", color: "#34C759" },
};

export default function ChartPanel({ defaultSymbol, symbols }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState("1day");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!chartRef.current) return;

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
      timeScale: { borderColor: "rgba(0,0,0,0.06)", timeVisible: true },
      width: chartRef.current.clientWidth,
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

        chart.timeScale().fitContent();
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

        {/* Günlük Özet butonu */}
        <button
          onClick={() => setShowSummary(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold"
          style={{ background: "#F5F5F7", color: "#1D1D1F" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
          Günlük Özet
        </button>
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
