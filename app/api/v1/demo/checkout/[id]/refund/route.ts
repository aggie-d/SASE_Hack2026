import type { RefundResponse } from "@/lib/contracts";
import { requireVerifiedUser } from "@/lib/server/auth";
import { processDemoCardEvent } from "@/lib/server/cards/events";
import { ApiHttpError, ok, route } from "@/lib/server/http";
import { getAccountBalance } from "@/lib/server/ledger/balances";
import { createAdminClient } from "@/lib/supabase/admin";

type OwnedAuthorizationRow = {
  id: string;
  status: string;
  cards: { user_id: string; funding_account_id: string } | null;
};

/**
 * POST /api/v1/demo/checkout/:id/refund
 *
 * "The merchant refunded you." Posts a compensating journal for a captured
 * demo checkout (never edits the original — see ledger rules). Cardholder-
 * callable, but only for authorizations on the caller's own card; anything
 * else is a 404 so ids cannot be probed.
 *
 * Idempotent: the refund event is keyed on the authorization id, so a second
 * call returns { applied: false, duplicate: true } and posts nothing.
 */
export const POST = route(
  async (_req, context: RouteContext<"/api/v1/demo/checkout/[id]/refund">) => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
      throw new ApiHttpError("FORBIDDEN", { message: "Demo operations are disabled." });
    }

    const { userId } = await requireVerifiedUser();
    const { id: authorizationId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorizationId)) {
      throw new ApiHttpError("NOT_FOUND", { message: "Authorization not found." });
    }

    const admin = createAdminClient();
    const { data: authorization, error } = await admin
      .from("card_authorizations")
      .select("id, status, cards!inner(user_id, funding_account_id)")
      .eq("id", authorizationId)
      .eq("cards.user_id", userId)
      .maybeSingle<OwnedAuthorizationRow>();
    if (error) throw error;
    if (!authorization || !authorization.cards) {
      throw new ApiHttpError("NOT_FOUND", { message: "Authorization not found." });
    }
    if (authorization.status !== "captured") {
      throw new ApiHttpError("VALIDATION_ERROR", {
        message: "Only a captured purchase can be refunded.",
      });
    }

    const refund = await processDemoCardEvent({
      operationId: authorizationId,
      outcome: "refund",
    });
    const funding = await getAccountBalance(authorization.cards.funding_account_id);

    return ok<RefundResponse>({ refund, funding });
  },
);
