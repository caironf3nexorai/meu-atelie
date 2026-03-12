ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS premium_duration_months integer;
