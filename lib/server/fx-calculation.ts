import { applyBasisPoints, convertAtRate } from "@/lib/contracts/money";

/** Fee taken from the MWK side before conversion: 200 bps = 2%. */
export const QUOTE_FEE_BPS = 200;

/**
 * Price an MWK→USDT quote at a given rate (MWK per 1 USDT, decimal string).
 * Pure and bigint-only: fee is 2% of source, floored; destination is
 * (source − fee) ÷ rate, floored to micro-USDT. The rate comes from
 * lib/server/rates.ts (live, pinned or frozen) — this function does not care.
 *
 *   calculateQuote(20400000n, "2000")        → { fee: 408000n, destination: 99960000n }
 *   calculateQuote(20400000n, "1736.150000") → destination ≈ 115.15 USDT
 */
export function calculateQuote(source: bigint, rateMwkPerUsdt: string): { fee: bigint; destination: bigint } {
  const fee = applyBasisPoints(source, QUOTE_FEE_BPS);
  return { fee, destination: convertAtRate(source - fee, "MWK", "USDT", rateMwkPerUsdt) };
}

/** The brief's worked example at the frozen 2,000 rate. Kept for tests and the offline fallback. */
export function calculateMockQuote(source: bigint): { fee: bigint; destination: bigint } {
  return calculateQuote(source, "2000");
}
