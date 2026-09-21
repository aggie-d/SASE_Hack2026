# Workstream C: Deposits and FX on `develop`

The C API uses the B contracts, authenticated session, idempotency records, ledger holds, and ledger journal function. Apply migrations in filename order; `20260920120000_deposits_fx_functions.sql` must run after `20260919215715_ledger_functions.sql`. A configured Supabase project and its service-role key are needed for request and database integration testing.

## Setup

Set the existing Supabase variables in `.env.local`, keep `NEXT_PUBLIC_DEMO_MODE=true` for mock callbacks, and set `MOCK_WEBHOOK_SECRET` to a unique random string of at least 32 characters (`openssl rand -hex 32`). The server never uses the service-role key in browser code. `MOCK_FX_OUTCOME=completed` is the default; `pending` simulates an ambiguous provider timeout and `failed` simulates a confirmed failure.

All wire `*_units` values are decimal strings of **minor units**: MWK tambala and micro-USDT. The demo accepts only whole kwacha. Requests with a monetary write need a fresh `Idempotency-Key` header. Quote and conversion require a verified user. The mock rate is **2,000 MWK per USDT**, fee **200 basis points**, quote lifetime **five minutes**. The rate is stored as `200000` tambala per USDT and displayed as `2000` MWK per USDT.

| Operation | Request | Result |
|---|---|---|
| Deposit | `POST /api/v1/deposits` `{"method":"mobile_money","amount_units":"20400000"}` | `202`, pending deposit and simulated reference |
| Quote | `POST /api/v1/quotes` `{"source_asset":"MWK","destination_asset":"USDT","source_units":"20400000"}` | `200`, fee `408000` tambala and destination `99960000` micro-USDT |
| Convert | `POST /api/v1/conversions` `{"quote_id":"<quote UUID>"}` | `200` completed or `202` pending; journal ID on completion |
| Poll | `GET /api/v1/deposits/<id>` or `GET /api/v1/conversions/<id>` | Owned resource and current status |

Deposits remain pending until a verified provider callback. Send a raw JSON event to `POST /api/v1/webhooks/mock` with header `x-mock-signature: <hex HMAC-SHA256 of exact raw body using MOCK_WEBHOOK_SECRET>`. Example body: `{"event_id":"collection_1","provider_reference":"mock_collection_<deposit UUID>","outcome":"confirmed","amount_units":"20400000","asset":"MWK"}`. A mismatched amount/reference is stored in `provider_events` as failed and never credits the wallet. A contradictory event after a terminal outcome remains pending for reconciliation. The `(provider,event_id)` unique key and ledger `(operation_id,type)` unique key prevent double credit.

The operator-only `POST /api/v1/demo/events` supports `{"operation_id":"<deposit UUID>","outcome":"deposit_confirmed"}` and `deposit_failed`, or a conversion UUID with `conversion_completed`, `conversion_failed`, or `provider_timeout`. It requires `NEXT_PUBLIC_DEMO_MODE=true`; Workstream D can extend this route for card events. For a pending mock FX conversion, send `conversion_completed` or `conversion_failed` to resolve the reserved hold and liquidity. `provider_timeout` records a pending event and leaves both reservations intact for later recovery.

Database function `c_reserve_conversion` locks the quote and liquidity pool, places a ledger hold, and enqueues an outbox job in one transaction. `c_finish_conversion` consumes the hold, posts a balanced multiasset journal through B's `ledger_post_journal`, decrements reserved and total inventory, and marks completed atomically; a failed outcome releases both reservations. `c_apply_deposit_event` persists and deduplicates a signed callback and posts a single deposit journal in one transaction. These functions are executable by `service_role` only. Pending outbox jobs are visible to operators for manual recovery; the background worker belongs to Workstream D.

The unit suite covers the example math, floor rounding and webhook signature validation. A production build and lint can run without a live database, with temporary **placeholder** Supabase URL and anon key for static page generation. Before a demo, run the migration against its own database and exercise signed callback, duplicate event, expired quote, unavailable liquidity, concurrent conversion, timeout recovery, and failed conversion scenarios there. Live mobile money collection, market FX, and on-chain USDT delivery are outside this mock adapter.
