import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ConversionResponse, DepositMethod, DepositResponse, ErrorCode, QuoteResponse,
} from "@/lib/contracts";
import { isWholeMajorUnits, money, parseMinorUnits } from "@/lib/contracts/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError } from "@/lib/server/http";
import { getJournalsForOperation } from "@/lib/server/ledger/post";
import { MockFxProvider } from "@/lib/server/providers/mock-fx";
import { calculateMockQuote } from "@/lib/server/fx-calculation";

const RATE_TAMBALA = "200000";
const FEE_BPS = 200;
const QUOTE_LIFETIME_MS = 5 * 60_000;
const MAX_BIGINT = 9_223_372_036_854_775_807n;

type DbError = { code?: string; message: string; details?: string };
const BUSINESS_ERRORS: ErrorCode[] = [
  "VALIDATION_ERROR", "NOT_FOUND", "IDEMPOTENCY_CONFLICT", "QUOTE_EXPIRED",
  "INSUFFICIENT_FUNDS", "LIQUIDITY_UNAVAILABLE",
];

function dbError(error: DbError): never {
  if (error.code === "P0001" && BUSINESS_ERRORS.includes(error.message as ErrorCode)) {
    throw new ApiHttpError(error.message as ErrorCode);
  }
  console.error("[deposits-fx] database operation failed", error);
  throw new ApiHttpError("INTERNAL_ERROR");
}

function checkedUnits(units: bigint): void {
  if (units <= 0n || units > MAX_BIGINT || !isWholeMajorUnits(units, "MWK")) {
    throw new ApiHttpError("VALIDATION_ERROR", { message: "Enter a positive whole-kwacha amount within the supported range." });
  }
}

type DepositRow = {
  id: string; user_id: string; method: DepositMethod; amount_units: string | number;
  provider: string; provider_reference: string | null;
  status: DepositResponse["status"]; created_at: string; updated_at: string;
};

function depositResponse(row: DepositRow): DepositResponse {
  return {
    deposit_id: row.id, status: row.status, method: row.method,
    amount: money("MWK", parseMinorUnits(row.amount_units)),
    provider: row.provider, provider_reference: row.provider_reference,
    instructions: row.status === "pending" ?
      `Demo ${row.method === "mobile_money" ? "mobile money" : "bank transfer"}: approve reference ${row.provider_reference}. No real payment is collected.` : null,
    mode: "mock", created_at: row.created_at, updated_at: row.updated_at,
  };
}

export async function getDeposit(userId: string, id: string): Promise<DepositResponse> {
  const { data, error } = await createAdminClient().from("deposits").select("*")
    .eq("id", id).eq("user_id", userId).maybeSingle<DepositRow>();
  if (error) dbError(error);
  if (!data) throw new ApiHttpError("NOT_FOUND");
  return depositResponse(data);
}

export async function createDeposit(userId: string, id: string, method: DepositMethod, units: bigint): Promise<DepositResponse> {
  checkedUnits(units);
  const { error } = await createAdminClient().rpc("c_create_deposit", {
    p_id: id, p_user_id: userId, p_method: method, p_amount_units: units.toString(),
    p_provider_reference: `mock_collection_${id}`,
  });
  if (error) dbError(error);
  return getDeposit(userId, id);
}

export type MockCollectionEvent = {
  event_id: string; provider_reference: string; outcome: "confirmed" | "failed";
  amount_units: string; asset: "MWK";
};

export function verifyMockEvent(raw: string, signature: string | null): MockCollectionEvent {
  const secret = process.env.MOCK_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new ApiHttpError("INTERNAL_ERROR", { message: "Mock webhook secret is not configured." });
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!signature || !/^[\da-f]{64}$/i.test(signature) ||
      !timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
    throw new ApiHttpError("FORBIDDEN", { message: "Invalid mock webhook signature." });
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new ApiHttpError("VALIDATION_ERROR"); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ApiHttpError("VALIDATION_ERROR");
  const event = parsed as Record<string, unknown>;
  if (typeof event.event_id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.event_id) ||
      typeof event.provider_reference !== "string" || !/^mock_collection_[\da-f-]{36}$/i.test(event.provider_reference) ||
      (event.outcome !== "confirmed" && event.outcome !== "failed") || event.asset !== "MWK" ||
      typeof event.amount_units !== "string" || !/^\d+$/.test(event.amount_units)) {
    throw new ApiHttpError("VALIDATION_ERROR", { message: "Malformed mock collection event." });
  }
  const units = parseMinorUnits(event.amount_units);
  if (units <= 0n || units > MAX_BIGINT) throw new ApiHttpError("VALIDATION_ERROR");
  return event as MockCollectionEvent;
}

export async function applyDepositEvent(event: MockCollectionEvent): Promise<{ duplicate: boolean; applied: boolean }> {
  const { data, error } = await createAdminClient().rpc("c_apply_deposit_event", {
    p_event_id: event.event_id, p_provider_reference: event.provider_reference,
    p_amount_units: event.amount_units, p_outcome: event.outcome, p_payload: event,
  });
  if (error) dbError(error);
  return data as { duplicate: boolean; applied: boolean };
}

type QuoteRow = {
  id: string; user_id: string; pair: string; source_units: number | string;
  fee_units: number | string; destination_units: number | string; rate_string: string;
  expires_at: string; provider: string; rounding: string;
};

function quoteResponse(row: QuoteRow): QuoteResponse {
  return {
    quote_id: row.id, source: money("MWK", parseMinorUnits(row.source_units)),
    fee: money("MWK", parseMinorUnits(row.fee_units)),
    destination: money("USDT", parseMinorUnits(row.destination_units)),
    rate: { value: (BigInt(row.rate_string) / 100n).toString(), meaning: "MWK per USDT" }, fee_bps: FEE_BPS,
    rounding: "floor", expires_at: row.expires_at, mode: "mock",
  };
}

export async function createQuote(userId: string, units: bigint): Promise<QuoteResponse> {
  checkedUnits(units);
  const { fee, destination } = calculateMockQuote(units);
  if (destination <= 0n || destination > MAX_BIGINT) throw new ApiHttpError("VALIDATION_ERROR", { message: "Amount is outside the supported quote range." });
  const { data, error } = await createAdminClient().from("quotes").insert({
    user_id: userId, pair: "MWK/USDT", source_units: units.toString(),
    fee_units: fee.toString(), destination_units: destination.toString(),
    rate_string: RATE_TAMBALA, expires_at: new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString(),
    provider: "mock", rounding: "floor",
  }).select("*").single<QuoteRow>();
  if (error) dbError(error);
  return quoteResponse(data);
}

type ConversionRow = {
  id: string; user_id: string; quote_id: string; status: ConversionResponse["status"];
  failure_code: ErrorCode | null; created_at: string; updated_at: string;
};

export async function getConversion(userId: string, id: string): Promise<ConversionResponse> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("conversions").select("*")
    .eq("id", id).eq("user_id", userId).maybeSingle<ConversionRow>();
  if (error) dbError(error);
  if (!data) throw new ApiHttpError("NOT_FOUND");
  const { data: quote, error: quoteError } = await admin.from("quotes").select("*")
    .eq("id", data.quote_id).eq("user_id", userId).single<QuoteRow>();
  if (quoteError) dbError(quoteError);
  const journals = await getJournalsForOperation(id);
  return {
    conversion_id: id, quote_id: data.quote_id, status: data.status,
    source: money("MWK", parseMinorUnits(quote.source_units)),
    fee: money("MWK", parseMinorUnits(quote.fee_units)),
    destination: money("USDT", parseMinorUnits(quote.destination_units)),
    failure_code: data.failure_code, journal_ids: journals.filter((j) => j.type === "conversion").map((j) => j.id),
    created_at: data.created_at, updated_at: data.updated_at,
  };
}

export async function finishConversion(id: string, outcome: "completed" | "failed"): Promise<void> {
  const { error } = await createAdminClient().rpc("c_finish_conversion", { p_id: id, p_outcome: outcome });
  if (error) dbError(error);
}

export async function createConversion(userId: string, id: string, quoteId: string): Promise<ConversionResponse> {
  const provider = new MockFxProvider();
  const { error } = await createAdminClient().rpc("c_reserve_conversion", {
    p_id: id, p_user_id: userId, p_quote_id: quoteId,
    p_provider_reference: provider.reference(id),
  });
  if (error) dbError(error);
  // The mock adapter returns an immediate terminal outcome by default. A
  // simulated timeout preserves both reservations for operator recovery.
  const outcome = await provider.executeConversion(id);
  if (outcome === "completed" || outcome === "failed") await finishConversion(id, outcome);
  return getConversion(userId, id);
}

export async function getDepositForOperator(id: string): Promise<DepositRow> {
  const { data, error } = await createAdminClient().from("deposits").select("*").eq("id", id).maybeSingle<DepositRow>();
  if (error) dbError(error);
  if (!data) throw new ApiHttpError("NOT_FOUND");
  return data;
}

export async function getConversionForOperator(id: string): Promise<ConversionRow> {
  const { data, error } = await createAdminClient().from("conversions").select("*").eq("id", id).maybeSingle<ConversionRow>();
  if (error) dbError(error);
  if (!data) throw new ApiHttpError("NOT_FOUND");
  return data;
}

export async function recordFxTimeout(id: string, eventId: string): Promise<boolean> {
  const admin = createAdminClient();
  const payload = { operation_id: id, outcome: "provider_timeout" };
  const inserted = await admin.from("provider_events").insert({
    provider: "mock_fx", event_id: eventId, payload, status: "pending", attempts: 1,
  });
  if (!inserted.error) return false;
  if (inserted.error.code !== "23505") dbError(inserted.error);
  const existing = await admin.from("provider_events").select("payload")
    .eq("provider", "mock_fx").eq("event_id", eventId).single<{ payload: unknown }>();
  if (existing.error) dbError(existing.error);
  if (JSON.stringify(existing.data.payload) !== JSON.stringify(payload)) throw new ApiHttpError("IDEMPOTENCY_CONFLICT");
  return true;
}
