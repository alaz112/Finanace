"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Position {
  id: string;
  symbol: string;
  instrumentName: string;
  qty: number;
  buyPrice: number;
  buyDate: string;
  note: string;
}

interface LivePrice {
  price: number;
  loading: boolean;
  error: boolean;
}

interface SearchResult {
  symbol: string;
  instrument_name: string;
  exchange: string;
  instrument_type: string;
  currency: string;
}

const INITIAL_CAPITAL = 5000;
const STORAGE_KEY = "finance_positions_v2";

function symbolColor(sym: string): string {
  const COLORS = ["#FF9500","#FF3B30","#5856D6","#34C759","#0A84FF","#FF9F0A","#30D158","#64D2FF","#BF5AF2","#FF6B6B"];
  let hash = 0;
  for (let i = 0; i < sym.length; i++) hash = sym.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function SymbolBadge({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const color = symbolColor(symbol);
  const letters = symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center justify-center rounded-[8px] shrink-0 font-bold"
      style={{ width: size, height: size, background: color + "22", color, fontSize: size * 0.38, border: `1px solid ${color}44` }}>
      {letters}
    </div>
  );
}

export default function PositionsPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedLivePrice, setSelectedLivePrice] = useState<number | null>(null);
  const [fetchingLive, setFetchingLive] = useState(false);

  const [qty, setQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("auth") !== "1") router.replace("/login");
  }, [router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { setPositions(JSON.parse(raw)); return; }
      const old = localStorage.getItem("finance_positions_v1");
      if (old) {
        const parsed = JSON.parse(old) as (Position & { instrumentName?: string })[];
        setPositions(parsed.map(p => ({ ...p, instrumentName: p.instrumentName ?? p.symbol })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }, [positions]);

  const fetchPrices = useCallback(async () => {
    const used = Array.from(new Set(positions.map(p => p.symbol)));
    for (const sym of used) {
      setPrices(prev => ({ ...prev, [sym]: { price: prev[sym]?.price ?? 0, loading: true, error: false } }));
      try {
        const res = await fetch(`/api/price/${encodeURIComponent(sym)}`);
        const data = await res.json();
        setPrices(prev => ({ ...prev, [sym]: { price: parseFloat(data.price), loading: false, error: false } }));
      } catch {
        setPrices(prev => ({ ...prev, [sym]: { price: prev[sym]?.price ?? 0, loading: false, error: true } }));
      }
    }
  }, [positions]);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSearchResults((data.data ?? []).slice(0, 8));
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function selectSymbol(r: SearchResult) {
    setSelectedSymbol(r.symbol);
    setSelectedName(r.instrument_name);
    setQuery(r.symbol);
    setShowDropdown(false);
    setSelectedLivePrice(null);
    setFetchingLive(true);
    try {
      const res = await fetch(`/api/price/${encodeURIComponent(r.symbol)}`);
      const data = await res.json();
      const price = parseFloat(data.price);
      setSelectedLivePrice(isNaN(price) ? null : price);
      setBuyPrice(isNaN(price) ? "" : String(price));
    } catch {
      setSelectedLivePrice(null);
    } finally {
      setFetchingLive(false);
    }
  }

  function calcPosition(p: Position) {
    const livePrice = prices[p.symbol]?.price ?? 0;
    const cost = p.qty * p.buyPrice;
    const value = p.qty * livePrice;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { cost, value, pnl, pnlPct, livePrice };
  }

  const totalCost   = positions.reduce((s, p) => s + p.qty * p.buyPrice, 0);
  const totalValue  = positions.reduce((s, p) => s + (prices[p.symbol]?.price ?? p.buyPrice) * p.qty, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const cashLeft    = INITIAL_CAPITAL - totalCost;
  const portfValue  = cashLeft + totalValue;
  const portfPnl    = portfValue - INITIAL_CAPITAL;
  const portfPnlPct = (portfPnl / INITIAL_CAPITAL) * 100;

  function openAdd() {
    setEditId(null);
    setQuery(""); setSelectedSymbol(""); setSelectedName(""); setSelectedLivePrice(null);
    setQty(""); setBuyPrice(""); setBuyDate(new Date().toISOString().split("T")[0]); setNote("");
    setShowForm(true);
  }

  function openEdit(p: Position) {
    setEditId(p.id);
    setQuery(p.symbol); setSelectedSymbol(p.symbol); setSelectedName(p.instrumentName ?? p.symbol);
    setQty(String(p.qty)); setBuyPrice(String(p.buyPrice)); setBuyDate(p.buyDate); setNote(p.note);
    setSelectedLivePrice(prices[p.symbol]?.price ?? null);
    setShowForm(true);
  }

  function saveForm() {
    if (!selectedSymbol || !qty || !buyPrice) return;
    const pos: Position = {
      id: editId ?? uid(),
      symbol: selectedSymbol,
      instrumentName: selectedName || selectedSymbol,
      qty: parseFloat(qty),
      buyPrice: parseFloat(buyPrice),
      buyDate,
      note,
    };
    setPositions(prev => editId ? prev.map(p => p.id === editId ? pos : p) : [...prev, pos]);
    setShowForm(false);
  }

  function deletePos(id: string) {
    setPositions(prev => prev.filter(p => p.id !== id));
  }

  const cost2 = selectedSymbol && qty && buyPrice ? parseFloat(qty) * parseFloat(buyPrice) : 0;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      <nav className="sticky top-0 z-20 flex items-center justify-between px-5 h-13"
        style={{ background: "rgba(10,10,10,0.9)", backdropFilter: "blur(20px)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Başlangıç Sermaye", value: `$${fmt(INITIAL_CAPITAL)}`, sub: "USD", color: "#636366" },
            { label: "Portföy Değeri", value: `$${fmt(portfValue)}`, sub: portfPnlPct >= 0 ? `+${fmt(portfPnlPct)}%` : `${fmt(portfPnlPct)}%`, color: portfPnlPct >= 0 ? "#30D158" : "#FF453A" },
            { label: "Toplam Kâr/Zarar", value: (portfPnl >= 0 ? "+" : "") + `$${fmt(Math.abs(portfPnl))}`, sub: portfPnlPct >= 0 ? `+${fmt(portfPnlPct)}%` : `${fmt(portfPnlPct)}%`, color: portfPnl >= 0 ? "#30D158" : "#FF453A" },
            { label: "Nakit", value: `$${fmt(Math.max(cashLeft, 0))}`, sub: cashLeft < 0 ? "⚠️ Limit aşıldı" : "kullanılabilir", color: cashLeft < 0 ? "#FF9F0A" : "#636366" },
          ].map(card => (
            <div key={card.label} className="rounded-[14px] px-4 py-4"
              style={{ background: "#1C1C1E", border: "0.5px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: "#636366" }}>{card.label}</p>
              <p className="text-[20px] font-bold" style={{ color: "#E5E5EA" }}>{card.value}</p>
              <p className="text-[12px] font-semibold mt-0.5" style={{ color: card.color }}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold" style={{ color: "#E5E5EA" }}>
            Pozisyonlar
            <span className="ml-2 text-[12px] font-normal" style={{ color: "#636366" }}>{positions.length} işlem</span>
          </h2>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-semibold"
            style={{ background: "#5856D6", color: "#fff" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Pozisyon Ekle
          </button>
        </div>

        {positions.length === 0 ? (
          <div className="rounded-[16px] py-16 flex flex-col items-center gap-3"
            style={{ background: "#1C1C1E", border: "0.5px solid rgba(255,255,255,0.07)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3A3A3C" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <p className="text-[14px]" style={{ color: "#48484A" }}>Henüz pozisyon yok</p>
            <button onClick={openAdd} className="text-[12px] px-4 py-1.5 rounded-[8px]"
              style={{ background: "rgba(88,86,214,0.15)", color: "#A29BFF", border: "0.5px solid rgba(88,86,214,0.3)" }}>
              İlk pozisyonu ekle
            </button>
          </div>
        ) : (
          <div className="rounded-[16px] overflow-hidden" style={{ border: "0.5px solid rgba(255,255,255,0.07)" }}>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr style={{ background: "#2C2C2E" }}>
                  {["Sembol", "Adet", "Alış", "Anlık", "Maliyet", "Değer", "Kâr / Zarar", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => {
                  const { cost, value, pnl, pnlPct, livePrice } = calcPosition(p);
                  const isLoading = prices[p.symbol]?.loading;
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#141414" : "#1A1A1A", borderTop: "0.5px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <SymbolBadge symbol={p.symbol} size={30} />
                          <div>
                            <p className="font-semibold" style={{ color: "#E5E5EA" }}>{p.symbol}</p>
                            <p className="text-[10px]" style={{ color: "#636366" }}>{p.instrumentName ?? p.symbol}{p.note ? ` · ${p.note}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: "#E5E5EA" }}>{fmt(p.qty, 4).replace(/\.?0+$/, "")}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "#AEAEB2" }}>${fmt(p.buyPrice, 4)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "#E5E5EA" }}>
                        {isLoading ? <span style={{ color: "#3A3A3C" }}>…</span> : `$${fmt(livePrice, 4)}`}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: "#AEAEB2" }}>${fmt(cost)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "#E5E5EA" }}>${fmt(value)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold font-mono" style={{ color: pnl >= 0 ? "#30D158" : "#FF453A" }}>{pnl >= 0 ? "+" : ""}{fmt(pnl)} $</p>
                        <p className="text-[11px] font-mono" style={{ color: pnl >= 0 ? "#30D158" : "#FF453A" }}>{pnlPct >= 0 ? "+" : ""}{fmt(pnlPct)}%</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-white/10 transition-all">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2" strokeLinecap="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button onClick={() => deletePos(p.id)} className="p-1.5 rounded-md hover:bg-red-500/20 transition-all">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#2C2C2E", borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
                  <td className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>TOPLAM</td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#E5E5EA" }}>${fmt(totalCost)}</td>
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#E5E5EA" }}>${fmt(totalValue)}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold font-mono" style={{ color: totalPnl >= 0 ? "#30D158" : "#FF453A" }}>{totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)} $</p>
                    <p className="text-[11px] font-mono" style={{ color: totalPnl >= 0 ? "#30D158" : "#FF453A" }}>{totalPnlPct >= 0 ? "+" : ""}{fmt(totalPnlPct)}%</p>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="w-full max-w-md rounded-[20px] p-6 space-y-4"
            style={{ background: "#1C1C1E", border: "0.5px solid rgba(255,255,255,0.1)" }}>
            <h3 className="text-[16px] font-bold" style={{ color: "#E5E5EA" }}>
              {editId ? "Pozisyonu Düzenle" : "Yeni Pozisyon"}
            </h3>

            <div className="space-y-1.5" ref={searchRef}>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>Kağıt Ara</label>
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 rounded-[10px]"
                  style={{ background: "#2C2C2E", border: `0.5px solid ${selectedSymbol ? symbolColor(selectedSymbol) + "55" : "rgba(255,255,255,0.1)"}` }}>
                  {selectedSymbol && <SymbolBadge symbol={selectedSymbol} size={24} />}
                  <input
                    autoFocus
                    placeholder="AAPL, BTC, XAU/USD, EUR/USD…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); if (selectedSymbol && e.target.value !== selectedSymbol) { setSelectedSymbol(""); setSelectedName(""); setSelectedLivePrice(null); } }}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    className="flex-1 bg-transparent outline-none text-[13px]"
                    style={{ color: "#E5E5EA" }}
                  />
                  {searching && (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  )}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-[12px] overflow-hidden z-10"
                    style={{ background: "#2C2C2E", border: "0.5px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
                    {searchResults.map(r => (
                      <button key={r.symbol + r.exchange}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-all"
                        onClick={() => selectSymbol(r)}>
                        <SymbolBadge symbol={r.symbol} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold" style={{ color: "#E5E5EA" }}>{r.symbol}</p>
                          <p className="text-[11px] truncate" style={{ color: "#636366" }}>{r.instrument_name} · {r.exchange}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[4px]"
                          style={{ background: "rgba(255,255,255,0.07)", color: "#636366" }}>
                          {r.instrument_type?.replace("Common Stock","Hisse").replace("Digital Currency","Kripto")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedSymbol && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px]"
                  style={{ background: symbolColor(selectedSymbol) + "11", border: `0.5px solid ${symbolColor(selectedSymbol)}33` }}>
                  <SymbolBadge symbol={selectedSymbol} size={32} />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold" style={{ color: "#E5E5EA" }}>{selectedSymbol}</p>
                    <p className="text-[11px]" style={{ color: "#636366" }}>{selectedName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px]" style={{ color: "#636366" }}>Anlık Fiyat</p>
                    {fetchingLive ? (
                      <p className="text-[14px] font-bold" style={{ color: "#636366" }}>…</p>
                    ) : selectedLivePrice !== null ? (
                      <p className="text-[15px] font-bold" style={{ color: "#30D158" }}>${fmt(selectedLivePrice, 4)}</p>
                    ) : (
                      <p className="text-[12px]" style={{ color: "#FF9F0A" }}>fiyat yok</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>Adet / Lot</label>
                <input type="number" step="any" placeholder="0.01" value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-[9px] text-[13px] outline-none"
                  style={{ background: "#2C2C2E", color: "#E5E5EA", border: "0.5px solid rgba(255,255,255,0.1)" }} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>Alış Fiyatı ($)</label>
                  {selectedLivePrice !== null && (
                    <button onClick={() => setBuyPrice(String(selectedLivePrice))}
                      className="text-[10px] px-1.5 py-0.5 rounded-[4px]"
                      style={{ background: "rgba(48,209,88,0.15)", color: "#30D158" }}>
                      Anlık Kullan
                    </button>
                  )}
                </div>
                <input type="number" step="any" placeholder="0.00" value={buyPrice}
                  onChange={e => setBuyPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-[9px] text-[13px] outline-none"
                  style={{ background: "#2C2C2E", color: "#E5E5EA", border: "0.5px solid rgba(255,255,255,0.1)" }} />
              </div>
            </div>

            {cost2 > 0 && (
              <div className="px-3 py-2 rounded-[9px]" style={{ background: "rgba(88,86,214,0.1)", border: "0.5px solid rgba(88,86,214,0.2)" }}>
                <p className="text-[12px]" style={{ color: "#A29BFF" }}>
                  Toplam maliyet: <span className="font-bold">${fmt(cost2)}</span>
                  {cashLeft - cost2 < 0 && !editId && <span className="ml-2" style={{ color: "#FF9F0A" }}>⚠️ Nakit yetersiz</span>}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>Alış Tarihi</label>
                <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-[9px] text-[13px] outline-none"
                  style={{ background: "#2C2C2E", color: "#E5E5EA", border: "0.5px solid rgba(255,255,255,0.1)", colorScheme: "dark" }} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#636366" }}>Not (opsiyonel)</label>
                <input type="text" placeholder="serbest not…" value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-[9px] text-[13px] outline-none"
                  style={{ background: "#2C2C2E", color: "#E5E5EA", border: "0.5px solid rgba(255,255,255,0.1)" }} />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-[9px] text-[13px] font-medium"
                style={{ background: "#2C2C2E", color: "#AEAEB2" }}>
                İptal
              </button>
              <button onClick={saveForm}
                disabled={!selectedSymbol || !qty || !buyPrice}
                className="flex-1 py-2 rounded-[9px] text-[13px] font-semibold"
                style={{ background: !selectedSymbol || !qty || !buyPrice ? "#2C2C2E" : "#5856D6", color: !selectedSymbol || !qty || !buyPrice ? "#636366" : "#fff" }}>
                {editId ? "Kaydet" : "Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
