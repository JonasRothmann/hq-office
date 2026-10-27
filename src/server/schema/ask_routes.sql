-- Go to the lead (decision D20): one row per hop an ask takes before the owner. Today a hop is only ever 1 (the
-- asking lane's lead); escalation goes straight to the owner. Times are absolute (epoch ms), so a restart keeps them.
--   delivery: sending (to be typed in once the lead is idle), sent, away (the lead is gone; kept until it is back),
--             failed (herdr could not type it in; the ask went to the owner).
--   escalated_by: the lead, hq, or why it went on its own: timeout, delivery, unavailable.
--   closed_at: the hop is over (answered, escalated, or the ask closed some other way).
--   answer_delivery: the answer typed into the asking lane: sending, sent, away (kept until it is back) or failed.
CREATE TABLE IF NOT EXISTS ask_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ask_id INTEGER NOT NULL,
  hop INTEGER NOT NULL DEFAULT 1,
  lane TEXT NOT NULL,
  routed_at INTEGER NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'sending',
  delivered_at INTEGER,
  tries INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  escalate_at INTEGER NOT NULL,
  escalated_at INTEGER,
  escalated_by TEXT,
  reason TEXT,
  closed_at INTEGER,
  answer_delivery TEXT,
  UNIQUE (ask_id, hop)
);
CREATE INDEX IF NOT EXISTS ask_routes_ask ON ask_routes (ask_id);
