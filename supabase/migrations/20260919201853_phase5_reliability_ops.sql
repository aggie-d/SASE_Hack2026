-- Phase 5: Reliability and Operations

-- Enums
CREATE TYPE provider_event_status AS ENUM ('pending', 'processed', 'failed');
CREATE TYPE outbox_job_status AS ENUM ('pending', 'running', 'done', 'failed');

-- provider_events: raw inbound webhook events, deduplicated before processing
CREATE TABLE provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status provider_event_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX provider_events_status_idx ON provider_events(status);

-- idempotency_records: prevents duplicate API writes
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  route TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  operation_id UUID,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_route_key UNIQUE (user_id, route, key)
);

CREATE INDEX idempotency_records_user_id_idx ON idempotency_records(user_id);

-- outbox_jobs: retry queue for provider calls
CREATE TABLE outbox_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL,
  job_type TEXT NOT NULL,
  status outbox_job_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX outbox_jobs_status_next_attempt_idx ON outbox_jobs(status, next_attempt_at);
CREATE INDEX outbox_jobs_operation_id_idx ON outbox_jobs(operation_id);

-- audit_events: append-only log; never update or delete rows
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_id UUID,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_actor_id_idx ON audit_events(actor_id);
CREATE INDEX audit_events_correlation_id_idx ON audit_events(correlation_id);

-- updated_at triggers (not on audit_events — it is append-only)
CREATE TRIGGER provider_events_updated_at
  BEFORE UPDATE ON provider_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER idempotency_records_updated_at
  BEFORE UPDATE ON idempotency_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER outbox_jobs_updated_at
  BEFORE UPDATE ON outbox_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: all reliability tables locked to service role only
ALTER TABLE provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
