-- Adicionando coluna para separar créditos mensais (free_generations_used decresce do limite mensal) 
-- dos créditos avulsos vitálícios (extra_credits).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extra_credits INT DEFAULT 0;

-- Adicionando vínculo de pacote na tabela de pagamentos para que o webhook diferencie Assinatura vs Lote
ALTER TABLE payments ADD COLUMN IF NOT EXISTS package_id UUID;

-- Tabela de Pacotes Avulsos (Vitrine)
CREATE TABLE credit_packages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  credit_amount INT NOT NULL,
  price_brl     DECIMAL(10,2) NOT NULL,
  active        BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Dados iniciais (Loja de Add-ons)
INSERT INTO credit_packages (name, credit_amount, price_brl, display_order) VALUES
  ('Pacote Bronze', 10,  19.90, 1),
  ('Pacote Prata',  30,  49.90, 2),
  ('Pacote Ouro',   100, 129.90, 3);

-- Segurança e Políticas de Acesso
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active packages" ON credit_packages
  FOR SELECT USING (auth.role() = 'authenticated' AND active = TRUE);

CREATE POLICY "Admin can manage packages" ON credit_packages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Trigger para atualizar `updated_at` na tabela de pacotes
CREATE TRIGGER update_credit_packages_updated_at
  BEFORE UPDATE ON credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RPC: Injeção de Créditos em Massa (Mutirão)
CREATE OR REPLACE FUNCTION grant_bulk_credits(p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET extra_credits = extra_credits + p_amount
  WHERE status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
