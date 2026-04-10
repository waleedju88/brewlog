-- ============================================
-- BrewLog v3 – Lifetime Budget Schema
-- Run this in: Supabase → SQL Editor → New query
-- ============================================

-- Drop old tables
DROP TABLE IF EXISTS coffee_logs;
DROP TABLE IF EXISTS cup_logs;

-- 1. Per-cup log (one row per cup, with timestamp)
CREATE TABLE IF NOT EXISTS cup_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  logged_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cup_logs_user_time ON cup_logs(user_id, logged_at DESC);

ALTER TABLE cup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cup logs only" ON cup_logs
  FOR ALL USING (auth.uid() = user_id);

-- 2. Profiles – stores lifetime budget (replaces daily_limit)
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cup_budget      integer DEFAULT NULL,  -- total budget set by user
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile only" ON profiles
  FOR ALL USING (auth.uid() = id);

-- 3. Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
