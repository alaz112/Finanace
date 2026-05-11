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
      rightPriceScale: {
        borderColor: "rgba(0,0,0,0.06)",
      },
      timeScale: {
        borderColor: "rgba(0,0,0,0.06)",
        timeVisible: true,
      },
      width: chartRef.current.clientWidth,
      height: 440,
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
    <div className="bg-white rounded-apple p-5 shadow-apple">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Sembol seçici */}
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

        {/* Interval seçici */}
        <div className="flex gap-1 ml-auto">
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
      </div>

      {/* Chart */}
      <div className="relative rounded-[10px] overflow-hidden" style={{ background: "#FAFAFA" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#007AFF", borderTopColor: "transparent" }}
            />
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
}

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
