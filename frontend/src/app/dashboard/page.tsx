import AssetCard from "@/components/ui/AssetCard";
import ChartPanel from "@/components/charts/ChartPanel";

const SYMBOLS = ["XAU/USD", "USD/CHF", "MRVL", "AVGO"];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-apple-bg">
      {/* Nav — macOS menu bar feel */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-apple-separator px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-apple-blue flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L10 5H4L7 1Z" fill="white" />
              <path d="M2 8h10M5 8v4M9 8v4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-apple-label">Finance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-apple-greenBg">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-green"></span>
            <span className="text-[11px] font-medium text-apple-green">Canlı</span>
          </span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {/* Sayfa başlığı */}
        <div className="mb-7">
          <h1 className="text-[28px] font-bold tracking-tight text-apple-label">Portföy</h1>
          <p className="text-[14px] text-apple-secondary mt-0.5">Canlı fiyatlar • 15 saniyede güncellenir</p>
        </div>

        {/* Asset Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
