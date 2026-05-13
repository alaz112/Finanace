export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";

const TD_KEY = "dbe4071a53634adfb69feab61ef7dfb1";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 1) return NextResponse.json({ data: [] });

  // Boost BIST results: search with exchange=BIST too if query looks like a BIST symbol
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&exchange=BIST&apikey=${TD_KEY}`;
  const urlGlobal = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${TD_KEY}`;
  try {
    const [bistRes, globalRes] = await Promise.all([
      fetch(url, { headers: { "User-Agent": "finance-app/1.0" } }),
      fetch(urlGlobal, { headers: { "User-Agent": "finance-app/1.0" } }),
    ]);
    const bistData = await bistRes.json();
    const globalData = await globalRes.json();
    const bistRows: unknown[] = bistData.data ?? [];
    const globalRows: unknown[] = globalData.data ?? [];
    // BIST results first, then global (deduplicated)
    const seen = new Set<string>();
    const merged = [...bistRows, ...globalRows].filter((r: unknown) => {
      const row = r as { symbol: string; exchange: string };
      const key = `${row.symbol}:${row.exchange}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return NextResponse.json({ data: merged });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
