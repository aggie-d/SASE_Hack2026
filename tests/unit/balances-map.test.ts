import { describe, expect, it } from "vitest";

import { MoneyError } from "@/lib/contracts/money";
import { toWalletBalance } from "@/lib/server/ledger/balances";

/**
 * account_balances view row → WalletBalance (lib/server/ledger/balances.ts).
 * The view returns unit columns as text after the ledger_functions migration;
 * the mapper also tolerates JSON numbers (older view / other int8 columns)
 * but must never accept an unsafe or non-integer value.
 */

const base = {
  account_id: "11111111-1111-4111-8111-111111111111",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
};

describe("toWalletBalance", () => {
  it("maps string units and sets exponent 2 for MWK", () => {
    const w = toWalletBalance({
      ...base,
      purpose: "mwk_wallet",
      asset: "MWK",
      posted_units: "20400000",
      held_units: "0",
      available_units: "20400000",
    });
    expect(w).toEqual({
      account_id: base.account_id,
      asset: "MWK",
      purpose: "mwk_wallet",
      posted_units: "20400000",
      held_units: "0",
      available_units: "20400000",
      exponent: 2,
    });
  });

  it("sets exponent 6 for USDT and keeps held/available distinct", () => {
    const w = toWalletBalance({
      ...base,
      purpose: "usdt_wallet",
      asset: "USDT",
      posted_units: "99960000",
      held_units: "20000000",
      available_units: "79960000",
    });
    expect(w.exponent).toBe(6);
    expect(w.posted_units).toBe("99960000");
    expect(w.held_units).toBe("20000000");
    expect(w.available_units).toBe("79960000");
  });

  it("does not leak owner_user_id into the wire shape", () => {
    const w = toWalletBalance({
      ...base,
      purpose: "card_funding",
      asset: "USDT",
      posted_units: "0",
      held_units: "0",
      available_units: "0",
    });
    expect(Object.keys(w).sort()).toEqual(
      ["account_id", "asset", "available_units", "exponent", "held_units", "posted_units", "purpose"].sort(),
    );
  });

  it("normalises string units (whitespace trimmed, canonical digits)", () => {
    const w = toWalletBalance({
      ...base,
      purpose: "mwk_wallet",
      asset: "MWK",
      posted_units: " 100 ",
      held_units: "0",
      available_units: "100",
    });
    expect(w.posted_units).toBe("100");
  });

  it("accepts negative balances (system accounts may go negative)", () => {
    const w = toWalletBalance({
      ...base,
      owner_user_id: null,
      purpose: "liquidity_inventory",
      asset: "USDT",
      posted_units: "-99960000",
      held_units: "0",
      available_units: "-99960000",
    });
    expect(w.posted_units).toBe("-99960000");
  });

  it("accepts safe-integer JSON numbers", () => {
    const w = toWalletBalance({
      ...base,
      purpose: "mwk_wallet",
      asset: "MWK",
      posted_units: 20400000,
      held_units: 0,
      available_units: 20400000,
    });
    expect(w.posted_units).toBe("20400000");
  });

  it("rejects unsafe JSON numbers instead of returning a rounded balance", () => {
    expect(() =>
      toWalletBalance({
        ...base,
        purpose: "mwk_wallet",
        asset: "MWK",
        posted_units: 2 ** 60,
        held_units: 0,
        available_units: 0,
      }),
    ).toThrow(MoneyError);
  });

  it("rejects non-integer numbers and strings", () => {
    const bad = [1.5, "1.5", "1e6", "abc", "", "12 34"];
    for (const v of bad) {
      expect(() =>
        toWalletBalance({
          ...base,
          purpose: "mwk_wallet",
          asset: "MWK",
          posted_units: v,
          held_units: "0",
          available_units: "0",
        }),
      ).toThrow(MoneyError);
    }
  });

  it("validates every unit column, not just posted", () => {
    expect(() =>
      toWalletBalance({
        ...base,
        purpose: "mwk_wallet",
        asset: "MWK",
        posted_units: "0",
        held_units: "oops",
        available_units: "0",
      }),
    ).toThrow(MoneyError);
    expect(() =>
      toWalletBalance({
        ...base,
        purpose: "mwk_wallet",
        asset: "MWK",
        posted_units: "0",
        held_units: "0",
        available_units: "1.0",
      }),
    ).toThrow(MoneyError);
  });
});
