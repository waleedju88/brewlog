-- ============================================
-- BrewLog v4 – Goals Schema
-- Run this in: Supabase → SQL Editor → New query
-- ============================================

-- 1. Goals table
CREATE TABLE IF NOT EXISTS goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  budget      integer NOT NULL,
  title       text DEFAULT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz DEFAULT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'closed')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user ON goals(user_id, created_at DESC);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own goals only" ON goals FOR ALL USING (auth.uid() = user_id);

-- 2. Add goal_id to cup_logs (if not exists)
ALTER TABLE cup_logs ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES goals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cup_logs_goal ON cup_logs(goal_id);

-- 3. Profiles table (keep, remove cup_budget since goals handles it)
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile only" ON profiles FOR ALL USING (auth.uid() = id);

-- 4. Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
