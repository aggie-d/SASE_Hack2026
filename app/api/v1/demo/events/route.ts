import type { DemoEventOutcome, DemoEventResponse } from "@/lib/contracts";
import { requireOperator } from "@/lib/server/auth";
import { processDemoCardEvent } from "@/lib/server/cards/events";
import {
  applyDepositEvent,
  finishConversion,
  getConversionForOperator,
  getDepositForOperator,
  recordFxTimeout,
} from "@/lib/server/deposits-fx";
import { ApiHttpError, field, ok, parseBody, route } from "@/lib/server/http";

/**
 * POST /api/v1/demo/events — operator-only, demo mode only.
 *
 * One route for every simulated provider outcome so the operator UI has a
 * single place to drive the demo:
 *   - Workstream C: deposit_* , conversion_* , provider_timeout
 *   - Workstream D: capture , reversal , refund   (card authorizations)
 */

const DEPOSIT_OUTCOMES = ["deposit_confirmed", "deposit_failed"] as const;
const CONVERSION_OUTCOMES = ["conversion_completed", "conversion_failed", "provider_timeout"] as const;
const CARD_OUTCOMES = ["capture", "reversal", "refund"] as const;

const DEMO_OUTCOMES = [
  ...DEPOSIT_OUTCOMES,
  ...CONVERSION_OUTCOMES,
  ...CARD_OUTCOMES,
] as const satisfies readonly DemoEventOutcome[];

type DepositOutcome = (typeof DEPOSIT_OUTCOMES)[number];
type ConversionOutcome = (typeof CONVERSION_OUTCOMES)[number];
type CardOutcome = (typeof CARD_OUTCOMES)[number];

function isDepositOutcome(o: DemoEventOutcome): o is DepositOutcome {
  return (DEPOSIT_OUTCOMES as readonly string[]).includes(o);
}
function isCardOutcome(o: DemoEventOutcome): o is CardOutcome {
  return (CARD_OUTCOMES as readonly string[]).includes(o);
}

export const POST = route(async (req) => {
  // Hidden when demo mode is off — do not advertise the route with a 403.
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") throw new ApiHttpError("NOT_FOUND");
  await requireOperator();

  const body = await parseBody(req, (b) => ({
    operation_id: field.uuid(b, "operation_id"),
    outcome: field.oneOf(b, "outcome", DEMO_OUTCOMES),
  }));
  const { operation_id: id, outcome } = body;

  // ── Workstream D: card authorization outcomes ─────────────────────────────
  if (isCardOutcome(outcome)) {
    const result = await processDemoCardEvent({ operationId: id, outcome });
    return ok<DemoEventResponse>(result);
  }

  // ── Workstream C: deposits and FX (unchanged from develop) ────────────────
  const eventId = `demo_${id}_${outcome}`;
  let applied = false;
  let duplicate = false;

  if (isDepositOutcome(outcome)) {
    const deposit = await getDepositForOperator(id);
    if (!deposit.provider_reference) throw new ApiHttpError("VALIDATION_ERROR");
    const result = await applyDepositEvent({
      event_id: eventId,
      provider_reference: deposit.provider_reference,
      outcome: outcome === "deposit_confirmed" ? "confirmed" : "failed",
      asset: "MWK",
      amount_units: String(deposit.amount_units),
    });
    if (!result.applied && !result.duplicate) {
      throw new ApiHttpError("IDEMPOTENCY_CONFLICT", {
        message: "Event needs reconciliation; deposit is already terminal.",
      });
    }
    applied = result.applied;
    duplicate = result.duplicate;
  } else {
    const conversionOutcome: ConversionOutcome = outcome;
    const conversion = await getConversionForOperator(id);
    if (conversionOutcome === "conversion_failed" || conversionOutcome === "conversion_completed") {
      const target = conversionOutcome === "conversion_failed" ? "failed" : "completed";
      await finishConversion(conversion.id, target);
      applied = conversion.status === "pending";
      duplicate = conversion.status === target;
    } else {
      if (conversion.status !== "pending") {
        throw new ApiHttpError("IDEMPOTENCY_CONFLICT", { message: "Conversion is already terminal." });
      }
      duplicate = await recordFxTimeout(id, eventId);
    }
    // Timeout deliberately leaves the conversion and reservations pending.
  }

  return ok<DemoEventResponse>({ event_id: eventId, operation_id: id, outcome, applied, duplicate });
});
