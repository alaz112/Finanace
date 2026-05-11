export const runtime = "edge";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

const NEWS_QUERIES: Record<string, string> = {
  "XAU/USD": "gold price XAU USD market",
  "USD/CHF": "USD CHF Swiss franc forex",
  MRVL: "Marvell Technology MRVL stock",
  AVGO: "Broadcom AVGO stock",
};

const SYMBOL_NAMES: Record<string, string> = {
  "XAU/USD": "Altın (XAU/USD)",
  "USD/CHF": "İsviçre Frangı (USD/CHF)",
  MRVL: "Marvell Technology (MRVL)",
  AVGO: "Broadcom (AVGO)",
};

function extractTitles(xml: string, max = 5): string[] {
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
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const change = parseFloat(url.searchParams.get("change") ?? "0");

  // Fetch recent news for this symbol
  const query = NEWS_QUERIES[sym] ?? sym;
  let headlines: string[] = [];
  try {
    const newsRes = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Finance/1.0)" } }
    );
    if (newsRes.ok) headlines = extractTitles(await newsRes.text(), 6);
  } catch {}

  const name = SYMBOL_NAMES[sym] ?? sym;
  const direction = change >= 0 ? "yükseldi" : "düştü";
  const absPct = Math.abs(change).toFixed(2);

  const prompt = `${name}, ${date} tarihinde %${absPct} ${direction}.

Şu anki güncel haberler (İngilizce):
${headlines.length ? headlines.map((h, i) => `${i + 1}. ${h}`).join("\n") : "Haber bulunamadı."}

Bu tarihte yaşanan fiyat hareketinin sebebini Türkçe olarak 2-3 kısa cümleyle açıkla.
Haberler tarih olarak tam olarak o güne denk gelmeyebilir; genel bağlam ve makroekonomik faktörleri de kullan.
Sade, anlaşılır dil kullan. Teknik jargon kullanma.`;

  if (!OPENAI_KEY) {
    return Response.json({ date, change, analysis: "OpenAI API key eksik.", headlines });
  }

  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 220,
      temperature: 0.6,
    }),
  });

  if (!gptRes.ok) {
    return Response.json({ error: "AI yanıt vermedi" }, { status: 502 });
  }

  const gptData = await gptRes.json();
  const analysis: string = gptData.choices?.[0]?.message?.content ?? "";

  return Response.json({ date, change, analysis, headlines });
}
