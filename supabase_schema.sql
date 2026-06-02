-- =============================================================================
-- Lumiq — AI Observer schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email          text,
  created_at     timestamptz DEFAULT now(),
  scaffold_level int         DEFAULT 1 CHECK (scaffold_level IN (1, 2, 3)),
  total_sessions int         DEFAULT 0
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: own row only"
  ON users
  FOR ALL
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES users (id) ON DELETE CASCADE,
  exercise_id         text        NOT NULL,
  started_at          timestamptz DEFAULT now(),
  ended_at            timestamptz,
  total_triggers      int         DEFAULT 0,
  dominant_error_type text,
  summary_text        text
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: own rows only"
  ON sessions
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- 3. code_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS code_snapshots (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        REFERENCES sessions (id) ON DELETE CASCADE,
  triggered_at timestamptz DEFAULT now(),
  trigger_type text        NOT NULL CHECK (trigger_type IN ('newline', 'run')),
  code_content text,
  line_count   int,
  cursor_line  int
);

ALTER TABLE code_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code_snapshots: own rows via session"
  ON code_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = code_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = code_snapshots.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS code_snapshots_session_id_idx ON code_snapshots (session_id);

-- ---------------------------------------------------------------------------
-- 4. events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id  uuid        REFERENCES code_snapshots (id) ON DELETE CASCADE,
  session_id   uuid        REFERENCES sessions (id) ON DELETE CASCADE,
  event_type   text        NOT NULL CHECK (event_type IN ('keystroke', 'pause', 'click', 'delete')),
  line_number  int,
  duration_ms  int,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events: own rows via session"
  ON events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = events.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = events.session_id
        AND s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. feedback_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid        REFERENCES sessions (id) ON DELETE CASCADE,
  snapshot_id          uuid        REFERENCES code_snapshots (id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  error_type           text,
  feedback_text        text,
  scaffold_level_at_time int,
  was_helpful          boolean     DEFAULT NULL
);

ALTER TABLE feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_log: own rows via session"
  ON feedback_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = feedback_log.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = feedback_log.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS feedback_log_session_id_idx ON feedback_log (session_id);

-- ---------------------------------------------------------------------------
-- Demo mode: drop FK so feedback_log inserts succeed without a valid session
-- Re-add this constraint once auth is fully wired up.
-- ---------------------------------------------------------------------------
ALTER TABLE feedback_log
  DROP CONSTRAINT IF EXISTS feedback_log_session_id_fkey;
