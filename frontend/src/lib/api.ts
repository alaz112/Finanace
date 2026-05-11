export async function fetchLivePrice(symbol: string): Promise<{
  symbol: string;
  price: number;
  timestamp: string;
}> {
  const res = await fetch(`/api/price/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
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
  const res = await fetch(`/api/history/${encodeURIComponent(symbol)}?${params}`);
  if (!res.ok) throw new Error(`Geçmiş veri çekilemedi: ${symbol}`);
  const json = await res.json();
  return json.data;
}
