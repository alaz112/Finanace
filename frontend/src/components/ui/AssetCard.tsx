"use client";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";

const META: Record<string, { label: string; icon: string; colorClass: string; bgClass: string }> = {
  "XAU/USD": { label: "Altın",        icon: "🥇", colorClass: "text-fin-gold",  bgClass: "bg-fin-goldBg" },
  "USD/CHF": { label: "Swiss Franc",  icon: "🇨🇭", colorClass: "text-fin-blue",  bgClass: "bg-fin-blueBg" },
  MRVL:      { label: "Marvell",       icon: "⚡", colorClass: "text-fin-blue",  bgClass: "bg-fin-blueBg" },
  AVGO:      { label: "Broadcom",      icon: "📡", colorClass: "text-fin-blue",  bgClass: "bg-fin-blueBg" },
};

export default function AssetCard({ symbol }: { symbol: string }) {
  const { price, direction } = useRealtimePrice(symbol);
  const meta = META[symbol] ?? { label: symbol, icon: "📈", colorClass: "text-fin-text", bgClass: "bg-fin-bg" };

  const isUp   = direction === "up";
  const isDown = direction === "down";

  return (
    <div className="bg-fin-white border border-fin-border rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow cursor-pointer group">
      {/* Üst satır */}
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${meta.bgClass} flex items-center justify-center text-lg`}>
          {meta.icon}
        </div>
        {direction !== "neutral" && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            isUp ? "bg-fin-greenBg text-fin-green" : "bg-fin-redBg text-fin-red"
          }`}>
            {isUp ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* İsim & sembol */}
      <div className="mb-2">
        <p className="text-xs text-fin-muted font-medium">{symbol}</p>
        <p className="text-sm font-semibold text-fin-text">{meta.label}</p>
      </div>

      {/* Fiyat */}
      <div className={`text-2xl font-bold font-mono ${
        isUp ? "text-fin-green" : isDown ? "text-fin-red" : "text-fin-text"
      }`}>
        {price !== null ? (
          price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
        ) : (
          <div className="h-7 w-28 bg-fin-border rounded animate-pulse" />
        )}
      </div>
    </div>
  );
}
