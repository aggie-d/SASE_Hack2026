import "server-only";

import { parseMinorUnits } from "@/lib/contracts/money";
import { createAdminClient } from "@/lib/supabase/admin";

import { assertBigint } from "./post";
import { LedgerError, ledgerErrorFrom, type HoldRow } from "./types";

/**
 * Holds reserve part of an account's available balance without moving money:
 *   available = posted − Σ active holds
 *
 * Lifecycle
 *   placeHold      → active           (card authorisation, pending conversion)
 *   postJournal({ consumeHoldIds })   → consumed, in the same transaction as
 *                                       the debit that settles it (capture)
 *   releaseHold    → released         (authorisation reversed / expired)
 *
 * There is deliberately no standalone "consume": consuming without posting
 * the matching debit would make money disappear from `held` without arriving
 * anywhere. Use postJournal({ consumeHoldIds: [holdId] }).
 */

/**
 * Reserve `amountUnits` on an account. Idempotent on (accountId, operationId):
 * a retry returns the existing hold rather than reserving twice.
 *
 * Throws LedgerError INSUFFICIENT_FUNDS if available < amountUnits.
 */
export async function placeHold(params: {
  accountId: string;
  operationId: string;
  amountUnits: bigint;
  expiresAt?: Date | string | null;
}): Promise<{ holdId: string }> {
  assertBigint(params.amountUnits, "amountUnits");
  if (params.amountUnits <= 0n) {
    throw new LedgerError("TS_VALIDATION", {
      code: "VALIDATION_ERROR",
      message: "Hold amount must be greater than zero.",
    });
  }

  const expiresAt =
    params.expiresAt instanceof Date ? params.expiresAt.toISOString() : (params.expiresAt ?? null);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ledger_place_hold", {
    p_account_id: params.accountId,
    p_operation_id: params.operationId,
    // bigint → string; PostgREST coerces to the function's bigint parameter.
    p_amount_units: params.amountUnits.toString(),
    p_expires_at: expiresAt,
  });

  if (error) throw ledgerErrorFrom(error);
  if (typeof data !== "string") {
    throw new LedgerError("TS_VALIDATION", { code: "INTERNAL_ERROR", message: "Ledger returned no hold id." });
  }
  return { holdId: data };
}

/**
 * active → released. Safe to call twice (released/expired is a no-op).
 * Throws LedgerError HOLD_NOT_ACTIVE if the hold was consumed — post a refund
 * journal instead, the money has already moved.
 */
export async function releaseHold(holdId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ledger_release_hold", { p_hold_id: holdId });
  if (error) throw ledgerErrorFrom(error);
}

type HoldRowRaw = Omit<HoldRow, "amount_units"> & { amount_units: string | number };

const HOLD_COLUMNS = "id, account_id, operation_id, amount_units, status, expires_at, created_at";

/** One hold, or null. amount_units parsed to bigint. */
export async function getHold(holdId: string): Promise<HoldRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("holds").select(HOLD_COLUMNS).eq("id", holdId).maybeSingle<HoldRowRaw>();

  if (error) throw ledgerErrorFrom(error);
  return data ? { ...data, amount_units: parseMinorUnits(data.amount_units) } : null;
}

/** The hold placed for an operation on an account, or null. */
export async function getHoldForOperation(accountId: string, operationId: string): Promise<HoldRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("holds")
    .select(HOLD_COLUMNS)
    .eq("account_id", accountId)
    .eq("operation_id", operationId)
    .maybeSingle<HoldRowRaw>();

  if (error) throw ledgerErrorFrom(error);
  return data ? { ...data, amount_units: parseMinorUnits(data.amount_units) } : null;
}
