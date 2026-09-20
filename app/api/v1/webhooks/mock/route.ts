import type { WebhookAckResponse } from "@/lib/contracts";
import { applyDepositEvent, verifyMockEvent } from "@/lib/server/deposits-fx";
import { ApiHttpError, ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") throw new ApiHttpError("NOT_FOUND");
  const raw = await req.text();
  if (raw.length > 16_384) throw new ApiHttpError("VALIDATION_ERROR");
  const event = verifyMockEvent(raw, req.headers.get("x-mock-signature"));
  const result = await applyDepositEvent(event);
  return ok<WebhookAckResponse>({ received: true, event_id: event.event_id, duplicate: result.duplicate });
});
