import "server-only";

import {
  CURRENCY_META,
  type AccountPurpose,
  type LedgerLeg,
  type ProviderMode,
  type ReceiptResponse,
  type ActivityItem,
  type ActivityListResponse,
  type ActivityType,
  type Asset,
  type CardTransactionType,
} from "@/lib/contracts";
import { parseMinorUnits } from "@/lib/contracts/money";
import { ApiHttpError } from "@/lib/server/http";
import { getUserAccounts } from "@/lib/server/ledger/accounts";
import { createAdminClient } from "@/lib/supabase/admin";


type DepositRow = {
  id: string;
  method: "mobile_money" | "bank_transfer";
  amount_units: string | number;
  asset: Asset;
  provider_reference: string | null;
  status: string;
  created_at: string;
};

type QuoteRow = {
  source_units: string | number;
  fee_units: string | number;
};

type ConversionRow = {
  id: string;
  status: string;
  provider_reference: string | null;
  created_at: string;
  quotes: QuoteRow | QuoteRow[];
};

type CardRow = {
  id: string;
};

type AuthorizationRow = {
  id: string;
  card_id: string;
  merchant: string;
  usdt_amount_units: string | number;
  provider_reference: string;
  status: string;
  created_at: string;
};

type CardTransactionRow = {
  id: string;
  authorization_id: string;
  type: CardTransactionType;
  usdt_amount_units: string | number;
  provider_reference: string;
  created_at: string;
};

type JournalRow = {
  id: string;
  operation_id: string;
  type: string;
  status: string;
  created_at: string;
};

type JournalEntryRow = {
  journal_id: string;
  credit_units: string | number;
};

function money(
  asset: Asset,
  units: string | number | bigint,
) {
  return {
    asset,
    amount_units: parseMinorUnits(units).toString(),
    exponent: CURRENCY_META[asset].exponent,
  };
}

// ─── Row → ActivityItem mappers (shared by the feed and receipts) ────────────

function depositItem(deposit: DepositRow): ActivityItem {
  return {
    id: deposit.id,
    type: "deposit",
    status: deposit.status,
    title:
      deposit.method === "mobile_money"
        ? "Deposit via mobile money"
        : "Deposit via bank transfer",
    amount: money(deposit.asset, deposit.amount_units),
    fee: null,
    reference: deposit.provider_reference ?? deposit.id,
    created_at: deposit.created_at,
  };
}

function conversionQuote(conversion: ConversionRow): QuoteRow | null {
  const quote = Array.isArray(conversion.quotes)
    ? conversion.quotes[0]
    : conversion.quotes;
  return quote ?? null;
}

function conversionItem(
  conversion: ConversionRow,
  quote: QuoteRow,
): ActivityItem {
  return {
    id: conversion.id,
    type: "conversion",
    status: conversion.status,
    title: "MWK to USDT conversion",
    amount: money("MWK", quote.source_units),
    fee: money("MWK", quote.fee_units),
    reference: conversion.provider_reference ?? conversion.id,
    created_at: conversion.created_at,
  };
}

function purchaseItem(authorization: AuthorizationRow): ActivityItem {
  return {
    id: authorization.id,
    type: "purchase",
    status: authorization.status,
    title: `Purchase — ${authorization.merchant}`,
    amount: money("USDT", authorization.usdt_amount_units),
    fee: null,
    reference: authorization.provider_reference,
    created_at: authorization.created_at,
  };
}

function cardTransactionItem(
  transaction: CardTransactionRow,
  merchant: string | undefined,
): ActivityItem {
  const isRefund = transaction.type === "refund";
  return {
    id: transaction.id,
    type: isRefund ? "refund" : "reversal",
    status: "posted",
    title: isRefund
      ? `Refund — ${merchant ?? "Merchant"}`
      : `Reversal — ${merchant ?? "Merchant"}`,
    amount: money("USDT", transaction.usdt_amount_units),
    fee: null,
    reference: transaction.provider_reference,
    created_at: transaction.created_at,
  };
}

function cardFundItem(
  journal: JournalRow,
  creditUnits: string | number,
): ActivityItem {
  return {
    id: journal.operation_id,
    type: "card_fund",
    status: journal.status,
    title: "Fund virtual card",
    amount: money("USDT", creditUnits),
    fee: null,
    reference: journal.operation_id,
    created_at: journal.created_at,
  };
}

function compareActivity(a: ActivityItem, b: ActivityItem): number {
  const timeDifference =
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime();

  if (timeDifference !== 0) {
    return timeDifference;
  }

  return b.id.localeCompare(a.id);
}

function isBeforeCursor(
  item: ActivityItem,
  cursor: string,
): boolean {
  const separator = cursor.lastIndexOf("|");

  if (separator === -1) {
    return true;
  }

  const cursorDate = cursor.slice(0, separator);
  const cursorId = cursor.slice(separator + 1);

  if (item.created_at < cursorDate) {
    return true;
  }

  return (
    item.created_at === cursorDate &&
    item.id < cursorId
  );
}

export async function listActivity(params: {
  userId: string;
  type?: ActivityType;
  limit: number;
  cursor?: string;
}): Promise<ActivityListResponse> {
  const admin = createAdminClient();
  const items: ActivityItem[] = [];

  const { data: deposits, error: depositError } = await admin
    .from("deposits")
    .select(
      "id, method, amount_units, asset, provider_reference, status, created_at",
    )
    .eq("user_id", params.userId)
    .returns<DepositRow[]>();

  if (depositError) {
    throw depositError;
  }

  for (const deposit of deposits ?? []) {
    items.push(depositItem(deposit));
  }

  const { data: conversions, error: conversionError } =
    await admin
      .from("conversions")
      .select(
        "id, status, provider_reference, created_at, quotes!inner(source_units, fee_units)",
      )
      .eq("user_id", params.userId)
      .returns<ConversionRow[]>();

  if (conversionError) {
    throw conversionError;
  }

  for (const conversion of conversions ?? []) {
    const quote = conversionQuote(conversion);

    if (!quote) {
      continue;
    }

    items.push(conversionItem(conversion, quote));
  }

  const { data: cards, error: cardsError } = await admin
    .from("cards")
    .select("id")
    .eq("user_id", params.userId)
    .returns<CardRow[]>();

  if (cardsError) {
    throw cardsError;
  }

  const cardIds = (cards ?? []).map((card) => card.id);
  let authorizations: AuthorizationRow[] = [];

  if (cardIds.length > 0) {
    const authorizationResult = await admin
      .from("card_authorizations")
      .select(
        "id, card_id, merchant, usdt_amount_units, provider_reference, status, created_at",
      )
      .in("card_id", cardIds)
      .returns<AuthorizationRow[]>();

    if (authorizationResult.error) {
      throw authorizationResult.error;
    }

    authorizations = authorizationResult.data ?? [];
  }

  for (const authorization of authorizations) {
    items.push(purchaseItem(authorization));
  }

  const authorizationIds = authorizations.map(
    (authorization) => authorization.id,
  );

  if (authorizationIds.length > 0) {
    const { data: transactions, error } = await admin
      .from("card_transactions")
      .select(
        "id, authorization_id, type, usdt_amount_units, provider_reference, created_at",
      )
      .in("authorization_id", authorizationIds)
      .in("type", ["reversal", "refund"])
      .returns<CardTransactionRow[]>();

    if (error) {
      throw error;
    }

    const authorizationById = new Map(
      authorizations.map((authorization) => [
        authorization.id,
        authorization,
      ]),
    );

    for (const transaction of transactions ?? []) {
      const authorization = authorizationById.get(
        transaction.authorization_id,
      );

      items.push(
        cardTransactionItem(transaction, authorization?.merchant),
      );
    }
  }

  const accounts = await getUserAccounts(params.userId);

  const { data: fundingEntries, error: entriesError } =
    await admin
      .from("journal_entries")
      .select("journal_id, credit_units")
      .eq("account_id", accounts.card_funding.id)
      .returns<JournalEntryRow[]>();

  if (entriesError) {
    throw entriesError;
  }

  const positiveFundingEntries = (fundingEntries ?? []).filter(
    (entry) => parseMinorUnits(entry.credit_units) > 0n,
  );

  const journalIds = positiveFundingEntries.map(
    (entry) => entry.journal_id,
  );

  if (journalIds.length > 0) {
    const { data: journals, error } = await admin
      .from("journals")
      .select(
        "id, operation_id, type, status, created_at",
      )
      .in("id", journalIds)
      .eq("type", "card_fund")
      .returns<JournalRow[]>();

    if (error) {
      throw error;
    }

    const entryByJournal = new Map(
      positiveFundingEntries.map((entry) => [
        entry.journal_id,
        entry,
      ]),
    );

    for (const journal of journals ?? []) {
      const entry = entryByJournal.get(journal.id);

      if (!entry) {
        continue;
      }

      items.push(cardFundItem(journal, entry.credit_units));
    }
  }

  let filtered = items;

  if (params.type) {
    filtered = filtered.filter(
      (item) => item.type === params.type,
    );
  }

  filtered.sort(compareActivity);

  if (params.cursor) {
    filtered = filtered.filter((item) =>
      isBeforeCursor(item, params.cursor!),
    );
  }

  const page = filtered.slice(0, params.limit);
  const hasMore = filtered.length > params.limit;
  const lastItem = page.at(-1);

  return {
    items: page,
    next_cursor:
      hasMore && lastItem
        ? `${lastItem.created_at}|${lastItem.id}`
        : null,
  };
}

// ─── Receipts ────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

/** Everything a receipt needs beyond the ActivityItem itself. */
type ReceiptSource = {
  item: ActivityItem;
  journalIds: string[];
  provider: string | null;
  providerReference: string | null;
  mode: ProviderMode;
  updatedAt: string;
};

type Lookup = (
  admin: AdminClient,
  userId: string,
  id: string,
) => Promise<ReceiptSource | null>;

/**
 * Spend events (purchase, reversal, refund) are produced by POST /demo/purchases
 * and POST /demo/events, never by Lithic. Their provider_reference is
 * demo-auth:* / demo-capture:* etc. Label them honestly. The card itself is
 * still a Lithic sandbox card, so card create/PATCH/GET keep lithic/sandbox.
 */
const DEMO_SPEND_PROVIDER = {
  provider: "demo",
  mode: "mock",
} as const satisfies Pick<ReceiptSource, "provider" | "mode">;

/** Journal ids posted under an operation id (deposit, conversion, card_fund). */
async function journalIdsForOperation(
  admin: AdminClient,
  operationId: string,
): Promise<{ ids: string[]; latestUpdatedAt: string | null }> {
  const { data, error } = await admin
    .from("journals")
    .select("id, updated_at")
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true })
    .returns<{ id: string; updated_at: string | null }[]>();

  if (error) {
    throw error;
  }

  const journals = data ?? [];
  return {
    ids: journals.map((journal) => journal.id),
    latestUpdatedAt: journals.at(-1)?.updated_at ?? null,
  };
}

const findDeposit: Lookup = async (admin, userId, id) => {
  const { data, error } = await admin
    .from("deposits")
    .select(
      "id, method, amount_units, asset, provider, provider_reference, status, created_at, updated_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<DepositRow & { provider: string | null; updated_at: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const item = depositItem(data);
  const journals = await journalIdsForOperation(admin, id);

  return {
    item,
    journalIds: journals.ids,
    provider: data.provider,
    providerReference: data.provider_reference ?? item.reference,
    mode: "mock",
    updatedAt: data.updated_at ?? journals.latestUpdatedAt ?? item.created_at,
  };
};

const findConversion: Lookup = async (admin, userId, id) => {
  const { data, error } = await admin
    .from("conversions")
    .select(
      "id, status, provider_reference, created_at, updated_at, quotes!inner(source_units, fee_units)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<ConversionRow & { updated_at: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const quote = conversionQuote(data);

  if (!quote) {
    return null;
  }

  const item = conversionItem(data, quote);
  const journals = await journalIdsForOperation(admin, id);

  return {
    item,
    journalIds: journals.ids,
    provider: null,
    providerReference: data.provider_reference ?? item.reference,
    mode: "mock",
    updatedAt: data.updated_at ?? journals.latestUpdatedAt ?? item.created_at,
  };
};

type OwnedAuthorizationRow = AuthorizationRow & {
  updated_at: string;
  cards: { user_id: string } | { user_id: string }[];
};

function embeddedOwner(
  cards: { user_id: string } | { user_id: string }[] | null | undefined,
): string | null {
  const card = Array.isArray(cards) ? cards[0] : cards;
  return card?.user_id ?? null;
}

const findPurchase: Lookup = async (admin, userId, id) => {
  const { data, error } = await admin
    .from("card_authorizations")
    .select(
      "id, card_id, merchant, usdt_amount_units, provider_reference, status, created_at, updated_at, cards!inner(user_id)",
    )
    .eq("id", id)
    .maybeSingle<OwnedAuthorizationRow>();

  if (error) {
    throw error;
  }

  // Ownership is checked on the joined card, never on the authorization alone.
  if (!data || embeddedOwner(data.cards) !== userId) {
    return null;
  }

  const { data: transactions, error: transactionError } = await admin
    .from("card_transactions")
    .select("journal_id")
    .eq("authorization_id", id)
    .returns<{ journal_id: string }[]>();

  if (transactionError) {
    throw transactionError;
  }

  const item = purchaseItem(data);

  return {
    item,
    journalIds: (transactions ?? []).map((transaction) => transaction.journal_id),
    ...DEMO_SPEND_PROVIDER,
    providerReference: data.provider_reference ?? item.reference,
    updatedAt: data.updated_at ?? item.created_at,
  };
};

type OwnedCardTransactionRow = CardTransactionRow & {
  journal_id: string;
  card_authorizations:
    | { merchant: string; cards: { user_id: string } | { user_id: string }[] }
    | { merchant: string; cards: { user_id: string } | { user_id: string }[] }[];
};

const findCardTransaction: Lookup = async (admin, userId, id) => {
  const { data, error } = await admin
    .from("card_transactions")
    .select(
      "id, authorization_id, type, usdt_amount_units, provider_reference, journal_id, created_at, card_authorizations!inner(merchant, cards!inner(user_id))",
    )
    .eq("id", id)
    .in("type", ["reversal", "refund"])
    .maybeSingle<OwnedCardTransactionRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const authorization = Array.isArray(data.card_authorizations)
    ? data.card_authorizations[0]
    : data.card_authorizations;

  if (!authorization || embeddedOwner(authorization.cards) !== userId) {
    return null;
  }

  const item = cardTransactionItem(data, authorization.merchant);

  return {
    item,
    journalIds: [data.journal_id],
    ...DEMO_SPEND_PROVIDER,
    providerReference: data.provider_reference ?? item.reference,
    updatedAt: data.created_at,
  };
};

const findCardFund: Lookup = async (admin, userId, id) => {
  // (operation_id, type) is unique, so this is at most one row.
  const { data: journal, error } = await admin
    .from("journals")
    .select("id, operation_id, type, status, created_at, updated_at")
    .eq("operation_id", id)
    .eq("type", "card_fund")
    .maybeSingle<JournalRow & { updated_at: string | null }>();

  if (error) {
    throw error;
  }

  if (!journal) {
    return null;
  }

  // The funding journal must credit *this* user's card_funding account.
  const accounts = await getUserAccounts(userId);

  const { data: entry, error: entryError } = await admin
    .from("journal_entries")
    .select("journal_id, credit_units")
    .eq("journal_id", journal.id)
    .eq("account_id", accounts.card_funding.id)
    .gt("credit_units", 0)
    .maybeSingle<JournalEntryRow>();

  if (entryError) {
    throw entryError;
  }

  if (!entry) {
    return null;
  }

  const item = cardFundItem(journal, entry.credit_units);

  return {
    item,
    journalIds: [journal.id],
    provider: null,
    providerReference: item.reference,
    mode: "mock",
    updatedAt: journal.updated_at ?? item.created_at,
  };
};

/** Tried in order; the first source that owns the id wins. */
const RECEIPT_LOOKUPS: readonly Lookup[] = [
  findDeposit,
  findConversion,
  findPurchase,
  findCardTransaction,
  findCardFund,
];

async function legsForJournals(
  admin: AdminClient,
  journalIds: string[],
): Promise<LedgerLeg[]> {
  if (journalIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("journal_entries")
    .select(
      "journal_id, asset, debit_units, credit_units, accounts!inner(purpose)",
    )
    .in("journal_id", journalIds);

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => {
    const account = Array.isArray(entry.accounts)
      ? entry.accounts[0]
      : entry.accounts;

    return {
      journal_id: entry.journal_id,
      account_purpose: account.purpose as AccountPurpose,
      asset: entry.asset as Asset,
      debit_units: String(entry.debit_units),
      credit_units: String(entry.credit_units),
    };
  });
}

export async function getActivityReceipt(params: {
  userId: string;
  activityId: string;
}): Promise<ReceiptResponse> {
  const admin = createAdminClient();

  let source: ReceiptSource | null = null;

  for (const lookup of RECEIPT_LOOKUPS) {
    source = await lookup(admin, params.userId, params.activityId);

    if (source) {
      break;
    }
  }

  if (!source) {
    throw new ApiHttpError("NOT_FOUND", {
      message: "Activity was not found.",
    });
  }

  const legs = await legsForJournals(admin, source.journalIds);

  return {
    ...source.item,
    legs,
    provider: source.provider,
    provider_reference: source.providerReference,
    mode: source.mode,
    updated_at: source.updatedAt,
  };
}
