-- Create financial_transactions table
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT CHECK (type IN ('receita', 'despesa')) NOT NULL,
  category TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" ON financial_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Create strategy_conversations table for Lia Strategy Chat
CREATE TABLE IF NOT EXISTS strategy_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE strategy_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat sessions" ON strategy_conversations
  FOR ALL USING (auth.uid() = user_id);
