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
    items.push({
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
    });
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
    const quote = Array.isArray(conversion.quotes)
      ? conversion.quotes[0]
      : conversion.quotes;

    if (!quote) {
      continue;
    }

    items.push({
      id: conversion.id,
      type: "conversion",
      status: conversion.status,
      title: "MWK to USDT conversion",
      amount: money("MWK", quote.source_units),
      fee: money("MWK", quote.fee_units),
      reference:
        conversion.provider_reference ?? conversion.id,
      created_at: conversion.created_at,
    });
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
    items.push({
      id: authorization.id,
      type: "purchase",
      status: authorization.status,
      title: `Purchase — ${authorization.merchant}`,
      amount: money("USDT", authorization.usdt_amount_units),
      fee: null,
      reference: authorization.provider_reference,
      created_at: authorization.created_at,
    });
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

      items.push({
        id: transaction.id,
        type:
          transaction.type === "refund"
            ? "refund"
            : "reversal",
        status: "posted",
        title:
          transaction.type === "refund"
            ? `Refund — ${authorization?.merchant ?? "Merchant"}`
            : `Reversal — ${authorization?.merchant ?? "Merchant"}`,
        amount: money(
          "USDT",
          transaction.usdt_amount_units,
        ),
        fee: null,
        reference: transaction.provider_reference,
        created_at: transaction.created_at,
      });
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

      items.push({
        id: journal.operation_id,
        type: "card_fund",
        status: journal.status,
        title: "Fund virtual card",
        amount: money("USDT", entry.credit_units),
        fee: null,
        reference: journal.operation_id,
        created_at: journal.created_at,
      });
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

export async function getActivityReceipt(params: {
    userId: string;
    activityId: string;
  }): Promise<ReceiptResponse> {
    const admin = createAdminClient();
  
    // Reuse listActivity so the requested activity must belong to this user.
    const activity = await listActivity({
      userId: params.userId,
      limit: 1000,
    });
  
    const item = activity.items.find(
      (candidate) => candidate.id === params.activityId,
    );
  
    if (!item) {
      throw new ApiHttpError("NOT_FOUND", {
        message: "Activity was not found.",
    });
    }
  
    let journalIds: string[] = [];
    let provider: string | null = null;
    let providerReference: string | null = item.reference;
    let mode: ProviderMode = "mock";
    let updatedAt = item.created_at;
  
    if (
      item.type === "deposit" ||
      item.type === "conversion" ||
      item.type === "card_fund"
    ) {
      const { data: journals, error } = await admin
        .from("journals")
        .select("id, updated_at")
        .eq("operation_id", item.id);
  
      if (error) {
        throw error;
      }
  
      journalIds = (journals ?? []).map((journal) => journal.id);
  
      const latestJournal = (journals ?? []).at(-1);
      if (latestJournal?.updated_at) {
        updatedAt = latestJournal.updated_at;
      }
    }
  
    if (item.type === "deposit") {
      const { data: deposit, error } = await admin
        .from("deposits")
        .select("provider, provider_reference, updated_at")
        .eq("id", item.id)
        .eq("user_id", params.userId)
        .maybeSingle();
  
      if (error) {
        throw error;
      }
  
      provider = deposit?.provider ?? null;
      providerReference =
        deposit?.provider_reference ?? providerReference;
      updatedAt = deposit?.updated_at ?? updatedAt;
    }
  
    if (item.type === "conversion") {
      const { data: conversion, error } = await admin
        .from("conversions")
        .select("provider_reference, updated_at")
        .eq("id", item.id)
        .eq("user_id", params.userId)
        .maybeSingle();
  
      if (error) {
        throw error;
      }
  
      providerReference =
        conversion?.provider_reference ?? providerReference;
      updatedAt = conversion?.updated_at ?? updatedAt;
    }
  
    if (item.type === "purchase") {
      const { data: authorization, error } = await admin
        .from("card_authorizations")
        .select("provider_reference, updated_at")
        .eq("id", item.id)
        .maybeSingle();
  
      if (error) {
        throw error;
      }
  
      provider = "lithic";
      mode = "sandbox";
      providerReference =
        authorization?.provider_reference ?? providerReference;
      updatedAt = authorization?.updated_at ?? updatedAt;
  
      const { data: transactions, error: transactionError } =
        await admin
          .from("card_transactions")
          .select("journal_id")
          .eq("authorization_id", item.id);
  
      if (transactionError) {
        throw transactionError;
      }
  
      journalIds = (transactions ?? []).map(
        (transaction) => transaction.journal_id,
      );
    }
  
    if (item.type === "reversal" || item.type === "refund") {
      const { data: transaction, error } = await admin
        .from("card_transactions")
        .select("journal_id, provider_reference, created_at")
        .eq("id", item.id)
        .maybeSingle();
  
      if (error) {
        throw error;
      }
  
      if (transaction) {
        journalIds = [transaction.journal_id];
        provider = "lithic";
        mode = "sandbox";
        providerReference =
          transaction.provider_reference ?? providerReference;
        updatedAt = transaction.created_at;
      }
    }
  
    let legs: LedgerLeg[] = [];
  
    if (journalIds.length > 0) {
      const { data: entries, error } = await admin
        .from("journal_entries")
        .select(
          "journal_id, asset, debit_units, credit_units, accounts!inner(purpose)",
        )
        .in("journal_id", journalIds);
  
      if (error) {
        throw error;
      }
  
      legs = (entries ?? []).map((entry) => {
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
  
    return {
      ...item,
      legs,
      provider,
      provider_reference: providerReference,
      mode,
      updated_at: updatedAt,
    };
  }