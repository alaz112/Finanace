export const runtime = "edge";

const BASE = "https://api.twelvedata.com";
const BIST_SYMBOLS = new Set(["ASELS","THYAO","GARAN","AKBNK","ISCTR","EREGL","FROTO","KCHOL","TUPRS","BIMAS","TCELL","SISE","SAHOL","VAKBN","YKBNK","HALKB","PGSUS","TOASO","ARCLK","MGROS","EKGYO","KRDMD","PETKM","TKFEN","DOAS","KOZAL","SASA","VESTL","ULKER","YEOTK","KONTR"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";

  if (!API_KEY) {
    return Response.json({ error: "env_missing" }, { status: 500 });
  }

  const exParam = BIST_SYMBOLS.has(sym.toUpperCase()) ? "&exchange=BIST" : "";
  const base = `${BASE}`;

  const [rsiRes, macdRes, volRes] = await Promise.all([
    fetch(`${base}/rsi?symbol=${encodeURIComponent(sym)}${exParam}&interval=1day&outputsize=1&apikey=${API_KEY}`),
    fetch(`${base}/macd?symbol=${encodeURIComponent(sym)}${exParam}&interval=1day&outputsize=1&apikey=${API_KEY}`),
    fetch(`${base}/time_series?symbol=${encodeURIComponent(sym)}${exParam}&interval=1day&outputsize=1&apikey=${API_KEY}`),
  ]);

  const [rsiData, macdData, volData] = await Promise.all([
    rsiRes.json(),
    macdRes.json(),
    volRes.json(),
  ]);

  const rsi    = rsiData?.values?.[0]?.rsi     ? parseFloat(rsiData.values[0].rsi)        : null;
  const macd   = macdData?.values?.[0]?.macd   ? parseFloat(macdData.values[0].macd)      : null;
  const signal = macdData?.values?.[0]?.macd_signal ? parseFloat(macdData.values[0].macd_signal) : null;
  const hist   = macdData?.values?.[0]?.macd_hist   ? parseFloat(macdData.values[0].macd_hist)   : null;
  const volume = volData?.values?.[0]?.volume  ? parseInt(volData.values[0].volume, 10)    : null;

  return Response.json({ rsi, macd, signal, hist, volume });
}
