export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";

const TD_KEY = "dbe4071a53634adfb69feab61ef7dfb1";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 1) return NextResponse.json({ data: [] });

  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&apikey=${TD_KEY}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "finance-app/1.0" } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ data: [] });
  }
}
