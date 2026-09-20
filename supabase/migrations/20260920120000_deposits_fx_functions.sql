-- Workstream C: transactional deposit and FX lifecycles. All functions are
-- called by the server's service-role client; no browser can invoke them.
create unique index deposits_provider_reference_unique
  on public.deposits(provider, provider_reference) where provider_reference is not null;

create table public.conversion_reservations (
  conversion_id uuid primary key references public.conversions(id) on delete restrict,
  pool_id uuid not null references public.liquidity_pools(id) on delete restrict,
  hold_id uuid not null unique references public.holds(id) on delete restrict,
  amount_units bigint not null check (amount_units > 0),
  status text not null default 'active' check (status in ('active','consumed','released'))
);
alter table public.conversion_reservations enable row level security;
revoke all on public.conversion_reservations from anon, authenticated;
grant select, insert, update on public.conversion_reservations to service_role;

create or replace function public.c_create_deposit(
  p_id uuid, p_user_id uuid, p_method public.deposit_method,
  p_amount_units bigint, p_provider_reference text
) returns uuid language plpgsql volatile security invoker set search_path = public as $$
declare v_existing public.deposits%rowtype;
begin
  if p_amount_units is null or p_amount_units <= 0 or p_amount_units % 100 <> 0
     or p_provider_reference is null or length(p_provider_reference) = 0 then
    raise exception using message='VALIDATION_ERROR', errcode='P0001';
  end if;
  insert into public.deposits(id,user_id,method,amount_units,asset,provider,provider_reference)
  values (p_id,p_user_id,p_method,p_amount_units,'MWK','mock',p_provider_reference)
  on conflict (id) do nothing;
  select * into v_existing from public.deposits where id=p_id;
  if v_existing.user_id is distinct from p_user_id or v_existing.method is distinct from p_method
     or v_existing.amount_units is distinct from p_amount_units or v_existing.asset <> 'MWK'
     or v_existing.provider <> 'mock' or v_existing.provider_reference is distinct from p_provider_reference then
    raise exception using message='IDEMPOTENCY_CONFLICT',errcode='P0001';
  end if;
  return p_id;
end $$;

-- Verified events are recorded, checked against the original deposit and
-- applied together with the ledger journal. A later contradictory event stays
-- pending for operator reconciliation; it never reverses a terminal status.
create or replace function public.c_apply_deposit_event(
  p_event_id text, p_provider_reference text, p_amount_units bigint,
  p_outcome text, p_payload jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = public as $$
declare v_event public.provider_events%rowtype; v_deposit public.deposits%rowtype;
        v_collection uuid; v_wallet uuid; v_journal uuid; v_new boolean := false;
begin
  if p_event_id is null or length(p_event_id) = 0 or p_provider_reference is null
     or p_outcome not in ('confirmed','failed') or p_payload is null then
    raise exception using message='VALIDATION_ERROR',errcode='P0001';
  end if;
  insert into public.provider_events(provider,event_id,payload,status,attempts)
  values('mock',p_event_id,p_payload,'pending',0)
  on conflict (provider,event_id) do nothing returning true into v_new;
  select * into v_event from public.provider_events
  where provider='mock' and event_id=p_event_id for update;
  if v_event.payload <> p_payload then
    raise exception using message='IDEMPOTENCY_CONFLICT',errcode='P0001';
  end if;
  if not coalesce(v_new,false) and v_event.status = 'processed' then
    return jsonb_build_object('duplicate',true,'applied',false);
  end if;
  select * into v_deposit from public.deposits
  where provider='mock' and provider_reference=p_provider_reference for update;
  if not found or v_deposit.amount_units <> p_amount_units or v_deposit.asset <> 'MWK' then
    update public.provider_events set status='failed',attempts=attempts+1
      where id=v_event.id;
    return jsonb_build_object('duplicate',false,'applied',false);
  end if;
  if v_deposit.status <> 'pending' then
    if v_deposit.status::text = p_outcome then
      update public.provider_events set status='processed',attempts=attempts+1 where id=v_event.id;
      return jsonb_build_object('duplicate',not coalesce(v_new,false),'applied',false);
    end if;
    update public.provider_events set status='pending',attempts=attempts+1 where id=v_event.id;
    return jsonb_build_object('duplicate',not coalesce(v_new,false),'applied',false);
  end if;
  if p_outcome='confirmed' then
    select id into strict v_collection from public.accounts
      where owner_user_id is null and purpose='collection_clearing' and asset='MWK';
    select id into strict v_wallet from public.accounts
      where owner_user_id=v_deposit.user_id and purpose='mwk_wallet' and asset='MWK';
    v_journal := public.ledger_post_journal(v_deposit.id,'deposit',jsonb_build_array(
      jsonb_build_object('account_id',v_collection,'asset','MWK','debit_units',v_deposit.amount_units::text,'credit_units','0'),
      jsonb_build_object('account_id',v_wallet,'asset','MWK','debit_units','0','credit_units',v_deposit.amount_units::text)
    ));
  end if;
  update public.deposits set status=p_outcome::public.deposit_status where id=v_deposit.id;
  update public.provider_events set status='processed',attempts=attempts+1 where id=v_event.id;
  return jsonb_build_object('duplicate',false,'applied',true,'deposit_id',v_deposit.id,'journal_id',v_journal);
end $$;

-- Quote row is locked to serialize acceptance, then the pool is locked before
-- the ledger account hold. Both reservations commit with the conversion.
create or replace function public.c_reserve_conversion(
  p_id uuid, p_user_id uuid, p_quote_id uuid, p_provider_reference text
) returns uuid language plpgsql volatile security invoker set search_path = public as $$
declare v_quote public.quotes%rowtype; v_conversion public.conversions%rowtype;
        v_pool public.liquidity_pools%rowtype; v_wallet uuid; v_hold uuid;
begin
  select * into v_quote from public.quotes where id=p_quote_id for update;
  if not found or v_quote.user_id <> p_user_id then
    raise exception using message='NOT_FOUND',errcode='P0001';
  end if;
  select * into v_conversion from public.conversions where quote_id=p_quote_id;
  if found then
    if v_conversion.id=p_id and v_conversion.user_id=p_user_id then return p_id; end if;
    raise exception using message='IDEMPOTENCY_CONFLICT',errcode='P0001';
  end if;
  if v_quote.expires_at <= now() then
    raise exception using message='QUOTE_EXPIRED',errcode='P0001';
  end if;
  if v_quote.pair <> 'MWK/USDT' or v_quote.provider <> 'mock' or v_quote.rounding <> 'floor'
     or v_quote.source_units <= 0 or v_quote.destination_units <= 0
     or v_quote.fee_units < 0 or v_quote.fee_units >= v_quote.source_units then
    raise exception using message='VALIDATION_ERROR',errcode='P0001';
  end if;
  select * into v_pool from public.liquidity_pools
    where provider='mock' and asset='USDT' for update;
  if not found or v_pool.total_units-v_pool.reserved_units < v_quote.destination_units then
    raise exception using message='LIQUIDITY_UNAVAILABLE',errcode='P0001';
  end if;
  select id into strict v_wallet from public.accounts
    where owner_user_id=p_user_id and purpose='mwk_wallet' and asset='MWK' and status='active';
  v_hold := public.ledger_place_hold(v_wallet,p_id,v_quote.source_units,null);
  update public.liquidity_pools set reserved_units=reserved_units+v_quote.destination_units where id=v_pool.id;
  insert into public.conversions(id,user_id,quote_id,status,provider_reference)
    values(p_id,p_user_id,p_quote_id,'pending',p_provider_reference);
  insert into public.conversion_reservations(conversion_id,pool_id,hold_id,amount_units)
    values(p_id,v_pool.id,v_hold,v_quote.destination_units);
  insert into public.outbox_jobs(operation_id,job_type,status)
    values(p_id,'mock_fx_execute','pending');
  return p_id;
end $$;

-- Terminal mock provider outcome. Pending timeouts never call this function:
-- the hold and liquidity remain reserved until explicit recovery.
create or replace function public.c_finish_conversion(p_id uuid, p_outcome text)
returns uuid language plpgsql volatile security invoker set search_path = public as $$
declare v_conversion public.conversions%rowtype; v_quote public.quotes%rowtype;
        v_res public.conversion_reservations%rowtype; v_wallet_mwk uuid; v_wallet_usdt uuid;
        v_fx_mwk uuid; v_fx_usdt uuid; v_fee uuid; v_entries jsonb; v_journal uuid;
begin
  if p_outcome not in ('completed','failed') then
    raise exception using message='VALIDATION_ERROR',errcode='P0001';
  end if;
  select * into v_conversion from public.conversions where id=p_id for update;
  if not found then raise exception using message='NOT_FOUND',errcode='P0001'; end if;
  if v_conversion.status <> 'pending' then
    if v_conversion.status::text=p_outcome then
      select id into v_journal from public.journals where operation_id=p_id and type='conversion';
      return v_journal;
    end if;
    raise exception using message='IDEMPOTENCY_CONFLICT',errcode='P0001';
  end if;
  select * into strict v_res from public.conversion_reservations
    where conversion_id=p_id for update;
  perform 1 from public.liquidity_pools where id=v_res.pool_id for update;
  select * into strict v_quote from public.quotes where id=v_conversion.quote_id;
  if p_outcome='completed' then
    select id into strict v_wallet_mwk from public.accounts
      where owner_user_id=v_conversion.user_id and purpose='mwk_wallet' and asset='MWK';
    select id into strict v_wallet_usdt from public.accounts
      where owner_user_id=v_conversion.user_id and purpose='usdt_wallet' and asset='USDT';
    select id into strict v_fx_mwk from public.accounts
      where owner_user_id is null and purpose='fx_clearing_mwk' and asset='MWK';
    select id into strict v_fx_usdt from public.accounts
      where owner_user_id is null and purpose='fx_clearing_usdt' and asset='USDT';
    v_entries := jsonb_build_array(
      jsonb_build_object('account_id',v_wallet_mwk,'asset','MWK','debit_units',v_quote.source_units::text,'credit_units','0'),
      jsonb_build_object('account_id',v_fx_mwk,'asset','MWK','debit_units','0','credit_units',(v_quote.source_units-v_quote.fee_units)::text),
      jsonb_build_object('account_id',v_fx_usdt,'asset','USDT','debit_units',v_quote.destination_units::text,'credit_units','0'),
      jsonb_build_object('account_id',v_wallet_usdt,'asset','USDT','debit_units','0','credit_units',v_quote.destination_units::text));
    if v_quote.fee_units > 0 then
      select id into strict v_fee from public.accounts
        where owner_user_id is null and purpose='fee_revenue' and asset='MWK';
      v_entries := v_entries || jsonb_build_array(jsonb_build_object(
        'account_id',v_fee,'asset','MWK','debit_units','0','credit_units',v_quote.fee_units::text));
    end if;
    v_journal := public.ledger_post_journal(p_id,'conversion',v_entries,array[v_res.hold_id]);
    update public.liquidity_pools set total_units=total_units-v_res.amount_units,
      reserved_units=reserved_units-v_res.amount_units where id=v_res.pool_id;
    update public.conversion_reservations set status='consumed' where conversion_id=p_id;
    update public.conversions set status='completed' where id=p_id;
    update public.outbox_jobs set status='done' where operation_id=p_id and job_type='mock_fx_execute';
  else
    perform public.ledger_release_hold(v_res.hold_id);
    update public.liquidity_pools set reserved_units=reserved_units-v_res.amount_units where id=v_res.pool_id;
    update public.conversion_reservations set status='released' where conversion_id=p_id;
    update public.conversions set status='failed',failure_code='PROVIDER_FAILED' where id=p_id;
    update public.outbox_jobs set status='failed' where operation_id=p_id and job_type='mock_fx_execute';
  end if;
  return v_journal;
end $$;

revoke execute on function public.c_create_deposit(uuid,uuid,public.deposit_method,bigint,text) from public,anon,authenticated;
revoke execute on function public.c_apply_deposit_event(text,text,bigint,text,jsonb) from public,anon,authenticated;
revoke execute on function public.c_reserve_conversion(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.c_finish_conversion(uuid,text) from public,anon,authenticated;
grant execute on function public.c_create_deposit(uuid,uuid,public.deposit_method,bigint,text) to service_role;
grant execute on function public.c_apply_deposit_event(text,text,bigint,text,jsonb) to service_role;
grant execute on function public.c_reserve_conversion(uuid,uuid,uuid,text) to service_role;
grant execute on function public.c_finish_conversion(uuid,text) to service_role;
