export const runtime = "edge";

const API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";
const BASE = "https://api.twelvedata.com";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);

  try {
    if (!API_KEY) {
      return Response.json({ error: "env_missing", detail: "TWELVE_DATA_API_KEY not set" }, { status: 500 });
    }

    const res = await fetch(
      `${BASE}/price?symbol=${encodeURIComponent(sym)}&apikey=${API_KEY}`
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
