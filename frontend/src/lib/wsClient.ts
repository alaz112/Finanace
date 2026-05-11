"use client";

type Listener = (price: number) => void;

interface WsMsg {
  event: string;
  symbol?: string;
  price?: string | number;
}

class TwelveDataWSClient {
  private ws: WebSocket | null = null;
  private apiKey = "";
  private listeners = new Map<string, Set<Listener>>();
  private ready = false;
  private pendingSubs = new Set<string>();

  /** Call once on app init. Idempotent. */
  connect(apiKey: string) {
    if (typeof window === "undefined") return;
    if (this.apiKey && this.ws && this.ws.readyState < WebSocket.CLOSING) return;
    this.apiKey = apiKey;
    this._open();
  }

  private _open() {
    this.ws = new WebSocket(
      `wss://ws.twelvedata.com/v1/quotes/price?apikey=${this.apiKey}`
    );

    this.ws.onopen = () => {
      this.ready = true;
      const symbols = [
        ...Array.from(this.listeners.keys()),
        ...Array.from(this.pendingSubs),
      ];
      this.pendingSubs.clear();
      if (symbols.length) {
        this._send("subscribe", symbols.join(","));
      }
    };

    this.ws.onmessage = (evt) => {
      let msg: WsMsg;
      try {
        msg = JSON.parse(evt.data as string);
      } catch {
        return;
      }
      if (msg.event === "price" && msg.symbol && msg.price != null) {
        const p =
          typeof msg.price === "string" ? parseFloat(msg.price) : msg.price;
        this.listeners.get(msg.symbol)?.forEach((cb) => cb(p));
      }
    };

    this.ws.onclose = () => {
      this.ready = false;
      // Reconnect after 4 seconds
      setTimeout(() => this._open(), 4_000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribe(symbol: string, listener: Listener) {
    if (!this.listeners.has(symbol)) {
      this.listeners.set(symbol, new Set());
      if (this.ready && this.ws?.readyState === WebSocket.OPEN) {
        this._send("subscribe", symbol);
      } else {
        this.pendingSubs.add(symbol);
      }
    }
    this.listeners.get(symbol)!.add(listener);
  }

  unsubscribe(symbol: string, listener: Listener) {
    const set = this.listeners.get(symbol);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(symbol);
      if (this.ready && this.ws?.readyState === WebSocket.OPEN) {
        this._send("unsubscribe", symbol);
      }
    }
  }

  private _send(action: "subscribe" | "unsubscribe", symbols: string) {
    this.ws!.send(JSON.stringify({ action, params: { symbols } }));
  }
}

export const wsClient = new TwelveDataWSClient();
