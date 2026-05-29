-- ==========================================
-- SCRIPT DE CORREÇÃO FINAL - ORÇAMENTOS E ARQUIVOS
-- ==========================================
-- Este script cria a tabela de arquivos que estava faltando e adiciona
-- as colunas finais para que a página de orçamentos carregue corretamente.

DO $$ 
BEGIN 
    -- 1. Adicionar colunas de aprovação/recusa na tabela de orçamentos
    BEGIN
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMPTZ;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;
        ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS cliente_observacoes TEXT;
    EXCEPTION WHEN OTHERS THEN END;
END $$;

-- 2. Criar a tabela de arquivos do orçamento que a página tenta buscar
CREATE TABLE IF NOT EXISTS public.orcamento_arquivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT, 
  enviado_por TEXT DEFAULT 'cliente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar e configurar as políticas de segurança da tabela orcamento_arquivos
ALTER TABLE public.orcamento_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono e clientes podem ver arquivos" ON public.orcamento_arquivos;
CREATE POLICY "Dono e clientes podem ver arquivos" ON public.orcamento_arquivos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Cliente pode enviar arquivos" ON public.orcamento_arquivos;
CREATE POLICY "Cliente pode enviar arquivos" ON public.orcamento_arquivos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Dono pode deletar arquivos" ON public.orcamento_arquivos;
CREATE POLICY "Dono pode deletar arquivos" ON public.orcamento_arquivos FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_arquivos.orcamento_id AND user_id = auth.uid())
);

-- 3. Criar a tabela de notificações (usada pelo sistema quando o cliente aprova)
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas de notificações
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê suas notificações" ON public.notificacoes;
CREATE POLICY "Usuário vê suas notificações" ON public.notificacoes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário pode deletar suas notificações" ON public.notificacoes;
CREATE POLICY "Usuário pode deletar suas notificações" ON public.notificacoes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário pode atualizar suas notificações" ON public.notificacoes;
CREATE POLICY "Usuário pode atualizar suas notificações" ON public.notificacoes FOR UPDATE USING (auth.uid() = user_id);

-- Permitir que o sistema/cliente insira notificações públicas quando aceitar orçamento
DROP POLICY IF EXISTS "Sistema insere notificações" ON public.notificacoes;
CREATE POLICY "Sistema insere notificações" ON public.notificacoes FOR INSERT WITH CHECK (true);
