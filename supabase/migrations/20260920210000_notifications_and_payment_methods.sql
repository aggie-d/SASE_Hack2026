-- Migration: notifications and payment_methods
-- Documenting user linked accounts/payment methods and notification feed schema

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank', 'mobile')),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  icon_type TEXT NOT NULL CHECK (icon_type IN ('card', 'bank', 'mobile')),
  last4 TEXT,
  cvv TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  is_unread BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_owner_all" ON payment_methods
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "notifications_owner_all" ON notifications
  FOR ALL USING (auth.uid() = user_id);
