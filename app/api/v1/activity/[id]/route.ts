import type { ReceiptResponse } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { getActivityReceipt } from "@/lib/server/activity/service";
import {
  ApiHttpError,
  ok,
  route,
} from "@/lib/server/http";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = route(
  async (
    _req,
    context: RouteContext<"/api/v1/activity/[id]">,
  ) => {
    const { userId } = await requireUser();
    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      throw new ApiHttpError("VALIDATION_ERROR", {
        message: "Activity id must be a UUID.",
      });
    }

    const receipt = await getActivityReceipt({
      userId,
      activityId: id,
    });

    return ok<ReceiptResponse>(receipt);
  },
);