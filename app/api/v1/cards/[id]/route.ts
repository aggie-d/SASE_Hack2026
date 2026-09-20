import type { CardResponse, UpdateCardRequest } from "@/lib/contracts";
  import { requireVerifiedUser } from "@/lib/server/auth";
  import {
    CARD_COLUMNS,
    getCardForUser,
    toCardResponse,
    type CardRow,
  } from "@/lib/server/cards/service";
  import {
    ApiHttpError,
    field,
    ok,
    parseBody,
    route,
  } from "@/lib/server/http";
  import { getAccountBalance } from "@/lib/server/ledger/balances";
  import { createLithicCardProvider } from "@/lib/server/providers/lithic-card";
  import { createAdminClient } from "@/lib/supabase/admin";
  
  /**
   * GET /api/v1/cards/:id
   *
   * Returns one of the authenticated user's cards. 404 if the id is unknown
   * or belongs to someone else (never distinguishes the two).
   */
  export const GET = route(
    async (
      _req,
      context: RouteContext<"/api/v1/cards/[id]">,
    ) => {
      const { userId } = await requireVerifiedUser();
      const { id: cardId } = await context.params;
      const card = await getCardForUser({ userId, cardId });
      return ok<CardResponse>(card);
    },
  );
  
  /**
   * PATCH /api/v1/cards/:id
   *
   * Freezes/unfreezes a card or changes its per-transaction limit.
   */
  export const PATCH = route(
    async (
      req,
      context: RouteContext<"/api/v1/cards/[id]">,
    ) => {
      const { userId } = await requireVerifiedUser();
      const { id: cardId } = await context.params;
  
      const parsed = await parseBody(req, (body) => ({
        status: field.optionalOneOf(body, "status", [
          "active",
          "frozen",
        ] as const),
        perTransactionLimitUnits: field.nullablePositiveMinorUnits(
          body,
          "per_transaction_limit_units",
        ),
      }));
  
      if (
        parsed.status === undefined &&
        parsed.perTransactionLimitUnits === undefined
      ) {
        throw new ApiHttpError("VALIDATION_ERROR", {
          message:
            "Provide status or per_transaction_limit_units to update.",
        });
      }
  
      // Lithic represents limits in cents, so the micro-USDT value must be
      // divisible by 10,000.
      if (
        typeof parsed.perTransactionLimitUnits === "bigint" &&
        parsed.perTransactionLimitUnits % 10_000n !== 0n
      ) {
        throw new ApiHttpError("VALIDATION_ERROR", {
          message:
            "per_transaction_limit_units must represent a whole number of cents.",
        });
      }
  
      const requestBody: UpdateCardRequest = {
        status: parsed.status,
        per_transaction_limit_units:
          parsed.perTransactionLimitUnits === undefined
            ? undefined
            : parsed.perTransactionLimitUnits === null
              ? null
              : parsed.perTransactionLimitUnits.toString(),
      };
  
      const admin = createAdminClient();
  
      const { data: existingCard, error: lookupError } = await admin
        .from("cards")
        .select(CARD_COLUMNS)
        .eq("id", cardId)
        .eq("user_id", userId)
        .maybeSingle<CardRow>();
  
      if (lookupError) {
        throw lookupError;
      }
  
      if (!existingCard) {
        throw new ApiHttpError("NOT_FOUND", {
          message: "Card not found.",
        });
      }
  
      if (!existingCard.provider_card_id) {
        throw new ApiHttpError("INTERNAL_ERROR", {
          message: "Card has no Lithic provider reference.",
        });
      }
  
      const provider = createLithicCardProvider();
  
      // Update the sandbox provider first.
      await provider.updateCard({
        providerCardId: existingCard.provider_card_id,
        status: requestBody.status,
        perTransactionLimitUnits:
          parsed.perTransactionLimitUnits,
      });
  
      const databaseUpdate: {
        status?: "active" | "frozen";
        per_transaction_limit_units?: string | null;
      } = {};
  
      if (requestBody.status !== undefined) {
        databaseUpdate.status = requestBody.status;
      }
  
      if (requestBody.per_transaction_limit_units !== undefined) {
        databaseUpdate.per_transaction_limit_units =
          requestBody.per_transaction_limit_units;
      }
  
      const { data: updatedCard, error: updateError } = await admin
        .from("cards")
        .update(databaseUpdate)
        .eq("id", cardId)
        .eq("user_id", userId)
        .select(CARD_COLUMNS)
        .single<CardRow>();
  
      if (updateError) {
        throw updateError;
      }
  
      const funding = await getAccountBalance(
        updatedCard.funding_account_id,
      );
  
      return ok<CardResponse>(
        toCardResponse(updatedCard, funding, provider),
      );
    },
  );