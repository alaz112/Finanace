export const runtime = "edge";
import { NextResponse } from "next/server";

const BACKEND = "https://finanace-production.up.railway.app";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/strategy`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
