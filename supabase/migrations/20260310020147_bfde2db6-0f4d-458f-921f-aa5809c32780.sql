
-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'agency')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  gumroad_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Usage limits table
CREATE TABLE public.usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  messages_used int NOT NULL DEFAULT 0,
  images_used int NOT NULL DEFAULT 0,
  files_used int NOT NULL DEFAULT 0,
  audio_minutes_used int NOT NULL DEFAULT 0,
  image_analyses_used int NOT NULL DEFAULT 0,
  reset_date timestamptz NOT NULL DEFAULT now(),
  messages_reset_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON public.usage_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.usage_limits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.usage_limits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage"
  ON public.usage_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);
