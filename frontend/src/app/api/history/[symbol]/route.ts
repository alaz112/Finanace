export const runtime = "edge";

const BASE = "https://api.twelvedata.com";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";

  const url = new URL(req.url);
  const interval = url.searchParams.get("interval") ?? "1day";
  const outputsize = url.searchParams.get("outputsize") ?? "90";

  let res: Response;
  try {
    res = await fetch(
      `${BASE}/time_series?symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=${outputsize}&apikey=${API_KEY}`
    );
  } catch (e: any) {
    return Response.json(
      { error: "fetch_failed", detail: e?.message ?? "network error", stage: "twelve_data_fetch" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return Response.json(
      { error: "upstream_error", status: res.status, stage: "twelve_data_fetch" },
      { status: 502 }
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e: any) {
    return Response.json(
      { error: "parse_failed", detail: e?.message, stage: "twelve_data_json" },
      { status: 502 }
    );
  }

  if (data.status === "error") {
    return Response.json(
      { error: data.message, code: data.code, stage: "twelve_data_api" },
      { status: 400 }
    );
  }

  // Twelve Data returns newest first, reverse for chart
  const values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }> = (data.values ?? []).reverse();

  const candles = values.map((v) => ({
    // intraday: keep full datetime; daily: keep date only
    time: v.datetime.includes(" ") && interval !== "1day" && interval !== "1week"
      ? v.datetime.replace(" ", "T")  // "2024-01-15T09:30:00"
      : v.datetime.split(" ")[0], // "2024-01-15"
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume ?? "0"),
  }));

  // Remove any duplicate timestamps (safety)
  const seen = new Set<string>();
  const deduped = candles.filter((c) => {
    if (seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  });

  return Response.json({ symbol: sym, interval, data: deduped });
}

export const dynamic = "force-dynamic";
