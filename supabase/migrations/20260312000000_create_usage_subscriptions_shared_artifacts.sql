CREATE TABLE IF NOT EXISTS public.usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  messages_used integer NOT NULL DEFAULT 0,
  images_used integer NOT NULL DEFAULT 0,
  files_used integer NOT NULL DEFAULT 0,
  audio_minutes_used integer NOT NULL DEFAULT 0,
  image_analyses_used integer NOT NULL DEFAULT 0,
  reset_date timestamptz NOT NULL DEFAULT now(),
  messages_reset_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_limits_user_id_key UNIQUE (user_id),
  CONSTRAINT usage_limits_user_id_unique UNIQUE (user_id)
);
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage" ON public.usage_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage usage" ON public.usage_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  gumroad_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_user_id_key UNIQUE (user_id),
  CONSTRAINT subscriptions_email_key UNIQUE (email),
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('starter','pro','agency')),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('active','cancelled','expired'))
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shared_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifacts jsonb NOT NULL,
  title text NOT NULL DEFAULT 'Arquivos Compartilhados',
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);
ALTER TABLE public.shared_artifacts ENABLE ROW LEVEL SECURITY;
