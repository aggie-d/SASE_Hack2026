import {
    CURRENCY_META,
    type CardResponse,
    type CardStatus,
    type CreateCardRequest,
  } from "@/lib/contracts";
  import { parseMinorUnits } from "@/lib/contracts/money";
  import { requireVerifiedUser } from "@/lib/server/auth";
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
  
  type CardRow = {
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
      .select(
        [
          "id",
          "user_id",
          "funding_account_id",
          "provider_card_id",
          "last4",
          "status",
          "per_transaction_limit_units",
          "created_at",
          "updated_at",
        ].join(", "),
      )
      .single<CardRow>();
  
    if (insertError) {
      throw insertError;
    }
  
    const funding = await getAccountBalance(fundingAccount.id);
  
    const perTransactionLimit =
      card.per_transaction_limit_units === null
        ? null
        : {
            asset: "USDT" as const,
            amount_units: parseMinorUnits(
              card.per_transaction_limit_units,
            ).toString(),
            exponent: CURRENCY_META.USDT.exponent,
          };
  
    const response: CardResponse = {
      card_id: card.id,
      status: card.status,
      last4: card.last4,
      masked_pan: `•••• •••• •••• ${card.last4}`,
      per_transaction_limit: perTransactionLimit,
      funding,
      provider: provider.providerName,
      mode: provider.mode,
      created_at: card.created_at,
      updated_at: card.updated_at,
    };
  
    return ok<CardResponse>(response, { status: 201 });
  });