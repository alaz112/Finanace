export const runtime = "edge";

const TD_KEY = process.env.TWELVE_DATA_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const TD_BASE = "https://api.twelvedata.com";

const NEWS_QUERIES: Record<string, string> = {
  "XAU/USD": "gold price XAU USD market",
  "USD/CHF": "USD CHF Swiss franc forex",
  MRVL: "Marvell Technology MRVL stock earnings",
  AVGO: "Broadcom AVGO stock earnings",
};

const SYMBOL_NAMES: Record<string, string> = {
  "XAU/USD": "Altın",
  "USD/CHF": "İsviçre Frangı",
  MRVL: "Marvell Technology",
  AVGO: "Broadcom",
};

function extractTitles(xml: string, max = 6): string[] {
  const re = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g;
  const results: string[] = [];
  let count = 0;
  let match;
  while ((match = re.exec(xml)) !== null && results.length < max) {
    const title = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (count > 0 && title.length > 10) results.push(title);
    count++;
  }
  return results;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);

  if (!TD_KEY) {
    return Response.json({ error: "env_missing", detail: "TWELVE_DATA_API_KEY not set" }, { status: 500 });
  }
  if (!OPENAI_KEY) {
    return Response.json({ error: "env_missing", detail: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  // Fetch price history and news in parallel
  const [histRes, newsRes] = await Promise.allSettled([
    fetch(
      `${TD_BASE}/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&outputsize=8&apikey=${TD_KEY}`
    ),
    fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(NEWS_QUERIES[sym] ?? sym)}&hl=en-US&gl=US&ceid=US:en`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Finance/1.0)" } }
    ),
  ]);

  // Parse price history
  let priceLines = "Veri yok";
  let change5d = 0;
  let currentPrice = 0;
  let bigMoves: string[] = [];

  if (histRes.status === "fulfilled" && histRes.value.ok) {
    try {
      const data = await histRes.value.json();
      const values: Array<{ datetime: string; open: string; high: string; low: string; close: string }> =
        (data.values ?? []).slice(0, 8).reverse();

      if (values.length >= 2) {
        currentPrice = parseFloat(values[values.length - 1].close);
        const firstPrice = parseFloat(values[0].close);
        change5d = ((currentPrice - firstPrice) / firstPrice) * 100;

        priceLines = values
          .map((v) => {
            const c = parseFloat(v.close);
            const o = parseFloat(v.open);
            const dayChange = ((c - o) / o) * 100;
            const marker = dayChange > 1 ? "↑" : dayChange < -1 ? "↓" : "→";
            return `${v.datetime}: ${c.toFixed(4)} ${marker}(${dayChange > 0 ? "+" : ""}${dayChange.toFixed(2)}%)`;
          })
          .join("\n");

        // Identify big moves
        for (let i = 1; i < values.length; i++) {
          const prev = parseFloat(values[i - 1].close);
          const curr = parseFloat(values[i].close);
          const chg = ((curr - prev) / prev) * 100;
          if (Math.abs(chg) >= 1.5) {
            bigMoves.push(
              `${values[i].datetime}: %${chg > 0 ? "+" : ""}${chg.toFixed(2)} (${chg > 0 ? "yükseliş" : "düşüş"})`
            );
          }
        }
      }
    } catch (_) {}
  }

  // Parse news headlines
  let headlines: string[] = [];
  if (newsRes.status === "fulfilled" && newsRes.value.ok) {
    try {
      const xml = await newsRes.value.text();
      headlines = extractTitles(xml, 6);
    } catch (_) {}
  }

  // Build prompt
  const name = SYMBOL_NAMES[sym] ?? sym;
  const direction = change5d >= 0 ? "yükseldi" : "düştü";

  const prompt = `Sen deneyimli bir finansal analistsin. Kullanıcıya ${name} (${sym}) varlığının son fiyat hareketini Türkçe olarak analiz et.

Son 7 günlük fiyatlar (eski → yeni, parantezdeki günlük değişim):
${priceLines}

5 günlük özet: %${change5d.toFixed(2)} ${direction}
${bigMoves.length ? `\nDikkat çeken günler:\n${bigMoves.join("\n")}` : ""}

Güncel İngilizce haberler:
${headlines.length ? headlines.map((h, i) => `${i + 1}. ${h}`).join("\n") : "Haber bulunamadı"}

Lütfen şunları Türkçe, sade ve anlaşılır bir şekilde açıkla (3-4 cümle):
1. Fiyat neden bu hareketi yaptı? Hangi faktörler etkili oldu?
2. En kritik haber hangisi ve bu haberle fiyat hareketi arasındaki bağlantı nedir?
3. Kısa vadeli görünüm nasıl?

Teknik jargon kullanma, orta düzey bir yatırımcıya anlatır gibi yaz.`;

  // Call GPT-4o
  let gptRes: Response;
  try {
    gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.65,
      }),
    });
  } catch (e: any) {
    return Response.json(
      { error: "openai_fetch_failed", detail: e?.message ?? "network error" },
      { status: 502 }
    );
  }

  if (!gptRes.ok) {
    let errBody = "";
    try { errBody = await gptRes.text(); } catch (_) {}
    return Response.json(
      { error: "openai_error", status: gptRes.status, detail: errBody },
      { status: 502 }
    );
  }

  let gptData: any;
  try {
    gptData = await gptRes.json();
  } catch (e: any) {
    return Response.json(
      { error: "openai_parse_failed", detail: e?.message },
      { status: 502 }
    );
  }

  const analysis: string = gptData.choices?.[0]?.message?.content ?? "";

  return Response.json({
    symbol: sym,
    name,
    change5d: parseFloat(change5d.toFixed(2)),
    currentPrice,
    headlines,
    analysis,
  });
}
