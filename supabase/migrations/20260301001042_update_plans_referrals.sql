-- 1. PLAN CONFIG UPDATES
ALTER TABLE plan_config
ADD COLUMN IF NOT EXISTS free_welcome_credits INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS premium_lia_messages INT DEFAULT 70,
ADD COLUMN IF NOT EXISTS premium_price_brl DECIMAL(10,2) DEFAULT 97.00;

UPDATE plan_config SET
  free_generations_limit = 3,
  free_welcome_credits = 2,
  premium_generations_limit = 15,
  premium_lia_messages = 70,
  premium_price_brl = 97.00;

-- 2. CREDIT PACKAGES
DELETE FROM credit_packages;

INSERT INTO credit_packages (name, credit_amount, price_brl, active) VALUES
('Pacote Inicial', 5, 19.90, true),
('Pacote Popular', 15, 49.90, true),
('Pacote Completo', 30, 99.90, true);

-- 3. PROFILE EXTRA CREDITS AND REFERRAL CODE
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS extra_credits INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS welcome_credits_used BOOLEAN DEFAULT false;

UPDATE profiles
SET referral_code = LOWER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Garante que todos os perfis legados também ganhem seus 2 créditos de boas vindas retroativos
UPDATE profiles
SET extra_credits = COALESCE(extra_credits, 0) + 2
WHERE welcome_credits_used = false AND COALESCE(extra_credits, 0) = 0;

-- 4. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  credits_granted BOOLEAN DEFAULT false
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "System can insert referrals" ON referrals
  FOR INSERT WITH CHECK (true); -- Permitimos insert no frontend na hora do signup se precisar, ou via DB

-- 5. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- Permite inserir a info da notificacao de indicacao

-- 6. PROFILE CREATION TRIGGER (WITH WELCOME CREDITS AND REFERRAL_CODE)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    plan, 
    free_cycle_expires_at,
    extra_credits,
    referral_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    'user',
    'free',
    NOW() + INTERVAL '30 days',
    2, -- 2 Welcome Credits
    LOWER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
