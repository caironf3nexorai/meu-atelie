-- 1. Create campaign_config table
CREATE TABLE IF NOT EXISTS public.campaign_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  general_trial_limit INT DEFAULT 50,
  general_trial_used INT DEFAULT 0,
  partner_trial_limit INT DEFAULT 50,
  partner_trial_used INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial config if not exists
INSERT INTO public.campaign_config (general_trial_limit, partner_trial_limit)
SELECT 50, 50
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_config);

-- RLS
ALTER TABLE public.campaign_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view campaign config" ON public.campaign_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage campaign config" ON public.campaign_config USING (public.is_admin());

-- 2. Update profiles for trial tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS had_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- 4. Insert FUNDADORA20 coupon if not exists
INSERT INTO public.coupons (code, discount_value, max_uses, current_uses, active)
VALUES ('FUNDADORA20', 20.00, 15, 0, true)
ON CONFLICT (code) DO UPDATE 
SET discount_value = 20.00, max_uses = 15;

-- 5. Create View for Trial Stats
CREATE OR REPLACE VIEW public.trial_stats_view AS
SELECT
  (SELECT general_trial_limit FROM public.campaign_config LIMIT 1) as general_trial_limit,
  (SELECT general_trial_used FROM public.campaign_config LIMIT 1) as general_trial_used,
  (SELECT partner_trial_limit FROM public.campaign_config LIMIT 1) as partner_trial_limit,
  (SELECT partner_trial_used FROM public.campaign_config LIMIT 1) as partner_trial_used,
  (SELECT count(*) FROM public.profiles WHERE had_trial = true) as total_trials_initiated,
  (SELECT count(*) FROM public.profiles WHERE had_trial = true AND plan = 'premium' AND (trial_expires_at IS NULL OR trial_expires_at < NOW())) as total_conversions;
