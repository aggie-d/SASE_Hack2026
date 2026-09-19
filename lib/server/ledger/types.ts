import "server-only";

import type { Asset, ErrorCode } from "@/lib/contracts";
import { ApiHttpError } from "@/lib/server/http";

/**
 * Types shared by the ledger modules, plus the error bridge between the
 * Postgres functions (supabase/migrations/*_ledger_functions.sql) and the
 * HTTP error catalogue in lib/contracts.
 */

// ─── Enums (mirror Postgres; keep in sync with migrations) ──────────────────

export type JournalType =
  | "deposit"
  | "conversion"
  | "card_fund"
  | "card_auth"
  | "card_capture"
  | "card_reversal"
  | "refund"
  | "fee";

export type JournalStatus = "posted" | "reversed";
export type HoldStatus = "active" | "consumed" | "released" | "expired";

// ─── Inputs ─────────────────────────────────────────────────────────────────

/** One leg of a journal. Exactly one of debitUnits / creditUnits must be > 0. */
export type JournalEntryInput = {
  accountId: string;
  asset: Asset;
  debitUnits: bigint;
  creditUnits: bigint;
};

export type PostJournalInput = {
  /** Business operation this journal belongs to (deposit id, conversion id, transfer id…). */
  operationId: string;
  type: JournalType;
  entries: JournalEntryInput[];
  /** Active holds to mark consumed in the same transaction (card capture). */
  consumeHoldIds?: string[];
  /** Journal this one compensates. The original is marked `reversed`. */
  reversalOf?: string | null;
};

// ─── Rows (as read back from the database) ──────────────────────────────────

export type JournalRow = {
  id: string;
  operation_id: string;
  type: JournalType;
  status: JournalStatus;
  reversal_of: string | null;
  created_at: string;
};

export type JournalEntryRow = {
  id: string;
  journal_id: string;
  account_id: string;
  asset: Asset;
  debit_units: bigint;
  credit_units: bigint;
};

export type HoldRow = {
  id: string;
  account_id: string;
  operation_id: string;
  amount_units: bigint;
  status: HoldStatus;
  expires_at: string | null;
  created_at: string;
};

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Codes raised by the SQL functions via
 *   RAISE EXCEPTION USING MESSAGE = '<code>', ERRCODE = 'P0001'
 */
export type LedgerSqlCode =
  | "INSUFFICIENT_FUNDS"
  | "LEDGER_UNBALANCED"
  | "LEDGER_INVALID_ENTRIES"
  | "LEDGER_ASSET_MISMATCH"
  | "LEDGER_ACCOUNT_NOT_FOUND"
  | "LEDGER_INVALID_AMOUNT"
  | "LEDGER_REVERSAL_INVALID"
  | "HOLD_NOT_FOUND"
  | "HOLD_NOT_ACTIVE";

/**
 * SQL code → API error code.
 *
 * LEDGER_* codes mean server code built a bad journal (clients never send
 * entries), so they surface as 500 INTERNAL_ERROR rather than blaming the user.
 */
const SQL_TO_API: Record<LedgerSqlCode, { code: ErrorCode; message: string }> = {
  INSUFFICIENT_FUNDS: { code: "INSUFFICIENT_FUNDS", message: "Not enough available balance for this amount." },
  LEDGER_UNBALANCED: { code: "INTERNAL_ERROR", message: "Ledger journal did not balance." },
  LEDGER_INVALID_ENTRIES: { code: "INTERNAL_ERROR", message: "Ledger journal entries were malformed." },
  LEDGER_ASSET_MISMATCH: { code: "INTERNAL_ERROR", message: "Ledger entry asset did not match the account." },
  LEDGER_ACCOUNT_NOT_FOUND: { code: "NOT_FOUND", message: "Ledger account not found." },
  LEDGER_INVALID_AMOUNT: { code: "VALIDATION_ERROR", message: "Amount must be greater than zero." },
  LEDGER_REVERSAL_INVALID: { code: "VALIDATION_ERROR", message: "That journal cannot be reversed (already reversed or unknown)." },
  HOLD_NOT_FOUND: { code: "NOT_FOUND", message: "Hold not found." },
  HOLD_NOT_ACTIVE: { code: "VALIDATION_ERROR", message: "Hold is not active." },
};

export function isLedgerSqlCode(value: unknown): value is LedgerSqlCode {
  return typeof value === "string" && value in SQL_TO_API;
}

/**
 * Thrown by every ledger module. Extends ApiHttpError so the route() wrapper
 * turns it into the standard envelope with no extra handling.
 */
export class LedgerError extends ApiHttpError {
  /** Raw code from SQL, or a TS-side code when validation failed before the DB. */
  readonly sqlCode: LedgerSqlCode | "TS_VALIDATION";
  readonly detail?: string;

  constructor(
    sqlCode: LedgerSqlCode | "TS_VALIDATION",
    opts: { code?: ErrorCode; message?: string; detail?: string } = {},
  ) {
    const mapped = sqlCode === "TS_VALIDATION" ? undefined : SQL_TO_API[sqlCode];
    super(opts.code ?? mapped?.code ?? "INTERNAL_ERROR", {
      message: opts.message ?? mapped?.message,
      details: opts.detail ? { detail: opts.detail, sql_code: sqlCode } : { sql_code: sqlCode },
    });
    this.name = "LedgerError";
    this.sqlCode = sqlCode;
    this.detail = opts.detail;
  }
}

/** Shape of the error object supabase-js returns from .rpc() / queries. */
export type PostgrestErrorLike = {
  code?: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * Convert a PostgREST error into a LedgerError. P0001 with a known MESSAGE
 * becomes the mapped code; anything else is an INTERNAL_ERROR that keeps the
 * Postgres message in `detail` for the logs.
 */
export function ledgerErrorFrom(err: PostgrestErrorLike): LedgerError {
  if (err.code === "P0001" && isLedgerSqlCode(err.message)) {
    return new LedgerError(err.message, { detail: err.details ?? undefined });
  }
  return new LedgerError("TS_VALIDATION", {
    code: "INTERNAL_ERROR",
    message: "Ledger operation failed.",
    detail: `${err.code ?? "?"}: ${err.message}${err.details ? ` — ${err.details}` : ""}`,
  });
}
