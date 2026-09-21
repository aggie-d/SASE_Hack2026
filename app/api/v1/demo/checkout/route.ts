import type { CheckoutRequest, CheckoutResponse } from "@/lib/contracts";
import { requireVerifiedUser } from "@/lib/server/auth";
import { processDemoCardEvent } from "@/lib/server/cards/events";
import { createDemoPurchase } from "@/lib/server/cards/service";
import { ApiHttpError, field, parseBody, route } from "@/lib/server/http";
import { withIdempotency } from "@/lib/server/idempotency";
import { getAccountBalance } from "@/lib/server/ledger/balances";

/**
 * Simulated merchant checkout — the "pay at a shop" moment of the demo.
 *
 * A real card purchase is two provider events: an authorization (hold) and,
 * seconds to days later, a capture (the money actually moves). At a checkout
 * the cardholder experiences both as one tap, so this route does both:
 *
 *   1. createDemoPurchase   → validates card/limit/balance, places the hold
 *   2. processDemoCardEvent → "capture": consumes the hold, posts the spend
 *
 * Declines (frozen card, over limit, insufficient funds) surface from step 1
 * as 422 ApiError with no hold placed. Step 2 is idempotent on the
 * authorization id, so a replay after a crash between the two steps just
 * finishes the capture rather than charging twice.
 *
 * Unlike POST /demo/events this is callable by the cardholder (not only an
 * operator): the merchant is the one capturing, and here we are the merchant.
 */
export const POST = route(async (req) => {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    throw new ApiHttpError("FORBIDDEN", { message: "Demo operations are disabled." });
  }

  const { userId } = await requireVerifiedUser();

  const parsed = await parseBody(req, (body) => ({
    cardId: field.uuid(body, "card_id"),
    merchant: field.string(body, "merchant", { min: 1, max: 120 }),
    amountUnits: field.positiveMinorUnits(body, "amount_units"),
  }));

  const requestBody: CheckoutRequest = {
    card_id: parsed.cardId,
    merchant: parsed.merchant,
    amount_units: parsed.amountUnits.toString(),
  };

  return withIdempotency(
    req,
    { userId, route: "POST /api/v1/demo/checkout" },
    requestBody,
    async ({ operationId }) => {
      const authorization = await createDemoPurchase({
        userId,
        operationId,
        cardId: parsed.cardId,
        merchant: parsed.merchant,
        amountUnits: parsed.amountUnits,
      });

      const capture = await processDemoCardEvent({
        operationId: authorization.authorization_id,
        outcome: "capture",
      });

      const funding = await getAccountBalance(authorization.funding.account_id);

      const body: CheckoutResponse = {
        authorization: { ...authorization, status: "captured", funding },
        capture,
        funding,
      };
      return { status: 201, body };
    },
  );
});
