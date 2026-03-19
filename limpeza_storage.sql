-- Tabela de log de limpezas (para monitorar no widget admin)
CREATE TABLE IF NOT EXISTS log_limpeza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'artes_expiradas', 'notificacoes', 'orcamento_arquivos'
  registros_deletados INTEGER DEFAULT 0,
  storage_liberado_mb NUMERIC(10,2) DEFAULT 0,
  executado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE log_limpeza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Apenas admin ou usuário logado acessa logs de limpeza"
ON log_limpeza FOR SELECT
USING (auth.role() = 'authenticated');

-- Índices para acelerar as queries de limpeza
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at
ON notificacoes(created_at);

CREATE INDEX IF NOT EXISTS idx_notificacoes_lida
ON notificacoes(lida, created_at);

CREATE INDEX IF NOT EXISTS idx_aprovacao_arte_expires
ON aprovacao_arte(expires_at, status);

CREATE INDEX IF NOT EXISTS idx_orcamento_arquivos_created
ON orcamento_arquivos(created_at);
