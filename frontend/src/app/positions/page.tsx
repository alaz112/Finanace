"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface StrategyRow {
  id: number;
  category: string;
  category_pct: number;
  symbols: string;    // comma-separated "NVDA,SMH"
  amount_usd: number;
  broker: string;
}

/* Each symbol inside a strategy row is a "slot" */
interface Slot {
  rowId: number;
  category: string;
  category_pct: number;
  broker: string;
  symbol: string;
  allocated: number;    // amount_usd / num_symbols
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const ENTRY_KEY = "strategy_entry_prices"; // localStorage

function loadEntryPrices(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ENTRY_KEY) ?? "{}"); } catch { return {}; }
}
function saveEntryPrices(ep: Record<string, number>) {
  localStorage.setItem(ENTRY_KEY, JSON.stringify(ep));
}

function symbolColor(sym: string): string {
  const C = ["#FF9500","#FF3B30","#5856D6","#34C759","#0A84FF","#FF9F0A","#30D158","#64D2FF","#BF5AF2","#FF6B6B"];
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h);
  return C[Math.abs(h) % C.length];
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function Badge({ symbol, size = 30 }: { symbol: string; size?: number }) {
  const c = symbolColor(symbol);
  const l = symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center justify-center rounded-[7px] shrink-0 font-bold"
      style={{ width: size, height: size, background: c + "22", color: c, fontSize: size * 0.38, border: `1px solid ${c}44` }}>
      {l}
    </div>
  );
}

const CAT_COLOR: Record<string, string> = {
  Safe: "#30D158", Growth: "#0A84FF", Extreme: "#FF9F0A",
};

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function PositionsPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>({});
  const [loadingPrices, setLoadingPrices] = useState<Record<string, boolean>>({});
  const [entryPrices, setEntryPrices] = useState<Record<string, number>>({});
  const totalCapital = 5000;

  /* ── Auth ── */
  useEffect(() => {
    if (sessionStorage.getItem("auth") !== "1") router.replace("/login");
  }, [router]);

  /* ── Load entry prices ── */
  useEffect(() => { setEntryPrices(loadEntryPrices()); }, []);

  /* ── Fetch strategy rows ── */
  useEffect(() => {
    fetch("/api/strategy")
      .then(r => r.json())
      .then(d => {
        const rows: StrategyRow[] = d.rows ?? [];
        const built: Slot[] = [];
        for (const row of rows) {
          const syms = row.symbols.split(",").map((s: string) => s.trim());
          const alloc = Number(row.amount_usd) / syms.length;
          for (const sym of syms) {
            built.push({
              rowId: row.id,
              category: row.category,
              category_pct: row.category_pct,
              broker: row.broker,
              symbol: sym,
              allocated: alloc,
            });
          }
        }
        setSlots(built);
      })
      .catch(() => {});
  }, []);

  /* ── Fetch live prices ── */
  const fetchLivePrices = useCallback(async () => {
    if (!slots.length) return;
    const syms = Array.from(new Set(slots.map(s => s.symbol)));
    const updates: Record<string, boolean> = {};
    syms.forEach(s => (updates[s] = true));
    setLoadingPrices(updates);
    await Promise.all(syms.map(async sym => {
      try {
        const res = await fetch(`/api/price/${encodeURIComponent(sym)}`);
        const data = await res.json();
        const p = parseFloat(data.price);
        setLivePrices(prev => ({ ...prev, [sym]: isNaN(p) ? null : p }));
      } catch {
        setLivePrices(prev => ({ ...prev, [sym]: null }));
      } finally {
        setLoadingPrices(prev => ({ ...prev, [sym]: false }));
      }
    }));
  }, [slots]);

  useEffect(() => {
    fetchLivePrices();
    const id = setInterval(fetchLivePrices, 30_000);
    return () => clearInterval(id);
  }, [fetchLivePrices]);

  /* ── Auto-save live price as entry if not yet set ── */
  useEffect(() => {
    if (!slots.length) return;
    const ep = loadEntryPrices();
    let changed = false;
    for (const [sym, price] of Object.entries(livePrices)) {
      if (price !== null && ep[sym] === undefined) {
        ep[sym] = price;
        changed = true;
      }
    }
    if (changed) {
      setEntryPrices({ ...ep });
      saveEntryPrices(ep);
    }
  }, [livePrices, slots]);

  function resetEntryPrices() {
    localStorage.removeItem(ENTRY_KEY);
    setEntryPrices({});
  }

  /* ── Totals ── */
  let totalAllocated = 0, totalCurrentValue = 0, totalPnl = 0;
  slots.forEach(slot => {
    const ep = entryPrices[slot.symbol];
    const lp = livePrices[slot.symbol];
    totalAllocated += slot.allocated;
    if (ep && lp) {
      const lot = slot.allocated / ep;
      const val = lot * lp;
      totalCurrentValue += val;
      totalPnl += val - slot.allocated;
    } else {
      totalCurrentValue += slot.allocated;
    }
  });
  const totalPnlPct = totalAllocated > 0 ? (totalPnl / totalAllocated) * 100 : 0;
  const portfValue = (totalCapital - totalAllocated) + totalCurrentValue;
  const portfPnlPct = (portfValue - totalCapital) / totalCapital * 100;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between px-5 h-13"
        style={{ background: "rgba(10,10,10,0.92)", backdropFilter: "blur(20px)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-4">
          <img src="/kurtlogo.png" alt="Logo" className="h-10 w-auto" />
          <div className="flex items-center gap-1 text-[13px]">
            <Link href="/dashboard" className="px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "#636366" }}>Portföy</Link>
            <span style={{ color: "#3A3A3C" }}>/</span>
            <span className="px-2 py-1 font-semibold" style={{ color: "#E5E5EA" }}>Pozisyonlar</span>
          </div>
        </div>
        <button onClick={() => { sessionStorage.removeItem("auth"); router.replace("/login"); }}
          className="text-[12px] px-2 py-1 rounded-md hover:bg-white/5" style={{ color: "#636366" }}>
          Çıkış
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {/* ── Özet Kartlar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Başlangıç Sermaye", value: `$${fmt(totalCapital)}`, sub: "USD", color: "#636366" },
            { label: "Portföy Değeri",    value: `$${fmt(portfValue)}`,   sub: (portfPnlPct >= 0 ? "+" : "") + fmt(portfPnlPct) + "%", color: portfPnlPct >= 0 ? "#30D158" : "#FF453A" },
            { label: "Yatırılan",         value: `$${fmt(totalAllocated)}`, sub: "pozisyonlara", color: "#636366" },
            { label: "Toplam K/Z",        value: (totalPnl >= 0 ? "+" : "") + `$${fmt(Math.abs(totalPnl))}`, sub: (totalPnlPct >= 0 ? "+" : "") + fmt(totalPnlPct) + "%", color: totalPnl >= 0 ? "#30D158" : "#FF453A" },
          ].map(card => (
            <div key={card.label} className="rounded-[14px] px-4 py-4"
              style={{ background: "#1C1C1E", border: "0.5px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: "#636366" }}>{card.label}</p>
              <p className="text-[20px] font-bold" style={{ color: "#E5E5EA" }}>{card.value}</p>
              <p className="text-[12px] font-semibold mt-0.5" style={{ color: card.color }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Sıfırla ── */}
        <div className="flex justify-end">
          <button onClick={resetEntryPrices}
            className="text-[12px] px-3 py-1.5 rounded-[8px] hover:opacity-80 transition-opacity"
            style={{ background: "rgba(255,69,58,0.1)", color: "#FF453A", border: "0.5px solid rgba(255,69,58,0.25)" }}>
            ↺ Giriş fiyatlarını sıfırla
          </button>
        </div>

        {/* ── Ana Tablo ── */}
        {slots.length === 0 ? (
          <div className="rounded-[16px] py-12 text-center" style={{ background: "#1C1C1E" }}>
            <p style={{ color: "#48484A" }}>Strateji yükleniyor…</p>
          </div>
        ) : (
          <div className="rounded-[16px] overflow-hidden" style={{ border: "0.5px solid rgba(255,255,255,0.07)" }}>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr style={{ background: "#2C2C2E" }}>
                  {["Kategori", "Sembol", "Borsa", "Ayrılan", "Giriş Fiyatı", "Lot", "Anlık Fiyat", "K / Z"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => {
                  const ep = entryPrices[slot.symbol];
                  const lp = livePrices[slot.symbol];
                  const loading = loadingPrices[slot.symbol];
                  const lot = ep ? slot.allocated / ep : null;
                  const currentVal = (lot !== null && lp) ? lot * lp : null;
                  const pnl = currentVal !== null ? currentVal - slot.allocated : null;
                  const pnlPct = pnl !== null ? (pnl / slot.allocated) * 100 : null;
                  const cc = CAT_COLOR[slot.category] ?? "#AEAEB2";
                  const key = slot.symbol;

                  return (
                    <tr key={`${slot.rowId}-${slot.symbol}`}
                      style={{ background: i % 2 === 0 ? "#141414" : "#1A1A1A", borderTop: "0.5px solid rgba(255,255,255,0.04)" }}>
                      {/* Kategori */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold"
                          style={{ background: cc + "18", color: cc, border: `0.5px solid ${cc}33` }}>
                          %{slot.category_pct} {slot.category}
                        </span>
                      </td>
                      {/* Sembol */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge symbol={slot.symbol} size={26} />
                          <span className="font-semibold" style={{ color: "#E5E5EA" }}>{slot.symbol}</span>
                        </div>
                      </td>
                      {/* Borsa */}
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#636366" }}>{slot.broker}</td>
                      {/* Ayrılan */}
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#AEAEB2" }}>${fmt(slot.allocated)}</td>
                      {/* Giriş Fiyatı — otomatik */}
                      <td className="px-4 py-3 font-mono text-[12px]" style={{ color: ep ? "#E5E5EA" : "#3A3A3C" }}>
                        {loading ? <span style={{ color: "#3A3A3C" }}>…</span> : ep ? `$${fmt(ep, 4)}` : "—"}
                      </td>
                      {/* Lot */}
                      <td className="px-4 py-3 font-mono" style={{ color: lot ? "#A29BFF" : "#3A3A3C" }}>
                        {lot ? fmt(lot, 4) : "—"}
                      </td>
                      {/* Anlık Fiyat */}
                      <td className="px-4 py-3 font-mono" style={{ color: "#E5E5EA" }}>
                        {loading ? <span style={{ color: "#3A3A3C" }}>…</span> : lp ? `$${fmt(lp, 4)}` : <span style={{ color: "#3A3A3C" }}>—</span>}
                      </td>
                      {/* K/Z */}
                      <td className="px-4 py-3">
                        {pnl !== null && pnlPct !== null ? (
                          <>
                            <p className="font-semibold font-mono text-[13px]" style={{ color: pnl >= 0 ? "#30D158" : "#FF453A" }}>
                              {pnl >= 0 ? "+" : ""}{fmt(pnl)} $
                            </p>
                            <p className="text-[11px] font-mono" style={{ color: pnl >= 0 ? "#30D158" : "#FF453A" }}>
                              {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%
                            </p>
                          </>
                        ) : (
                          <span className="text-[12px]" style={{ color: "#3A3A3C" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Toplam */}
              <tfoot>
                <tr style={{ background: "#2C2C2E", borderTop: "0.5px solid rgba(255,255,255,0.12)" }}>
                  <td colSpan={3} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>TOPLAM</td>
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#E5E5EA" }}>${fmt(totalAllocated)}</td>
                  <td colSpan={2} />
                  <td className="px-4 py-3">
                    <p className="font-bold font-mono" style={{ color: totalPnl >= 0 ? "#30D158" : "#FF453A" }}>
                      {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)} $
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: totalPnl >= 0 ? "#30D158" : "#FF453A" }}>
                      {totalPnlPct >= 0 ? "+" : ""}{fmt(totalPnlPct)}%
                    </p>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
