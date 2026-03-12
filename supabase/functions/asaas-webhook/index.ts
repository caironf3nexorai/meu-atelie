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

        // Verificar se é pagamento de créditos avulsos (externalReference = credits_<pkg_id>_<user_id>)
        const externalRef = payment.externalReference || ''
        const isCreditPurchase = typeof externalRef === 'string' && externalRef.startsWith('credits_')

        switch (event) {
            case 'PAYMENT_CONFIRMED':
            case 'PAYMENT_RECEIVED': {
                if (isCreditPurchase) {
                    // --- COMPRA DE CRÉDITOS AVULSOS ---
                    const parts = externalRef.split('_')
                    // formato: credits_<package_id>_<user_id>
                    const packageId = parts[1]
                    const creditUserId = parts[2]

                    console.log(`[webhook] Créditos detectados! Package: ${packageId}, User: ${creditUserId}`)

                    // Buscar pacote de créditos
                    const { data: pkg } = await supabase
                        .from('credit_packages')
                        .select('credit_amount, name')
                        .eq('id', packageId)
                        .single()

                    if (pkg && creditUserId) {
                        // Incrementar extra_credits
                        const { data: currentProfile } = await supabase
                            .from('profiles')
                            .select('extra_credits')
                            .eq('id', creditUserId)
                            .single()

                        const currentCredits = currentProfile?.extra_credits || 0
                        await supabase.from('profiles')
                            .update({ extra_credits: currentCredits + pkg.credit_amount })
                            .eq('id', creditUserId)

                        // Atualizar invoice como pago
                        await supabase.from('invoices')
                            .update({ status: 'paid', paid_at: new Date().toISOString() })
                            .eq('asaas_payment_id', payment.id)

                        // Notificação
                        await supabase.from('notificacoes').insert({
                            user_id: creditUserId,
                            titulo: '🎉 Créditos adicionados!',
                            mensagem: `Seu pacote "${pkg.name}" com ${pkg.credit_amount} criações foi ativado com sucesso!`,
                            tipo: 'success',
                            link: '/dashboard/loja'
                        })

                        console.log(`[webhook] +${pkg.credit_amount} créditos adicionados ao user ${creditUserId}`)
                    }
                } else {
                    // --- ASSINATURA PREMIUM (fluxo original) ---
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
                        tipo: 'success',
                        link: '/financeiro'
                    })
                }

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
                        tipo: 'warning',
                        link: '/dashboard/assinar'
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
