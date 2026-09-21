import "server-only";

import { ApiHttpError } from "@/lib/server/http";

export type FxOutcome = "completed" | "pending" | "failed";

/** Stable mock operation reference; an ambiguous timeout must stay pending. */
export class MockFxProvider {
  reference(operationId: string): string { return `mock_fx_${operationId}`; }

  async executeConversion(operationId: string): Promise<FxOutcome> {
    if (!operationId) throw new ApiHttpError("INTERNAL_ERROR", { message: "Missing mock FX operation ID." });
    const configured = process.env.MOCK_FX_OUTCOME ?? "completed";
    if (configured !== "completed" && configured !== "pending" && configured !== "failed") {
      throw new ApiHttpError("INTERNAL_ERROR", { message: "Invalid MOCK_FX_OUTCOME." });
    }
    return configured;
  }
}
