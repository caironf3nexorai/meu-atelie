-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create Enum Types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE user_plan AS ENUM ('free', 'premium');
CREATE TYPE user_status AS ENUM ('active', 'blocked');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('credit_card', 'pix');
CREATE TYPE generation_type AS ENUM ('risco', 'bordado_colorido');
CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

-- ==========================================
-- TABLES
-- ==========================================

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  cpf TEXT UNIQUE, -- Permitido nulo inicialmente, definido na complementação de cadastro
  phone TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  role user_role DEFAULT 'user',
  plan user_plan DEFAULT 'free',
  status user_status DEFAULT 'active',
  
  -- Controle de assinaturas e acessos free
  free_generations_used INT DEFAULT 0,
  free_cycle_expires_at TIMESTAMPTZ,
  premium_starts_at TIMESTAMPTZ,
  premium_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- plan_config
CREATE TABLE public.plan_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  premium_price_brl DECIMAL(10,2) NOT NULL,
  premium_duration_months INT DEFAULT 12,
  free_generations_limit INT DEFAULT 2,
  premium_generations_limit INT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_config_id UUID REFERENCES public.plan_config(id) ON DELETE SET NULL,
  amount_brl DECIMAL(10,2) NOT NULL,
  status payment_status DEFAULT 'pending',
  payment_method payment_method,
  gateway_transaction_id TEXT,
  gateway_response JSONB,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- generations
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_type generation_type NOT NULL,
  status generation_status DEFAULT 'pending',
  form_data JSONB DEFAULT '{}',
  prompt_used TEXT,
  image_storage_path TEXT,
  image_public_url TEXT,
  image_expires_at TIMESTAMPTZ,
  plan_at_generation user_plan,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- financial_records
CREATE TABLE public.financial_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  amount_brl DECIMAL(10,2) NOT NULL,
  record_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- pricing_calculations
CREATE TABLE public.pricing_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_name TEXT,
  materials_cost DECIMAL(10,2),
  labor_hours DECIMAL(5,2),
  hourly_rate DECIMAL(10,2),
  overhead_cost DECIMAL(10,2),
  profit_margin DECIMAL(5,2),
  final_price DECIMAL(10,2),
  form_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- strategy_conversations
CREATE TABLE public.strategy_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================

-- profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX idx_profiles_plan ON public.profiles(plan);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_premium_expires ON public.profiles(premium_expires_at);
CREATE INDEX idx_profiles_free_cycle_expires ON public.profiles(free_cycle_expires_at);

-- payments
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_gateway_transaction ON public.payments(gateway_transaction_id);

-- generations
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_status ON public.generations(status);
CREATE INDEX idx_generations_expires_at ON public.generations(image_expires_at);
CREATE INDEX idx_generations_type ON public.generations(generation_type);

-- financial_records
CREATE INDEX idx_financial_records_user_id ON public.financial_records(user_id);
CREATE INDEX idx_financial_records_date ON public.financial_records(record_date);
CREATE INDEX idx_financial_records_type ON public.financial_records(type);

-- pricing_calculations
CREATE INDEX idx_pricing_user_id ON public.pricing_calculations(user_id);

-- strategy_conversations
CREATE INDEX idx_strategy_user_id ON public.strategy_conversations(user_id);


-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- 1. update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_financial_records_updated_at
  BEFORE UPDATE ON public.financial_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_strategy_conversations_updated_at
  BEFORE UPDATE ON public.strategy_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_plan_config_updated_at
  BEFORE UPDATE ON public.plan_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- 2. Trigger: Criar profile automaticamente no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    plan, 
    free_cycle_expires_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    'user',
    'free',
    NOW() + INTERVAL '30 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Função: Resetar ciclo free
CREATE OR REPLACE FUNCTION public.reset_free_cycle(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET free_generations_used = 0,
      free_cycle_expires_at = NOW() + INTERVAL '30 days'
  WHERE id = p_user_id AND (free_cycle_expires_at < NOW() OR free_cycle_expires_at IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Função: Ativar premium
CREATE OR REPLACE FUNCTION public.activate_premium(p_user_id UUID, p_payment_id UUID, p_duration_months INT DEFAULT 12)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET plan = 'premium',
      premium_starts_at = NOW(),
      premium_expires_at = NOW() + (p_duration_months || ' months')::INTERVAL
  WHERE id = p_user_id;

  UPDATE public.payments
  SET status = 'approved',
      paid_at = NOW(),
      expires_at = NOW() + (p_duration_months || ' months')::INTERVAL
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Função: Revogar premium por reembolso
CREATE OR REPLACE FUNCTION public.revoke_premium(p_user_id UUID, p_payment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET plan = 'free',
      premium_starts_at = NULL,
      premium_expires_at = NULL
  WHERE id = p_user_id;

  UPDATE public.payments
  SET status = 'refunded'
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Admin check RLS helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- ==========================================
-- JOBS PG_CRON
-- ==========================================

-- 1. Limpar imagens expiradas a cada 30 minutos
SELECT cron.schedule(
  'limpar_imagens_expiradas',
  '*/30 * * * *',
  $$
  UPDATE public.generations
  SET image_storage_path = NULL,
      image_public_url = NULL
  WHERE image_expires_at < NOW() AND image_storage_path IS NOT NULL;
  $$
);

-- 2. Todo dia à meia-noite: expirar assinaturas premium vencidas
SELECT cron.schedule(
  'expirar_assinaturas_premium',
  '0 0 * * *',
  $$
  UPDATE public.profiles
  SET plan = 'free',
      premium_starts_at = NULL,
      premium_expires_at = NULL
  WHERE plan = 'premium' AND premium_expires_at < NOW();
  $$
);


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_conversations ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can perform all actions on profiles" ON public.profiles USING (public.is_admin());

-- payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (public.is_admin());

-- generations
CREATE POLICY "Users can view own generations" ON public.generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generations" ON public.generations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own generations" ON public.generations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all generations" ON public.generations FOR SELECT USING (public.is_admin());

-- financial_records
CREATE POLICY "Users can fully manage own financial records" ON public.financial_records USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all financial records" ON public.financial_records FOR SELECT USING (public.is_admin());

-- pricing_calculations
CREATE POLICY "Users can fully manage own pricing calculations" ON public.pricing_calculations USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all pricing calculations" ON public.pricing_calculations FOR SELECT USING (public.is_admin());

-- strategy_conversations
CREATE POLICY "Users can fully manage own strategy conversations" ON public.strategy_conversations USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all strategy conversations" ON public.strategy_conversations FOR SELECT USING (public.is_admin());

-- plan_config
CREATE POLICY "Anyone authenticated can view plan config" ON public.plan_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can fully manage plan config" ON public.plan_config USING (public.is_admin());


-- ==========================================
-- DADOS INICIAIS
-- ==========================================

INSERT INTO public.plan_config (premium_price_brl, premium_duration_months, free_generations_limit, premium_generations_limit)
VALUES (97.00, 12, 2, NULL);

-- NOTA: Admin privileges should be granted via Supabase Dashboard manually or via Edge Functions
-- UPDATE profiles SET role = 'admin' WHERE email IN ('email_cairon@dominio.com', 'email_suelen@dominio.com');
