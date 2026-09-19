-- Phase 3: Deposits, Quotes, Conversions, Liquidity Pools

-- Enums
CREATE TYPE deposit_method AS ENUM ('mobile_money', 'bank_transfer');
CREATE TYPE deposit_status AS ENUM ('pending', 'confirmed', 'failed');
CREATE TYPE conversion_status AS ENUM ('pending', 'completed', 'failed');

-- deposits: one row per deposit attempt
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  method deposit_method NOT NULL,
  amount_units BIGINT NOT NULL,
  asset account_asset NOT NULL DEFAULT 'MWK',
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_reference TEXT,
  status deposit_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amount_positive CHECK (amount_units > 0)
);

CREATE INDEX deposits_user_id_idx ON deposits(user_id);
CREATE INDEX deposits_provider_reference_idx ON deposits(provider_reference);

-- quotes: immutable once created; never edited after generation
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  pair TEXT NOT NULL,
  source_units BIGINT NOT NULL,
  fee_units BIGINT NOT NULL,
  destination_units BIGINT NOT NULL,
  rate_string TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  rounding TEXT NOT NULL DEFAULT 'floor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT source_positive CHECK (source_units > 0),
  CONSTRAINT fee_non_negative CHECK (fee_units >= 0),
  CONSTRAINT destination_positive CHECK (destination_units > 0)
);

CREATE INDEX quotes_user_id_idx ON quotes(user_id);

-- conversions: one per accepted quote; quote consumed at most once
CREATE TABLE conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  quote_id UUID NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE RESTRICT,
  status conversion_status NOT NULL DEFAULT 'pending',
  provider_reference TEXT,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversions_user_id_idx ON conversions(user_id);
CREATE INDEX conversions_quote_id_idx ON conversions(quote_id);

-- liquidity_pools: simulated USDT inventory for the mock FX provider
CREATE TABLE liquidity_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  asset account_asset NOT NULL,
  total_units BIGINT NOT NULL DEFAULT 0,
  reserved_units BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_provider_asset UNIQUE (provider, asset),
  CONSTRAINT total_non_negative CHECK (total_units >= 0),
  CONSTRAINT reserved_non_negative CHECK (reserved_units >= 0),
  CONSTRAINT reserved_lte_total CHECK (reserved_units <= total_units)
);

-- Seed mock liquidity: 10,000,000 USDT (scale 6 = 10,000 USDT)
INSERT INTO liquidity_pools (provider, asset, total_units, reserved_units)
VALUES ('mock', 'USDT', 10000000000, 0);

-- updated_at triggers
CREATE TRIGGER deposits_updated_at
  BEFORE UPDATE ON deposits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER conversions_updated_at
  BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER liquidity_pools_updated_at
  BEFORE UPDATE ON liquidity_pools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_pools ENABLE ROW LEVEL SECURITY;

-- Users can read their own deposits, quotes, and conversions
CREATE POLICY "deposits_select_own" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "quotes_select_own" ON quotes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "conversions_select_own" ON conversions
  FOR SELECT USING (auth.uid() = user_id);

-- liquidity_pools: service role only, no user access
