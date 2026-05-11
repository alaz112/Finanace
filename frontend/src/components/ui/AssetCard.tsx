"use client";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";

const LABELS: Record<string, string> = {
  "XAU/USD": "Gold",
  "USD/CHF": "Swiss Franc",
  MRVL: "Marvell",
  AVGO: "Broadcom",
};

export default function AssetCard({ symbol }: { symbol: string }) {
  const { price, direction } = useRealtimePrice(symbol);

  const priceColor =
    direction === "up" ? "text-brand-green" :
    direction === "down" ? "text-brand-red" :
    "text-brand-text";

  const arrow =
    direction === "up" ? "▲" :
    direction === "down" ? "▼" : "";

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-gold transition-colors">
      <div className="text-xs text-brand-muted mb-1">{symbol}</div>
      <div className="text-sm font-semibold text-brand-text mb-2">{LABELS[symbol] ?? symbol}</div>
      <div className={`text-xl font-mono font-bold ${priceColor}`}>
        {price !== null ? (
          <>
            <span className="text-sm mr-1">{arrow}</span>
            {price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </>
        ) : (
          <span className="text-brand-muted text-sm animate-pulse">Yükleniyor...</span>
        )}
      </div>
    </div>
  );
}
