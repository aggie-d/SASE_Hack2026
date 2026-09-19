-- ============================================================================
-- ledger_functions — transactional core of the LAD Transfer ledger
-- ============================================================================
--
-- supabase-js cannot open a multi-statement transaction, so every monetary
-- write goes through one of the plpgsql functions below via rpc(). Each call
-- is one transaction: row locks, invariant checks, and inserts either all
-- commit or all roll back.
--
-- Invariants enforced here (the TypeScript layer re-checks them first for
-- fast failure, but this is the source of truth):
--   * every journal balances per asset: SUM(debit) = SUM(credit)
--   * each entry is exactly one-sided (debit XOR credit), non-negative
--   * entry.asset matches the account's asset
--   * a user-owned account never ends a posting with available < 0
--   * account rows are locked in ascending id order → no deadlocks
--   * (operation_id, type) is unique → a retried post cannot double-book
--   * past entries are never edited; reversals are new journals
--
-- Error protocol: RAISE EXCEPTION USING MESSAGE = '<CODE>', ERRCODE = 'P0001'.
-- lib/server/ledger/post.ts maps MESSAGE onto lib/contracts ErrorCode.
--   INSUFFICIENT_FUNDS          available balance would go negative
--   LEDGER_UNBALANCED           per-asset debits != credits
--   LEDGER_INVALID_ENTRIES      malformed / fewer than two / two-sided entry
--   LEDGER_ASSET_MISMATCH       entry.asset != accounts.asset
--   LEDGER_ACCOUNT_NOT_FOUND    unknown account id
--   LEDGER_INVALID_AMOUNT       hold amount <= 0
--   LEDGER_REVERSAL_INVALID     reversal_of does not reference a posted journal
--   HOLD_NOT_FOUND              unknown hold id
--   HOLD_NOT_ACTIVE             hold is not in a state that allows the action
-- ============================================================================

-- ─── 1. Unique posting reference ────────────────────────────────────────────
-- A retry with the same operation_id + type returns the original journal
-- instead of posting twice. Different types on one operation (e.g. card_auth
-- then card_capture) are still allowed.

create unique index if not exists journals_operation_type_uidx
  on public.journals (operation_id, type);

-- ─── 2. account_balances with text units ────────────────────────────────────
-- SUM(bigint) is numeric; PostgREST would serialise that as a JSON number and
-- the TypeScript side would have to trust Number precision. Cast to text so
-- balances cross the wire as exact decimal strings.
-- Column types change, so DROP + CREATE (not CREATE OR REPLACE).

drop view if exists public.account_balances;

create view public.account_balances as
select
  a.id                                              as account_id,
  a.owner_user_id,
  a.purpose,
  a.asset,
  coalesce(je.posted, 0)::bigint::text              as posted_units,
  coalesce(h.held, 0)::bigint::text                 as held_units,
  (coalesce(je.posted, 0) - coalesce(h.held, 0))::bigint::text as available_units
from public.accounts a
left join lateral (
  select sum(e.credit_units - e.debit_units) as posted
  from public.journal_entries e
  where e.account_id = a.id
) je on true
left join lateral (
  select sum(hd.amount_units) as held
  from public.holds hd
  where hd.account_id = a.id and hd.status = 'active'
) h on true;

comment on view public.account_balances is
  'Per-account posted / held / available minor units as text. Read only via lib/server (service role).';

-- The previous view ran with owner privileges and was granted to anon and
-- authenticated, which let any signed-in user read every balance. Clients get
-- balances from GET /api/v1/wallets, never from the view directly.
revoke all on public.account_balances from anon, authenticated;
grant select on public.account_balances to service_role;

-- ─── 3. Input type for journal entries ──────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ledger_entry_input') then
    create type public.ledger_entry_input as (
      account_id   uuid,
      asset        public.account_asset,
      debit_units  bigint,
      credit_units bigint
    );
  end if;
end $$;

-- ─── 4. ledger_available_units ──────────────────────────────────────────────
-- posted minus active holds. VOLATILE so that, when called inside
-- ledger_post_journal after the entries insert, it sees the new rows.

create or replace function public.ledger_available_units(p_account_id uuid)
returns bigint
language sql
volatile
security invoker
set search_path = public
as $$
  select
    coalesce((select sum(e.credit_units - e.debit_units)
              from public.journal_entries e
              where e.account_id = p_account_id), 0)::bigint
  - coalesce((select sum(h.amount_units)
              from public.holds h
              where h.account_id = p_account_id and h.status = 'active'), 0)::bigint;
$$;

-- ─── 5. ledger_post_journal ─────────────────────────────────────────────────
-- p_entries: JSON array of
--   { "account_id": uuid, "asset": "MWK"|"USDT",
--     "debit_units": "<digits>", "credit_units": "<digits>" }
-- Units are strings on purpose: JSON numbers would lose precision above 2^53.
--
-- p_consume_hold_ids: active holds to mark consumed in the same transaction
-- (card capture). Each must belong to an account that is net-debited here.
--
-- p_reversal_of: id of the journal this one compensates. The original is
-- marked status = 'reversed'. Its entries are never modified.

create or replace function public.ledger_post_journal(
  p_operation_id     uuid,
  p_type             public.journal_type,
  p_entries          jsonb,
  p_consume_hold_ids uuid[] default '{}',
  p_reversal_of      uuid   default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_journal_id   uuid;
  v_entries      public.ledger_entry_input[];
  v_account_ids  uuid[];
  v_locked       int;
  v_count        int;
  v_bad          text;
  v_elem         jsonb;
begin
  -- 5.1 Idempotent replay ---------------------------------------------------
  select id into v_journal_id
  from public.journals
  where operation_id = p_operation_id and type = p_type;
  if found then
    return v_journal_id;
  end if;

  -- 5.2 Shape validation ----------------------------------------------------
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
      detail = 'p_entries must be a JSON array';
  end if;
  if jsonb_array_length(p_entries) < 2 then
    raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
      detail = 'a journal needs at least two entries';
  end if;

  for v_elem in select * from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(v_elem) <> 'object'
       or not (v_elem ? 'account_id') or not (v_elem ? 'asset')
       or not (v_elem ? 'debit_units') or not (v_elem ? 'credit_units') then
      raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
        detail = 'each entry needs account_id, asset, debit_units, credit_units';
    end if;
    if jsonb_typeof(v_elem -> 'debit_units') <> 'string'
       or jsonb_typeof(v_elem -> 'credit_units') <> 'string' then
      raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
        detail = 'debit_units and credit_units must be decimal strings, not JSON numbers';
    end if;
    if (v_elem ->> 'debit_units') !~ '^\d+$' or (v_elem ->> 'credit_units') !~ '^\d+$' then
      raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
        detail = 'units must be non-negative integer strings';
    end if;
  end loop;

  -- 5.3 Typed parse (uuid / enum / bigint casts) ----------------------------
  begin
    select array_agg(row(
             (x ->> 'account_id')::uuid,
             (x ->> 'asset')::public.account_asset,
             (x ->> 'debit_units')::bigint,
             (x ->> 'credit_units')::bigint
           )::public.ledger_entry_input)
      into v_entries
    from jsonb_array_elements(p_entries) x;
  exception when others then
    raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
      detail = 'could not parse entries: ' || sqlerrm;
  end;

  -- 5.4 One-sided entries ---------------------------------------------------
  select count(*) into v_count
  from unnest(v_entries) e
  where not ((e.debit_units > 0) <> (e.credit_units > 0));
  if v_count > 0 then
    raise exception using message = 'LEDGER_INVALID_ENTRIES', errcode = 'P0001',
      detail = 'each entry must have exactly one of debit_units or credit_units > 0';
  end if;

  -- 5.5 Balanced per asset --------------------------------------------------
  select string_agg(s.asset::text || ' debit=' || s.d || ' credit=' || s.c, '; ')
    into v_bad
  from (
    select e.asset, sum(e.debit_units) d, sum(e.credit_units) c
    from unnest(v_entries) e
    group by e.asset
  ) s
  where s.d <> s.c;
  if v_bad is not null then
    raise exception using message = 'LEDGER_UNBALANCED', errcode = 'P0001', detail = v_bad;
  end if;

  -- 5.6 Lock accounts in ascending id order ---------------------------------
  select array_agg(distinct e.account_id order by e.account_id)
    into v_account_ids
  from unnest(v_entries) e;

  select count(*) into v_locked
  from (
    select a.id
    from public.accounts a
    where a.id = any(v_account_ids)
    order by a.id
    for update
  ) locked;

  if v_locked <> cardinality(v_account_ids) then
    raise exception using message = 'LEDGER_ACCOUNT_NOT_FOUND', errcode = 'P0001',
      detail = 'one or more account ids do not exist';
  end if;

  -- 5.7 Asset must match the account --------------------------------------
  select string_agg(e.account_id::text || ' is ' || a.asset::text || ', entry says ' || e.asset::text, '; ')
    into v_bad
  from unnest(v_entries) e
  join public.accounts a on a.id = e.account_id
  where a.asset <> e.asset;
  if v_bad is not null then
    raise exception using message = 'LEDGER_ASSET_MISMATCH', errcode = 'P0001', detail = v_bad;
  end if;

  -- 5.8 Reversal target -----------------------------------------------------
  if p_reversal_of is not null then
    update public.journals
       set status = 'reversed'
     where id = p_reversal_of and status = 'posted';
    if not found then
      raise exception using message = 'LEDGER_REVERSAL_INVALID', errcode = 'P0001',
        detail = 'reversal_of must reference a journal with status posted';
    end if;
  end if;

  -- 5.9 Consume holds (same transaction as the debit) -----------------------
  if p_consume_hold_ids is not null and cardinality(p_consume_hold_ids) > 0 then
    with net as (
      select e.account_id, sum(e.debit_units) - sum(e.credit_units) as net_debit
      from unnest(v_entries) e
      group by e.account_id
    ),
    consumed as (
      update public.holds h
         set status = 'consumed'
       where h.id = any(p_consume_hold_ids)
         and h.status = 'active'
         and h.account_id in (select account_id from net where net_debit > 0)
      returning h.id
    )
    select count(*) into v_count from consumed;

    if v_count <> (select count(distinct x) from unnest(p_consume_hold_ids) x) then
      raise exception using message = 'HOLD_NOT_ACTIVE', errcode = 'P0001',
        detail = 'every consumed hold must be active and belong to an account debited in this journal';
    end if;
  end if;

  -- 5.10 Insert journal (race-safe on the unique index) ---------------------
  begin
    insert into public.journals (operation_id, type, status, reversal_of)
    values (p_operation_id, p_type, 'posted', p_reversal_of)
    returning id into v_journal_id;
  exception when unique_violation then
    -- A concurrent call with the same (operation_id, type) committed first.
    select id into v_journal_id
    from public.journals
    where operation_id = p_operation_id and type = p_type;
    return v_journal_id;
  end;

  insert into public.journal_entries (journal_id, account_id, asset, debit_units, credit_units)
  select v_journal_id, e.account_id, e.asset, e.debit_units, e.credit_units
  from unnest(v_entries) e;

  -- 5.11 No user account may end with available < 0 -------------------------
  -- System accounts (clearing, fee_revenue, liquidity_inventory) may go
  -- negative; that is normal double-entry bookkeeping.
  select string_agg(a.id::text || ' available=' || public.ledger_available_units(a.id), '; ')
    into v_bad
  from (
    select e.account_id
    from unnest(v_entries) e
    group by e.account_id
    having sum(e.debit_units) > sum(e.credit_units)
  ) d
  join public.accounts a on a.id = d.account_id
  where a.owner_user_id is not null
    and public.ledger_available_units(a.id) < 0;
  if v_bad is not null then
    raise exception using message = 'INSUFFICIENT_FUNDS', errcode = 'P0001', detail = v_bad;
  end if;

  return v_journal_id;
end;
$$;

-- ─── 6. ledger_place_hold ───────────────────────────────────────────────────
-- Reserve part of an account's available balance. Idempotent on
-- (account_id, operation_id): a retry returns the existing hold.
-- The availability check applies to every account: a hold that cannot be
-- covered is meaningless, including on liquidity_inventory.

create or replace function public.ledger_place_hold(
  p_account_id   uuid,
  p_operation_id uuid,
  p_amount_units bigint,
  p_expires_at   timestamptz default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_hold_id   uuid;
  v_exists    uuid;
  v_available bigint;
begin
  if p_amount_units is null or p_amount_units <= 0 then
    raise exception using message = 'LEDGER_INVALID_AMOUNT', errcode = 'P0001',
      detail = 'hold amount must be > 0';
  end if;

  -- Lock the account so concurrent holds serialise on it.
  select id into v_exists from public.accounts where id = p_account_id for update;
  if not found then
    raise exception using message = 'LEDGER_ACCOUNT_NOT_FOUND', errcode = 'P0001';
  end if;

  select id into v_hold_id
  from public.holds
  where account_id = p_account_id and operation_id = p_operation_id;
  if found then
    return v_hold_id;
  end if;

  v_available := public.ledger_available_units(p_account_id);
  if p_amount_units > v_available then
    raise exception using message = 'INSUFFICIENT_FUNDS', errcode = 'P0001',
      detail = 'requested ' || p_amount_units || ', available ' || v_available;
  end if;

  insert into public.holds (account_id, operation_id, amount_units, status, expires_at)
  values (p_account_id, p_operation_id, p_amount_units, 'active', p_expires_at)
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

-- ─── 7. ledger_release_hold ─────────────────────────────────────────────────
-- active → released. Already released/expired is a no-op (safe to retry).
-- consumed → HOLD_NOT_ACTIVE: the money has moved; compensate with a refund
-- journal instead.

create or replace function public.ledger_release_hold(p_hold_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_status public.hold_status;
begin
  select status into v_status from public.holds where id = p_hold_id for update;
  if not found then
    raise exception using message = 'HOLD_NOT_FOUND', errcode = 'P0001';
  end if;

  if v_status in ('released', 'expired') then
    return;
  end if;

  if v_status = 'active' then
    update public.holds set status = 'released' where id = p_hold_id;
    return;
  end if;

  raise exception using message = 'HOLD_NOT_ACTIVE', errcode = 'P0001',
    detail = 'hold is ' || v_status::text;
end;
$$;

-- ─── 8. Only the server may call these ──────────────────────────────────────
-- Functions default to EXECUTE for PUBLIC. Browser clients (anon /
-- authenticated) must go through the API, which runs as service_role.

revoke execute on function public.ledger_available_units(uuid) from public, anon, authenticated;
revoke execute on function public.ledger_post_journal(uuid, public.journal_type, jsonb, uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.ledger_place_hold(uuid, uuid, bigint, timestamptz) from public, anon, authenticated;
revoke execute on function public.ledger_release_hold(uuid) from public, anon, authenticated;

grant execute on function public.ledger_available_units(uuid) to service_role;
grant execute on function public.ledger_post_journal(uuid, public.journal_type, jsonb, uuid[], uuid) to service_role;
grant execute on function public.ledger_place_hold(uuid, uuid, bigint, timestamptz) to service_role;
grant execute on function public.ledger_release_hold(uuid) to service_role;

comment on function public.ledger_post_journal(uuid, public.journal_type, jsonb, uuid[], uuid) is
  'Post a balanced journal atomically. Idempotent on (operation_id, type). Raises INSUFFICIENT_FUNDS / LEDGER_* / HOLD_NOT_ACTIVE.';
comment on function public.ledger_place_hold(uuid, uuid, bigint, timestamptz) is
  'Reserve available balance. Idempotent on (account_id, operation_id). Raises INSUFFICIENT_FUNDS.';
comment on function public.ledger_release_hold(uuid) is
  'active → released. No-op if already released/expired. Raises HOLD_NOT_ACTIVE if consumed.';
