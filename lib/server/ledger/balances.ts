import "server-only";

import { CURRENCY_META, type AccountPurpose, type Asset, type WalletBalance } from "@/lib/contracts";
import { parseMinorUnits } from "@/lib/contracts/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError } from "@/lib/server/http";

import { USER_ACCOUNT_PURPOSES } from "./accounts";

/**
 * Balance reads. Everything comes from the `account_balances` view:
 *
 *   posted_units    = SUM(credit - debit) over journal_entries
 *   held_units      = SUM(amount) over holds WHERE status = 'active'
 *   available_units = posted_units - held_units
 *
 * The view's unit columns are aggregates. PostgREST may hand them back as JSON
 * numbers (numeric) or strings (after the B2 migration casts them to text);
 * parseMinorUnits accepts both and rejects anything outside the safe-integer
 * range when it is a number, so a silently-wrong balance is not possible.
 */

type BalanceRow = {
  account_id: string;
  owner_user_id: string | null;
  purpose: AccountPurpose;
  asset: Asset;
  posted_units: string | number;
  held_units: string | number;
  available_units: string | number;
};

const BALANCE_COLUMNS = "account_id, owner_user_id, purpose, asset, posted_units, held_units, available_units";

export function toWalletBalance(row: BalanceRow): WalletBalance {
  const posted = parseMinorUnits(row.posted_units);
  const held = parseMinorUnits(row.held_units);
  const available = parseMinorUnits(row.available_units);

  return {
    account_id: row.account_id,
    asset: row.asset,
    purpose: row.purpose,
    posted_units: posted.toString(),
    held_units: held.toString(),
    available_units: available.toString(),
    exponent: CURRENCY_META[row.asset].exponent,
  };
}

const PURPOSE_ORDER: Record<string, number> = Object.fromEntries(
  USER_ACCOUNT_PURPOSES.map((p, i) => [p, i]),
);

/**
 * All user-owned wallets (mwk_wallet, usdt_wallet, card_funding) in a stable
 * display order. This is the body of GET /api/v1/wallets.
 */
export async function getWalletBalances(userId: string): Promise<WalletBalance[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_balances")
    .select(BALANCE_COLUMNS)
    .eq("owner_user_id", userId)
    .returns<BalanceRow[]>();

  if (error) throw error;

  return (data ?? [])
    .map(toWalletBalance)
    .sort((a, b) => (PURPOSE_ORDER[a.purpose] ?? 99) - (PURPOSE_ORDER[b.purpose] ?? 99));
}

/** Balance of one account (user or system). Throws NOT_FOUND if it does not exist. */
export async function getAccountBalance(accountId: string): Promise<WalletBalance> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_balances")
    .select(BALANCE_COLUMNS)
    .eq("account_id", accountId)
    .maybeSingle<BalanceRow>();

  if (error) throw error;
  if (!data) throw new ApiHttpError("NOT_FOUND", { message: "Account not found." });
  return toWalletBalance(data);
}

/**
 * Balances for several accounts at once, keyed by account id. Used after a
 * posting to build responses like FundCardResponse without N round trips.
 */
export async function getAccountBalances(accountIds: string[]): Promise<Map<string, WalletBalance>> {
  if (accountIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_balances")
    .select(BALANCE_COLUMNS)
    .in("account_id", accountIds)
    .returns<BalanceRow[]>();

  if (error) throw error;

  const out = new Map<string, WalletBalance>();
  for (const row of data ?? []) out.set(row.account_id, toWalletBalance(row));
  return out;
}
