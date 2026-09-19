/**
 * BigInt money helpers shared by the frontend and every API route.
 *
 * Rules enforced here (see lib/contracts/index.ts for the ISO 4217 table):
 *  - Amounts are BigInt in minor units (tambala, cent, micro-USDT). Never Number.
 *  - Parsing is strict: anything that is not a plain integer string is rejected.
 *  - Converting user input never silently drops precision — too many decimals throws.
 *  - FX conversion rounds by floor; the fee absorbs the remainder.
 *
 * This module has no server-only imports so it is safe in client components.
 */

import { CURRENCY_META, type Asset, type MoneyAmount } from "./index";

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

const INTEGER_RE = /^-?\d+$/;
const DECIMAL_RE = /^(\d+)(?:\.(\d*))?$/;

function pow10(exp: number): bigint {
  return 10n ** BigInt(exp);
}

function exponentOf(asset: Asset): number {
  return CURRENCY_META[asset].exponent;
}

// ─── Parsing (wire → BigInt) ────────────────────────────────────────────────

/**
 * Parse a minor-unit value coming off the wire or out of the database.
 * Accepts a decimal-integer string, a safe-integer Number (Supabase returns
 * int8 columns as Number), or a BigInt. Anything else throws.
 *
 *   parseMinorUnits("20400000") → 20400000n
 */
export function parseMinorUnits(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError(`Unsafe or non-integer number for money: ${value}`);
    }
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!INTEGER_RE.test(trimmed)) {
    throw new MoneyError(`Invalid minor-unit amount "${value}" — expected an integer string`);
  }
  return BigInt(trimmed);
}

/** Like parseMinorUnits but also rejects zero and negative values (for user-submitted amounts). */
export function parsePositiveMinorUnits(value: string | number | bigint): bigint {
  const units = parseMinorUnits(value);
  if (units <= 0n) throw new MoneyError("Amount must be greater than zero");
  return units;
}

// ─── User input (major units → minor units) ─────────────────────────────────

/**
 * Convert a user-typed major-unit amount into minor units for the given asset.
 * Thousands separators and whitespace are ignored. Negative input is rejected.
 * More decimals than the asset's exponent is rejected — never round user input.
 *
 *   toMinorUnits("204,000", "MWK")  → 20400000n   (tambala)
 *   toMinorUnits("99.96",  "USDT")  → 99960000n   (micro-USDT)
 *   toMinorUnits("1.234",  "MWK")   → throws (MWK has 2 decimals)
 */
export function toMinorUnits(input: string, asset: Asset): bigint {
  const exp = exponentOf(asset);
  const cleaned = input.trim().replace(/[,\s_]/g, "");
  const match = DECIMAL_RE.exec(cleaned);
  if (!match) throw new MoneyError(`Invalid amount "${input}"`);

  const whole = match[1];
  const frac = match[2] ?? "";
  if (frac.length > exp) {
    throw new MoneyError(`${asset} supports at most ${exp} decimal place${exp === 1 ? "" : "s"}`);
  }
  return BigInt(whole) * pow10(exp) + BigInt(frac.padEnd(exp, "0") || "0");
}

/** Demo rule for MWK: deposits and conversions must be whole kwacha (no tambala). */
export function isWholeMajorUnits(units: bigint, asset: Asset): boolean {
  return units % pow10(exponentOf(asset)) === 0n;
}

// ─── Display (minor units → string) ─────────────────────────────────────────

/**
 * Fixed-point decimal string with exactly `exponent` decimals. No separators.
 *
 *   fromMinorUnits(20400000n, "MWK")  → "204000.00"
 *   fromMinorUnits(99960000n, "USDT") → "99.960000"
 */
export function fromMinorUnits(units: bigint, asset: Asset): string {
  const exp = exponentOf(asset);
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = pow10(exp);
  const whole = (abs / base).toString();
  const frac = exp === 0 ? "" : "." + (abs % base).toString().padStart(exp, "0");
  return (negative ? "-" : "") + whole + frac;
}

/**
 * Human-readable amount with thousands separators and the asset code.
 * USDT is shown with 2 decimals by default (it is USD-pegged); pass
 * `{ decimals }` to override, e.g. 6 for full precision on receipts.
 *
 *   formatMinorUnits(20400000n, "MWK")  → "204,000.00 MWK"
 *   formatMinorUnits(99960000n, "USDT") → "99.96 USDT"
 */
export function formatMinorUnits(
  units: bigint,
  asset: Asset,
  opts: { decimals?: number; code?: boolean } = {},
): string {
  const exp = exponentOf(asset);
  const decimals = opts.decimals ?? (asset === "USDT" ? 2 : exp);
  if (decimals > exp) throw new MoneyError(`${asset} only has ${exp} decimal places`);

  const fixed = fromMinorUnits(units, asset);
  const [wholePart, fracPart = ""] = fixed.replace("-", "").split(".");
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = decimals === 0 ? "" : "." + fracPart.slice(0, decimals);
  const sign = units < 0n ? "-" : "";
  const code = opts.code === false ? "" : ` ${asset}`;
  return `${sign}${grouped}${frac}${code}`;
}

/** formatMinorUnits for a wire MoneyAmount. */
export function formatMoney(amount: MoneyAmount, opts?: { decimals?: number; code?: boolean }): string {
  return formatMinorUnits(parseMinorUnits(amount.amount_units), amount.asset, opts);
}

// ─── Construction ───────────────────────────────────────────────────────────

/** Build a wire MoneyAmount from BigInt minor units. */
export function money(asset: Asset, units: bigint): MoneyAmount {
  return { asset, amount_units: units.toString(), exponent: exponentOf(asset) };
}

// ─── Arithmetic ─────────────────────────────────────────────────────────────

/**
 * Apply a percentage expressed in basis points using integer floor division.
 * 200 bps = 2.00%.
 *
 *   applyBasisPoints(20400000n, 200) → 408000n   (4,080.00 MWK fee on 204,000 MWK)
 */
export function applyBasisPoints(units: bigint, bps: number | bigint): bigint {
  const b = typeof bps === "bigint" ? bps : BigInt(bps);
  if (b < 0n) throw new MoneyError("Basis points must be non-negative");
  return (units * b) / 10_000n;
}

/**
 * Convert minor units of one asset into minor units of another at a rate
 * expressed in MAJOR units of source per 1 MAJOR unit of destination
 * (e.g. "2000" meaning 2,000 MWK per 1 USDT). Rounds by floor.
 *
 *   convertAtRate(19992000n, "MWK", "USDT", "2000") → 99960000n
 *   (199,920.00 MWK ÷ 2000 = 99.96 USDT)
 *
 * The rate may have decimals ("1987.50"). Negative amounts are rejected.
 */
export function convertAtRate(
  sourceUnits: bigint,
  sourceAsset: Asset,
  destAsset: Asset,
  rateSourcePerDest: string,
): bigint {
  if (sourceUnits < 0n) throw new MoneyError("Cannot convert a negative amount");

  const match = DECIMAL_RE.exec(rateSourcePerDest.trim());
  if (!match) throw new MoneyError(`Invalid rate "${rateSourcePerDest}"`);
  const rateFrac = match[2] ?? "";
  const rateScaled = BigInt(match[1] + rateFrac); // rate × 10^rateDecimals
  if (rateScaled === 0n) throw new MoneyError("Rate must be greater than zero");

  const numerator = sourceUnits * pow10(exponentOf(destAsset)) * pow10(rateFrac.length);
  const denominator = rateScaled * pow10(exponentOf(sourceAsset));
  return numerator / denominator; // floor for non-negative operands
}

/** Guard for the "never mix assets" rule. */
export function assertSameAsset(a: MoneyAmount, b: MoneyAmount): void {
  if (a.asset !== b.asset) {
    throw new MoneyError(`Cannot combine ${a.asset} with ${b.asset}`);
  }
}
