-- ILN SDK usage analytics schema
-- No PII: no addresses, amounts, or wallet identifiers

CREATE TABLE IF NOT EXISTS sdk_events (
  id         SERIAL PRIMARY KEY,
  method     TEXT        NOT NULL,
  success    BOOLEAN     NOT NULL,
  error_code TEXT,
  network    TEXT        NOT NULL,
  version    TEXT        NOT NULL,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the maintainer dashboard queries
CREATE INDEX IF NOT EXISTS sdk_events_method_idx  ON sdk_events (method);
CREATE INDEX IF NOT EXISTS sdk_events_network_idx ON sdk_events (network);
CREATE INDEX IF NOT EXISTS sdk_events_ts_idx      ON sdk_events (ts DESC);
