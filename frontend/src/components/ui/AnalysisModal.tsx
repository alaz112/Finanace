"use client";
import { useEffect, useState } from "react";

interface AnalysisData {
  symbol: string;
  name: string;
  change5d: number;
  currentPrice: number;
  headlines: string[];
  analysis: string;
}

interface Props {
  symbol: string;
  name: string;
  color: string;
  onClose: () => void;
}

export default function AnalysisModal({ symbol, name, color, onClose }: Props) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/analysis/${encodeURIComponent(symbol)}`)
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((d: AnalysisData) => {
        if ("error" in d) throw new Error((d as any).error);
        setData(d);
      })
      .catch((e) => setError(e.message ?? "Analiz yüklenemedi."))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Escape tuşu ile kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Body scroll kilitle
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const isUp = (data?.change5d ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] overflow-hidden"
        style={{
          boxShadow: "0 -4px 40px rgba(0,0,0,0.15)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sticky header */}
        <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
          {/* iOS drag handle */}
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4 sm:hidden" />

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-bold tracking-tight" style={{ color: "#1D1D1F" }}>
                {name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px]" style={{ color: "#6E6E73" }}>{symbol}</span>
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: "linear-gradient(135deg, #007AFF20, #5856D620)",
                    color: "#5856D6",
                  }}
                >
                  GPT-4o
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "#F5F5F7" }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#6E6E73" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l9 9M10 1L1 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div
                className="w-9 h-9 rounded-full border-2 animate-spin"
                style={{ borderColor: color, borderTopColor: "transparent" }}
              />
              <p className="text-[13px]" style={{ color: "#6E6E73" }}>
                Haberler ve fiyatlar analiz ediliyor...
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p className="text-[14px] text-center" style={{ color: "#6E6E73" }}>{error}</p>
            </div>
          )}

          {/* Content */}
          {data && !loading && (
            <>
              {/* 5-day change */}
              <div
                className="flex items-center justify-between rounded-[16px] px-4 py-3"
                style={{
                  background: isUp ? "#E3F9E9" : "#FFECEC",
                  border: `0.5px solid ${isUp ? "#34C75930" : "#FF3B3030"}`,
                }}
              >
                <div>
                  <p className="text-[12px] font-medium" style={{ color: isUp ? "#1D8B3E" : "#C0392B" }}>
                    5 Günlük Değişim
                  </p>
                  <p className="text-[24px] font-bold" style={{ color: isUp ? "#34C759" : "#FF3B30" }}>
                    {isUp ? "+" : ""}{data.change5d}%
                  </p>
                </div>
                <div style={{ color: isUp ? "#34C759" : "#FF3B30" }}>
                  {isUp ? (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 6l-9.5 9.5-5-5L1 18" />
                      <path d="M17 6h6v6" />
                    </svg>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 18l-9.5-9.5-5 5L1 6" />
                      <path d="M17 18h6v-6" />
                    </svg>
                  )}
                </div>
              </div>

              {/* AI Analysis */}
              <div className="rounded-[16px] p-4" style={{ background: "#F5F5F7" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: color + "20" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#AEAEB2" }}>
                    AI Analiz
                  </p>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: "#1D1D1F" }}>
                  {data.analysis}
                </p>
              </div>

              {/* News */}
              {data.headlines.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#AEAEB2" }}>
                    Son Haberler
                  </p>
                  <div className="space-y-2">
                    {data.headlines.map((h, i) => (
                      <div
                        key={i}
                        className="flex gap-3 items-start rounded-[12px] p-3"
                        style={{ background: "#FAFAFA", border: "0.5px solid rgba(0,0,0,0.06)" }}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                          style={{ background: color + "18", color }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-[13px] leading-snug" style={{ color: "#1D1D1F" }}>{h}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
