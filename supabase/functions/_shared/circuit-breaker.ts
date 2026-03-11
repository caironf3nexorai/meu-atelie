import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function checkCircuitBreaker(
    supabase: any,
    chave: string
): Promise<{ bloqueado: boolean; motivo?: string }> {
    const { data } = await supabase
        .from('circuit_breakers')
        .select('ativo, motivo')
        .eq('chave', chave)
        .single()

    if (data?.ativo) {
        return { bloqueado: true, motivo: data.motivo }
    }
    return { bloqueado: false }
}

export async function verificarLimiteEdgeFunctions(supabase: any): Promise<boolean> {
    const mes = new Date().toISOString().slice(0, 7)

    const { data: uso } = await supabase
        .from('uso_infraestrutura')
        .select('edge_functions_calls')
        .eq('mes', mes)
        .single()

    const { data: limite } = await supabase
        .from('config_limites')
        .select('valor_limite, valor_critico')
        .eq('chave', 'edge_functions_mes')
        .single()

    if (!uso || !limite) return true

    const percentual = (uso.edge_functions_calls / limite.valor_limite) * 100

    // Acima do % crítico — ativar circuit breaker automático nos geradores
    if (percentual >= limite.valor_critico) {
        await supabase.from('circuit_breakers').update({
            ativo: true,
            motivo: `Edge Functions em ${percentual.toFixed(0)}% do limite mensal`,
            ativado_em: new Date().toISOString()
        }).eq('chave', 'gerar_bordado')

        await supabase.from('circuit_breakers').update({
            ativo: true,
            motivo: `Edge Functions em ${percentual.toFixed(0)}% do limite mensal`,
            ativado_em: new Date().toISOString()
        }).eq('chave', 'gerar_risco')

        return false
    }

    return true
}

export async function verificarLimiteEmails(supabase: any): Promise<{ bloqueado: boolean; motivo?: string }> {
    const mes = new Date().toISOString().slice(0, 7)

    const { data: uso } = await supabase
        .from('uso_infraestrutura')
        .select('emails_enviados')
        .eq('mes', mes)
        .single()

    const { data: limite } = await supabase
        .from('config_limites')
        .select('valor_limite')
        .eq('chave', 'emails_mes')
        .single()

    if (uso && limite && uso.emails_enviados >= limite.valor_limite * 0.95) {
        // Ativar circuit breaker de email automaticamente
        await supabase.from('circuit_breakers').update({
            ativo: true,
            motivo: `${uso.emails_enviados} de ${limite.valor_limite} emails usados no mês`,
            ativado_em: new Date().toISOString()
        }).eq('chave', 'envio_email')

        return { bloqueado: true, motivo: `Limite de emails do mês atingido (${uso.emails_enviados}/${limite.valor_limite})` }
    }

    return { bloqueado: false }
}

export async function incrementarUso(supabase: any) {
    await supabase.rpc('increment_edge_call')
}

export async function incrementarEmail(supabase: any, quantidade: number = 1) {
    await supabase.rpc('increment_email_count', { quantidade })
}
