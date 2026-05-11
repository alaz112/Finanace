export const runtime = "edge";

const API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";
const BASE = "https://api.twelvedata.com";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);

  const res = await fetch(
    `${BASE}/price?symbol=${encodeURIComponent(sym)}&apikey=${API_KEY}`
  );

  if (!res.ok) {
    return Response.json({ error: "upstream error" }, { status: 502 });
  }

  const data = await res.json();

  if (data.status === "error") {
    return Response.json({ error: data.message }, { status: 400 });
  }

  return Response.json({
    symbol: sym,
    price: parseFloat(data.price),
    timestamp: new Date().toISOString(),
  });
}
