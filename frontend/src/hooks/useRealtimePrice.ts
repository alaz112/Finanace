"use client";
import { useEffect, useState } from "react";
import { fetchLivePrice } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000; // 15 sn

export function useRealtimePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await fetchLivePrice(symbol);
        if (!cancelled) {
          setPrice((prev) => {
            setPrevPrice(prev);
            return data.price;
          });
        }
      } catch {
        // sessizce geç, bir sonraki tick'te tekrar dener
      }
    };

    poll(); // ilk çağrı hemen
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  const direction =
    price === null || prevPrice === null ? "neutral"
    : price > prevPrice ? "up"
    : price < prevPrice ? "down"
    : "neutral";

  return { price, direction };
}
