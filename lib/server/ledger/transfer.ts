import "server-only";

import type { WalletBalance } from "@/lib/contracts";
import { assertSameAsset, money } from "@/lib/contracts/money";

import { getUserAccounts, type UserAccountPurpose } from "./accounts";
import { getAccountBalances } from "./balances";
import { assertBigint, credit, debit, postJournal } from "./post";
import { LedgerError, type JournalType } from "./types";

/**
 * Internal transfer between two accounts owned by the same user.
 * Used by POST /api/v1/cards/:id/fund (usdt_wallet → card_funding).
 *
 * Ownership is enforced by construction: both accounts are resolved through
 * getUserAccounts(userId), so a caller cannot name someone else's account.
 * Same-asset is enforced here and again in SQL (per-asset balance check).
 */
export async function transferBetweenUserAccounts(params: {
  userId: string;
  /** Idempotency anchor; reuse it on retry to get the same journal back. */
  operationId: string;
  from: UserAccountPurpose;
  to: UserAccountPurpose;
  amountUnits: bigint;
  type?: Extract<JournalType, "card_fund">;
}): Promise<{ journalId: string; from: WalletBalance; to: WalletBalance }> {
  assertBigint(params.amountUnits, "amountUnits");
  if (params.amountUnits <= 0n) {
    throw new LedgerError("TS_VALIDATION", {
      code: "VALIDATION_ERROR",
      message: "Transfer amount must be greater than zero.",
    });
  }
  if (params.from === params.to) {
    throw new LedgerError("TS_VALIDATION", {
      code: "VALIDATION_ERROR",
      message: "Source and destination accounts must differ.",
    });
  }

  const accounts = await getUserAccounts(params.userId);
  const fromAcct = accounts[params.from];
  const toAcct = accounts[params.to];

  // Rule: never mix assets. money() + assertSameAsset throws MoneyError (→ 400).
  assertSameAsset(money(fromAcct.asset, params.amountUnits), money(toAcct.asset, params.amountUnits));

  const { journalId } = await postJournal({
    operationId: params.operationId,
    type: params.type ?? "card_fund",
    entries: [debit(fromAcct, params.amountUnits), credit(toAcct, params.amountUnits)],
  });

  const balances = await getAccountBalances([fromAcct.id, toAcct.id]);
  const from = balances.get(fromAcct.id);
  const to = balances.get(toAcct.id);
  if (!from || !to) {
    throw new LedgerError("TS_VALIDATION", {
      code: "INTERNAL_ERROR",
      message: "Could not read balances after transfer.",
    });
  }

  return { journalId, from, to };
}
