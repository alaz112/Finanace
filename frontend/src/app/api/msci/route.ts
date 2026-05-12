export const runtime = "edge";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/msci/screen`, {
      headers: { "Cache-Control": "no-store" },
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json(
      { error: "Backend'e ulaşılamadı." },
      { status: 503 }
    );
  }
}
