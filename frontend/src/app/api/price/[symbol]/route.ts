export const runtime = "edge";

const BASE = "https://api.twelvedata.com";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";

  // Twelve Data needs exchange=BIST for Borsa Istanbul stocks
  const BIST_SYMBOLS = new Set(["ASELS","THYAO","GARAN","AKBNK","ISCTR","EREGL","FROTO","KCHOL","TUPRS","BIMAS","TCELL","SISE","SAHOL","VAKBN","YKBNK","HALKB","PGSUS","TOASO","ARCLK","MGROS","EKGYO","KRDMD","PETKM","TKFEN","DOAS","KOZAL","SASA","VESTL","ULKER","YEOTK","KONTR"]);
  const exchangeParam = BIST_SYMBOLS.has(sym.toUpperCase()) ? "&exchange=BIST" : "";

  try {
    if (!API_KEY) {
      return Response.json({ error: "env_missing", detail: "TWELVE_DATA_API_KEY not set" }, { status: 500 });
    }

    const res = await fetch(
      `${BASE}/price?symbol=${encodeURIComponent(sym)}${exchangeParam}&apikey=${API_KEY}`
    );

    const data = await res.json();

    if (data.status === "error") {
      return Response.json({ error: data.message, code: data.code }, { status: 400 });
    }

    if (!data.price) {
      return Response.json({ error: "no price field", raw: data }, { status: 502 });
    }

    return Response.json({
      symbol: sym,
      price: parseFloat(data.price),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
