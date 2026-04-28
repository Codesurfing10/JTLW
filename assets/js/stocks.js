// JTLW Agent — Stock Scanner (Alpha Vantage + Gemini analysis)
import { CONFIG } from './config.js';

/**
 * Fetch quote data for a list of symbols from Alpha Vantage.
 * Falls back gracefully if no API key is provided.
 * @param {string[]} symbols
 * @param {string} apiKey  Alpha Vantage API key (may be empty)
 * @returns {Promise<StockQuote[]>}
 */
export async function fetchQuotes(symbols, apiKey) {
  if (!apiKey) return [];

  const results = [];
  // Alpha Vantage free tier: sequential fetches to avoid rate limiting
  for (const symbol of symbols.slice(0, 5)) {
    try {
      const url =
        `${CONFIG.ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const q = data['Global Quote'];
      if (!q || !q['05. price']) continue;

      results.push({
        symbol,
        price: parseFloat(q['05. price']),
        change: parseFloat(q['09. change']),
        changePercent: q['10. change percent']?.replace('%', '') || '0',
        volume: parseInt(q['06. volume'], 10),
        high: parseFloat(q['03. high']),
        low: parseFloat(q['04. low']),
      });
    } catch (_) {
      // skip failed symbol
    }
  }
  return results;
}

/**
 * Ask Gemini to rank the top 5 stock picks from the watchlist,
 * optionally enriched with live quote data.
 * @param {GeminiClient} gemini
 * @param {string[]} watchlist
 * @param {StockQuote[]} quotes  — may be empty
 * @returns {Promise<StockPick[]>}
 */
export async function getTopFivePicks(gemini, watchlist, quotes = []) {
  const quoteContext =
    quotes.length > 0
      ? `Current market data:\n` +
        quotes
          .map(
            (q) =>
              `${q.symbol}: $${q.price.toFixed(2)} (${q.changePercent}% today)`
          )
          .join('\n')
      : `No live data available. Use your knowledge of these symbols.`;

  const prompt = `
You are a financial analyst. From this watchlist: ${watchlist.join(', ')}
${quoteContext}

Select the TOP 5 stock picks right now based on momentum, fundamentals, and market position.
Reply with a JSON array of exactly 5 objects:
[
  {
    "symbol": "TICKER",
    "name": "Company Name",
    "reason": "2-3 sentence rationale",
    "sentiment": "bullish" | "very_bullish",
    "theme": "e.g. AI, EV, Cloud, Semiconductor"
  },
  ...
]
Return ONLY the JSON array, no other text.`;

  const raw = await gemini.generate(prompt, { temperature: 0.4 });

  // Parse JSON array from response
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Gemini did not return a stock picks array.');

  const picks = JSON.parse(match[0]);

  // Merge in live price data if available
  return picks.map((p, i) => {
    const live = quotes.find((q) => q.symbol === p.symbol);
    return {
      rank: i + 1,
      symbol: p.symbol,
      name: p.name || p.symbol,
      reason: p.reason,
      sentiment: p.sentiment || 'bullish',
      theme: p.theme || '',
      price: live ? `$${live.price.toFixed(2)}` : null,
      change: live ? live.change : null,
      changePercent: live ? live.changePercent : null,
    };
  });
}
