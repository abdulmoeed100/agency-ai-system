-- ═══════════════════════════════════════════════════════════════════
-- PixelForge Agency Chatbot — UPDATED Supabase Database Schema
-- Run this FULL SQL in your Supabase project's SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Table 1: conversations
CREATE TABLE IF NOT EXISTS conversations (
  id              BIGSERIAL PRIMARY KEY,
  session_id      UUID NOT NULL UNIQUE,
  client_name     TEXT,
  client_email    TEXT,
  client_phone    TEXT,
  business_name   TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: messages
CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES conversations(session_id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: admins (NEW — stores which Supabase Auth users are admins)
CREATE TABLE IF NOT EXISTS admins (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_session      ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status  ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_admins_user_id        ON admins(user_id);

-- Disable RLS (we handle auth in backend with service role key)
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages      DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins        DISABLE ROW LEVEL SECURITY;

-- ─── DONE! ───────────────────────────────────────────────────────────────────
-- After running this SQL:
-- 1. Go to Supabase → Authentication → Users → Add user (admin@pixelforge.com)
-- 2. Copy the user's UUID
-- 3. Run this INSERT to make them admin (replace UUID below):
--
--    INSERT INTO admins (user_id, name, email)
--    VALUES ('PASTE-UUID-HERE', 'Admin Name', 'admin@pixelforge.com');
