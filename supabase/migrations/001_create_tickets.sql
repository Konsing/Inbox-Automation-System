CREATE TABLE tickets (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message       TEXT NOT NULL,
  category      TEXT CHECK (category IN ('refund','billing','technical','general')),
  priority      TEXT CHECK (priority IN ('low','medium','high','urgent')),
  sentiment     TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  ai_response   TEXT,
  status        TEXT NOT NULL DEFAULT 'received'
                CHECK (status IN ('received','classifying','classified','generating','stored','done','error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  classified_at TIMESTAMPTZ,
  responded_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_tickets_created_at ON tickets (created_at DESC);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for anon" ON tickets
  FOR ALL USING (true) WITH CHECK (true);
