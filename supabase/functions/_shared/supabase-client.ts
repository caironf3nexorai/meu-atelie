import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cliente admin com SERVICE_ROLE_KEY — acesso total ignorando RLS
export const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Função que cria cliente autenticado com o JWT do usuário
export const supabaseClient = (authHeader: string) =>
    createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: {
                headers: { Authorization: authHeader }
            }
        }
    )
