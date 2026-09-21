import { MoneyError } from "@/lib/contracts/money";

/**
 * Server-authoritative pricing for a card/bank/mobile deposit in any
 * currency, credited to the USDT wallet. Pure bigint; the client's own
 * arithmetic is never trusted — it is recomputed here from `amount` and
 * `currency` at the rate the server fetched.
 *
 *   source (2dp minor units) ─÷ ratePerUsd─▶ USD cents ─− fee─▶ net cents ─× usdtPerUsd─▶ micro-USDT
 *
 * Rounding: floor at every step, in the customer's disfavour by at most one
 * minor unit. Same policy as the ledger's quote path.
 *
 * Currencies outside CURRENCY_META are treated as exponent-2 (cents-like).
 * JPY/KRW/etc. are exponent-0 in ISO 4217; for the demo picker that only
 * affects display precision, not correctness of the arithmetic.
 */

export const DEPOSIT_FEE_USD_CENTS = 50n; // flat $0.50, matches the deposit page

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;

/** "50,000" | "50000.5" → 5000050n (exponent 2). Rejects negatives, junk, >2dp. */
export function parseMajorToMinor2(input: string | number): bigint {
  const cleaned = String(input).trim().replace(/[,\s_]/g, "");
  const m = DECIMAL_RE.exec(cleaned);
  if (!m) throw new MoneyError(`Invalid amount "${input}"`);
  const frac = m[2] ?? "";
  if (frac.length > 2) throw new MoneyError("Amount supports at most 2 decimal places");
  return BigInt(m[1]) * 100n + BigInt(frac.padEnd(2, "0") || "0");
}

/** Parse a positive decimal rate string into { scaled, decimals } so rate = scaled / 10^decimals. */
function parseRate(rate: string): { scaled: bigint; decimals: number } {
  const m = DECIMAL_RE.exec(rate.trim());
  if (!m) throw new MoneyError(`Invalid rate "${rate}"`);
  const frac = m[2] ?? "";
  const scaled = BigInt(m[1] + frac);
  if (scaled === 0n) throw new MoneyError("Rate must be greater than zero");
  return { scaled, decimals: frac.length };
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** units ÷ rate, floored. */
export function divideByRate(units: bigint, rate: string): bigint {
  const { scaled, decimals } = parseRate(rate);
  return (units * pow10(decimals)) / scaled;
}

/** units × rate, floored. */
export function multiplyByRate(units: bigint, rate: string): bigint {
  const { scaled, decimals } = parseRate(rate);
  return (units * scaled) / pow10(decimals);
}

export type DepositPricing = {
  /** Source amount in exponent-2 minor units of `currency`. */
  sourceUnits: bigint;
  currency: string;
  /** Units of `currency` per 1 USD, as applied. */
  ratePerUsd: string;
  /** USDT per 1 USD, as applied (≈ "1.000471"). */
  usdtPerUsd: string;
  grossUsdCents: bigint;
  feeUsdCents: bigint;
  netUsdCents: bigint;
  /** Micro-USDT to credit. */
  usdtUnits: bigint;
};

export function priceDeposit(params: {
  amount: string | number;
  currency: string;
  ratePerUsd: string;
  usdtPerUsd: string;
  feeUsdCents?: bigint;
}): DepositPricing {
  const currency = params.currency.toUpperCase();
  const sourceUnits = parseMajorToMinor2(params.amount);
  if (sourceUnits <= 0n) throw new MoneyError("Deposit amount must be positive");

  const grossUsdCents = currency === "USD" ? sourceUnits : divideByRate(sourceUnits, params.ratePerUsd);
  const feeUsdCents = params.feeUsdCents ?? DEPOSIT_FEE_USD_CENTS;
  const netUsdCents = grossUsdCents > feeUsdCents ? grossUsdCents - feeUsdCents : 0n;
  // cents → micro-USDT is ×10,000 at par, then the live USDT/USD rate.
  const usdtUnits = multiplyByRate(netUsdCents * 10_000n, params.usdtPerUsd);

  return {
    sourceUnits,
    currency,
    ratePerUsd: currency === "USD" ? "1" : params.ratePerUsd,
    usdtPerUsd: params.usdtPerUsd,
    grossUsdCents,
    feeUsdCents,
    netUsdCents,
    usdtUnits,
  };
}
