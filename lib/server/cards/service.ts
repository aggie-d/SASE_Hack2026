import "server-only";

import {
  CURRENCY_META,
  type AuthorizationResponse,
  type CardStatus,
} from "@/lib/contracts";
import { parseMinorUnits } from "@/lib/contracts/money";
import { ApiHttpError } from "@/lib/server/http";
import { getAccountBalance } from "@/lib/server/ledger/balances";
import { placeHold } from "@/lib/server/ledger/holds";
import { createAdminClient } from "@/lib/supabase/admin";

type CardRow = {
  id: string;
  user_id: string;
  funding_account_id: string;
  status: CardStatus;
  per_transaction_limit_units: string | number | null;
};

type AuthorizationRow = {
  id: string;
  card_id: string;
  merchant: string;
  usdt_amount_units: string | number;
  status: "pending" | "captured" | "reversed" | "expired";
  hold_id: string;
  created_at: string;
};

const AUTHORIZATION_COLUMNS = [
  "id",
  "card_id",
  "merchant",
  "usdt_amount_units",
  "status",
  "hold_id",
  "created_at",
].join(", ");

export async function createDemoPurchase(params: {
  userId: string;
  operationId: string;
  cardId: string;
  merchant: string;
  amountUnits: bigint;
}): Promise<AuthorizationResponse> {
  const admin = createAdminClient();

  const { data: card, error: cardError } = await admin
    .from("cards")
    .select(
      "id, user_id, funding_account_id, status, per_transaction_limit_units",
    )
    .eq("id", params.cardId)
    .eq("user_id", params.userId)
    .maybeSingle<CardRow>();

  if (cardError) {
    throw cardError;
  }

  if (!card) {
    throw new ApiHttpError("NOT_FOUND", {
      message: "Card not found.",
    });
  }

  if (card.status !== "active") {
    throw new ApiHttpError("CARD_FROZEN");
  }

  if (card.per_transaction_limit_units !== null) {
    const limit = parseMinorUnits(
      card.per_transaction_limit_units,
    );

    if (params.amountUnits > limit) {
      throw new ApiHttpError("LIMIT_EXCEEDED");
    }
  }

  const providerReference = `demo-auth:${params.operationId}`;

  // If this operation is being retried, return the existing authorization.
  const { data: existing, error: existingError } = await admin
    .from("card_authorizations")
    .select(AUTHORIZATION_COLUMNS)
    .eq("provider_reference", providerReference)
    .maybeSingle<AuthorizationRow>();

  if (existingError) {
    throw existingError;
  }

  let authorization = existing;

  if (!authorization) {
    const { holdId } = await placeHold({
      accountId: card.funding_account_id,
      operationId: params.operationId,
      amountUnits: params.amountUnits,
    });

    const { data: inserted, error: insertError } = await admin
      .from("card_authorizations")
      .insert({
        card_id: card.id,
        provider_reference: providerReference,
        merchant: params.merchant,
        usdt_amount_units: params.amountUnits.toString(),
        status: "pending",
        hold_id: holdId,
        merchant_amount_units: null,
        merchant_currency: null,
        settlement_quote_reference: null,
      })
      .select(AUTHORIZATION_COLUMNS)
      .single<AuthorizationRow>();

    if (insertError) {
      throw insertError;
    }

    authorization = inserted;
  }

  if (!authorization.hold_id) {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: "Authorization has no associated ledger hold.",
    });
  }

  const funding = await getAccountBalance(
    card.funding_account_id,
  );

  return {
    authorization_id: authorization.id,
    card_id: authorization.card_id,
    merchant: authorization.merchant,
    amount: {
      asset: "USDT",
      amount_units: parseMinorUnits(
        authorization.usdt_amount_units,
      ).toString(),
      exponent: CURRENCY_META.USDT.exponent,
    },
    status: authorization.status,
    hold_id: authorization.hold_id,
    funding,
    created_at: authorization.created_at,
  };
}