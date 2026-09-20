import type {
    AuthorizationResponse,
    CreatePurchaseRequest,
  } from "@/lib/contracts";
  import { requireVerifiedUser } from "@/lib/server/auth";
  import { createDemoPurchase } from "@/lib/server/cards/service";
  import {
    ApiHttpError,
    field,
    parseBody,
    route,
  } from "@/lib/server/http";
  import { withIdempotency } from "@/lib/server/idempotency";
  
  export const POST = route(async (req) => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
      throw new ApiHttpError("FORBIDDEN", {
        message: "Demo operations are disabled.",
      });
    }
  
    const { userId } = await requireVerifiedUser();
  
    const parsed = await parseBody(req, (body) => ({
      cardId: field.uuid(body, "card_id"),
      merchant: field.string(body, "merchant", {
        min: 1,
        max: 120,
      }),
      amountUnits: field.positiveMinorUnits(
        body,
        "amount_units",
      ),
    }));
  
    const requestBody: CreatePurchaseRequest = {
      card_id: parsed.cardId,
      merchant: parsed.merchant,
      amount_units: parsed.amountUnits.toString(),
    };
  
    return withIdempotency(
      req,
      {
        userId,
        route: "POST /api/v1/demo/purchases",
      },
      requestBody,
      async ({ operationId }) => {
        const authorization: AuthorizationResponse =
          await createDemoPurchase({
            userId,
            operationId,
            cardId: parsed.cardId,
            merchant: parsed.merchant,
            amountUnits: parsed.amountUnits,
          });
  
        return {
          status: 201,
          body: authorization,
        };
      },
    );
  });