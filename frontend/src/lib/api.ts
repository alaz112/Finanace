// Twelve Data API'sine istek atan yardımcı fonksiyonlar

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchLivePrice(symbol: string): Promise<{
  symbol: string;
  price: number;
  timestamp: string;
  source: string;
}> {
  const res = await fetch(`${BACKEND}/api/v1/assets/${encodeURIComponent(symbol)}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Fiyat çekilemedi: ${symbol}`);
  return res.json();
}

export async function fetchHistory(
  symbol: string,
  interval = "1day",
  outputsize = 90
): Promise<{ time: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const params = new URLSearchParams({ interval, outputsize: String(outputsize) });
  const res = await fetch(
    `${BACKEND}/api/v1/prices/history/${encodeURIComponent(symbol)}?${params}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`Geçmiş veri çekilemedi: ${symbol}`);
  const json = await res.json();
  return json.data;
}
