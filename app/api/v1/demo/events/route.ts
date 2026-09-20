import {
    type DemoEventOutcome,
    type DemoEventRequest,
    type DemoEventResponse,
  } from "@/lib/contracts";
  import { requireOperator } from "@/lib/server/auth";
  import { processDemoCardEvent } from "@/lib/server/cards/events";
  import {
    ApiHttpError,
    field,
    ok,
    parseBody,
    route,
  } from "@/lib/server/http";
  
  const DEMO_OUTCOMES = [
    "deposit_confirmed",
    "deposit_failed",
    "capture",
    "reversal",
    "refund",
    "conversion_failed",
    "provider_timeout",
  ] as const satisfies readonly DemoEventOutcome[];
  
  export const POST = route(async (req) => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
      throw new ApiHttpError("FORBIDDEN", {
        message: "Demo operations are disabled.",
      });
    }
  
    await requireOperator();
  
    const body = await parseBody<DemoEventRequest>(
      req,
      (input) => ({
        operation_id: field.uuid(input, "operation_id"),
        outcome: field.oneOf(
          input,
          "outcome",
          DEMO_OUTCOMES,
        ),
      }),
    );
  
    const result: DemoEventResponse =
      await processDemoCardEvent({
        operationId: body.operation_id,
        outcome: body.outcome,
      });
  
    return ok<DemoEventResponse>(result);
  });
  