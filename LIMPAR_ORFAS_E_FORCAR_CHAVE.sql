-- ==========================================
-- SCRIPT PARA LIMPAR ÓRFÃOS E FORÇAR A CHAVE
-- ==========================================

-- 1. Excluir qualquer arquivo que esteja apontando para um orçamento que não existe mais
DELETE FROM public.orcamento_arquivos 
WHERE orcamento_id NOT IN (SELECT id FROM public.orcamentos);

-- 2. Tentar adicionar a chave estrangeira novamente
ALTER TABLE public.orcamento_arquivos
ADD CONSTRAINT fk_orcamento
FOREIGN KEY (orcamento_id) 
REFERENCES public.orcamentos(id) 
ON DELETE CASCADE;

-- 3. Recarregar o cache
NOTIFY pgrst, 'reload schema';
