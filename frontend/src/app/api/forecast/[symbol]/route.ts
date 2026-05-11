export const runtime = "edge";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const url = new URL(req.url);
  const days = url.searchParams.get("days") ?? "3";

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/forecast/${encodeURIComponent(sym)}?days=${days}`
    );
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json(
      { error: "Backend'e ulaşılamadı. Lokal sunucunun çalıştığından emin ol." },
      { status: 503 }
    );
  }
}
