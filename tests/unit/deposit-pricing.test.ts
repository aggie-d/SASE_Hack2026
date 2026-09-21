import { describe, expect, it } from "vitest";

import {
  divideByRate,
  multiplyByRate,
  parseMajorToMinor2,
  priceDeposit,
} from "@/lib/server/deposit-pricing";

describe("server-side deposit pricing", () => {
  it("parses display amounts into exponent-2 minor units", () => {
    expect(parseMajorToMinor2("50,000")).toBe(5_000_000n);
    expect(parseMajorToMinor2("12.5")).toBe(1_250n);
    expect(parseMajorToMinor2(8)).toBe(800n);
    expect(() => parseMajorToMinor2("1.234")).toThrow();
    expect(() => parseMajorToMinor2("-5")).toThrow();
    expect(() => parseMajorToMinor2("abc")).toThrow();
  });

  it("divides and multiplies by decimal rates with floor rounding", () => {
    expect(divideByRate(5_000_000n, "1736.967434")).toBe(2878n); // 50,000 MWK → $28.78
    expect(multiplyByRate(282_800n, "1.000471")).toBe(282_933n); // 28.28 USD in micro-ish units × USDT/USD
    expect(() => divideByRate(1n, "0")).toThrow();
  });

  it("prices 50,000 MWK exactly like the deposit page preview", () => {
    const p = priceDeposit({
      amount: "50,000",
      currency: "MWK",
      ratePerUsd: "1736.967434",
      usdtPerUsd: "1.000471",
    });
    expect(p.grossUsdCents).toBe(2878n);
    expect(p.feeUsdCents).toBe(50n);
    expect(p.netUsdCents).toBe(2828n);
    // 28.28 USD × 1.000471 = 28.29331988 USDT → floored to micro-USDT
    expect(p.usdtUnits).toBe(28_293_319n);
  });

  it("treats USD as 1:1 before the fee and USDT peg", () => {
    const p = priceDeposit({ amount: "100", currency: "usd", ratePerUsd: "ignored", usdtPerUsd: "1" });
    expect(p.currency).toBe("USD");
    expect(p.ratePerUsd).toBe("1");
    expect(p.netUsdCents).toBe(9_950n);
    expect(p.usdtUnits).toBe(99_500_000n);
  });

  it("never goes negative when the fee exceeds the amount", () => {
    const p = priceDeposit({ amount: "500", currency: "MWK", ratePerUsd: "1736.967434", usdtPerUsd: "1" });
    expect(p.grossUsdCents).toBe(28n);
    expect(p.netUsdCents).toBe(0n);
    expect(p.usdtUnits).toBe(0n);
  });

  it("ignores nothing the client says: identical inputs give identical credits", () => {
    const a = priceDeposit({ amount: "50000", currency: "MWK", ratePerUsd: "1736.967434", usdtPerUsd: "1.000471" });
    const b = priceDeposit({ amount: "50,000.00", currency: "mwk", ratePerUsd: "1736.967434", usdtPerUsd: "1.000471" });
    expect(a.usdtUnits).toBe(b.usdtUnits);
  });
});
