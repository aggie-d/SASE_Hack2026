import type { ConversionResponse } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { getConversion } from "@/lib/server/deposits-fx";
import { ApiHttpError, ok, route } from "@/lib/server/http";

export const GET = route<RouteContext<"/api/v1/conversions/[id]">>(async (_req, ctx) => {
  const { userId } = await requireUser();
  const { id } = await ctx.params;
  if (!/^[\da-f]{8}-[\da-f-]{27,}$/i.test(id)) throw new ApiHttpError("VALIDATION_ERROR");
  return ok<ConversionResponse>(await getConversion(userId, id));
});
