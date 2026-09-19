import "server-only";

import type { AccountPurpose, Asset } from "@/lib/contracts";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError } from "@/lib/server/http";

/**
 * Account lookup — the one place other workstreams go to find out WHICH
 * account to debit or credit. Nobody else should query `accounts` directly.
 *
 *   const acct = await getUserAccounts(userId);
 *   acct.mwk_wallet.id      // credit on deposit confirmation
 *   acct.usdt_wallet.id     // credit on conversion, debit on card funding
 *   acct.card_funding.id    // debit on card capture
 *
 *   const clearing = await getSystemAccount("collection_clearing", "MWK");
 */

/** Purposes that every user owns exactly one of (created by the signup trigger). */
export const USER_ACCOUNT_PURPOSES = ["mwk_wallet", "usdt_wallet", "card_funding"] as const;
export type UserAccountPurpose = (typeof USER_ACCOUNT_PURPOSES)[number];

/** Platform-owned accounts (owner_user_id IS NULL). */
export type SystemAccountPurpose = Exclude<AccountPurpose, UserAccountPurpose>;

export type AccountRef = { id: string; asset: Asset };
export type AccountRow = AccountRef & {
  owner_user_id: string | null;
  purpose: AccountPurpose;
  status: "active" | "frozen";
};

export type UserAccounts = Record<UserAccountPurpose, AccountRef>;

const ACCOUNT_COLUMNS = "id, owner_user_id, purpose, asset, status";

export function isUserAccountPurpose(p: AccountPurpose): p is UserAccountPurpose {
  return (USER_ACCOUNT_PURPOSES as readonly string[]).includes(p);
}

/**
 * The three accounts owned by a user, keyed by purpose.
 * Throws INTERNAL_ERROR if any is missing — that means the signup trigger did
 * not run, which is a provisioning bug rather than a user error.
 */
export async function getUserAccounts(userId: string): Promise<UserAccounts> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("owner_user_id", userId)
    .in("purpose", [...USER_ACCOUNT_PURPOSES])
    .returns<AccountRow[]>();

  if (error) throw error;

  const found: Partial<UserAccounts> = {};
  for (const row of data ?? []) {
    if (isUserAccountPurpose(row.purpose)) {
      found[row.purpose] = { id: row.id, asset: row.asset };
    }
  }

  const missing = USER_ACCOUNT_PURPOSES.filter((p) => !found[p]);
  if (missing.length > 0) {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: `User ${userId} is missing ledger accounts: ${missing.join(", ")}`,
      details: { missing },
    });
  }
  return found as UserAccounts;
}

/** One platform account by purpose and asset, e.g. ("fee_revenue", "USDT"). */
export async function getSystemAccount(purpose: SystemAccountPurpose, asset: Asset): Promise<AccountRef> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .is("owner_user_id", null)
    .eq("purpose", purpose)
    .eq("asset", asset)
    .maybeSingle<AccountRow>();

  if (error) throw error;
  if (!data) {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: `System account ${purpose}/${asset} is not provisioned.`,
      details: { purpose, asset },
    });
  }
  return { id: data.id, asset: data.asset };
}

/** Fetch one account row by id, or null. */
export async function getAccount(accountId: string): Promise<AccountRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("id", accountId)
    .maybeSingle<AccountRow>();

  if (error) throw error;
  return data ?? null;
}

/**
 * Assert that `accountId` is owned by `userId`. Throws 403 FORBIDDEN both when
 * the account belongs to someone else and when it does not exist, so callers
 * cannot probe for account ids. Returns the row for convenience.
 */
export async function assertAccountOwner(accountId: string, userId: string): Promise<AccountRow> {
  const row = await getAccount(accountId);
  if (!row || row.owner_user_id !== userId) {
    throw new ApiHttpError("FORBIDDEN");
  }
  return row;
}
