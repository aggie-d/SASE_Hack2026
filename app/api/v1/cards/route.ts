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
  const { userId } = await requireVerifiedUser();
  const cards = await listCardsForUser(userId);
  return ok<CardsResponse>({ cards });
});

/**
 * POST /api/v1/cards
 *
 * Creates one Lithic sandbox virtual card for the authenticated user and
 * stores its provider token and last four digits in Supabase.
 */
export const POST = route(async (req) => {
  const { userId } = await requireVerifiedUser();

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
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  if (existingCardError) {
    throw existingCardError;
  }

  if (existingCard) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "A card already exists for this user.",
    });
  }

  // The signup trigger creates this ledger account for every user.
  const accounts = await getUserAccounts(userId);
  const fundingAccount = accounts.card_funding;

  if (fundingAccount.asset !== "USDT") {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: "The card funding account must use USDT.",
    });
  }

  // Lithic generates the sandbox card. We do not generate card values locally.
  const provider = createLithicCardProvider();
  const providerCard = await provider.createVirtualCard({
    userId,
    cardholderName: body.cardholder_name,
  });

  // Persist the provider's card reference in our database.
  const { data: card, error: insertError } = await admin
    .from("cards")
    .insert({
      user_id: userId,
      funding_account_id: fundingAccount.id,
      provider_card_id: providerCard.providerCardId,
      last4: providerCard.last4,
      status: "active",
      per_transaction_limit_units: null,
    })
    .select(CARD_COLUMNS)
    .single<CardRow>();

  if (insertError) {
    throw insertError;
  }

  const funding = await getAccountBalance(fundingAccount.id);

  return ok<CardResponse>(toCardResponse(card, funding, provider), {
    status: 201,
  });
});
