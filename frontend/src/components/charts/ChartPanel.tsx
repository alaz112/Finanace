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
        background: { type: ColorType.Solid, color: "#161B22" },
        textColor: "#8B949E",
      },
      grid: {
        vertLines: { color: "#30363D" },
        horzLines: { color: "#30363D" },
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
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Sembol seçici */}
        <div className="flex gap-1">
          {symbols.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                symbol === s
                  ? "bg-brand-gold text-black font-bold"
                  : "bg-brand-bg text-brand-muted hover:text-brand-text border border-brand-border"
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
              className={`px-2 py-1 rounded text-xs transition-colors ${
                interval === iv
                  ? "bg-brand-green text-black font-bold"
                  : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-surface/80 z-10 rounded-lg">
            <span className="text-brand-muted text-sm animate-pulse">Yükleniyor...</span>
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
}
