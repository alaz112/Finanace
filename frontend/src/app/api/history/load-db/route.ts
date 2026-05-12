export const runtime = "edge";

const BACKEND = process.env.BACKEND_URL ?? "https://finanace-production.up.railway.app";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND}/api/history/load-db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return Response.json(data, { status: res.ok ? 200 : 502 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "fetch failed" }, { status: 502 });
  }
}
