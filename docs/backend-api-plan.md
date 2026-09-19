# LAD Transfer — Backend API and Integration Plan

3 backend people, 1 frontend person. This doc is the source of truth for what the backend team needs to build, who owns what, and in what order. Frontend builds against the types in `lib/contracts/index.ts` and the routes described here.

---

## Step 0 — Shared foundation — DONE

`lib/contracts/` is filled in. Every route and every UI component imports from here. No one invents their own shapes.

| File | Contents |
|---|---|
| `lib/contracts/index.ts` | ISO 4217 table (`CURRENCY_META`), status enums mirroring the DB, request/response types for every route in this doc, `ErrorCode`, `ApiError`, `IDEMPOTENCY_HEADER`, `IDEMPOTENT_ROUTES` |
| `lib/contracts/money.ts` | BigInt helpers: `toMinorUnits`, `parseMinorUnits`, `parsePositiveMinorUnits`, `fromMinorUnits`, `formatMinorUnits`, `formatMoney`, `money`, `applyBasisPoints`, `convertAtRate`, `isWholeMajorUnits`, `assertSameAsset` |
| `lib/contracts/errors.ts` | `ERROR_HTTP_STATUS`, `ERROR_RETRYABLE`, `ERROR_MESSAGE`, `apiError()`, `isApiError()` |

All three are safe to import in client components (no server-only dependencies). `tsconfig.json` target was bumped to `ES2020` so BigInt literals (`100n`) compile.

**How to use them**

```ts
// Frontend: user typed "204,000" into the deposit form
import { toMinorUnits } from "@/lib/contracts/money";
const body: CreateDepositRequest = {
  method: "mobile_money",
  amount_units: toMinorUnits(input, "MWK").toString(), // "20400000"
};

// API route: never trust the string, re-parse it
import { parsePositiveMinorUnits, isWholeMajorUnits } from "@/lib/contracts/money";
import { apiError, ERROR_HTTP_STATUS } from "@/lib/contracts/errors";
const units = parsePositiveMinorUnits(body.amount_units);          // throws MoneyError on junk
if (!isWholeMajorUnits(units, "MWK")) {
  return Response.json(apiError("VALIDATION_ERROR", { message: "Enter whole kwacha." }),
    { status: ERROR_HTTP_STATUS.VALIDATION_ERROR });
}

// FX service: the brief's demo arithmetic, all BigInt
const fee  = applyBasisPoints(src, 200);                 // 2% → 408000n tambala
const dest = convertAtRate(src - fee, "MWK", "USDT", "2000"); // → 99960000n micro-USDT

// Frontend display
formatMoney(quote.destination); // "99.96 USDT"
```

### ISO 4217 currency standard

ISO 4217 defines a minor-unit exponent for every fiat currency — the number of decimal places between the major unit and its smallest sub-unit. We store all amounts as integers in the minor unit and transmit as strings in JSON.

| Currency | ISO code | ISO numeric | Exponent | Minor unit | 1 major = N minor |
|---|---|---|---|---|---|
| Malawian Kwacha | MWK | 454 | 2 | tambala | 100 |
| US Dollar | USD | 840 | 2 | cent | 100 |

USDT is not ISO 4217. On-chain convention (TRC-20, ERC-20) is 6 decimal places.

| Token | Exponent | 1 token = N units |
|---|---|---|
| USDT | 6 | 1,000,000 |

**Minor units on the wire:** every `*_units` field in a request or response is a BigInt in minor units serialised as a string. The API never accepts major units.

**Demo simplification:** the UI accepts whole-kwacha input. The frontend converts it with `toMinorUnits(input, "MWK")` before sending (`204000` → `"20400000"` tambala); the server re-parses with `parsePositiveMinorUnits()` and, for MWK, rejects anything that is not whole kwacha via `isWholeMajorUnits()`. Internal storage is therefore ISO-correct (exponent 2). A production integration must accept tambala directly from providers.

**Arithmetic rule:** use `BigInt` in TypeScript for all money. Never use `Number` or floating-point. Serialise to string for JSON. Note that Supabase returns Postgres `bigint` columns as JavaScript `Number` — run every DB value through `parseMinorUnits()` immediately (it rejects unsafe integers).

### Route → type map

Every route below has its request/response type in `lib/contracts/index.ts`:

| Route | Request type | Response type |
|---|---|---|
| `GET /me` | — | `MeResponse` |
| `GET /wallets` | — | `WalletsResponse` |
| `POST /deposits` | `CreateDepositRequest` | `DepositResponse` (202) |
| `GET /deposits/:id` | — | `DepositResponse` |
| `POST /quotes` | `CreateQuoteRequest` | `QuoteResponse` |
| `POST /conversions` | `CreateConversionRequest` | `ConversionResponse` (200 or 202) |
| `GET /conversions/:id` | — | `ConversionResponse` |
| `POST /cards` | `CreateCardRequest` | `CardResponse` (201) |
| `POST /cards/:id/fund` | `FundCardRequest` | `FundCardResponse` |
| `PATCH /cards/:id` | `UpdateCardRequest` | `CardResponse` |
| `POST /demo/purchases` | `CreatePurchaseRequest` | `AuthorizationResponse` (201) or 422 `ApiError` on decline |
| `POST /demo/events` | `DemoEventRequest` | `DemoEventResponse` |
| `GET /activity` | `ActivityListQuery` (query string) | `ActivityListResponse` |
| `GET /activity/:id` | — | `ReceiptResponse` |
| `POST /webhooks/:provider` | raw provider payload | `WebhookAckResponse` |

Status enums (`DepositStatus`, `ConversionStatus`, `CardStatus`, `AuthorizationStatus`, `AccountPurpose`, …) mirror the Postgres enums exactly. If a migration changes an enum, change the type in the same PR.

### Error codes the frontend will handle

Defined in `ErrorCode`; status, retryability, and default message live in `lib/contracts/errors.ts`.

| Code | HTTP | Retryable | Meaning |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | no | Malformed body / bad amount string |
| `UNAUTHORIZED` | 401 | no | No session |
| `FORBIDDEN` | 403 | no | Session exists but not allowed (e.g. operator-only) |
| `VERIFICATION_REQUIRED` | 403 | no | User not verified |
| `NOT_FOUND` | 404 | no | Absent, or owned by someone else (do not leak which) |
| `IDEMPOTENCY_CONFLICT` | 409 | no | Same key, different payload |
| `QUOTE_EXPIRED` | 422 | yes | Quote past `expires_at`; get a new one |
| `INSUFFICIENT_FUNDS` | 422 | no | Not enough `available_units` |
| `LIQUIDITY_UNAVAILABLE` | 422 | yes | Mock FX pool cannot cover the conversion |
| `CARD_FROZEN` | 422 | no | Card status is `frozen`; no hold placed |
| `LIMIT_EXCEEDED` | 422 | no | Amount exceeds `per_transaction_limit_units` |
| `DEPOSIT_PENDING` | 422 | yes | Provider has not confirmed yet |
| `PROVIDER_PENDING` | 202 | yes | Async operation accepted; poll the resource |
| `INTERNAL_ERROR` | 500 | yes | Unexpected failure |

Build every error response with `apiError(code)` so the message is actionable and `request_id` is always present.

### Idempotency

Every monetary write route requires an `Idempotency-Key` header (constant `IDEMPOTENCY_HEADER`; the list is `IDEMPOTENT_ROUTES`): `POST /deposits`, `POST /conversions`, `POST /cards/:id/fund`, `POST /demo/purchases`. Same key + same payload → return original result. Same key + different payload → 409 `IDEMPOTENCY_CONFLICT`.

---

## Workstream B — Core ledger (Person 1) — DONE

**Everything else depends on this. Build it first.** Landed in PR #7 (`feature/core-ledger`). C and D: skip to [Ledger API for C and D](#ledger-api-for-c-and-d) below for exactly what to import.

### Files to create

```
lib/server/auth.ts           — extract verified user_id from Supabase session or throw 401
lib/server/idempotency.ts    — check/store idempotency_records
lib/server/ledger/
  post.ts                    — write balanced journal entries in a Postgres transaction
  holds.ts                   — create, consume, and release holds atomically
  balances.ts                — query the account_balances view
  transfer.ts                — internal transfer between two user accounts (used for card funding)
```

### Ledger rules (enforce in `post.ts`)

- All money is `bigint`. No `number` arithmetic, anywhere.
- Every journal must balance per asset: sum of debits = sum of credits across all entries.
- MWK and USDT are never mixed in the same balance check.
- Never edit a past entry — corrections use a compensating journal.
- Lock account rows in a consistent order before posting to prevent deadlocks.

### API routes

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/me` | Return profile + verification status from `profiles` table |
| `GET` | `/api/v1/wallets` | Return all user accounts from `account_balances` view |

### Key helper

Write `getUserAccounts(userId)` that returns account IDs keyed by purpose (`mwk_wallet`, `usdt_wallet`, `card_funding`). All other workstreams use this to know which account to debit or credit.

### Ledger API for C and D

Everything below is server-only (`import "server-only"` is enforced; it will not bundle into a client component). All functions use the service-role client, so RLS does not apply — the route is responsible for calling `requireUser()` first and only touching that user's accounts.

**Route skeleton** — every route looks like this. `route()` turns any thrown `ApiHttpError` / `LedgerError` / `MoneyError` into the standard `ApiError` envelope with the right HTTP status and a `request_id`; you never write a `try/catch` for errors.

```ts
// app/api/v1/cards/[id]/fund/route.ts
import type { NextRequest } from "next/server";
import type { FundCardResponse } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { withIdempotency } from "@/lib/server/idempotency";
import { field, parseBody, route } from "@/lib/server/http";
import { transferBetweenUserAccounts } from "@/lib/server/ledger/transfer";

export const POST = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { userId } = await requireUser();
  const { id: cardId } = await ctx.params;
  const body = await parseBody(req, (b) => ({
    amount_units: field.positiveMinorUnits(b, "amount_units"), // bigint
  }));

  return withIdempotency(req, { userId, route: "POST /api/v1/cards/:id/fund" }, body, async ({ operationId }) => {
    const result = await transferBetweenUserAccounts({
      userId, operationId, from: "usdt_wallet", to: "card_funding", amountUnits: body.amount_units, type: "card_fund",
    });
    return { status: 200, body: { /* FundCardResponse built from result */ } as FundCardResponse };
  });
});
```

**`lib/server/auth.ts`**

```ts
requireUser(): Promise<{ userId: string }>                                  // 401 UNAUTHORIZED
requireVerifiedUser(): Promise<{ userId: string; profile: MeResponse }>     // 403 VERIFICATION_REQUIRED
requireOperator(): Promise<{ userId: string; profile: MeResponse }>         // 403 FORBIDDEN — D's /demo routes
getProfile(userId: string): Promise<MeResponse>
```

**`lib/server/http.ts`**

```ts
route(handler)                                    // wrap every export const GET/POST
ok<T>(body: T, { status?, headers?, requestId? }): Response
parseBody<T>(req, (body: JsonObject) => T): Promise<T>   // JSON parse + your field checks → 400 VALIDATION_ERROR
field.string / optionalString / uuid / oneOf / optionalOneOf
field.minorUnits(body, key): bigint               // "20400000" → 20400000n, zero allowed
field.positiveMinorUnits(body, key): bigint       // > 0 or 400
field.nullablePositiveMinorUnits(body, key): bigint | null | undefined
new ApiHttpError(code: ErrorCode, { message?, details? })  // throw this for business errors
```

**`lib/server/idempotency.ts`** — required on the four routes in `IDEMPOTENT_ROUTES` (`lib/contracts/index.ts`): `POST /api/v1/deposits`, `POST /api/v1/conversions`, `POST /api/v1/cards/:id/fund`, `POST /api/v1/demo/purchases`. Pass the string exactly as listed there.

```ts
withIdempotency<T>(
  req: Request,
  scope: { userId: string; route: IdempotentRoute },   // route string exactly as in IDEMPOTENT_ROUTES
  body: unknown,                                       // the parsed body; hashed with stableStringify (bigint-safe)
  handler: ({ operationId, requestId }) => Promise<{ status: number; body: T }>,
): Promise<Response>
```

Behaviour: missing header → 400; same key + same body → replays the stored response with header `Idempotent-Replayed: true`; same key + different body → 409 `IDEMPOTENCY_CONFLICT`; a handler that threw a 5xx (or died mid-flight for 60 s) is retried **with the same `operationId`**, so the ledger short-circuits and no money moves twice. Always pass that `operationId` straight into `postJournal` / `placeHold` / `transferBetweenUserAccounts`.

**`lib/server/ledger/accounts.ts`**

```ts
type UserAccountPurpose = "mwk_wallet" | "usdt_wallet" | "card_funding";
type SystemAccountPurpose = "collection_clearing" | "fx_clearing_mwk" | "fx_clearing_usdt" | "fee_revenue" | "liquidity_inventory";
type AccountRef = { id: string; asset: Asset };

getUserAccounts(userId): Promise<Record<UserAccountPurpose, AccountRef>>   // throws 500 if the signup trigger didn't run
getSystemAccount(purpose: SystemAccountPurpose, asset: Asset): Promise<AccountRef>
getAccount(accountId): Promise<AccountRow | null>
assertAccountOwner(accountId, userId): Promise<AccountRow>                 // 403 FORBIDDEN
```

**`lib/server/ledger/post.ts`**

```ts
debit(account: AccountRef, units: bigint): JournalEntryInput    // money leaves the account
credit(account: AccountRef, units: bigint): JournalEntryInput   // money arrives

postJournal({
  operationId: string;          // deposit id / conversion id / withIdempotency's operationId
  type: JournalType;            // "deposit" | "conversion" | "card_fund" | "card_auth" | "card_capture" | "card_reversal" | "refund" | "fee"
  entries: JournalEntryInput[]; // ≥ 2, balanced per asset
  consumeHoldIds?: string[];    // card capture: mark these active holds consumed in the same transaction
  reversalOf?: string | null;   // prefer reverseJournal() below
}): Promise<{ journalId: string }>

reverseJournal({ journalId, operationId, type }): Promise<{ journalId: string }>   // mirrored entries, never edits
getJournal(journalId): Promise<JournalWithEntries | null>
getJournalsForOperation(operationId): Promise<JournalRow[]>
```

`postJournal` is idempotent on `(operationId, type)` — calling it twice returns the same `journalId`. Within one journal you may mix assets **only if each asset balances on its own** (a conversion is one journal: MWK legs balance, USDT legs balance). User-owned accounts cannot go below zero (`INSUFFICIENT_FUNDS`); system accounts can.

**`lib/server/ledger/holds.ts`** (D: card authorization)

```ts
placeHold({ accountId, operationId, amountUnits: bigint, expiresAt? }): Promise<{ holdId: string }>   // INSUFFICIENT_FUNDS if > available
releaseHold(holdId): Promise<void>                       // active → released; released is a no-op; consumed → HOLD_NOT_ACTIVE
getHold(holdId): Promise<HoldRow | null>
getHoldForOperation(accountId, operationId): Promise<HoldRow | null>
// consume = postJournal({ ..., consumeHoldIds: [holdId] }) — capture and consume are one transaction
```

**`lib/server/ledger/balances.ts`**

```ts
getWalletBalances(userId): Promise<WalletBalance[]>                    // the three user accounts, ordered
getAccountBalance(accountId): Promise<WalletBalance>                   // 404 NOT_FOUND
getAccountBalances(accountIds: string[]): Promise<Map<string, WalletBalance>>
```

**`lib/server/ledger/transfer.ts`** (D: card funding)

```ts
transferBetweenUserAccounts({ userId, operationId, from, to, amountUnits: bigint, type?: "card_fund" })
  : Promise<{ journalId: string; from: WalletBalance; to: WalletBalance }>
```

**Recipes**

```ts
// C — confirm an MWK deposit (webhook or mock confirm)
const { mwk_wallet } = await getUserAccounts(userId);
const clearing = await getSystemAccount("collection_clearing", "MWK");
await postJournal({ operationId: deposit.id, type: "deposit",
  entries: [debit(clearing, amount), credit(mwk_wallet, amount)] });

// C — execute a conversion from an accepted quote (fee taken in MWK)
const { mwk_wallet, usdt_wallet } = await getUserAccounts(userId);
const fxMwk  = await getSystemAccount("fx_clearing_mwk", "MWK");
const fxUsdt = await getSystemAccount("fx_clearing_usdt", "USDT");
const fees   = await getSystemAccount("fee_revenue", "MWK");
await postJournal({ operationId: conversion.id, type: "conversion", entries: [
  debit(mwk_wallet, quote.source_units),                       // MWK side balances:
  credit(fxMwk, quote.source_units - quote.fee_units),         //   source = (source − fee) + fee
  credit(fees, quote.fee_units),
  debit(fxUsdt, quote.destination_units),                      // USDT side balances on its own
  credit(usdt_wallet, quote.destination_units),
] });

// D — authorize, then capture (consumes the hold atomically), or reverse
const { holdId } = await placeHold({ accountId: card_funding.id, operationId: auth.id, amountUnits });
await postJournal({ operationId: auth.id, type: "card_capture", consumeHoldIds: [holdId],
  entries: [debit(card_funding, amountUnits), credit(await getSystemAccount("liquidity_inventory", "USDT"), amountUnits)] });
// or: await releaseHold(holdId);
```

**Errors you will see** (all thrown as `LedgerError extends ApiHttpError`; `route()` maps them):

| SQL / TS code | API `ErrorCode` | HTTP | Meaning |
|---|---|---|---|
| `INSUFFICIENT_FUNDS` | `INSUFFICIENT_FUNDS` | 422 | User account would go below zero (or hold > available) |
| `LEDGER_INVALID_AMOUNT`, `HOLD_NOT_ACTIVE`, `LEDGER_REVERSAL_INVALID`, `TS_VALIDATION` | `VALIDATION_ERROR` | 400 | Bad amount, hold already consumed/released, journal already reversed, or `number` used for units |
| `LEDGER_ACCOUNT_NOT_FOUND`, `HOLD_NOT_FOUND` | `NOT_FOUND` | 404 | |
| `LEDGER_UNBALANCED`, `LEDGER_INVALID_ENTRIES`, `LEDGER_ASSET_MISMATCH` | `INTERNAL_ERROR` | 500 | **Your route built a bad journal.** Clients never send entries, so this is a server bug — check the recipe. |

**Rules that will fail loudly if you break them**

- Units are `bigint` end to end. Parse request bodies with `field.minorUnits` / `field.positiveMinorUnits`; a `number` anywhere in an entry throws `VALIDATION_ERROR` before the DB is touched.
- Never call `admin.from("journals"|"journal_entries"|"holds").insert/update` directly — go through the functions above. The SQL functions are the only path that locks rows in a consistent order and validates balance.
- Never edit or delete a posted journal. Compensate with `reverseJournal` or a new `postJournal`.
- Reuse the same `operationId` on every retry of the same business action. New UUID per attempt = double posting.
- Do not read the `account_balances` view from the browser; it is `service_role` only. Use `GET /api/v1/wallets`.

**Migrations.** `supabase/migrations/` is the full history and matches `supabase_migrations.schema_migrations` on the project exactly (versions `20260919201358` → `20260919215715`). New schema changes: apply via Supabase MCP `apply_migration`, then save the identical SQL as `supabase/migrations/<version>_<name>.sql` in the same PR.

---

## Workstream C — Deposits and FX (Person 2)

Depends on the ledger service from B. Can stub out `post.ts` locally while B finishes.

### Deposit flow

```
POST /deposits
  → create deposits row (pending)
  → MockCollectionProvider.createDeposit (returns provider_reference)
  → return { deposit_id, status: "pending" }

POST /webhooks/mock  (simulated callback from provider)
  → insert into provider_events (dedup on provider + event_id)
  → post journal: debit collection_clearing, credit user mwk_wallet
  → mark deposit confirmed
```

### FX / conversion flow

```
POST /quotes
  → server computes: fee = source_units * 2 / 100 (bigint)
  → net = source_units - fee
  → destination_units = net / 2000  (bigint, MWK per USDT, scale difference applied)
  → store in quotes, expires_at = now() + 5 minutes
  → return quote JSON

POST /conversions
  → verify quote not expired, owned by this user
  → check available_units >= source_units on mwk_wallet
  → check liquidity_pools has enough unreserved USDT
  → place hold on mwk_wallet
  → reserve in liquidity_pools
  → MockFxProvider.executeConversion
  → post journals: MWK debit leg + USDT credit leg through clearing accounts
  → release hold, consume liquidity reservation
  → mark conversion completed
```

### Demo quote numbers (for reference)

Using the brief's demo scenario (204,000 MWK UI input, converted to tambala internally):

| Field | Value | Notes |
|---|---|---|
| UI input | `204000` | Whole kwacha, as entered by user |
| `source_units` | `"20400000"` | 204,000 MWK × 100 tambala = 20,400,000 tambala (exponent 2) |
| `fee_units` | `"408000"` | 2% of 20,400,000 tambala = 408,000 tambala (= 4,080 MWK) |
| Net MWK after fee | `"19992000"` | 19,992,000 tambala (= 199,920 MWK) |
| `destination_units` | `"99960000"` | 99.96 USDT = 99,960,000 micro-USDT (exponent 6) |
| `rate` | `"200000"` tambala per USDT | Equivalent to 2,000 MWK per USDT |
| `rate_display` | `"2000"` MWK per USDT | Human-readable label shown in UI |
| `expires_at` | ISO 8601 UTC | 5 minutes from quote creation |

> The rate stored in the database and used for arithmetic is in tambala-per-USDT (200,000). The UI displays the human-readable MWK-per-USDT value (2,000). Keep these separate to avoid confusion.

### Files to create

```
lib/server/deposits/service.ts
lib/server/fx/quotes.ts          — rate calculation (integer arithmetic only)
lib/server/fx/conversions.ts
lib/server/providers/types.ts    — CollectionProvider and FxProvider interfaces
lib/server/providers/mock-collection.ts
lib/server/providers/mock-fx.ts
```

### API routes

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/deposits` | Create deposit, call mock provider, return `deposit_id` |
| `GET` | `/api/v1/deposits/:id` | Ownership check, return status + receipt fields |
| `POST` | `/api/v1/quotes` | Compute and store server-side quote |
| `POST` | `/api/v1/conversions` | Accept quote, move money through ledger |
| `GET` | `/api/v1/conversions/:id` | Ownership check, return outcome + journal refs |
| `POST` | `/api/v1/webhooks/mock` | Receive simulated deposit callback, deduplicate, credit wallet |

### Failure cases to handle

- Duplicate webhook → `provider_events` unique constraint blocks second insert; return 200 silently
- Two simultaneous conversions overdrawing → hold + Postgres row lock prevents negative balance
- Quote expired → check `expires_at`, return `QUOTE_EXPIRED` 422
- Liquidity unavailable → check pool before reserving, return `LIQUIDITY_UNAVAILABLE` 422

---

## Workstream D — Cards with Lithic sandbox + Integration (Person 3)

Uses the **Lithic sandbox** for real card creation and status mirroring. Depends on the ledger transfer service from B.

### Lithic setup

1. Get a Lithic sandbox API key from [app.lithic.com](https://app.lithic.com)
2. Add to `.env.local`: `LITHIC_API_KEY=your_sandbox_key`
3. Add to `.env.example`: `LITHIC_API_KEY=your-lithic-sandbox-key-here`
4. Install the SDK: `npm install lithic`
5. Optionally add the Lithic MCP to `.cursor/mcp.json` for docs access:
   ```json
   "lithic": { "url": "https://docs.lithic.com/mcp" }
   ```

### Card flow

```
POST /cards
  → Lithic.cards.create({ type: "VIRTUAL", ... }) in sandbox
  → store last4 + provider_card_id in cards table
  → link to user's card_funding account
  → return card metadata (masked)

POST /cards/:id/fund
  → verify card owned by user
  → check usdt_wallet available_units >= amount
  → ledger transfer: usdt_wallet → card_funding
  → return updated balances

PATCH /cards/:id
  → update status (frozen/active) or per_transaction_limit_units
  → mirror status to Lithic: Lithic.cards.update({ state: "PAUSED" | "OPEN" })

POST /demo/purchases  (simulates a merchant authorization)
  → check card active, amount <= limit
  → place hold on card_funding
  → create card_authorization row (pending)
  → return { authorization_id, status: "pending" }

POST /demo/events  (trigger capture / reversal / deposit-confirm / failure)
  → capture  → consume hold, post card_transaction + journal debit
  → reversal → release hold, mark authorization reversed
  → deposit-confirm → same as webhook for deposit
  → failure  → release holds, mark operation failed
```

### API routes

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/cards` | Create Lithic sandbox card, store in DB |
| `POST` | `/api/v1/cards/:id/fund` | Transfer USDT from wallet to card funding |
| `PATCH` | `/api/v1/cards/:id` | Freeze/unfreeze, set limit; mirror to Lithic |
| `POST` | `/api/v1/demo/purchases` | Simulate merchant authorization + hold |
| `POST` | `/api/v1/demo/events` | Trigger capture, reversal, or deposit outcome |
| `GET` | `/api/v1/activity` | Paginated owned operations (cursor-based) |
| `GET` | `/api/v1/activity/:id` | Single receipt with full amounts, fees, timestamps |

### Files to create

```
lib/server/cards/service.ts
lib/server/providers/lithic-card.ts    — CardProvider wrapping Lithic SDK
lib/server/providers/mock-card.ts      — fallback if sandbox unavailable
lib/server/activity/service.ts
scripts/seed-demo.ts                   — seed one user with MWK balance for judging demo
```

### Failure cases to handle

- Card frozen → check `cards.status`, return `CARD_FROZEN` 422, no hold placed
- Limit exceeded → check `per_transaction_limit_units`, return `LIMIT_EXCEEDED` 422
- Auth + capture not double-charged → capture consumes existing hold; `card_transactions.provider_reference` unique blocks duplicate captures
- Auth reversed → hold released, no debit posted

---

## Build order

```
1. Agree on lib/contracts/index.ts  (all three together)
2. B: ledger service + GET /me + GET /wallets
3. C and D in parallel, using ledger service from B
4. Integration: frontend swaps fixtures for real API calls
5. Failure case testing (use the demo acceptance tests from the brief)
6. scripts/seed-demo.ts + full fresh-account run
```

---

## Repository structure

```
app/api/v1/
  me/route.ts
  wallets/route.ts
  deposits/route.ts
  deposits/[id]/route.ts
  quotes/route.ts
  conversions/route.ts
  conversions/[id]/route.ts
  cards/route.ts
  cards/[id]/route.ts
  cards/[id]/fund/route.ts
  activity/route.ts
  activity/[id]/route.ts
  webhooks/mock/route.ts
  webhooks/lithic/route.ts
  demo/purchases/route.ts
  demo/events/route.ts

lib/
  contracts/index.ts          ← shared types, everyone reads this
  server/
    auth.ts
    idempotency.ts
    ledger/
      post.ts
      holds.ts
      balances.ts
      transfer.ts
    deposits/service.ts
    fx/
      quotes.ts
      conversions.ts
    cards/service.ts
    activity/service.ts
    providers/
      types.ts
      mock-collection.ts
      mock-fx.ts
      lithic-card.ts
      mock-card.ts

scripts/
  seed-demo.ts
```

---

## Key rules (apply everywhere)

- **No `number` for money** — use `BigInt` in server code, serialise as `string` in JSON responses
- **ISO 4217 minor units** — store MWK as tambala (×100), USD as cents (×100), USDT as micro-USDT (×1,000,000); include `exponent` in every JSON money object so the frontend can format correctly
- **Minor units on the wire** — the API only accepts and returns `*_units` strings in minor units; the frontend converts whole-kwacha input with `toMinorUnits()` from `lib/contracts/money`, and every route re-validates with `parsePositiveMinorUnits()` before touching the ledger
- **Only the helpers do money math** — use `applyBasisPoints`, `convertAtRate`, and plain BigInt `+`/`-`; never write your own percentage or rate arithmetic
- **Idempotency-Key required** on all monetary writes
- **User identity from session** — call `lib/server/auth.ts`, never trust a client-supplied user ID
- **Service role Supabase client** in all `lib/server/` code — never the anon client
- **Ownership check on every read** — a user must not be able to fetch another user's deposit, conversion, card, or receipt
