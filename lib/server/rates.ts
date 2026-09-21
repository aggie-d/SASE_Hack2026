import "server-only";

import type { RatesResponse } from "@/lib/contracts";

/**
 * Live reference FX rates from Fawaz Ahmed's free currency API
 * (https://github.com/fawazahmed0/exchange-api): no key, no rate limit,
 * fiat + crypto in one document, refreshed daily. We read the USD-based
 * document once and derive every pair from it:
 *
 *   USD → X      = rates[x]
 *   X   → USD    = 1 / rates[x]
 *   X   → USDT   = rates.usdt / rates[x]
 *
 * Primary host is jsDelivr; the project's documented fallback is a
 * Cloudflare Pages mirror. Both are tried before giving up. Results are
 * cached by Next's fetch cache for an hour — the upstream only changes once
 * a day, so this is plenty fresh and keeps the deposit page fast.
 *
 * These are DISPLAY rates for the deposit screen. The ledger's quotes still
 * come from lib/server/fx-calculation.ts (frozen demo rate); reconciling the
 * two is a separate task.
 */

const PRIMARY_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json";
const FALLBACK_URL = "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json";
const REVALIDATE_SECONDS = 60 * 60;
const FETCH_TIMEOUT_MS = 5_000;

type UpstreamDoc = { date: string; usd: Record<string, number> };

async function fetchDoc(url: string): Promise<UpstreamDoc> {
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const doc = (await res.json()) as Partial<UpstreamDoc>;
  if (typeof doc.date !== "string" || !doc.usd || typeof doc.usd !== "object") {
    throw new Error(`${url} → unexpected shape`);
  }
  return doc as UpstreamDoc;
}

export class RatesUnavailableError extends Error {
  constructor(public readonly causes: unknown[]) {
    super("Live FX rates are unavailable from every source.");
    this.name = "RatesUnavailableError";
  }
}

/** USD-based rates. Throws RatesUnavailableError if both hosts fail. */
export async function getUsdRates(): Promise<RatesResponse> {
  const causes: unknown[] = [];
  for (const [source, url] of [
    ["jsdelivr", PRIMARY_URL],
    ["currency-api.pages.dev", FALLBACK_URL],
  ] as const) {
    try {
      const doc = await fetchDoc(url);
      // Keep only finite positive numbers; upstream occasionally has nulls
      // for delisted tokens and we never want a division by zero downstream.
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(doc.usd)) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          rates[code.toUpperCase()] = value;
        }
      }
      rates.USD = 1;
      return {
        base: "USD",
        date: doc.date,
        source,
        fetched_at: new Date().toISOString(),
        rates,
      };
    } catch (err) {
      causes.push(err);
    }
  }
  throw new RatesUnavailableError(causes);
}
