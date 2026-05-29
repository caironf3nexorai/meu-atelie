-- ==========================================
-- SCRIPT DE RESTAURAÇÃO DE POLÍTICAS - ORÇAMENTOS E ARTES
-- ==========================================
-- Aplica as políticas de segurança (RLS) nas tabelas orcamentos, orcamento_itens e aprovacao_arte

DO $$ 
BEGIN 
    -- Garante que as colunas essenciais existem, caso o banco base não as tenha
    BEGIN
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_cpf TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_endereco_cep TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_endereco_rua TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_endereco_numero TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_endereco_bairro TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_endereco_cidade TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_endereco_estado TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS valor_frete DECIMAL(10,2);
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS token_publico UUID DEFAULT uuid_generate_v4();
    EXCEPTION WHEN OTHERS THEN END;
END $$;

-- 1. ORÇAMENTOS (orcamentos)
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own orcamentos" ON public.orcamentos;
CREATE POLICY "Users can insert their own orcamentos" ON public.orcamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own orcamentos" ON public.orcamentos;
CREATE POLICY "Users can view their own orcamentos" ON public.orcamentos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own orcamentos" ON public.orcamentos;
CREATE POLICY "Users can update their own orcamentos" ON public.orcamentos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own orcamentos" ON public.orcamentos;
CREATE POLICY "Users can delete their own orcamentos" ON public.orcamentos FOR DELETE USING (auth.uid() = user_id);

-- 2. ITENS DO ORÇAMENTO (orcamento_itens)
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert orcamento itens on own orcamentos" ON public.orcamento_itens;
CREATE POLICY "Users can insert orcamento itens on own orcamentos" ON public.orcamento_itens FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_itens.orcamento_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view orcamento itens on own orcamentos" ON public.orcamento_itens;
CREATE POLICY "Users can view orcamento itens on own orcamentos" ON public.orcamento_itens FOR SELECT USING (EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_itens.orcamento_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update orcamento itens on own orcamentos" ON public.orcamento_itens;
CREATE POLICY "Users can update orcamento itens on own orcamentos" ON public.orcamento_itens FOR UPDATE USING (EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_itens.orcamento_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete orcamento itens on own orcamentos" ON public.orcamento_itens;
CREATE POLICY "Users can delete orcamento itens on own orcamentos" ON public.orcamento_itens FOR DELETE USING (EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_itens.orcamento_id AND user_id = auth.uid()));

-- 3. APROVAÇÃO DE ARTE (aprovacao_arte)
ALTER TABLE public.aprovacao_arte ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert aprovacao arte" ON public.aprovacao_arte;
CREATE POLICY "Users can insert aprovacao arte" ON public.aprovacao_arte FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own aprovacao arte" ON public.aprovacao_arte;
CREATE POLICY "Users can view own aprovacao arte" ON public.aprovacao_arte FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own aprovacao arte" ON public.aprovacao_arte;
CREATE POLICY "Users can update own aprovacao arte" ON public.aprovacao_arte FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own aprovacao arte" ON public.aprovacao_arte;
CREATE POLICY "Users can delete own aprovacao arte" ON public.aprovacao_arte FOR DELETE USING (auth.uid() = user_id);
