import {
    CURRENCY_META,
    type FundCardRequest,
    type FundCardResponse,
  } from "@/lib/contracts";
  import { requireVerifiedUser } from "@/lib/server/auth";
  import {
    ApiHttpError,
    field,
    parseBody,
    route,
  } from "@/lib/server/http";
  import { withIdempotency } from "@/lib/server/idempotency";
  import { transferBetweenUserAccounts } from "@/lib/server/ledger/transfer";
  import { createAdminClient } from "@/lib/supabase/admin";
  
  type OwnedCardRow = {
    id: string;
    funding_account_id: string;
  };
  
  /**
   * POST /api/v1/cards/:id/fund
   *
   * Transfers USDT from the user's USDT wallet into the card-funding account.
   * Requires an Idempotency-Key header.
   */
  export const POST = route(
    async (
      req,
      context: RouteContext<"/api/v1/cards/[id]/fund">,
    ) => {
      const { userId } = await requireVerifiedUser();
      const { id: cardId } = await context.params;
  
      const parsed = await parseBody(req, (body) => ({
        amountUnits: field.positiveMinorUnits(body, "amount_units"),
      }));
  
      const requestBody: FundCardRequest = {
        amount_units: parsed.amountUnits.toString(),
      };
  
      return withIdempotency(
        req,
        {
          userId,
          route: "POST /api/v1/cards/:id/fund",
        },
        requestBody,
        async ({ operationId }) => {
          const admin = createAdminClient();
  
          // Including user_id in the query prevents access to another user's card.
          const { data: card, error } = await admin
            .from("cards")
            .select("id, funding_account_id")
            .eq("id", cardId)
            .eq("user_id", userId)
            .maybeSingle<OwnedCardRow>();
  
          if (error) {
            throw error;
          }
  
          if (!card) {
            throw new ApiHttpError("NOT_FOUND", {
              message: "Card not found.",
            });
          }
  
          const transfer = await transferBetweenUserAccounts({
            userId,
            operationId,
            from: "usdt_wallet",
            to: "card_funding",
            amountUnits: parsed.amountUnits,
            type: "card_fund",
          });
  
          if (transfer.to.account_id !== card.funding_account_id) {
            throw new ApiHttpError("INTERNAL_ERROR", {
              message: "Card is linked to an unexpected funding account.",
            });
          }
  
          const response: FundCardResponse = {
            transfer_id: operationId,
            journal_id: transfer.journalId,
            amount: {
              asset: "USDT",
              amount_units: parsed.amountUnits.toString(),
              exponent: CURRENCY_META.USDT.exponent,
            },
            wallet: transfer.from,
            funding: transfer.to,
          };
  
          return {
            status: 200,
            body: response,
          };
        },
      );
    },
  );