-- 1. Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'pro')),
  paddle_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 4. Policy: service role can insert/update
CREATE POLICY "Service role can manage profiles"
  ON profiles FOR ALL
  USING (true)
  WITH CHECK (true);
