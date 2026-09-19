import { describe, expect, it } from "vitest";

import { ApiHttpError } from "@/lib/server/http";
import { hashBody, requireIdempotencyKey, stableStringify } from "@/lib/server/idempotency";

/**
 * Pure parts of lib/server/idempotency.ts. The DB-backed flow (claim, replay,
 * conflict) is covered by the integration suite.
 */

describe("stableStringify", () => {
  it("sorts object keys recursively", () => {
    const a = { amount_units: "1000000", nested: { b: 1, a: 2 }, list: [{ z: 1, y: 2 }] };
    const b = { list: [{ y: 2, z: 1 }], nested: { a: 2, b: 1 }, amount_units: "1000000" };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(stableStringify(a)).toBe('{"amount_units":"1000000","list":[{"y":2,"z":1}],"nested":{"a":2,"b":1}}');
  });

  it("preserves array order (arrays are ordered data)", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it("drops undefined properties, keeps null", () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("serialises bigint as a string instead of throwing", () => {
    expect(stableStringify({ units: 20400000n })).toBe('{"units":"20400000"}');
  });

  it("handles primitives", () => {
    expect(stableStringify("x")).toBe('"x"');
    expect(stableStringify(5)).toBe("5");
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
  });
});

describe("hashBody", () => {
  it("is a 64-char lowercase hex sha256", async () => {
    const h = await hashBody({ amount_units: "1000000" });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same body with reordered keys hashes identically", async () => {
    const h1 = await hashBody({ method: "mobile_money", amount_units: "20400000" });
    const h2 = await hashBody({ amount_units: "20400000", method: "mobile_money" });
    expect(h1).toBe(h2);
  });

  it("different amounts hash differently", async () => {
    const h1 = await hashBody({ amount_units: "20400000" });
    const h2 = await hashBody({ amount_units: "20400001" });
    expect(h1).not.toBe(h2);
  });

  it("string vs number amount are different requests", async () => {
    // The API only accepts strings; a client that sends a number must not
    // silently replay a string-bodied request.
    const h1 = await hashBody({ amount_units: "100" });
    const h2 = await hashBody({ amount_units: 100 });
    expect(h1).not.toBe(h2);
  });

  it("is deterministic across calls", async () => {
    const body = { quote_id: "q-1" };
    expect(await hashBody(body)).toBe(await hashBody(body));
  });
});

describe("requireIdempotencyKey", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/x", { method: "POST", headers });

  it("returns the trimmed header value", () => {
    expect(requireIdempotencyKey(req({ "Idempotency-Key": "  abc-123  " }))).toBe("abc-123");
  });

  it("is case-insensitive on the header name", () => {
    expect(requireIdempotencyKey(req({ "idempotency-key": "k" }))).toBe("k");
  });

  it("throws 400 VALIDATION_ERROR when missing or blank", () => {
    for (const r of [req({}), req({ "Idempotency-Key": "   " })]) {
      try {
        requireIdempotencyKey(r);
        throw new Error("expected throw");
      } catch (e) {
        expect(e).toBeInstanceOf(ApiHttpError);
        expect((e as ApiHttpError).code).toBe("VALIDATION_ERROR");
        expect((e as ApiHttpError).status).toBe(400);
        expect((e as ApiHttpError).message).toContain("Idempotency-Key");
      }
    }
  });

  it("throws 400 when the key is oversized", () => {
    expect(() => requireIdempotencyKey(req({ "Idempotency-Key": "k".repeat(201) }))).toThrow(ApiHttpError);
    expect(() => requireIdempotencyKey(req({ "Idempotency-Key": "k".repeat(200) }))).not.toThrow();
  });
});
