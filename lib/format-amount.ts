/**
 * Shared money-input formatting for client forms (deposit page, fund card
 * modal). Display only — never feed these strings into ledger math; parse
 * with parseFloat(value.replace(/[^0-9.]/g, "")) or toMinorUnits instead.
 */

/**
 * Live-format the amount as the user types: thousands separators on the
 * integer part, at most two decimals. "50000.5" → "50,000.5"; a trailing
 * "." is kept so the user can keep typing. Anything non-numeric is dropped.
 */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";
  const dot = cleaned.indexOf(".");
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const decPart = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  const grouped = (intPart === "" ? "0" : intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart === null ? grouped : `${grouped}.${decPart}`;
}

/** On blur, settle to the canonical x,xxx.00 form. Empty or zero stays empty. */
export function normalizeAmountInput(value: string): string {
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
