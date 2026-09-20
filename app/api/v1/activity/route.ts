import {
    type ActivityListResponse,
    type ActivityType,
  } from "@/lib/contracts";
  import { requireUser } from "@/lib/server/auth";
  import { listActivity } from "@/lib/server/activity/service";
  import {
    ApiHttpError,
    ok,
    route,
  } from "@/lib/server/http";
  
  const ACTIVITY_TYPES = [
    "deposit",
    "conversion",
    "card_fund",
    "purchase",
    "reversal",
    "refund",
  ] as const satisfies readonly ActivityType[];
  
  function parseLimit(value: string | null): number {
    if (value === null) {
      return 20;
    }
  
    if (!/^\d+$/.test(value)) {
      throw new ApiHttpError("VALIDATION_ERROR", {
        message: "limit must be a whole number.",
      });
    }
  
    const limit = Number(value);
  
    if (limit < 1 || limit > 100) {
      throw new ApiHttpError("VALIDATION_ERROR", {
        message: "limit must be between 1 and 100.",
      });
    }
  
    return limit;
  }
  
  export const GET = route(async (req) => {
    const { userId } = await requireUser();
  
    const requestedType = req.nextUrl.searchParams.get("type");
    let type: ActivityType | undefined;
  
    if (requestedType !== null) {
      if (
        !(ACTIVITY_TYPES as readonly string[]).includes(
          requestedType,
        )
      ) {
        throw new ApiHttpError("VALIDATION_ERROR", {
          message: `type must be one of ${ACTIVITY_TYPES.join(", ")}.`,
        });
      }
  
      type = requestedType as ActivityType;
    }
  
    const result: ActivityListResponse = await listActivity({
      userId,
      type,
      limit: parseLimit(
        req.nextUrl.searchParams.get("limit"),
      ),
      cursor:
        req.nextUrl.searchParams.get("cursor") ?? undefined,
    });
  
    return ok<ActivityListResponse>(result);
  });