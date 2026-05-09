-- Adiciona a coluna partner_id à tabela coupons para vincular cupons a parceiras
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_partner_coupon BOOLEAN DEFAULT false;

-- Atualiza a documentação da tabela
COMMENT ON COLUMN public.coupons.partner_id IS 'ID da parceira caso seja um cupom exclusivo gerado para ela';
COMMENT ON COLUMN public.coupons.is_partner_coupon IS 'Flag para identificar se o cupom é atrelado a parceiros e gera indicação automática';
