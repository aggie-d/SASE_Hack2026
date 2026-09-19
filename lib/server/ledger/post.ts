import "server-only";

import type { Asset } from "@/lib/contracts";
import { parseMinorUnits } from "@/lib/contracts/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError } from "@/lib/server/http";

import type { AccountRef } from "./accounts";
import {
  LedgerError,
  ledgerErrorFrom,
  type JournalEntryInput,
  type JournalEntryRow,
  type JournalRow,
  type JournalType,
  type PostJournalInput,
} from "./types";

/**
 * Journal posting.
 *
 * The four ledger rules, and where each is enforced:
 *   1. All money is bigint            → assertBigint here, string-only jsonb in SQL
 *   2. Every journal balances/asset   → assertBalanced here, re-checked in SQL
 *   3. Never edit a past entry        → no update path exists; reverseJournal posts a new one
 *   4. Lock accounts in a fixed order → SQL: SELECT … ORDER BY id FOR UPDATE
 *
 * The TS checks exist to fail fast with a clear message before a round trip;
 * the SQL function (ledger_post_journal) is the source of truth and runs the
 * same checks inside the transaction.
 *
 *   const acct = await getUserAccounts(userId);
 *   const clearing = await getSystemAccount("collection_clearing", "MWK");
 *   await postJournal({
 *     operationId: depositId,
 *     type: "deposit",
 *     entries: [debit(clearing, 20400000n), credit(acct.mwk_wallet, 20400000n)],
 *   });
 */

// ─── Entry builders ─────────────────────────────────────────────────────────

/** Debit `units` from an account (money leaves it, for liability accounts). */
export function debit(account: AccountRef, units: bigint): JournalEntryInput {
  return { accountId: account.id, asset: account.asset, debitUnits: units, creditUnits: 0n };
}

/** Credit `units` to an account (money arrives, for liability accounts). */
export function credit(account: AccountRef, units: bigint): JournalEntryInput {
  return { accountId: account.id, asset: account.asset, debitUnits: 0n, creditUnits: units };
}

// ─── Validation (pure; unit-tested) ─────────────────────────────────────────

function invalid(message: string, detail?: string): LedgerError {
  return new LedgerError("TS_VALIDATION", { code: "VALIDATION_ERROR", message, detail });
}

/** Rule 1: units must be bigint. A Number anywhere is a bug, not a rounding issue. */
export function assertBigint(value: unknown, label: string): asserts value is bigint {
  if (typeof value !== "bigint") {
    throw invalid(`${label} must be a bigint, got ${typeof value}`);
  }
  if (value < 0n) {
    throw invalid(`${label} must not be negative`);
  }
}

/** Each entry is exactly one-sided: debit XOR credit, and that side > 0. */
export function assertOneSide(entry: JournalEntryInput, index: number): void {
  assertBigint(entry.debitUnits, `entries[${index}].debitUnits`);
  assertBigint(entry.creditUnits, `entries[${index}].creditUnits`);
  const hasDebit = entry.debitUnits > 0n;
  const hasCredit = entry.creditUnits > 0n;
  if (hasDebit === hasCredit) {
    throw invalid(`entries[${index}] must have exactly one of debitUnits or creditUnits > 0`);
  }
}

/** Rule 2: per asset, SUM(debit) === SUM(credit). Never mixes assets. */
export function assertBalanced(entries: JournalEntryInput[]): void {
  const sums = new Map<Asset, { debit: bigint; credit: bigint }>();
  for (const e of entries) {
    const s = sums.get(e.asset) ?? { debit: 0n, credit: 0n };
    s.debit += e.debitUnits;
    s.credit += e.creditUnits;
    sums.set(e.asset, s);
  }
  const unbalanced: string[] = [];
  for (const [asset, s] of sums) {
    if (s.debit !== s.credit) unbalanced.push(`${asset} debit=${s.debit} credit=${s.credit}`);
  }
  if (unbalanced.length > 0) {
    throw invalid("Journal does not balance", unbalanced.join("; "));
  }
}

/** Full pre-flight check for a PostJournalInput. Throws LedgerError. */
export function validateJournal(input: PostJournalInput): void {
  if (!input.operationId) throw invalid("operationId is required");
  if (!input.type) throw invalid("type is required");
  if (!Array.isArray(input.entries) || input.entries.length < 2) {
    throw invalid("A journal needs at least two entries");
  }
  input.entries.forEach((e, i) => {
    if (!e.accountId) throw invalid(`entries[${i}].accountId is required`);
    if (!e.asset) throw invalid(`entries[${i}].asset is required`);
    assertOneSide(e, i);
  });
  assertBalanced(input.entries);
}

// ─── Wire format ────────────────────────────────────────────────────────────

type WireEntry = { account_id: string; asset: Asset; debit_units: string; credit_units: string };

/** bigint → decimal string; the SQL function rejects JSON numbers on purpose. */
export function serializeEntries(entries: JournalEntryInput[]): WireEntry[] {
  return entries.map((e) => ({
    account_id: e.accountId,
    asset: e.asset,
    debit_units: e.debitUnits.toString(),
    credit_units: e.creditUnits.toString(),
  }));
}

// ─── Posting ────────────────────────────────────────────────────────────────

/**
 * Post a balanced journal atomically. Idempotent on (operationId, type):
 * a retry returns the original journalId without posting again.
 *
 * Throws LedgerError:
 *   INSUFFICIENT_FUNDS  a user account would end with available < 0
 *   VALIDATION_ERROR    TS pre-flight failed (bad shape / unbalanced / Number)
 *   NOT_FOUND           unknown account id
 *   INTERNAL_ERROR      SQL-side invariant failure (server bug)
 */
export async function postJournal(input: PostJournalInput): Promise<{ journalId: string }> {
  validateJournal(input);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ledger_post_journal", {
    p_operation_id: input.operationId,
    p_type: input.type,
    p_entries: serializeEntries(input.entries),
    p_consume_hold_ids: input.consumeHoldIds ?? [],
    p_reversal_of: input.reversalOf ?? null,
  });

  if (error) throw ledgerErrorFrom(error);
  if (typeof data !== "string") {
    throw new LedgerError("TS_VALIDATION", {
      code: "INTERNAL_ERROR",
      message: "Ledger returned no journal id.",
    });
  }
  return { journalId: data };
}

// ─── Reading back ───────────────────────────────────────────────────────────

type JournalWithEntriesRaw = Omit<JournalRow, never> & {
  journal_entries: Array<Omit<JournalEntryRow, "debit_units" | "credit_units"> & {
    debit_units: string | number;
    credit_units: string | number;
  }>;
};

export type JournalWithEntries = JournalRow & { entries: JournalEntryRow[] };

/** A journal with its entries, or null. Units are parsed to bigint. */
export async function getJournal(journalId: string): Promise<JournalWithEntries | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("journals")
    .select(
      "id, operation_id, type, status, reversal_of, created_at, " +
        "journal_entries(id, journal_id, account_id, asset, debit_units, credit_units)",
    )
    .eq("id", journalId)
    .maybeSingle<JournalWithEntriesRaw>();

  if (error) throw ledgerErrorFrom(error);
  if (!data) return null;

  const { journal_entries, ...journal } = data;
  return {
    ...journal,
    entries: journal_entries.map((e) => ({
      ...e,
      debit_units: parseMinorUnits(e.debit_units),
      credit_units: parseMinorUnits(e.credit_units),
    })),
  };
}

/** All journals for an operation (e.g. card_auth + card_capture for one purchase). */
export async function getJournalsForOperation(operationId: string): Promise<JournalRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("journals")
    .select("id, operation_id, type, status, reversal_of, created_at")
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true })
    .returns<JournalRow[]>();

  if (error) throw ledgerErrorFrom(error);
  return data ?? [];
}

// ─── Reversal ───────────────────────────────────────────────────────────────

/**
 * Rule 3: never edit — compensate. Reads the original journal and posts a new
 * one with every entry mirrored (debits become credits and vice versa), linked
 * via reversal_of. The SQL function marks the original `reversed` and refuses
 * to reverse it twice.
 *
 * Idempotent on (operationId, type) like any other post.
 */
export async function reverseJournal(params: {
  journalId: string;
  operationId: string;
  type: Extract<JournalType, "card_reversal" | "refund" | "deposit" | "conversion" | "fee">;
}): Promise<{ journalId: string }> {
  const original = await getJournal(params.journalId);
  if (!original) {
    throw new ApiHttpError("NOT_FOUND", { message: "Journal to reverse was not found." });
  }
  if (original.status !== "posted") {
    throw new LedgerError("LEDGER_REVERSAL_INVALID", {
      detail: `journal ${params.journalId} is ${original.status}`,
    });
  }

  const mirrored: JournalEntryInput[] = original.entries.map((e) => ({
    accountId: e.account_id,
    asset: e.asset,
    debitUnits: e.credit_units,
    creditUnits: e.debit_units,
  }));

  return postJournal({
    operationId: params.operationId,
    type: params.type,
    entries: mirrored,
    reversalOf: params.journalId,
  });
}
