import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    // Substituir a validação temporariamente por log:
    const allHeaders: Record<string, string> = {}
    req.headers.forEach((value, key) => { allHeaders[key] = value })
    console.log('HEADERS RECEBIDOS:', JSON.stringify(allHeaders))

    // Comentar o bloco de rejeição temporariamente:
    // if (!asaasToken || asaasToken !== expectedToken) {
    //     return new Response('Unauthorized Webhook Access', { status: 401 })
    // }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    try {
        const body = await req.json()
        const event = body.event
        const payment = body.payment

        if (!payment?.customer) {
            return new Response('OK', { status: 200 })
        }

        // Buscar usuário pelo asaas_customer_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('asaas_customer_id', payment.customer)
            .single()

        if (!profile) {
            return new Response('OK', { status: 200 })
        }

        const userId = profile.id

        switch (event) {
            case 'PAYMENT_CONFIRMED':
            case 'PAYMENT_RECEIVED': {
                await supabase.from('profiles').update({
                    plan: 'premium',
                    premium_starts_at: new Date().toISOString(),
                    premium_expires_at: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString()
                }).eq('id', userId)

                // Inserir fatura
                await supabase.from('invoices').insert({
                    user_id: userId,
                    asaas_payment_id: payment.id,
                    value: payment.value,
                    status: 'paid',
                    paid_at: new Date().toISOString()
                })

                await supabase.from('notificacoes').insert({
                    user_id: userId,
                    titulo: '✅ Pagamento confirmado!',
                    mensagem: 'Seu plano Premium foi ativado. Aproveite todas as funcionalidades!',
                    tipo: 'success'
                })

                break
            }

            case 'PAYMENT_OVERDUE': {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('premium_expires_at')
                    .eq('id', userId)
                    .single()

                const expirou = !prof?.premium_expires_at ||
                    new Date() > new Date(prof.premium_expires_at)

                if (expirou) {
                    await supabase.from('profiles').update({
                        plan: 'free',
                        asaas_subscription_id: null,
                        premium_expires_at: null
                    }).eq('id', userId)

                    await supabase.from('notificacoes').insert({
                        user_id: userId,
                        titulo: '⚠️ Pagamento não identificado',
                        mensagem: 'Não identificamos seu pagamento. Seu plano foi alterado para Free. Renove para continuar com acesso Premium.',
                        tipo: 'warning'
                    })
                }
                break
            }

            case 'SUBSCRIPTION_INACTIVATED':
            case 'PAYMENT_REFUNDED': {
                await supabase.from('profiles').update({
                    plan: 'free',
                    asaas_subscription_id: null,
                    premium_expires_at: null,
                    premium_starts_at: null
                }).eq('id', userId)

                break
            }
        }

        return new Response('OK', { status: 200 })
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal Error' }), { status: 500 })
    }
})
