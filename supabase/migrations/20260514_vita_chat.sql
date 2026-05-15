-- Vita AI chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  check_in_type text DEFAULT 'general' CHECK (check_in_type IN ('morning', 'night', 'general')),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_history_user_id_created_at
  ON chat_history (user_id, created_at);

-- RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add check-in columns to daily_logs
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS morning_checkin_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS night_checkin_done   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS morning_checkin      jsonb,
  ADD COLUMN IF NOT EXISTS night_checkin        jsonb;
