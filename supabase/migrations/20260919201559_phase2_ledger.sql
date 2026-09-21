-- Phase 2: Ledger (journals, journal_entries, holds)

-- Enums
CREATE TYPE journal_type AS ENUM ('deposit', 'conversion', 'card_fund', 'card_auth', 'card_capture', 'card_reversal', 'refund', 'fee');
CREATE TYPE journal_status AS ENUM ('posted', 'reversed');
CREATE TYPE hold_status AS ENUM ('active', 'consumed', 'released', 'expired');

-- journals: one row per financial event
CREATE TABLE journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL,
  type journal_type NOT NULL,
  status journal_status NOT NULL DEFAULT 'posted',
  reversal_of UUID REFERENCES journals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX journals_operation_id_idx ON journals(operation_id);

-- journal_entries: double-entry rows; every journal must balance per asset
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  asset account_asset NOT NULL,
  debit_units BIGINT NOT NULL DEFAULT 0,
  credit_units BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT debit_credit_non_negative CHECK (debit_units >= 0 AND credit_units >= 0),
  CONSTRAINT one_side_only CHECK (NOT (debit_units > 0 AND credit_units > 0))
);

CREATE INDEX journal_entries_journal_id_idx ON journal_entries(journal_id);
CREATE INDEX journal_entries_account_id_idx ON journal_entries(account_id);

-- holds: temporary balance reservations
CREATE TABLE holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  amount_units BIGINT NOT NULL,
  status hold_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amount_positive CHECK (amount_units > 0),
  CONSTRAINT unique_account_operation UNIQUE (account_id, operation_id)
);

CREATE INDEX holds_account_id_idx ON holds(account_id);
CREATE INDEX holds_operation_id_idx ON holds(operation_id);

-- updated_at triggers
CREATE TRIGGER journals_updated_at
  BEFORE UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER holds_updated_at
  BEFORE UPDATE ON holds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: all ledger tables locked to service role only (no direct browser access)
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE holds ENABLE ROW LEVEL SECURITY;

-- No user-facing policies on these tables.
-- All reads go through server-side API routes using the service role key.

-- Balance view: posted balance per account (debits reduce user liability accounts)
-- NOTE: superseded by 20260919215715_ledger_functions.sql, which recreates this
-- view with text unit columns and revokes client access.
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id AS account_id,
  a.owner_user_id,
  a.purpose,
  a.asset,
  COALESCE(SUM(je.credit_units - je.debit_units), 0) AS posted_units,
  COALESCE((
    SELECT SUM(h.amount_units)
    FROM holds h
    WHERE h.account_id = a.id AND h.status = 'active'
  ), 0) AS held_units,
  COALESCE(SUM(je.credit_units - je.debit_units), 0) -
  COALESCE((
    SELECT SUM(h.amount_units)
    FROM holds h
    WHERE h.account_id = a.id AND h.status = 'active'
  ), 0) AS available_units
FROM accounts a
LEFT JOIN journal_entries je ON je.account_id = a.id
GROUP BY a.id, a.owner_user_id, a.purpose, a.asset;
