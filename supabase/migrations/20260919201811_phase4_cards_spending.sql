-- Phase 4: Cards, Authorizations, Transactions

-- Enums
CREATE TYPE card_status AS ENUM ('active', 'frozen', 'closed');
CREATE TYPE authorization_status AS ENUM ('pending', 'captured', 'reversed', 'expired');
CREATE TYPE card_transaction_type AS ENUM ('capture', 'reversal', 'refund');

-- cards: one virtual demo card per user
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  funding_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  provider_card_id TEXT,
  last4 TEXT NOT NULL,
  status card_status NOT NULL DEFAULT 'active',
  per_transaction_limit_units BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT last4_format CHECK (last4 ~ '^[0-9]{4}$'),
  CONSTRAINT limit_positive CHECK (per_transaction_limit_units IS NULL OR per_transaction_limit_units > 0)
);

CREATE INDEX cards_user_id_idx ON cards(user_id);

-- card_authorizations: hold placed when a merchant authorizes a charge
CREATE TABLE card_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  provider_reference TEXT NOT NULL UNIQUE,
  merchant TEXT NOT NULL,
  usdt_amount_units BIGINT NOT NULL,
  status authorization_status NOT NULL DEFAULT 'pending',
  hold_id UUID REFERENCES holds(id),
  merchant_amount_units BIGINT,
  merchant_currency TEXT,
  settlement_quote_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amount_positive CHECK (usdt_amount_units > 0)
);

CREATE INDEX card_authorizations_card_id_idx ON card_authorizations(card_id);
CREATE INDEX card_authorizations_provider_reference_idx ON card_authorizations(provider_reference);

-- card_transactions: posted debits and credits (captures, reversals, refunds)
CREATE TABLE card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL REFERENCES card_authorizations(id) ON DELETE RESTRICT,
  type card_transaction_type NOT NULL,
  usdt_amount_units BIGINT NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  merchant_amount_units BIGINT,
  merchant_currency TEXT,
  fee_units BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amount_positive CHECK (usdt_amount_units > 0),
  CONSTRAINT fee_non_negative CHECK (fee_units IS NULL OR fee_units >= 0)
);

CREATE INDEX card_transactions_authorization_id_idx ON card_transactions(authorization_id);

-- updated_at triggers
CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER card_authorizations_updated_at
  BEFORE UPDATE ON card_authorizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own cards
CREATE POLICY "cards_select_own" ON cards
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read authorizations on their own cards
CREATE POLICY "card_authorizations_select_own" ON card_authorizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = card_authorizations.card_id
      AND c.user_id = auth.uid()
    )
  );

-- Users can read transactions on their own cards
CREATE POLICY "card_transactions_select_own" ON card_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM card_authorizations ca
      JOIN cards c ON c.id = ca.card_id
      WHERE ca.id = card_transactions.authorization_id
      AND c.user_id = auth.uid()
    )
  );
