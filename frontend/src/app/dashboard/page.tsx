import AssetCard from "@/components/ui/AssetCard";
import ChartPanel from "@/components/charts/ChartPanel";

const SYMBOLS = ["XAU/USD", "USD/CHF", "MRVL", "AVGO"];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-brand-bg p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Finance Tracker</h1>
          <p className="text-sm text-brand-muted mt-1">Anlık piyasa takibi</p>
        </div>
        <div className="flex gap-2">
          {SYMBOLS.map((s) => (
            <span key={s} className="px-3 py-1 rounded-full text-xs bg-brand-surface border border-brand-border text-brand-muted">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Asset Cards — fiyat özeti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {SYMBOLS.map((symbol) => (
          <AssetCard key={symbol} symbol={symbol} />
        ))}
      </div>

      {/* Ana Grafik Paneli */}
      <ChartPanel defaultSymbol="XAU/USD" symbols={SYMBOLS} />
    </main>
  );
}
