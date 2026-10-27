-- What a lane last said about itself (hud lane NAME --model --effort --subagents --context): one row per lane, each
-- report merged into it. A report wins over the lane's transcript until the transcript changes; see vitals.ts.
-- Applied at every start; IF NOT EXISTS keeps existing data.
CREATE TABLE IF NOT EXISTS lane_vitals (
  lane TEXT PRIMARY KEY,
  model TEXT,
  effort TEXT,
  subagents INTEGER,
  context_used INTEGER,
  context_max INTEGER,
  reported_at INTEGER NOT NULL
);
