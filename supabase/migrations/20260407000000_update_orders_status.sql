-- Alterando a coluna status da tabela orders para TEXT puro,
-- removendo restrições de ENUM ou CHECK para dar total liberdade ao frontend.

DO $$ 
BEGIN 
    -- 1. Se houver alguma constraint do tipo CHECK na coluna, vamos derrubar.
    -- O nome normalmente é orders_status_check ou parecido, mas tentaremos os mais comuns.
    ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_status_check1;
    
    -- 2. Alterar o tipo da coluna para TEXT definitivamente
    -- Isso lida automagicamente caso a coluna atual fosse um ENUM customizado.
    ALTER TABLE public.orders ALTER COLUMN status TYPE TEXT USING status::text;
    
    -- 3. Definir um valor padrão seguro
    ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'em_aberto'::text;
END $$;
