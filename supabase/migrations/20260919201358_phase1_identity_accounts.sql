-- Phase 1: Identity and Accounts

-- Enums
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified');
CREATE TYPE user_role AS ENUM ('user', 'operator');
CREATE TYPE account_purpose AS ENUM ('mwk_wallet', 'usdt_wallet', 'card_funding', 'collection_clearing', 'fx_clearing_mwk', 'fx_clearing_usdt', 'fee_revenue', 'liquidity_inventory');
CREATE TYPE account_asset AS ENUM ('MWK', 'USDT');
CREATE TYPE account_status AS ENUM ('active', 'frozen');

-- profiles: one row per auth user
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- accounts: wallets and system clearing accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  purpose account_purpose NOT NULL,
  asset account_asset NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_purpose_asset UNIQUE (owner_user_id, purpose, asset)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: enable but lock financial tables to service role only
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- profiles: users can read and update their own row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND role = 'user');

-- accounts: readable by owner via service role only (no direct browser writes)
CREATE POLICY "accounts_select_own" ON accounts
  FOR SELECT USING (auth.uid() = owner_user_id);

-- Seed system accounts (no owner = system-owned)
INSERT INTO accounts (owner_user_id, purpose, asset) VALUES
  (NULL, 'collection_clearing',  'MWK'),
  (NULL, 'fx_clearing_mwk',      'MWK'),
  (NULL, 'fx_clearing_usdt',     'USDT'),
  (NULL, 'fee_revenue',          'MWK'),
  (NULL, 'fee_revenue',          'USDT'),
  (NULL, 'liquidity_inventory',  'USDT');
