import AssetCard from "@/components/ui/AssetCard";
import ChartPanel from "@/components/charts/ChartPanel";

const SYMBOLS = ["XAU/USD", "USD/CHF", "MRVL", "AVGO"];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-fin-bg">
      {/* Top Nav */}
      <nav className="bg-fin-white border-b border-fin-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-fin-blue flex items-center justify-center">
            <span className="text-white text-sm font-bold">F</span>
          </div>
          <span className="font-semibold text-fin-text text-lg">Finance Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-fin-green animate-pulse"></div>
          <span className="text-xs text-fin-muted font-medium">Canlı</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Sayfa başlığı */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fin-text">Portföy Takibi</h1>
          <p className="text-sm text-fin-muted mt-1">Anlık fiyatlar ve teknik analiz</p>
        </div>

        {/* Asset Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {SYMBOLS.map((symbol) => (
            <AssetCard key={symbol} symbol={symbol} />
          ))}
        </div>

        {/* Grafik */}
        <ChartPanel defaultSymbol="XAU/USD" symbols={SYMBOLS} />
      </main>
    </div>
  );
}
