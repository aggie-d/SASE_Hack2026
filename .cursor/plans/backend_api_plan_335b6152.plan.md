---
name: Backend API Plan
overview: "Full backend plan for the 3-person backend team: shared types, ledger service, deposits, FX, Lithic card sandbox integration, and all API routes the frontend needs."
todos:
  - id: shared-contracts
    content: Fill lib/contracts/index.ts with agreed money types, wallet balance shape, and error envelope
    status: pending
  - id: ledger-service
    content: "B: Build lib/server/ledger/ — post.ts, holds.ts, balances.ts, transfer.ts"
    status: pending
  - id: auth-idempotency
    content: "B: Build lib/server/auth.ts and lib/server/idempotency.ts"
    status: pending
  - id: me-wallets-routes
    content: "B: Build GET /api/v1/me and GET /api/v1/wallets"
    status: pending
  - id: deposit-service
    content: "C: Build lib/server/deposits/service.ts and mock collection provider"
    status: pending
  - id: deposit-routes
    content: "C: Build POST /api/v1/deposits, GET /deposits/:id, POST /webhooks/mock"
    status: pending
  - id: fx-service
    content: "C: Build lib/server/fx/quotes.ts and conversions.ts with mock FX provider"
    status: pending
  - id: fx-routes
    content: "C: Build POST /api/v1/quotes, POST /conversions, GET /conversions/:id"
    status: pending
  - id: lithic-setup
    content: "D: Install Lithic SDK, add LITHIC_API_KEY env var, create lib/server/providers/lithic-card.ts"
    status: pending
  - id: card-routes
    content: "D: Build POST /api/v1/cards, POST /cards/:id/fund, PATCH /cards/:id"
    status: pending
  - id: demo-routes
    content: "D: Build POST /api/v1/demo/purchases and POST /demo/events"
    status: pending
  - id: activity-routes
    content: "D: Build GET /api/v1/activity and GET /activity/:id"
    status: pending
  - id: seed-script
    content: "D: Build scripts/seed-demo.ts for full fresh-account demo run"
    status: pending
isProject: false
---

# LAD Transfer — Backend API and Integration Plan

3 backend people. Work is split into three workstreams that can proceed in parallel once the shared foundation is done. All routes live under `app/api/v1/`. All domain logic lives in `lib/server/`. Frontend talks only to the API routes — never to `lib/server/` directly.

---

## Shared foundation — do this first, together (30 min)

Fill [`lib/contracts/index.ts`](lib/contracts/index.ts) with the agreed types. Every backend route and every frontend component references these. No one invents their own shape.

### ISO 4217 currency standard

ISO 4217 defines a minor-unit exponent — the number of decimal places between the major unit and its smallest sub-unit. Store all amounts as integers in the minor unit, transmit as strings in JSON. Use `BigInt` in TypeScript; never `Number` for money.

| Currency | ISO code | Exponent | Minor unit | 1 major = N minor |
|---|---|---|---|---|
| Malawian Kwacha | MWK | 2 | tambala | 100 |
| US Dollar | USD | 2 | cent | 100 |
| USDT (on-chain) | — | 6 | micro-USDT | 1,000,000 |

USDT is not ISO 4217. Exponent 6 follows the TRC-20/ERC-20 on-chain convention.

**Demo rule:** the UI accepts whole-kwacha input. The API multiplies ×100 at the boundary before any storage or arithmetic (`amount_tambala = input × 100`). Internal storage is ISO-correct (exponent 2).

### Key types

```ts
// asset includes USD for future-proofing; only MWK and USDT used in demo
type Asset = "MWK" | "USD" | "USDT";

// amount_units = BigInt in minor units (tambala for MWK, micro-USDT for USDT)
// exponent tells the frontend how many decimal places to display
type MoneyAmount = { asset: Asset; amount_units: string; exponent: number }

type WalletBalance = {
  account_id: string; asset: Asset; purpose: string
  posted_units: string; held_units: string; available_units: string
  exponent: number
}

type ApiError = {
  error: { code: ErrorCode; message: string; retryable: boolean }
  request_id: string
}
```

Error codes the frontend will handle: `QUOTE_EXPIRED`, `INSUFFICIENT_FUNDS`, `LIQUIDITY_UNAVAILABLE`, `CARD_FROZEN`, `LIMIT_EXCEEDED`, `VERIFICATION_REQUIRED`, `PROVIDER_PENDING`, `IDEMPOTENCY_CONFLICT`.

HTTP statuses: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 idempotency conflict, 422 business rule, 202 async accepted.

---

## Workstream B — Core ledger (Person 1)

Everything else depends on this. Do it first.

### Files to create
- `lib/server/ledger/post.ts` — write balanced journal entries inside a Postgres transaction
- `lib/server/ledger/holds.ts` — create, consume, and release holds atomically
- `lib/server/ledger/balances.ts` — query the `account_balances` view
- `lib/server/ledger/transfer.ts` — internal transfer between two user accounts (used for card funding)
- `lib/server/auth.ts` — server-side session check, returns `user_id` or throws 401
- `lib/server/idempotency.ts` — check/store idempotency records for monetary writes

### Ledger rules (enforce in `post.ts`)
- All money is `bigint`. No `number` arithmetic anywhere.
- Every journal must balance per asset: sum of debits = sum of credits.
- Never edit a past entry — compensate with a new journal.
- Lock account rows in a consistent order before posting to prevent deadlocks.

### API routes
- `GET /api/v1/me` — return profile + verification status from `profiles` table
- `GET /api/v1/wallets` — return all user accounts from `account_balances` view

### Helper: account lookup
A function `getUserAccounts(userId)` that returns the user's account IDs by purpose. Used by all other workstreams to know which account to debit/credit.

---

## Workstream C — Deposits and FX (Person 2)

Depends on the ledger service from B. Can start with mock data while B is finishing.

### Deposit flow

```mermaid
flowchart LR
    POST_deposit["POST /deposits"] --> create_deposit[Create deposit row pending]
    create_deposit --> mock_provider[MockCollectionProvider]
    mock_provider --> webhook["POST /webhooks/mock\n(simulated callback)"]
    webhook --> dedup[Check provider_events unique]
    dedup --> post_ledger[Post journal via ledger service]
    post_ledger --> update_deposit[Mark deposit confirmed]
```

- `POST /api/v1/deposits` — create deposit row (`pending`), call `MockCollectionProvider.createDeposit`, return `deposit_id`
- `GET /api/v1/deposits/:id` — ownership check, return status + receipt fields
- `POST /api/v1/webhooks/mock` — persist to `provider_events` first (dedup on `provider + event_id`), then process: credit `collection_clearing` → credit user `mwk_wallet`

### FX / conversion flow

```mermaid
flowchart LR
    POST_quotes["POST /quotes"] --> calc[Calculate: fee = 2% of source, dest = source-fee / 2000]
    calc --> store_quote[Store in quotes table, expires_at = now+5min]
    store_quote --> return_quote[Return quote JSON]
    POST_conv["POST /conversions"] --> check_expiry[Check quote not expired]
    check_expiry --> check_balance[Check available MWK balance]
    check_balance --> reserve[Create hold on mwk_wallet]
    reserve --> exec[MockFxProvider.executeConversion]
    exec --> post_both[Post MWK debit + USDT credit journals]
    post_both --> release_hold[Release MWK hold]
```

- `POST /api/v1/quotes` — compute server-side at fixed demo rate (2,000 MWK/USDT, 2% fee), store in `quotes`, return quote JSON with `expires_at`
- `POST /api/v1/conversions` — verify expiry + ownership + sufficient `available_units`, place hold, execute via mock, post both asset legs through clearing accounts, mark done
- `GET /api/v1/conversions/:id` — ownership check, return status + linked journal refs

### Files to create
- `lib/server/deposits/service.ts`
- `lib/server/fx/quotes.ts` — rate calculation (integer arithmetic only)
- `lib/server/fx/conversions.ts`
- `lib/server/providers/mock-collection.ts` — `CollectionProvider` interface implementation
- `lib/server/providers/mock-fx.ts` — `FxProvider` interface implementation

### Provider interfaces (define in `lib/server/providers/types.ts`)
```ts
interface CollectionProvider {
  createDeposit(params): Promise<{ provider_reference: string }>
  verifyEvent(payload, headers): boolean
}
interface FxProvider {
  executeConversion(operationId: string, params): Promise<{ status: "completed" | "pending" | "failed" }>
}
```

---

## Workstream D — Cards with Lithic sandbox + Integration (Person 3)

Uses Lithic sandbox for card creation, funding, and authorization/capture events. Depends on ledger service from B.

### Lithic sandbox setup
- Add `LITHIC_API_KEY` (sandbox key) to `.env.local` and `.env.example`
- Install the Lithic SDK: `npm install lithic`
- The Lithic MCP server at `https://docs.lithic.com/mcp` can be added to `.cursor/mcp.json` (no auth needed for docs; add API key for live calls)

### Card flow

```mermaid
flowchart LR
    POST_cards["POST /cards"] --> lithic_create[Lithic.cards.create sandbox]
    lithic_create --> store_card[Store in cards table\nlast4 fictional]
    POST_fund["POST /cards/:id/fund"] --> check_usdt[Check usdt_wallet available]
    check_usdt --> transfer[Transfer usdt_wallet → card_funding\nvia ledger transfer service]
    POST_purchase["POST /demo/purchases"] --> check_frozen[Check card status]
    check_frozen --> check_limit[Check per_transaction_limit]
    check_limit --> place_hold[Hold on card_funding]
    place_hold --> auth_row[Create card_authorization pending]
    POST_capture["POST /demo/events outcome=captured"] --> consume_hold[Consume hold]
    consume_hold --> post_debit[Post card_transaction + journal]
```

### API routes to build
- `POST /api/v1/cards` — call `Lithic.cards.create` in sandbox, store `last4` and `provider_card_id`, link to user's `card_funding` account
- `POST /api/v1/cards/:id/fund` — internal USDT transfer from `usdt_wallet` → `card_funding` via ledger transfer service; requires `Idempotency-Key`
- `PATCH /api/v1/cards/:id` — update `status` (freeze/unfreeze) or `per_transaction_limit_units`; call `Lithic.cards.update` to mirror status in sandbox
- `POST /api/v1/demo/purchases` — simulate a merchant authorization: check frozen + limit, create hold on `card_funding`, create `card_authorization` row, return authorization result
- `POST /api/v1/demo/events` — trigger capture / reversal / deposit-confirm / failure; each path posts the correct ledger entry and transitions the right status
- `GET /api/v1/activity` — paginated list of owned deposits, conversions, and card transactions; cursor-based
- `GET /api/v1/activity/:id` — single receipt with full amounts, fees, timestamps, and status; enforce ownership

### Lithic sandbox webhook (for live card events if needed)
- `POST /api/v1/webhooks/lithic` — verify Lithic signature, persist to `provider_events`, process authorization/capture/reversal events
- For the hackathon demo, `POST /demo/events` can substitute for the real webhook

### Files to create
- `lib/server/cards/service.ts`
- `lib/server/providers/lithic-card.ts` — `CardProvider` implementation wrapping the Lithic SDK
- `lib/server/providers/mock-card.ts` — fallback mock if sandbox is unavailable
- `lib/server/activity/service.ts`
- `scripts/seed-demo.ts` — seed one demo user with MWK balance and pre-confirmed deposit for judging

---

## Failure scenarios — all three must cover their own

| Scenario | Owner | Mechanism |
|---|---|---|
| Duplicate deposit callback | C | `provider_events` unique constraint; return 200 without reposting |
| Two simultaneous conversions overdraw | C | Hold placed before checking balance; Postgres row lock on account |
| Quote expired | C | Check `expires_at` before accepting; return `QUOTE_EXPIRED` 422 |
| Liquidity unavailable | C | Check `liquidity_pools.total - reserved > destination_units`; return `LIQUIDITY_UNAVAILABLE` 422 |
| Card frozen | D | Check `cards.status = 'active'`; return `CARD_FROZEN` 422 |
| Auth then capture — no double debit | D | Capture consumes hold, posts one debit; duplicate capture blocked by `card_transactions.provider_reference` unique |
| Cross-user receipt access | B | All routes check `user_id = auth.uid()` before returning |

---

## Build order

```mermaid
flowchart TD
    contracts["lib/contracts/index.ts\nshared types"] --> B
    contracts --> C
    contracts --> D
    B["B: ledger + auth\nGET /me, GET /wallets"] --> C
    B --> D
    C["C: deposits + FX\nPOST /deposits, /quotes, /conversions\nPOST /webhooks/mock"] --> integrate[Integration + demo run]
    D["D: cards + activity\nPOST /cards, /fund, /demo/purchases\nGET /activity"] --> integrate
    integrate --> seed["scripts/seed-demo.ts\nfull journey from zero"]
```

---

## Key constraints (enforce everywhere)
- Never `Number` for money — use `BigInt` in server code, return as `string` in JSON
- ISO 4217 minor units — store MWK as tambala (×100), USDT as micro-USDT (×1,000,000); include `exponent` in every JSON money object
- UI input conversion — multiply whole-kwacha input ×100 at the API boundary before any storage or arithmetic
- Every monetary write route requires an `Idempotency-Key` header
- All routes derive `user_id` from the server-side Supabase session — never trust a client-supplied ID
- Use the service role Supabase client in all `lib/server/` code, never the anon client
