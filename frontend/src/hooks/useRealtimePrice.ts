"use client";
import { useEffect, useRef, useState } from "react";
import { fetchLivePrice } from "@/lib/api";
import { wsClient } from "@/lib/wsClient";

const POLL_FALLBACK_MS = 60_000; // used when WS unavailable

// Initialize singleton WS once (browser only)
if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY ?? "";
  if (key) wsClient.connect(key);
}

export function useRealtimePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const priceRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const updatePrice = (newPrice: number) => {
      if (cancelled) return;
      setPrevPrice(priceRef.current);
      priceRef.current = newPrice;
      setPrice(newPrice);
    };

    // Initial price via REST
    fetchLivePrice(symbol).then((d) => updatePrice(d.price)).catch(() => {});

    // WS live ticks (primary)
    wsClient.subscribe(symbol, updatePrice);

    // Polling fallback — runs in background regardless; WS ticks simply arrive more often
    pollId = setInterval(() => {
      fetchLivePrice(symbol).then((d) => updatePrice(d.price)).catch(() => {});
    }, POLL_FALLBACK_MS);

    return () => {
      cancelled = true;
      wsClient.unsubscribe(symbol, updatePrice);
      if (pollId) clearInterval(pollId);
    };
  }, [symbol]);

  const direction =
    price === null || prevPrice === null
      ? "neutral"
      : price > prevPrice
      ? "up"
      : price < prevPrice
      ? "down"
      : "neutral";

  return { price, direction };
}
