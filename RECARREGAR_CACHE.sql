-- ==========================================
-- SCRIPT PARA RECARREGAR CACHE DO BANCO
-- ==========================================

-- Isso força o PostgREST (API do Supabase) a recarregar as tabelas e relacionamentos novos.
NOTIFY pgrst, 'reload schema';
