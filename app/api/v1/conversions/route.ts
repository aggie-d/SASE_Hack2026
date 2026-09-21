import type { ConversionResponse } from "@/lib/contracts";
import { requireVerifiedUser } from "@/lib/server/auth";
import { createConversion } from "@/lib/server/deposits-fx";
import { field, parseBody, route } from "@/lib/server/http";
import { withIdempotency } from "@/lib/server/idempotency";

export const POST = route(async (req) => {
  const { userId } = await requireVerifiedUser();
  const body = await parseBody(req, (b) => ({ quote_id: field.uuid(b, "quote_id") }));
  return withIdempotency<ConversionResponse>(req, { userId, route: "POST /api/v1/conversions" }, body,
    async ({ operationId }) => {
      const result = await createConversion(userId, operationId, body.quote_id);
      return { status: result.status === "pending" ? 202 : 200, body: result };
    });
});
