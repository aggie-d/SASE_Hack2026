/**
 * LAD Transfer — Shared contracts
 *
 * Single source of truth for every request/response shape shared between
 * API routes (app/api/v1) and the frontend. Do not invent local shapes.
 *
 * Companion modules:
 *   lib/contracts/money.ts   — BigInt helpers (parse, convert, format)
 *   lib/contracts/errors.ts  — error code → HTTP status, messages, builder
 *
 * ─── ISO 4217 currency reference ────────────────────────────────────────────
 *
 * ISO 4217 defines a "minor unit" exponent for every fiat currency — the
 * number of decimal places separating the major unit from its smallest
 * sub-unit. We store all monetary amounts as integers in that smallest unit
 * (tambala for MWK, cents for USD) and transmit them as strings in JSON to
 * avoid floating-point loss.
 *
 *  Currency | ISO code | Numeric | Exponent | Minor unit  | 1 major = N minor
 *  ---------|----------|---------|----------|-------------|------------------
 *  Kwacha   | MWK      | 454     | 2        | tambala     | 100
 *  US Dollar| USD      | 840     | 2        | cent        | 100
 *
 * USDT is not an ISO 4217 currency. It is a USD-pegged stablecoin. The
 * on-chain convention (TRC-20 / ERC-20) is 6 decimal places (1 USDT =
 * 1,000,000 units). We follow that convention internally.
 *
 *  Token  | Standard                   | Exponent | 1 token = N units
 *  -------|----------------------------|----------|------------------
 *  USDT   | on-chain (TRC-20 / ERC-20) | 6        | 1,000,000
 *
 * ─── Minor units on the wire ────────────────────────────────────────────────
 *
 * Every `*_units` field in a request OR response is a BigInt in minor units,
 * serialised as a decimal string. The API never accepts major units.
 *
 * The UI accepts whole-kwacha input (e.g. "204000"). The frontend converts it
 * with toMinorUnits(input, "MWK") from lib/contracts/money.ts before sending
 * (204000 → "20400000" tambala). The server re-parses with parseMinorUnits()
 * and rejects anything that is not a non-negative integer string.
 *
 * A production integration must handle tambala from providers directly and
 * must not assume whole-kwacha input from external systems.
 *
 * ─── Arithmetic rules ───────────────────────────────────────────────────────
 *
 * - All server-side arithmetic uses BigInt. Never use Number for money.
 * - Never mix MWK and USDT units in the same arithmetic expression.
 * - Percentages are expressed in basis points (200 bps = 2%) and applied
 *   with integer division — see applyBasisPoints().
 * - FX rounding policy: floor (truncate toward zero) on the destination
 *   amount. The fee absorbs any remainder.
 */

// ─── Currency metadata ──────────────────────────────────────────────────────

export const CURRENCY_META = {
  MWK: { isoCode: "MWK", isoNumeric: 454, exponent: 2, minorUnit: "tambala", majorToMinor: 100n },
  USD: { isoCode: "USD", isoNumeric: 840, exponent: 2, minorUnit: "cent", majorToMinor: 100n },
  USDT: { isoCode: null, isoNumeric: null, exponent: 6, minorUnit: "micro-USDT", majorToMinor: 1_000_000n },
} as const;

/** "MWK" | "USD" | "USDT". Only MWK and USDT are used in the demo. */
export type Asset = keyof typeof CURRENCY_META;

// ─── Status enums (mirror the Postgres enums; keep in sync with migrations) ─

export type VerificationStatus = "unverified" | "pending" | "verified";
export type UserRole = "user" | "operator";

export type AccountPurpose =
  | "mwk_wallet"
  | "usdt_wallet"
  | "card_funding"
  | "collection_clearing"
  | "fx_clearing_mwk"
  | "fx_clearing_usdt"
  | "fee_revenue"
  | "liquidity_inventory";

export type DepositMethod = "mobile_money" | "bank_transfer";
export type DepositStatus = "pending" | "confirmed" | "failed";
export type ConversionStatus = "pending" | "completed" | "failed";
export type CardStatus = "active" | "frozen" | "closed";
export type AuthorizationStatus = "pending" | "captured" | "reversed" | "expired";
export type CardTransactionType = "capture" | "reversal" | "refund";

/** Each provider adapter runs independently in one of these modes. */
export type ProviderMode = "mock" | "sandbox";

// ─── Money ──────────────────────────────────────────────────────────────────

/**
 * A monetary amount as it appears in JSON.
 *
 * Examples:
 *   204,000 MWK  → { asset: "MWK",  amount_units: "20400000", exponent: 2 }
 *   99.96  USDT  → { asset: "USDT", amount_units: "99960000", exponent: 6 }
 */
export type MoneyAmount = {
  asset: Asset;
  amount_units: string; // BigInt in minor units, serialised as string
  exponent: number; // decimal places — lets the UI format without a lookup
};

/** One row of the account_balances view, as returned by GET /api/v1/wallets. */
export type WalletBalance = {
  account_id: string;
  asset: Asset;
  purpose: AccountPurpose;
  posted_units: string; // confirmed balance in minor units
  held_units: string; // reserved by active holds (pending conversion / card auth)
  available_units: string; // posted_units - held_units
  exponent: number;
};

// ─── Identity ───────────────────────────────────────────────────────────────

/** GET /api/v1/me */
export type MeResponse = {
  user_id: string;
  display_name: string;
  verification_status: VerificationStatus;
  role: UserRole;
  phone?: string;
  country?: string;
  currency?: string;
  card_details?: {
    card_number: string;
    last4: string;
    cvv: string;
    exp: string;
  };
};

/** PATCH /api/v1/me */
export type UpdateProfileRequest = {
  display_name?: string;
  phone?: string;
  country?: string;
  currency?: string;
};

/**
 * POST /api/v1/me/verify — simulated onboarding (NEXT_PUBLIC_DEMO_MODE only).
 *
 * Marks the signed-in user `verified` so they can quote, convert, and use
 * cards. No identity documents are collected; this stands in for KYC in the
 * demo. Idempotent: an already-verified user gets 200 with their profile.
 * Response is MeResponse.
 */
export type VerifyMeRequest = {
  /** Optional fictional display name from the onboarding form (2–80 chars). */
  display_name?: string;
};

// ─── Wallets ────────────────────────────────────────────────────────────────

/** GET /api/v1/wallets — one entry per user-owned account (mwk_wallet, usdt_wallet, card_funding). */
export type WalletsResponse = {
  wallets: WalletBalance[];
};

// ─── Deposits ───────────────────────────────────────────────────────────────

/** POST /api/v1/deposits (requires Idempotency-Key) */
export type CreateDepositRequest = {
  method: DepositMethod;
  /** Tambala. Demo rule: must be a whole number of kwacha (divisible by 100). */
  amount_units: string;
};

/** POST /api/v1/deposits → 202 · GET /api/v1/deposits/:id → 200 */
export type DepositResponse = {
  deposit_id: string;
  status: DepositStatus;
  method: DepositMethod;
  amount: MoneyAmount;
  provider: string;
  provider_reference: string | null;
  /** Simulated payment instructions shown while pending, e.g. "Dial *123# and approve ref MOCK-1234". */
  instructions: string | null;
  mode: ProviderMode;
  created_at: string; // ISO 8601 UTC
  updated_at: string;
};

// ─── FX ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/quotes */
export type CreateQuoteRequest = {
  source_asset: "MWK";
  destination_asset: "USDT";
  /** Tambala to convert. */
  source_units: string;
};

/** POST /api/v1/quotes → 200. Frontend displays this and submits only quote_id. */
export type QuoteResponse = {
  quote_id: string;
  source: MoneyAmount;
  fee: MoneyAmount;
  destination: MoneyAmount;
  /** Human-readable rate in major units, e.g. { value: "2000", meaning: "MWK per USDT" }. */
  rate: { value: string; meaning: string };
  fee_bps: number; // e.g. 200 = 2%
  rounding: "floor";
  expires_at: string; // ISO 8601 UTC
  /** "mock" → UI must label "Demo rate — not a market quote". */
  mode: ProviderMode;
};

/** POST /api/v1/conversions (requires Idempotency-Key) */
export type CreateConversionRequest = {
  quote_id: string;
};

/** POST /api/v1/conversions → 200 (completed) | 202 (pending) · GET /api/v1/conversions/:id */
export type ConversionResponse = {
  conversion_id: string;
  quote_id: string;
  status: ConversionStatus;
  source: MoneyAmount;
  fee: MoneyAmount;
  destination: MoneyAmount;
  failure_code: ErrorCode | null;
  /** Ledger journals posted for this conversion (MWK leg, USDT leg, fee). Empty while pending. */
  journal_ids: string[];
  created_at: string;
  updated_at: string;
};

// ─── Cards ──────────────────────────────────────────────────────────────────

/** POST /api/v1/cards */
export type CreateCardRequest = {
  /** Fictional cardholder name for the demo card. */
  cardholder_name: string;
};

/** POST /api/v1/cards → 201 · PATCH /api/v1/cards/:id → 200 */
export type CardResponse = {
  card_id: string;
  status: CardStatus;
  last4: string;
  /** Always masked, e.g. "•••• •••• •••• 4242". Never a real PAN. */
  masked_pan: string;
  per_transaction_limit: MoneyAmount | null;
  /** The card_funding account this card spends from. */
  funding: WalletBalance;
  provider: string;
  mode: ProviderMode;
  created_at: string;
  updated_at: string;
};

/** GET /api/v1/cards — every card the caller owns (0 or 1 in the demo). */
export type CardsResponse = {
  cards: CardResponse[];
};

/** POST /api/v1/cards/:id/fund (requires Idempotency-Key) */
export type FundCardRequest = {
  /** Micro-USDT to move from usdt_wallet → card_funding. */
  amount_units: string;
};

/** POST /api/v1/cards/:id/fund → 200 */
export type FundCardResponse = {
  transfer_id: string; // operation id
  journal_id: string;
  amount: MoneyAmount;
  wallet: WalletBalance; // usdt_wallet after the transfer
  funding: WalletBalance; // card_funding after the transfer
};

/** PATCH /api/v1/cards/:id — send only the fields to change. */
export type UpdateCardRequest = {
  status?: Extract<CardStatus, "active" | "frozen">;
  /** Micro-USDT, or null to remove the limit. */
  per_transaction_limit_units?: string | null;
};

// ─── Demo operations (server flag NEXT_PUBLIC_DEMO_MODE must be on) ─────────

/** POST /api/v1/demo/purchases (requires Idempotency-Key) */
export type CreatePurchaseRequest = {
  card_id: string;
  merchant: string;
  /** Simulated USDT debit in micro-USDT. Card conversion costs are zero in the demo. */
  amount_units: string;
};

/**
 * POST /api/v1/demo/purchases → 201 when approved.
 * Declines are NOT this shape — they return 422 ApiError with code
 * CARD_FROZEN | LIMIT_EXCEEDED | INSUFFICIENT_FUNDS and place no hold.
 */
export type AuthorizationResponse = {
  authorization_id: string;
  card_id: string;
  merchant: string;
  amount: MoneyAmount;
  status: AuthorizationStatus; // "pending" = approved, hold placed
  hold_id: string;
  funding: WalletBalance; // card_funding showing the new held_units
  created_at: string;
};

export type DemoEventOutcome =
  | "deposit_confirmed"
  | "deposit_failed"
  | "capture"
  | "reversal"
  | "refund"
  | "conversion_failed"
  | "conversion_completed"
  | "provider_timeout";

/** POST /api/v1/demo/events — operator-triggered provider outcome. */
export type DemoEventRequest = {
  /** deposit_id, conversion_id, or authorization_id the outcome applies to. */
  operation_id: string;
  outcome: DemoEventOutcome;
};

/** POST /api/v1/demo/events → 200 */
export type DemoEventResponse = {
  event_id: string;
  operation_id: string;
  outcome: DemoEventOutcome;
  /** false when the event was a duplicate and nothing was posted. */
  applied: boolean;
  duplicate: boolean;
};

// ─── Activity and receipts ──────────────────────────────────────────────────

export type ActivityType =
  | "deposit"
  | "conversion"
  | "card_fund"
  | "purchase"
  | "reversal"
  | "refund";

/** One row in GET /api/v1/activity. */
export type ActivityItem = {
  id: string; // deposit_id | conversion_id | transfer_id | authorization_id | card_transaction id
  type: ActivityType;
  status: string; // the operation's own status enum value
  title: string; // e.g. "Deposit via mobile money", "Purchase — Acme Software"
  amount: MoneyAmount;
  fee: MoneyAmount | null;
  reference: string; // provider_reference or internal operation id
  created_at: string;
};

/** Query string for GET /api/v1/activity. */
export type ActivityListQuery = {
  cursor?: string;
  type?: ActivityType;
  limit?: number; // default 20, max 100
};

export type ActivityListResponse = {
  items: ActivityItem[];
  next_cursor: string | null;
};

/** One journal_entries row, exposed on receipts so every balance change is explainable. */
export type LedgerLeg = {
  journal_id: string;
  account_purpose: AccountPurpose;
  asset: Asset;
  debit_units: string;
  credit_units: string;
};

/** GET /api/v1/activity/:id — 404 if the operation is not owned by the caller. */
export type ReceiptResponse = ActivityItem & {
  legs: LedgerLeg[];
  provider: string | null;
  provider_reference: string | null;
  mode: ProviderMode;
  updated_at: string;
};

// ─── Webhooks ───────────────────────────────────────────────────────────────

/** POST /api/v1/webhooks/:provider → 200 always once the event is persisted. */
export type WebhookAckResponse = {
  received: true;
  event_id: string;
  duplicate: boolean;
};

// ─── Payment Methods ────────────────────────────────────────────────────────

export type PaymentMethodType = "card" | "bank" | "mobile";

export type PaymentMethodItem = {
  id: string;
  type: PaymentMethodType;
  title: string;
  subtitle: string;
  icon_type: PaymentMethodType;
  last4?: string;
  cvv?: string;
  created_at: string;
};

export type CreatePaymentMethodRequest = {
  type: PaymentMethodType;
  name: string;
  number: string;
  cvv?: string;
};

export type PaymentMethodsResponse = {
  payment_methods: PaymentMethodItem[];
};

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationType = "transfer" | "security" | "card" | "system" | "limit";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  type: NotificationType;
  is_unread: boolean;
  created_at: string;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
  unread_count: number;
};

// ─── Errors ─────────────────────────────────────────────────────────────────

export type ErrorCode =
  // business rules (422)
  | "QUOTE_EXPIRED"
  | "INSUFFICIENT_FUNDS"
  | "LIQUIDITY_UNAVAILABLE"
  | "CARD_FROZEN"
  | "LIMIT_EXCEEDED"
  | "DEPOSIT_PENDING"
  | "PROVIDER_FAILED"
  // access
  | "VERIFICATION_REQUIRED" // 403
  | "UNAUTHORIZED" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  // request
  | "VALIDATION_ERROR" // 400
  | "IDEMPOTENCY_CONFLICT" // 409
  // async / infra
  | "PROVIDER_PENDING" // 202 — not a failure; poll the resource
  | "INTERNAL_ERROR"; // 500

/** Every non-2xx response body uses this envelope. */
export type ApiError = {
  error: {
    code: ErrorCode;
    message: string; // actionable, user-facing
    retryable: boolean;
  };
  request_id: string;
};

// ─── Idempotency ────────────────────────────────────────────────────────────

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Routes that MUST receive an Idempotency-Key. Same key + same body → replay; same key + different body → 409. */
export const IDEMPOTENT_ROUTES = [
  "POST /api/v1/deposits",
  "POST /api/v1/conversions",
  "POST /api/v1/cards/:id/fund",
  "POST /api/v1/demo/purchases",
] as const;
