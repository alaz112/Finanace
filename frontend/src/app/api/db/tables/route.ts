export const runtime = "edge";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/db/tables`);
    if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend'e ulaşılamadı." }, { status: 503 });
  }
}
