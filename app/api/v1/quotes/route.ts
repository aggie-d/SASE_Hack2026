import type { QuoteResponse } from "@/lib/contracts";
import { requireVerifiedUser } from "@/lib/server/auth";
import { createQuote } from "@/lib/server/deposits-fx";
import { field, ok, parseBody, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const { userId } = await requireVerifiedUser();
  const body = await parseBody(req, (b) => ({
    source_asset: field.oneOf(b, "source_asset", ["MWK"] as const),
    destination_asset: field.oneOf(b, "destination_asset", ["USDT"] as const),
    source_units: field.positiveMinorUnits(b, "source_units"),
  }));
  return ok<QuoteResponse>(await createQuote(userId, body.source_units));
});
