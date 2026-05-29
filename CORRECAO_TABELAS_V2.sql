-- ==========================================
-- SCRIPT DE CORREÇÃO DE ESTRUTURAS DAS TABELAS
-- ==========================================
-- Este script corrige os problemas de colunas faltando e restrições (constraints)
-- antigas que estão impedindo o cadastro de orçamentos, clientes e salvamento de configurações.

DO $$ 
BEGIN 
    -- ==========================================
    -- 1. CORREÇÃO NA TABELA ORDERS (ORÇAMENTOS)
    -- ==========================================
    -- Removemos a restrição antiga que não deixava colocar o status "em_aberto" ou "pronto"
    ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_status_check1;
    
    -- Alteramos a coluna para aceitar qualquer texto e definimos um padrão
    ALTER TABLE IF EXISTS public.orders ALTER COLUMN status TYPE TEXT USING status::text;
    ALTER TABLE IF EXISTS public.orders ALTER COLUMN status SET DEFAULT 'em_aberto'::text;

    -- ==========================================
    -- 2. CORREÇÃO NA TABELA CLIENTS
    -- ==========================================
    -- Adicionamos as colunas de endereço, cpf e email que faltavam
    BEGIN
        ALTER TABLE public.clients ADD COLUMN cpf TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN email TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN endereco_rua TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN endereco_numero TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN endereco_bairro TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN endereco_cidade TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN endereco_estado TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.clients ADD COLUMN endereco_cep TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    -- ==========================================
    -- 3. CORREÇÃO NA TABELA PLAN_CONFIG (CONFIGURAÇÕES GLOBAIS)
    -- ==========================================
    -- Adicionamos as colunas de identidade visual, cotação e pré-lançamento
    BEGIN
        ALTER TABLE public.plan_config ADD COLUMN platform_name TEXT DEFAULT 'Meu Ateliê';
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.plan_config ADD COLUMN platform_logo_url TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.plan_config ADD COLUMN gemini_cost_per_generation_usd NUMERIC DEFAULT 0.039;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.plan_config ADD COLUMN usd_to_brl_rate NUMERIC DEFAULT 5.80;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.plan_config ADD COLUMN prelancamento BOOLEAN DEFAULT true;
    EXCEPTION WHEN duplicate_column THEN END;

END $$;
