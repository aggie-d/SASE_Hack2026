import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { toMinorUnits } from "@/lib/contracts/money";
import { verifyMockEvent } from "@/lib/server/deposits-fx";
import { calculateMockQuote } from "@/lib/server/fx-calculation";

const SECRET = "a-sufficiently-long-unique-test-webhook-secret";
const event = {
  event_id: "event_123", provider_reference: "mock_collection_11111111-1111-4111-8111-111111111111",
  amount_units: "20400000", asset: "MWK", outcome: "confirmed",
};

afterEach(() => { delete process.env.MOCK_WEBHOOK_SECRET; });

describe("mock quote", () => {
  it("uses the brief's tambala, fee and micro-USDT example", () => {
    expect(calculateMockQuote(toMinorUnits("204000", "MWK"))).toEqual({
      fee: 408000n, destination: 99960000n,
    });
  });

  it("floors a non-integral micro-USDT destination", () => {
    expect(calculateMockQuote(toMinorUnits("1", "MWK"))).toEqual({ fee: 2n, destination: 490n });
  });
});

describe("signed collection callbacks", () => {
  it("accepts an exact signed raw payload", () => {
    process.env.MOCK_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify(event);
    const signature = createHmac("sha256", SECRET).update(raw).digest("hex");
    expect(verifyMockEvent(raw, signature)).toEqual(event);
    expect(() => verifyMockEvent(JSON.stringify({ ...event, amount_units: "20400001" }), signature))
      .toThrow("Invalid mock webhook signature");
  });

  it("rejects malformed event fields even with a valid signature", () => {
    process.env.MOCK_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ ...event, asset: "USDT" });
    const signature = createHmac("sha256", SECRET).update(raw).digest("hex");
    expect(() => verifyMockEvent(raw, signature)).toThrow("Malformed mock collection event");
  });
});
