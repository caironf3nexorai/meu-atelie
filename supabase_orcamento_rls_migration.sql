-- Verificar policies existentes
-- SELECT * FROM pg_policies WHERE tablename = 'orcamentos';

-- Remover policy genérica que pode estar bloqueando ou ser muito restritiva/aberta demais
DROP POLICY IF EXISTS "Usuário gerencia seus orçamentos" ON orcamentos;
DROP POLICY IF EXISTS "Leitura pública de orçamento por token" ON orcamentos;
DROP POLICY IF EXISTS "Dono lê seus orçamentos" ON orcamentos;
DROP POLICY IF EXISTS "Dono cria orçamentos" ON orcamentos;
DROP POLICY IF EXISTS "Dono edita seus orçamentos" ON orcamentos;
DROP POLICY IF EXISTS "Dono deleta seus orçamentos" ON orcamentos;
DROP POLICY IF EXISTS "Dono gerencia seus orçamentos" ON orcamentos;
DROP POLICY IF EXISTS "Leitura pública por token" ON orcamentos;
DROP POLICY IF EXISTS "Cliente responde orçamento" ON orcamentos;
DROP POLICY IF EXISTS "Cliente aprova orçamento por token" ON orcamentos;

-- Recriar separando SELECT, INSERT, UPDATE, DELETE 

-- Dono (Artesã) pode ler seus orçamentos
CREATE POLICY "Dono lê seus orçamentos"
ON orcamentos FOR SELECT
USING (auth.uid() = user_id);

-- Dono (Artesã) pode criar seus orçamentos
CREATE POLICY "Dono cria orçamentos"
ON orcamentos FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Dono (Artesã) pode editar seus orçamentos
CREATE POLICY "Dono edita seus orçamentos"
ON orcamentos FOR UPDATE
USING (auth.uid() = user_id);

-- Dono (Artesã) pode deletar seus orçamentos
CREATE POLICY "Dono deleta seus orçamentos"
ON orcamentos FOR DELETE
USING (auth.uid() = user_id);

-- Leitura pública por token (Cliente sem login visualizando os itens)
CREATE POLICY "Leitura pública por token"
ON orcamentos FOR SELECT
USING (token_publico IS NOT NULL);

-- Cliente atualiza status pelo token (Cliente sem login aprovando/recusando via OrcamentoPublicoPage.tsx)
CREATE POLICY "Cliente responde orçamento"
ON orcamentos FOR UPDATE
USING (token_publico IS NOT NULL)
WITH CHECK (
  status IN ('aceito', 'recusado')
);
