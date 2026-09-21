import "server-only";

import {
  CURRENCY_META,
  type AuthorizationResponse,
  type CardResponse,
  type CardStatus,
  type ProviderMode,
  type WalletBalance,
} from "@/lib/contracts";
import { parseMinorUnits } from "@/lib/contracts/money";
import { ApiHttpError } from "@/lib/server/http";
import {
  getAccountBalance,
  getAccountBalances,
} from "@/lib/server/ledger/balances";
import { placeHold } from "@/lib/server/ledger/holds";
import { LITHIC_PROVIDER_IDENTITY } from "@/lib/server/providers/lithic-card";
import { createAdminClient } from "@/lib/supabase/admin";

/** Full `cards` row as selected by CARD_COLUMNS. */
export type CardRow = {
  id: string;
  user_id: string;
  funding_account_id: string;
  provider_card_id: string | null;
  last4: string;
  status: CardStatus;
  per_transaction_limit_units: string | number | null;
  created_at: string;
  updated_at: string;
};

export const CARD_COLUMNS = [
  "id",
  "user_id",
  "funding_account_id",
  "provider_card_id",
  "last4",
  "status",
  "per_transaction_limit_units",
  "created_at",
  "updated_at",
].join(", ");

type ProviderIdentity = { providerName: string; mode: ProviderMode };

/**
 * Single mapping from a `cards` row to the wire shape. Used by GET, POST and
 * PATCH so every route returns an identical CardResponse.
 */
export function toCardResponse(
  card: CardRow,
  funding: WalletBalance,
  provider: ProviderIdentity = LITHIC_PROVIDER_IDENTITY,
): CardResponse {
  return {
    card_id: card.id,
    status: card.status,
    last4: card.last4,
    masked_pan: `•••• •••• •••• ${card.last4}`,
    per_transaction_limit:
      card.per_transaction_limit_units === null
        ? null
        : {
            asset: "USDT",
            amount_units: parseMinorUnits(
              card.per_transaction_limit_units,
            ).toString(),
            exponent: CURRENCY_META.USDT.exponent,
          },
    funding,
    provider: provider.providerName,
    mode: provider.mode,
    created_at: card.created_at,
    updated_at: card.updated_at,
  };
}

/** All cards owned by the user, oldest first, each with its funding balance. */
export async function listCardsForUser(
  userId: string,
): Promise<CardResponse[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<CardRow[]>();

  if (error) {
    throw error;
  }

  const cards = data ?? [];

  if (cards.length === 0) {
    return [];
  }

  const balances = await getAccountBalances(
    cards.map((card) => card.funding_account_id),
  );

  return cards.map((card) => {
    const funding = balances.get(card.funding_account_id);

    if (!funding) {
      throw new ApiHttpError("INTERNAL_ERROR", {
        message: `Funding account ${card.funding_account_id} has no balance row.`,
      });
    }

    return toCardResponse(card, funding);
  });
}

/** One card, scoped to its owner. 404 if the id is unknown or not theirs. */
export async function getCardForUser(params: {
  userId: string;
  cardId: string;
}): Promise<CardResponse> {
  const admin = createAdminClient();

  const { data: card, error } = await admin
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("id", params.cardId)
    .eq("user_id", params.userId)
    .maybeSingle<CardRow>();

  if (error) {
    throw error;
  }

  if (!card) {
    throw new ApiHttpError("NOT_FOUND", {
      message: "Card not found.",
    });
  }

  const funding = await getAccountBalance(card.funding_account_id);

  return toCardResponse(card, funding);
}

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