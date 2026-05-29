-- ==========================================
-- SCRIPT DE CORREÇÃO FINAL - PERFIL DO ATELIÊ
-- ==========================================
-- Este script adiciona as colunas referentes ao ateliê na tabela profiles,
-- que estavam faltando e impedindo o salvamento das configurações.

DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_nome TEXT;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_logo_url TEXT;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_whatsapp TEXT;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_email TEXT;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_instagram TEXT;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_cidade TEXT;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS atelie_estado TEXT;
    EXCEPTION WHEN OTHERS THEN END;
END $$;

NOTIFY pgrst, 'reload schema';
