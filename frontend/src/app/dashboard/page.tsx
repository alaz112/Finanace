"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AssetCard from "@/components/ui/AssetCard";
import ChartPanel from "@/components/charts/ChartPanel";

const SYMBOLS = ["XAU/USD", "USD/CHF", "MRVL", "AVGO"];

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem("auth") !== "1") {
      router.replace("/login");
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("auth");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-apple-bg">
      {/* Nav — macOS menu bar feel */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-apple-separator px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/kurtlogo.png" alt="Logo" className="h-12 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-apple-greenBg">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-green"></span>
            <span className="text-[11px] font-medium text-apple-green">Canlı</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-[12px] text-apple-secondary hover:text-apple-label transition-colors px-2 py-1 rounded-lg hover:bg-black/5"
          >
            Çıkış
          </button>
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
