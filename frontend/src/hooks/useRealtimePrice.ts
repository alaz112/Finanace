"use client";
import { useEffect, useRef, useState } from "react";

const BACKEND_WS = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export function useRealtimePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const encoded = encodeURIComponent(symbol);
    const ws = new WebSocket(`${BACKEND_WS}/ws/prices/${encoded}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.price) {
        setPrevPrice((p) => p);
        setPrice((prev) => {
          setPrevPrice(prev);
          return data.price;
        });
      }
    };

    ws.onerror = () => ws.close();

    // Canlı tutmak için 15sn'de bir ping
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 15000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [symbol]);

  const direction =
    price === null || prevPrice === null ? "neutral"
    : price > prevPrice ? "up"
    : price < prevPrice ? "down"
    : "neutral";

  return { price, direction };
}
