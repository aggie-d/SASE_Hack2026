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
 * One rate source for the whole app: the deposit page, POST /quotes and
 * POST /deposits all price from here, so the numbers a judge sees agree
 * with each other.
 *
 * Demo safety — FX_RATE_OVERRIDE_MWK_PER_USDT:
 *   Set it (e.g. "1736.15") before presenting and MWK is priced at exactly
 *   that figure everywhere, tagged source "pinned", regardless of network.
 *   Other currencies still come from the feed when reachable. Unset it and
 *   everything is live again.
 *
 * Last resort when the feed is down and nothing is pinned: the original
 * frozen demo rate (2,000 MWK per USDT), tagged source "mock".
 */

const PRIMARY_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json";
const FALLBACK_URL = "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json";
const REVALIDATE_SECONDS = 60 * 60;
const FETCH_TIMEOUT_MS = 5_000;

/** The brief's frozen demo rate; only used when the feed is down and nothing is pinned. */
export const FALLBACK_MWK_PER_USDT = "2000";

/** Decimal places we carry on a quoted rate string. Enough for any fiat pair we show. */
export const RATE_DECIMALS = 6;

export type RateSource = "live" | "pinned" | "mock";

export type MwkPerUsdt = {
  /** Fixed-point decimal string, RATE_DECIMALS places, e.g. "1736.150000". */
  rate: string;
  source: RateSource;
  /** Upstream publication date for live rates; "pinned" / "mock" otherwise. */
  date: string;
  /** Which host answered (live only). */
  provider: string;
};

function pinnedMwkPerUsdt(): string | null {
  const raw = process.env.FX_RATE_OVERRIDE_MWK_PER_USDT?.trim();
  if (!raw) return null;
  if (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) <= 0) {
    console.error(`[rates] ignoring invalid FX_RATE_OVERRIDE_MWK_PER_USDT="${raw}"`);
    return null;
  }
  return raw;
}

/** Fixed-point string with RATE_DECIMALS places. Input is a display-grade JS number. */
export function rateToString(rate: number, decimals = RATE_DECIMALS): string {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Invalid rate ${rate}`);
  return rate.toFixed(decimals);
}

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

/** Raw feed, no pin applied. Throws RatesUnavailableError if both hosts fail. */
async function fetchUsdRates(): Promise<RatesResponse> {
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

/**
 * USD-based rates for display and pricing.
 *
 * With FX_RATE_OVERRIDE_MWK_PER_USDT set, rates.MWK is replaced by the pin
 * (converted through the feed's USDT/USD so MWK→USDT lands exactly on the
 * pinned figure) and `source` becomes "pinned". If the feed is down AND a pin
 * exists, a minimal USD/USDT/MWK document is returned so the demo keeps
 * working. Throws RatesUnavailableError only when there is nothing to show.
 */
export async function getUsdRates(): Promise<RatesResponse> {
  const pin = pinnedMwkPerUsdt();
  try {
    const live = await fetchUsdRates();
    if (!pin) return live;
    const usdtPerUsd = live.rates.USDT ?? 1;
    return { ...live, source: "pinned", rates: { ...live.rates, MWK: Number(pin) * usdtPerUsd } };
  } catch (err) {
    if (!pin) throw err;
    console.error("[rates] feed unavailable; serving pinned MWK only", err);
    return {
      base: "USD",
      date: "pinned",
      source: "pinned",
      fetched_at: new Date().toISOString(),
      rates: { USD: 1, USDT: 1, MWK: Number(pin) },
    };
  }
}

/**
 * The one rate the ledger prices MWK→USDT conversions at. Never throws:
 * pinned → live feed → frozen demo rate, in that order, and says which.
 */
export async function getMwkPerUsdt(): Promise<MwkPerUsdt> {
  const pin = pinnedMwkPerUsdt();
  if (pin) {
    return { rate: rateToString(Number(pin)), source: "pinned", date: "pinned", provider: "env" };
  }
  try {
    const live = await fetchUsdRates();
    const mwk = live.rates.MWK;
    const usdt = live.rates.USDT;
    if (!mwk || !usdt) throw new Error("feed is missing MWK or USDT");
    return { rate: rateToString(mwk / usdt), source: "live", date: live.date, provider: live.source };
  } catch (err) {
    console.error("[rates] feed unavailable; quoting the frozen demo rate", err);
    return { rate: rateToString(Number(FALLBACK_MWK_PER_USDT)), source: "mock", date: "mock", provider: "mock" };
  }
}
