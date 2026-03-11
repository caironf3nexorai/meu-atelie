import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { user_id } = await req.json()

        if (!user_id) {
            return new Response(JSON.stringify({ error: 'ID de Usuário Faltante' }), { status: 400, headers: corsHeaders })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('asaas_subscription_id, plan, premium_expires_at')
            .eq('id', user_id)
            .single()

        if (!profile || !profile.asaas_subscription_id) {
            throw new Error('Assinatura não encontrada para este usuário.')
        }

        const ASAAS_KEY = Deno.env.get('ASAAS_API_KEY')
        const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL')

        // Disparar cancelamento real no endpoint Asaas
        const asaasReq = await fetch(`${ASAAS_URL}/subscriptions/${profile.asaas_subscription_id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_KEY!
            }
        })

        const cancelResult = await asaasReq.json()

        if (cancelResult.errors) {
            throw new Error('Falha contatando a financiadora: ' + JSON.stringify(cancelResult.errors))
        }

        // Mesmo que o Asaas lance O Webhook de inativação, apenas desvinculamos
        // o ID de assinatura e apagamos faturas futuras. O acesso é mantido até acabar.
        await supabase
            .from('profiles')
            .update({ asaas_subscription_id: null })
            .eq('id', user_id)

        // Notificar sucesso do Cancelamento mas informando a retenção:
        const expDate = profile.premium_expires_at
            ? new Date(profile.premium_expires_at).toLocaleDateString('pt-BR')
            : 'sua data de vencimento';

        await supabase.from('notifications').insert({
            user_id,
            title: '😢 Assinatura Cancelada',
            message: `O cancelamento ocorreu com sucesso e não haverá novas cobranças. Seu acesso Premium continua ativo até ${expDate}. Após essa data, seu plano voltará para o gratuito.`,
            type: 'info'
        })

        return new Response(JSON.stringify({ success: true }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
