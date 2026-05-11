"use client";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";

const META: Record<string, { name: string; sub: string; color: string; bg: string }> = {
  "XAU/USD": { name: "Altın",      sub: "XAU/USD",  color: "#FF9500", bg: "#FFF9F0" },
  "USD/CHF": { name: "Swiss Franc", sub: "USD/CHF",  color: "#007AFF", bg: "#F0F8FF" },
  MRVL:      { name: "Marvell",     sub: "NASDAQ",   color: "#5856D6", bg: "#F5F4FF" },
  AVGO:      { name: "Broadcom",    sub: "NASDAQ",   color: "#34C759", bg: "#F0FFF4" },
};

export default function AssetCard({ symbol }: { symbol: string }) {
  const { price, direction } = useRealtimePrice(symbol);
  const meta = META[symbol] ?? { name: symbol, sub: "", color: "#007AFF", bg: "#F0F8FF" };

  const isUp   = direction === "up";
  const isDown = direction === "down";

  return (
    <div className="bg-white rounded-apple p-4 shadow-apple hover:shadow-apple-md transition-shadow duration-300">
      {/* İkon + sembol satırı */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[18px] font-bold"
          style={{ background: meta.bg, color: meta.color }}
        >
          {symbol === "XAU/USD" ? "🥇" : symbol === "USD/CHF" ? "🇨🇭" : symbol[0]}
        </div>
        {direction !== "neutral" && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: isUp ? "#34C759" : "#FF3B30",
              background: isUp ? "#F0FFF4" : "#FFF5F5",
            }}
          >
            {isUp ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* İsim */}
      <p className="text-[12px] text-apple-secondary mb-0.5">{meta.sub}</p>
      <p className="text-[14px] font-semibold text-apple-label mb-2">{meta.name}</p>

      {/* Fiyat */}
      <div
        className="num text-[22px] font-bold tracking-tight"
        style={{
          color: isUp ? "#34C759" : isDown ? "#FF3B30" : "#1D1D1F",
        }}
      >
        {price !== null ? (
          price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
        ) : (
          <div className="h-7 w-24 rounded-lg bg-gray-100 animate-pulse" />
        )}
      </div>
    </div>
  );
}
