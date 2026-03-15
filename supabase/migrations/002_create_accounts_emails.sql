-- Accounts: stores Google OAuth tokens (encrypted)
CREATE TABLE accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ NOT NULL,
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role" ON accounts
  FOR ALL USING (true) WITH CHECK (true);

-- Emails: stores fetched + classified emails
CREATE TABLE emails (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       UUID REFERENCES accounts(id) ON DELETE CASCADE,
  gmail_id         TEXT NOT NULL UNIQUE,
  gmail_message_id TEXT,
  thread_id        TEXT,
  from_address     TEXT NOT NULL,
  from_name        TEXT,
  subject          TEXT NOT NULL,
  snippet          TEXT,
  body_text        TEXT,
  received_at      TIMESTAMPTZ NOT NULL,
  category         TEXT CHECK (category IN ('refund','billing','technical','general')),
  priority         TEXT CHECK (priority IN ('low','medium','high','urgent')),
  sentiment        TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  summary          TEXT,
  reply_deadline   TEXT,
  draft_reply      TEXT,
  reply_sent       BOOLEAN DEFAULT false,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_emails_account_synced ON emails (account_id, synced_at DESC);
CREATE INDEX idx_emails_gmail_id ON emails (gmail_id);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for service role" ON emails
  FOR ALL USING (true) WITH CHECK (true);
