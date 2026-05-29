-- ==========================================
-- SCRIPT PARA FORÇAR A CHAVE ESTRANGEIRA
-- ==========================================

-- Garante que o banco entenda o relacionamento entre orcamentos e orcamento_arquivos
ALTER TABLE public.orcamento_arquivos
ADD CONSTRAINT fk_orcamento
FOREIGN KEY (orcamento_id) 
REFERENCES public.orcamentos(id) 
ON DELETE CASCADE;

-- E recarrega o cache imediatamente
NOTIFY pgrst, 'reload schema';
