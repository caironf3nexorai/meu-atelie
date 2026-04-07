-- Nova tabela para registrar o uso individual de cupons
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, coupon_id)
);

-- Configurações RLS Opcionais
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coupon usages" 
  ON public.user_coupons FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all coupon usages" 
  ON public.user_coupons FOR SELECT 
  USING (public.is_admin());
