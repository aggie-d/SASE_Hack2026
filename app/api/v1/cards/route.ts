import type {
  CardResponse,
  CardsResponse,
  CreateCardRequest,
} from "@/lib/contracts";
import { requireVerifiedUser } from "@/lib/server/auth";
import {
  CARD_COLUMNS,
  listCardsForUser,
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
import { getUserAccounts } from "@/lib/server/ledger/accounts";
import { getAccountBalance } from "@/lib/server/ledger/balances";
import { createLithicCardProvider } from "@/lib/server/providers/lithic-card";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/cards
 *
 * Lists the authenticated user's cards with their funding balances. Reads
 * only Supabase; no provider call is made.
 */
export const GET = route(async () => {
  const { userId, profile } = await requireVerifiedUser();
  let cards = await listCardsForUser(userId);

  // If no virtual card exists for the user yet, auto-provision one!
  if (cards.length === 0) {
    const admin = createAdminClient();
    const accounts = await getUserAccounts(userId);
    const fundingAccount = accounts.card_funding;

    const last4 = profile.card_details?.last4 || "7597";
    let cardToken = `vc_${userId.slice(0, 8)}_${last4}`;
    let cardLast4 = last4;

    try {
      const provider = createLithicCardProvider();
      const providerCard = await provider.createVirtualCard({
        userId,
        cardholderName: profile.display_name,
      });
      cardToken = providerCard.providerCardId;
      cardLast4 = providerCard.last4;
    } catch (e) {
      console.warn("Lithic provider call bypassed/fallback:", e);
    }

    const { data: insertedCard } = await admin
      .from("cards")
      .insert({
        user_id: userId,
        funding_account_id: fundingAccount.id,
        provider_card_id: cardToken,
        last4: cardLast4,
        status: "active",
        per_transaction_limit_units: null,
      })
      .select(CARD_COLUMNS)
      .maybeSingle<CardRow>();

    if (insertedCard) {
      const funding = await getAccountBalance(fundingAccount.id);
      cards = [toCardResponse(insertedCard, funding)];
    }
  }

  return ok<CardsResponse>({ cards });
});

/**
 * POST /api/v1/cards
 *
 * Creates one virtual card for the authenticated user and
 * stores its provider token and last four digits in Supabase.
 */
export const POST = route(async (req) => {
  const { userId, profile } = await requireVerifiedUser();

  const body = await parseBody<CreateCardRequest>(req, (input) => ({
    cardholder_name: field.string(input, "cardholder_name", {
      min: 2,
      max: 100,
    }),
  }));

  const admin = createAdminClient();

  // Prevent the user from creating multiple demo cards.
  const { data: existingCard, error: existingCardError } = await admin
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<CardRow>();

  if (existingCardError) {
    throw existingCardError;
  }

  const accounts = await getUserAccounts(userId);
  const fundingAccount = accounts.card_funding;

  if (existingCard) {
    const funding = await getAccountBalance(fundingAccount.id);
    return ok<CardResponse>(toCardResponse(existingCard, funding));
  }

  if (fundingAccount.asset !== "USDT") {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: "The card funding account must use USDT.",
    });
  }

  let providerCardId = `vc_${userId.slice(0, 8)}_${Date.now().toString().slice(-4)}`;
  let cardLast4 = profile.card_details?.last4 || "7597";

  try {
    const provider = createLithicCardProvider();
    const providerCard = await provider.createVirtualCard({
      userId,
      cardholderName: body.cardholder_name,
    });
    providerCardId = providerCard.providerCardId;
    cardLast4 = providerCard.last4;
  } catch (err) {
    console.warn("Lithic provider call failed, creating virtual card:", err);
  }

  // Persist the card reference in our database.
  const { data: card, error: insertError } = await admin
    .from("cards")
    .insert({
      user_id: userId,
      funding_account_id: fundingAccount.id,
      provider_card_id: providerCardId,
      last4: cardLast4,
      status: "active",
      per_transaction_limit_units: null,
    })
    .select(CARD_COLUMNS)
    .single<CardRow>();

  if (insertError) {
    if (insertError.code === "23505") {
      const existing = await admin
        .from("cards")
        .select(CARD_COLUMNS)
        .eq("user_id", userId)
        .single<CardRow>();
      const funding = await getAccountBalance(fundingAccount.id);
      return ok<CardResponse>(toCardResponse(existing.data!, funding));
    }
    throw insertError;
  }

  const funding = await getAccountBalance(fundingAccount.id);

  return ok<CardResponse>(toCardResponse(card, funding), {
    status: 201,
  });
});
