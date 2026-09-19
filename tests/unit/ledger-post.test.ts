import { describe, expect, it } from "vitest";

import type { AccountRef } from "@/lib/server/ledger/accounts";
import {
  assertBalanced,
  assertBigint,
  assertOneSide,
  credit,
  debit,
  serializeEntries,
  validateJournal,
} from "@/lib/server/ledger/post";
import { LedgerError, ledgerErrorFrom, type PostJournalInput } from "@/lib/server/ledger/types";

/**
 * Pure pre-flight checks in lib/server/ledger/post.ts. No database.
 * The SQL function enforces the same rules; these tests pin the TS side so a
 * bad journal fails before the round trip with a clear message.
 */

const mwkWallet: AccountRef = { id: "11111111-1111-4111-8111-111111111111", asset: "MWK" };
const clearing: AccountRef = { id: "22222222-2222-4222-8222-222222222222", asset: "MWK" };
const usdtWallet: AccountRef = { id: "33333333-3333-4333-8333-333333333333", asset: "USDT" };
const liquidity: AccountRef = { id: "44444444-4444-4444-8444-444444444444", asset: "USDT" };

const op = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function journal(entries: PostJournalInput["entries"]): PostJournalInput {
  return { operationId: op, type: "deposit", entries };
}

function expectLedgerError(fn: () => void, messagePart: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(LedgerError);
    const err = e as LedgerError;
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.status).toBe(400);
    expect(err.sqlCode).toBe("TS_VALIDATION");
    expect(err.message).toContain(messagePart);
    return;
  }
  throw new Error("expected a LedgerError to be thrown");
}

describe("entry builders", () => {
  it("debit() and credit() take asset from the account and zero the other side", () => {
    expect(debit(clearing, 20400000n)).toEqual({
      accountId: clearing.id,
      asset: "MWK",
      debitUnits: 20400000n,
      creditUnits: 0n,
    });
    expect(credit(mwkWallet, 20400000n)).toEqual({
      accountId: mwkWallet.id,
      asset: "MWK",
      debitUnits: 0n,
      creditUnits: 20400000n,
    });
  });
});

describe("validateJournal", () => {
  it("accepts a balanced two-entry journal", () => {
    expect(() => validateJournal(journal([debit(clearing, 20400000n), credit(mwkWallet, 20400000n)]))).not.toThrow();
  });

  it("accepts a balanced multi-asset journal when each asset balances on its own", () => {
    // Conversion: MWK leg and USDT leg posted together, each balanced.
    const entries = [
      debit(mwkWallet, 20400000n),
      credit(clearing, 20400000n),
      debit(liquidity, 99960000n),
      credit(usdtWallet, 99960000n),
    ];
    expect(() => validateJournal(journal(entries))).not.toThrow();
  });

  it("rejects an unbalanced journal within one asset", () => {
    expectLedgerError(
      () => validateJournal(journal([debit(clearing, 100n), credit(mwkWallet, 90n)])),
      "does not balance",
    );
  });

  it("rejects MWK debit vs USDT credit even when numerically equal", () => {
    // 100 tambala and 100 micro-USDT are not the same money.
    expectLedgerError(
      () => validateJournal(journal([debit(clearing, 100n), credit(usdtWallet, 100n)])),
      "does not balance",
    );
  });

  it("rejects an entry with both debit and credit set", () => {
    expectLedgerError(
      () =>
        validateJournal(
          journal([
            { accountId: clearing.id, asset: "MWK", debitUnits: 100n, creditUnits: 100n },
            credit(mwkWallet, 0n),
          ]),
        ),
      "exactly one of debitUnits or creditUnits",
    );
  });

  it("rejects an entry with neither side set", () => {
    expectLedgerError(
      () =>
        validateJournal(
          journal([
            { accountId: clearing.id, asset: "MWK", debitUnits: 0n, creditUnits: 0n },
            credit(mwkWallet, 0n),
          ]),
        ),
      "exactly one of debitUnits or creditUnits",
    );
  });

  it("rejects Number units (rule: no number arithmetic)", () => {
    const bad = { accountId: clearing.id, asset: "MWK" as const, debitUnits: 100 as unknown as bigint, creditUnits: 0n };
    expectLedgerError(() => validateJournal(journal([bad, credit(mwkWallet, 100n)])), "must be a bigint, got number");
  });

  it("rejects string units", () => {
    const bad = { accountId: clearing.id, asset: "MWK" as const, debitUnits: "100" as unknown as bigint, creditUnits: 0n };
    expectLedgerError(() => validateJournal(journal([bad, credit(mwkWallet, 100n)])), "must be a bigint, got string");
  });

  it("rejects negative units", () => {
    expectLedgerError(
      () => validateJournal(journal([debit(clearing, -100n), credit(mwkWallet, -100n)])),
      "must not be negative",
    );
  });

  it("rejects fewer than two entries", () => {
    expectLedgerError(() => validateJournal(journal([debit(clearing, 100n)])), "at least two entries");
    expectLedgerError(() => validateJournal(journal([])), "at least two entries");
  });

  it("rejects a missing operationId or type", () => {
    expectLedgerError(
      () => validateJournal({ operationId: "", type: "deposit", entries: [debit(clearing, 1n), credit(mwkWallet, 1n)] }),
      "operationId is required",
    );
    expectLedgerError(
      () =>
        validateJournal({
          operationId: op,
          type: "" as unknown as "deposit",
          entries: [debit(clearing, 1n), credit(mwkWallet, 1n)],
        }),
      "type is required",
    );
  });

  it("rejects an entry with no accountId", () => {
    expectLedgerError(
      () =>
        validateJournal(
          journal([{ accountId: "", asset: "MWK", debitUnits: 1n, creditUnits: 0n }, credit(mwkWallet, 1n)]),
        ),
      "accountId is required",
    );
  });
});

describe("individual assertions", () => {
  it("assertBigint accepts 0n and large values", () => {
    expect(() => assertBigint(0n, "x")).not.toThrow();
    expect(() => assertBigint(2n ** 62n, "x")).not.toThrow();
  });

  it("assertOneSide names the offending index", () => {
    expectLedgerError(
      () => assertOneSide({ accountId: "a", asset: "MWK", debitUnits: 1n, creditUnits: 1n }, 3),
      "entries[3]",
    );
  });

  it("assertBalanced reports every unbalanced asset", () => {
    try {
      assertBalanced([debit(clearing, 10n), credit(mwkWallet, 5n), debit(liquidity, 7n), credit(usdtWallet, 1n)]);
    } catch (e) {
      const err = e as LedgerError;
      expect(err.detail).toContain("MWK debit=10 credit=5");
      expect(err.detail).toContain("USDT debit=7 credit=1");
      return;
    }
    throw new Error("expected throw");
  });
});

describe("serializeEntries", () => {
  it("serialises bigint units to decimal strings and snake_case keys", () => {
    expect(serializeEntries([debit(clearing, 20400000n), credit(mwkWallet, 20400000n)])).toEqual([
      { account_id: clearing.id, asset: "MWK", debit_units: "20400000", credit_units: "0" },
      { account_id: mwkWallet.id, asset: "MWK", debit_units: "0", credit_units: "20400000" },
    ]);
  });

  it("keeps values above Number.MAX_SAFE_INTEGER exact", () => {
    const big = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2
    const [e] = serializeEntries([debit(liquidity, big)]);
    expect(e.debit_units).toBe("9007199254740993");
    expect(JSON.stringify(e)).not.toContain("9007199254740992"); // what Number would have produced
  });
});

describe("ledgerErrorFrom (SQL → API mapping)", () => {
  it("maps P0001 INSUFFICIENT_FUNDS to 422", () => {
    const err = ledgerErrorFrom({ code: "P0001", message: "INSUFFICIENT_FUNDS", details: "requested 5, available 1" });
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
    expect(err.status).toBe(422);
    expect(err.sqlCode).toBe("INSUFFICIENT_FUNDS");
    expect(err.detail).toBe("requested 5, available 1");
  });

  it("maps invariant failures to 500 (server bug, not user error)", () => {
    for (const sql of ["LEDGER_UNBALANCED", "LEDGER_INVALID_ENTRIES", "LEDGER_ASSET_MISMATCH"]) {
      const err = ledgerErrorFrom({ code: "P0001", message: sql });
      expect(err.code).toBe("INTERNAL_ERROR");
      expect(err.status).toBe(500);
    }
  });

  it("maps not-found and state codes", () => {
    expect(ledgerErrorFrom({ code: "P0001", message: "LEDGER_ACCOUNT_NOT_FOUND" }).status).toBe(404);
    expect(ledgerErrorFrom({ code: "P0001", message: "HOLD_NOT_FOUND" }).status).toBe(404);
    expect(ledgerErrorFrom({ code: "P0001", message: "HOLD_NOT_ACTIVE" }).status).toBe(400);
    expect(ledgerErrorFrom({ code: "P0001", message: "LEDGER_REVERSAL_INVALID" }).status).toBe(400);
  });

  it("wraps unknown Postgres errors as INTERNAL_ERROR and keeps the message in detail", () => {
    const err = ledgerErrorFrom({ code: "22003", message: "bigint out of range" });
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.detail).toContain("22003");
    expect(err.detail).toContain("bigint out of range");
  });
});
