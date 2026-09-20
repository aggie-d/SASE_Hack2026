import type { DemoEventResponse } from "@/lib/contracts";
import { requireOperator } from "@/lib/server/auth";
import { applyDepositEvent, finishConversion, getConversionForOperator, getDepositForOperator, recordFxTimeout } from "@/lib/server/deposits-fx";
import { ApiHttpError, field, ok, parseBody, route } from "@/lib/server/http";

// Workstream D can extend this operator-only route with card outcomes.
export const POST = route(async (req) => {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") throw new ApiHttpError("NOT_FOUND");
  await requireOperator();
  const body = await parseBody(req, (b) => ({
    operation_id: field.uuid(b, "operation_id"),
    outcome: field.oneOf(b, "outcome", ["deposit_confirmed", "deposit_failed", "conversion_completed", "conversion_failed", "provider_timeout"] as const),
  }));
  const { operation_id: id, outcome } = body;
  const eventId = `demo_${id}_${outcome}`;
  let applied = false;
  let duplicate = false;
  if (outcome.startsWith("deposit_")) {
    const deposit = await getDepositForOperator(id);
    if (!deposit.provider_reference) throw new ApiHttpError("VALIDATION_ERROR");
    const result = await applyDepositEvent({
      event_id: eventId, provider_reference: deposit.provider_reference,
      outcome: outcome === "deposit_confirmed" ? "confirmed" : "failed",
      asset: "MWK", amount_units: String(deposit.amount_units),
    });
    if (!result.applied && !result.duplicate) throw new ApiHttpError("IDEMPOTENCY_CONFLICT", { message: "Event needs reconciliation; deposit is already terminal." });
    applied = result.applied;
    duplicate = result.duplicate;
  } else {
    const conversion = await getConversionForOperator(id);
    if (outcome === "conversion_failed" || outcome === "conversion_completed") {
      const target = outcome === "conversion_failed" ? "failed" : "completed";
      await finishConversion(conversion.id, target);
      applied = conversion.status === "pending";
      duplicate = conversion.status === target;
    } else {
      if (conversion.status !== "pending") throw new ApiHttpError("IDEMPOTENCY_CONFLICT", { message: "Conversion is already terminal." });
      duplicate = await recordFxTimeout(id, eventId);
    }
    // Timeout deliberately leaves the conversion and reservations pending.
  }
  return ok<DemoEventResponse>({ event_id: eventId, operation_id: id, outcome, applied, duplicate });
});
