"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { fetchHistory } from "@/lib/api";

const INTERVALS = ["1min", "5min", "15min", "1h", "1day", "1week"];

interface Props {
  defaultSymbol: string;
  symbols: string[];
}

export default function ChartPanel({ defaultSymbol, symbols }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [interval, setInterval] = useState("1day");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#6B7280",
      },
      grid: {
        vertLines: { color: "#F3F4F6" },
        horzLines: { color: "#F3F4F6" },
      },
      width: chartRef.current.clientWidth,
      height: 480,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#3FB950",
      downColor: "#F85149",
      borderUpColor: "#3FB950",
      borderDownColor: "#F85149",
      wickUpColor: "#3FB950",
      wickDownColor: "#F85149",
    });

    setLoading(true);
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
      .catch(console.error)
      .finally(() => setLoading(false));

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, interval]);

  return (
    <div className="bg-fin-white border border-fin-border rounded-2xl p-6 shadow-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Sembol seçici */}
        <div className="flex gap-1 bg-fin-bg rounded-xl p-1">
          {symbols.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                symbol === s
                  ? "bg-fin-white shadow-card text-fin-text"
                  : "text-fin-muted hover:text-fin-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Interval seçici */}
        <div className="flex gap-1 ml-auto">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                interval === iv
                  ? "bg-fin-blue text-white"
                  : "text-fin-muted hover:text-fin-text hover:bg-fin-bg"
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative rounded-xl overflow-hidden border border-fin-border">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="w-6 h-6 border-2 border-fin-blue border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
}
