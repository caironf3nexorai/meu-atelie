-- ==========================================
-- SCRIPT PARA RESTAURAR POLÍTICAS RLS (Row Level Security)
-- ==========================================
-- Execute este script no SQL Editor do Supabase para recriar todas as políticas
-- de segurança que foram perdidas após a recriação das tabelas.

-- 1. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can perform all actions on profiles" ON public.profiles;
CREATE POLICY "Admins can perform all actions on profiles" ON public.profiles USING (public.is_admin());

-- 2. PLAN CONFIG (Configurações da Plataforma)
ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can view plan config" ON public.plan_config;
CREATE POLICY "Anyone authenticated can view plan config" ON public.plan_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can fully manage plan config" ON public.plan_config;
CREATE POLICY "Admins can fully manage plan config" ON public.plan_config USING (public.is_admin());

-- 3. CLIENTES
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- 4. ORÇAMENTOS / PEDIDOS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;
CREATE POLICY "Users can delete their own orders" ON public.orders FOR DELETE USING (auth.uid() = user_id);

-- 5. MATERIAIS DOS PEDIDOS
ALTER TABLE public.order_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert order materials on own orders" ON public.order_materials;
CREATE POLICY "Users can insert order materials on own orders" ON public.order_materials FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_materials.order_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view order materials on own orders" ON public.order_materials;
CREATE POLICY "Users can view order materials on own orders" ON public.order_materials FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_materials.order_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update order materials on own orders" ON public.order_materials;
CREATE POLICY "Users can update order materials on own orders" ON public.order_materials FOR UPDATE USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_materials.order_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete order materials on own orders" ON public.order_materials;
CREATE POLICY "Users can delete order materials on own orders" ON public.order_materials FOR DELETE USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_materials.order_id AND user_id = auth.uid()));

-- 6. ESTOQUE
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own inventory items" ON public.inventory_items;
CREATE POLICY "Users can insert their own inventory items" ON public.inventory_items FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own inventory items" ON public.inventory_items;
CREATE POLICY "Users can view their own inventory items" ON public.inventory_items FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own inventory items" ON public.inventory_items;
CREATE POLICY "Users can update their own inventory items" ON public.inventory_items FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own inventory items" ON public.inventory_items;
CREATE POLICY "Users can delete their own inventory items" ON public.inventory_items FOR DELETE USING (auth.uid() = user_id);

-- 7. MOVIMENTAÇÕES DE ESTOQUE
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can insert their own inventory movements" ON public.inventory_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can view their own inventory movements" ON public.inventory_movements FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can update their own inventory movements" ON public.inventory_movements FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can delete their own inventory movements" ON public.inventory_movements FOR DELETE USING (auth.uid() = user_id);

-- 8. CRONÔMETRO (Sessões de tempo)
ALTER TABLE public.time_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own time sessions" ON public.time_sessions;
CREATE POLICY "Users can insert their own time sessions" ON public.time_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own time sessions" ON public.time_sessions;
CREATE POLICY "Users can view their own time sessions" ON public.time_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own time sessions" ON public.time_sessions;
CREATE POLICY "Users can update their own time sessions" ON public.time_sessions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own time sessions" ON public.time_sessions;
CREATE POLICY "Users can delete their own time sessions" ON public.time_sessions FOR DELETE USING (auth.uid() = user_id);

-- 9. PAGAMENTOS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (public.is_admin());

-- 10. GERAÇÕES
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own generations" ON public.generations;
CREATE POLICY "Users can view own generations" ON public.generations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;
CREATE POLICY "Users can insert own generations" ON public.generations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own generations" ON public.generations;
CREATE POLICY "Users can update own generations" ON public.generations FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all generations" ON public.generations;
CREATE POLICY "Admins can view all generations" ON public.generations FOR SELECT USING (public.is_admin());

-- 11. REGISTROS FINANCEIROS
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can fully manage own financial records" ON public.financial_records;
CREATE POLICY "Users can fully manage own financial records" ON public.financial_records USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all financial records" ON public.financial_records;
CREATE POLICY "Admins can view all financial records" ON public.financial_records FOR SELECT USING (public.is_admin());

-- 12. PRECIFICAÇÕES
ALTER TABLE public.pricing_calculations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can fully manage own pricing calculations" ON public.pricing_calculations;
CREATE POLICY "Users can fully manage own pricing calculations" ON public.pricing_calculations USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all pricing calculations" ON public.pricing_calculations;
CREATE POLICY "Admins can view all pricing calculations" ON public.pricing_calculations FOR SELECT USING (public.is_admin());

-- 13. CONVERSAS (ESTRATÉGIA)
ALTER TABLE public.strategy_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can fully manage own strategy conversations" ON public.strategy_conversations;
CREATE POLICY "Users can fully manage own strategy conversations" ON public.strategy_conversations USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all strategy conversations" ON public.strategy_conversations;
CREATE POLICY "Admins can view all strategy conversations" ON public.strategy_conversations FOR SELECT USING (public.is_admin());
