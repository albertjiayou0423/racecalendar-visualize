CREATE TABLE IF NOT EXISTS api_monitor_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id TEXT NOT NULL,
  checked_at_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
  latency_ms INTEGER NOT NULL,
  http_status INTEGER,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS api_monitor_checks_target_time
  ON api_monitor_checks (target_id, checked_at_ms DESC);

CREATE TABLE IF NOT EXISTS api_monitor_notification_state (
  target_id TEXT PRIMARY KEY,
  last_notified_status TEXT NOT NULL CHECK (last_notified_status IN ('up', 'down')),
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_monitor_daily_usage (
  utc_day TEXT PRIMARY KEY,
  status_executions INTEGER NOT NULL DEFAULT 0 CHECK (status_executions >= 0),
  scheduled_runs INTEGER NOT NULL DEFAULT 0 CHECK (scheduled_runs >= 0),
  updated_at_ms INTEGER NOT NULL
);
