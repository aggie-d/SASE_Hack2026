import type { CreateDepositRequest, DepositResponse } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { createDeposit } from "@/lib/server/deposits-fx";
import { field, parseBody, route } from "@/lib/server/http";
import { withIdempotency } from "@/lib/server/idempotency";

export const POST = route(async (req) => {
  const { userId } = await requireUser();
  const body = await parseBody(req, (b) => ({
    method: field.oneOf(b, "method", ["mobile_money", "bank_transfer"] as const),
    amount_units: field.positiveMinorUnits(b, "amount_units"),
  }));
  return withIdempotency<DepositResponse>(req, { userId, route: "POST /api/v1/deposits" },
    { method: body.method, amount_units: body.amount_units.toString() } satisfies CreateDepositRequest,
    async ({ operationId }) => ({
      status: 202, body: await createDeposit(userId, operationId, body.method, body.amount_units),
    }));
});
