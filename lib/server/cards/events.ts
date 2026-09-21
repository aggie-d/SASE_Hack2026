import "server-only";

import type {
  DemoEventOutcome,
  DemoEventResponse,
} from "@/lib/contracts";
import { parseMinorUnits } from "@/lib/contracts/money";
import { ApiHttpError } from "@/lib/server/http";
import { getSystemAccount } from "@/lib/server/ledger/accounts";
import { releaseHold } from "@/lib/server/ledger/holds";
import {
  credit,
  debit,
  getJournalsForOperation,
  postJournal,
  reverseJournal,
} from "@/lib/server/ledger/post";
import { createAdminClient } from "@/lib/supabase/admin";

type ProviderEventRow = {
  id: string;
  event_id: string;
  status: "pending" | "processed" | "failed";
  attempts: number;
};

type AuthorizationRow = {
  id: string;
  card_id: string;
  usdt_amount_units: string | number;
  status: "pending" | "captured" | "reversed" | "expired";
  hold_id: string | null;
};

type CardRow = {
  id: string;
  funding_account_id: string;
};

type CardTransactionRow = {
  id: string;
  journal_id: string;
  type: "capture" | "reversal" | "refund";
};

const CARD_OUTCOMES = [
  "capture",
  "reversal",
  "refund",
] as const;

type CardOutcome = (typeof CARD_OUTCOMES)[number];

function isCardOutcome(
  outcome: DemoEventOutcome,
): outcome is CardOutcome {
  return (CARD_OUTCOMES as readonly string[]).includes(outcome);
}

async function findCapture(
  authorizationId: string,
): Promise<CardTransactionRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("card_transactions")
    .select("id, journal_id, type")
    .eq("authorization_id", authorizationId)
    .eq("type", "capture")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<CardTransactionRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function recordCardTransaction(params: {
  authorizationId: string;
  type: "capture" | "reversal" | "refund";
  amountUnits: bigint;
  providerReference: string;
  journalId: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("card_transactions")
    .select("id")
    .eq("provider_reference", params.providerReference)
    .maybeSingle<{ id: string }>();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    return;
  }

  const { error } = await admin
    .from("card_transactions")
    .insert({
      authorization_id: params.authorizationId,
      type: params.type,
      usdt_amount_units: params.amountUnits.toString(),
      provider_reference: params.providerReference,
      journal_id: params.journalId,
      merchant_amount_units: null,
      merchant_currency: null,
      fee_units: 0,
    });

  if (error) {
    throw error;
  }
}

async function reverseJournalOnce(params: {
  originalJournalId: string;
  eventOperationId: string;
  type: "card_reversal" | "refund";
}): Promise<string> {
  const existing = await getJournalsForOperation(
    params.eventOperationId,
  );

  const previous = existing.find(
    (journal) => journal.type === params.type,
  );

  if (previous) {
    return previous.id;
  }

  const reversed = await reverseJournal({
    journalId: params.originalJournalId,
    operationId: params.eventOperationId,
    type: params.type,
  });

  return reversed.journalId;
}

async function processCapture(
  event: ProviderEventRow,
  authorization: AuthorizationRow,
): Promise<void> {
  // Already captured: the journal and hold consumption happened on an earlier
  // attempt. Return the existing capture instead of touching the ledger again.
  if (authorization.status === "captured") {
    const existing = await findCapture(authorization.id);

    if (!existing) {
      throw new ApiHttpError("INTERNAL_ERROR", {
        message: "Authorization is marked captured but has no capture transaction.",
      });
    }

    return;
  }

  if (authorization.status !== "pending") {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: `Cannot capture an authorization with status ${authorization.status}.`,
    });
  }

  if (!authorization.hold_id) {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: "Authorization has no ledger hold.",
    });
  }

  const admin = createAdminClient();

  const { data: card, error: cardError } = await admin
    .from("cards")
    .select("id, funding_account_id")
    .eq("id", authorization.card_id)
    .single<CardRow>();

  if (cardError) {
    throw cardError;
  }

  const settlementAccount = await getSystemAccount(
    "liquidity_inventory",
    "USDT",
  );

  const amountUnits = parseMinorUnits(
    authorization.usdt_amount_units,
  );

  const { journalId } = await postJournal({
    operationId: event.id,
    type: "card_capture",
    entries: [
      debit(
        {
          id: card.funding_account_id,
          asset: "USDT",
        },
        amountUnits,
      ),
      credit(settlementAccount, amountUnits),
    ],
    consumeHoldIds: [authorization.hold_id],
  });

  await recordCardTransaction({
    authorizationId: authorization.id,
    type: "capture",
    amountUnits,
    providerReference: `demo-capture:${event.event_id}`,
    journalId,
  });

  const { error: updateError } = await admin
    .from("card_authorizations")
    .update({ status: "captured" })
    .eq("id", authorization.id);

  if (updateError) {
    throw updateError;
  }
}

async function processReversal(
  event: ProviderEventRow,
  authorization: AuthorizationRow,
): Promise<void> {
  const admin = createAdminClient();

  if (authorization.status === "pending") {
    if (!authorization.hold_id) {
      throw new ApiHttpError("INTERNAL_ERROR", {
        message: "Authorization has no ledger hold.",
      });
    }

    await releaseHold(authorization.hold_id);
  } else if (authorization.status === "captured") {
    const capture = await findCapture(authorization.id);

    if (!capture) {
      throw new ApiHttpError("INTERNAL_ERROR", {
        message: "Captured authorization has no capture transaction.",
      });
    }

    const amountUnits = parseMinorUnits(
      authorization.usdt_amount_units,
    );

    const journalId = await reverseJournalOnce({
      originalJournalId: capture.journal_id,
      eventOperationId: event.id,
      type: "card_reversal",
    });

    await recordCardTransaction({
      authorizationId: authorization.id,
      type: "reversal",
      amountUnits,
      providerReference: `demo-reversal:${event.event_id}`,
      journalId,
    });
  } else {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: `Cannot reverse an authorization with status ${authorization.status}.`,
    });
  }

  const { error } = await admin
    .from("card_authorizations")
    .update({ status: "reversed" })
    .eq("id", authorization.id);

  if (error) {
    throw error;
  }
}

async function processRefund(
  event: ProviderEventRow,
  authorization: AuthorizationRow,
): Promise<void> {
  if (authorization.status !== "captured") {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Only a captured authorization can be refunded.",
    });
  }

  const capture = await findCapture(authorization.id);

  if (!capture) {
    throw new ApiHttpError("INTERNAL_ERROR", {
      message: "Captured authorization has no capture transaction.",
    });
  }

  const amountUnits = parseMinorUnits(
    authorization.usdt_amount_units,
  );

  const journalId = await reverseJournalOnce({
    originalJournalId: capture.journal_id,
    eventOperationId: event.id,
    type: "refund",
  });

  await recordCardTransaction({
    authorizationId: authorization.id,
    type: "refund",
    amountUnits,
    providerReference: `demo-refund:${event.event_id}`,
    journalId,
  });
}

type ClaimResult =
  | { kind: "fresh"; event: ProviderEventRow }
  | { kind: "retry"; event: ProviderEventRow }
  | { kind: "processed"; event: ProviderEventRow };

/**
 * Insert the provider_events row for this demo event, or reuse the existing
 * one. A row that already reached `processed` is a true duplicate; a row left
 * `failed` (handler threw) or `pending` (crashed mid-flight) is reclaimed so
 * the operator can simply fire the same event again.
 *
 * The row id is reused as the ledger operation_id, so a retry hits the same
 * (operation_id, type) idempotency guard in ledger_post_journal and can never
 * double-post a journal that did land on the first attempt.
 */
async function claimDemoEvent(
  operationId: string,
  outcome: CardOutcome,
  eventId: string,
): Promise<ClaimResult> {
  const admin = createAdminClient();
  const columns = "id, event_id, status, attempts";

  const inserted = await admin
    .from("provider_events")
    .insert({
      provider: "demo",
      event_id: eventId,
      payload: { operation_id: operationId, outcome },
      status: "pending",
      attempts: 1,
    })
    .select(columns)
    .single<ProviderEventRow>();

  if (!inserted.error) {
    return { kind: "fresh", event: inserted.data };
  }

  if (inserted.error.code !== "23505") {
    throw inserted.error;
  }

  const { data: existing, error: existingError } = await admin
    .from("provider_events")
    .select(columns)
    .eq("provider", "demo")
    .eq("event_id", eventId)
    .single<ProviderEventRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing.status === "processed") {
    return { kind: "processed", event: existing };
  }

  // failed or pending: take the row back and count the attempt.
  const { data: reclaimed, error: reclaimError } = await admin
    .from("provider_events")
    .update({ status: "pending", attempts: existing.attempts + 1 })
    .eq("id", existing.id)
    .select(columns)
    .single<ProviderEventRow>();

  if (reclaimError) {
    throw reclaimError;
  }

  return { kind: "retry", event: reclaimed };
}

export async function processDemoCardEvent(params: {
  operationId: string;
  outcome: DemoEventOutcome;
}): Promise<DemoEventResponse> {
  if (!isCardOutcome(params.outcome)) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message:
        "This service only handles capture, reversal, and refund outcomes.",
    });
  }

  const admin = createAdminClient();
  const eventId =
    `demo:${params.operationId}:${params.outcome}`;

  const claimed = await claimDemoEvent(params.operationId, params.outcome, eventId);

  if (claimed.kind === "processed") {
    return {
      event_id: claimed.event.event_id,
      operation_id: params.operationId,
      outcome: params.outcome,
      applied: false,
      duplicate: true,
    };
  }

  const event = claimed.event;

  try {
    const { data: authorization, error } = await admin
      .from("card_authorizations")
      .select(
        "id, card_id, usdt_amount_units, status, hold_id",
      )
      .eq("id", params.operationId)
      .maybeSingle<AuthorizationRow>();

    if (error) {
      throw error;
    }

    if (!authorization) {
      throw new ApiHttpError("NOT_FOUND", {
        message: "Card authorization not found.",
      });
    }

    if (params.outcome === "capture") {
      await processCapture(event, authorization);
    } else if (params.outcome === "reversal") {
      await processReversal(event, authorization);
    } else {
      await processRefund(event, authorization);
    }

    const { error: processedError } = await admin
      .from("provider_events")
      .update({ status: "processed" })
      .eq("id", event.id);

    if (processedError) {
      throw processedError;
    }

    return {
      event_id: event.event_id,
      operation_id: params.operationId,
      outcome: params.outcome,
      applied: true,
      duplicate: false,
    };
  } catch (error) {
    await admin
      .from("provider_events")
      .update({ status: "failed" })
      .eq("id", event.id);

    throw error;
  }
}