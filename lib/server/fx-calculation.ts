import { applyBasisPoints, convertAtRate } from "@/lib/contracts/money";

/** Money stays bigint until the database call serializes it as decimal text. */
export function calculateMockQuote(source: bigint): { fee: bigint; destination: bigint } {
  const fee = applyBasisPoints(source, 200);
  return { fee, destination: convertAtRate(source - fee, "MWK", "USDT", "2000") };
}
