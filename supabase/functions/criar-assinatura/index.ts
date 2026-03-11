import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers para permitir execução a partir do front-end
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // PRIMEIRA LINHA ABSOLUTA
    console.log('>>> ENTROU NA FUNÇÃO - método:', req.method, 'url:', req.url)

    if (req.method === 'OPTIONS') {
        console.log('>>> OPTIONS - retornando CORS')
        return new Response('ok', { headers: corsHeaders })
    }

    console.log('>>> PASSOU OPTIONS')

    try {
        console.log('>>> INICIANDO TRY')

        // Validar variáveis de ambiente ANTES de tudo
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const ASAAS_KEY = Deno.env.get('ASAAS_API_KEY')
        const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL')

        console.log('>>> ENV CHECK:', {
            hasSupabaseUrl: !!SUPABASE_URL,
            hasSupabaseKey: !!SUPABASE_KEY,
            hasAsaasKey: !!ASAAS_KEY,
            hasAsaasUrl: !!ASAAS_URL,
            asaasUrl: ASAAS_URL
        })

        if (!SUPABASE_URL || !SUPABASE_KEY) {
            throw new Error('Variáveis de ambiente do Supabase não configuradas')
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

        console.log('1. Iniciando função criar-assinatura')

        // Usar req.json() direto em vez de req.text() + JSON.parse
        const body = await req.json()
        console.log('>>> BODY:', JSON.stringify(body))

        const { user_id, forma_pagamento, card, holder, coupon_code } = body
        console.log('Dados recebidos do parser - user_id:', user_id, 'holder:', holder?.name)

        if (!user_id || !holder || (forma_pagamento === 'CREDIT_CARD' && !card)) {
            console.warn('Faltam parâmetros obrigatórios')
            return new Response(JSON.stringify({ error: 'Faltam parâmetros obrigatórios' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('3. Buscando perfil...')

        // 1. Buscar dados do usuário
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user_id)
            .single()

        if (profileError || !profile) {
            throw new Error('Usuário não encontrado.')
        }
        console.log('4. Profile encontrado:', profile?.id)

        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_KEY!
        }

        // 2. Criar ou reutilizar cliente no Asaas
        let customerId = profile.asaas_customer_id

        if (!customerId) {
            console.log('5. Criando cliente Asaas...')
            const customerRes = await fetch(`${ASAAS_URL}/customers`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: holder.name,
                    email: profile.email,
                    cpfCnpj: holder.cpf.replace(/\D/g, ''),
                    phone: holder.phone.replace(/\D/g, ''),
                    postalCode: holder.cep.replace(/\D/g, ''),
                    addressNumber: holder.addressNumber
                })
            })
            const customer = await customerRes.json()
            console.log('6. Resposta Asaas customer:', JSON.stringify(customer))

            if (customer.errors) {
                throw new Error('Erro ao criar cliente no Asaas: ' + JSON.stringify(customer.errors))
            }

            customerId = customer.id

            await supabase
                .from('profiles')
                .update({ asaas_customer_id: customerId })
                .eq('id', user_id)
        }

        // 3. Criar assinatura recorrente mensal
        console.log('7. Criando assinatura...')
        const today = new Date().toISOString().split('T')[0]

        // Buscar valor do plano configurado
        const { data: configData } = await supabase.from('plan_config').select('premium_price_brl').maybeSingle()
        let premiumValue = configData?.premium_price_brl ?? 97.00

        // Verificar cupom se informado
        let couponId = null
        if (coupon_code) {
            const { data: coupon } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', coupon_code.toUpperCase())
                .eq('active', true)
                .single()

            if (coupon && coupon.current_uses < coupon.max_uses) {
                premiumValue = coupon.discount_value
                couponId = coupon.id
            }
        }

        let subscriptionBody: any = {
            customer: customerId,
            billingType: forma_pagamento || 'CREDIT_CARD',
            value: premiumValue,
            nextDueDate: today,
            cycle: 'MONTHLY',
            description: 'Meu Ateliê Premium',
        }

        if (subscriptionBody.billingType === 'CREDIT_CARD') {
            subscriptionBody.creditCard = {
                holderName: card.holderName,
                number: card.number.replace(/\s/g, ''),
                expiryMonth: card.expiryMonth,
                expiryYear: card.expiryYear,
                ccv: card.ccv
            }
            subscriptionBody.creditCardHolderInfo = {
                name: holder.name,
                email: profile.email,
                cpfCnpj: holder.cpf.replace(/\D/g, ''),
                postalCode: holder.cep.replace(/\D/g, ''),
                addressNumber: holder.addressNumber,
                phone: holder.phone.replace(/\D/g, '')
            }
        }

        const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(subscriptionBody)
        })

        const subscription = await subRes.json()
        console.log('8. Resposta Asaas subscription:', JSON.stringify(subscription))
        console.log('Subscription criada:', subscription.id, subscription.status)

        if (subscription.errors || subscription.status === 'DECLINED') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Cartão recusado ou inválido. Verifique os dados e tente novamente.'
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Para Pix e Boleto — buscar dados do primeiro pagamento
        let pixData = null
        let boletoData = null

        if (subscriptionBody.billingType === 'PIX' || subscriptionBody.billingType === 'BOLETO') {
            await new Promise(r => setTimeout(r, 2000)) // aguardar Asaas processar

            const paymentsRes = await fetch(
                `${ASAAS_URL}/payments?subscription=${subscription.id}&status=PENDING`,
                { headers }
            )
            const payments = await paymentsRes.json()
            const payment = payments.data?.[0]

            if (payment && subscriptionBody.billingType === 'PIX') {
                const pixRes = await fetch(
                    `${ASAAS_URL}/payments/${payment.id}/pixQrCode`,
                    { headers }
                )
                const pix = await pixRes.json()
                pixData = {
                    encodedImage: pix.encodedImage, // QR Code base64
                    payload: pix.payload,           // Pix copia-e-cola
                    expirationDate: pix.expirationDate
                }
            }

            if (payment && subscriptionBody.billingType === 'BOLETO') {
                boletoData = {
                    bankSlipUrl: payment.bankSlipUrl,  // Link do boleto
                    dueDate: payment.dueDate,
                    identificationField: payment.identificationField // código de barras
                }
            }

            await supabase.from('profiles').update({
                asaas_subscription_id: subscription.id,
                asaas_customer_id: customerId,
                plan: 'free', // mantém free até confirmação do webhook
                pending_payment_method: subscriptionBody.billingType
            }).eq('id', user_id)

        } else {
            // Cartão — ativar Premium imediatamente
            const now = new Date()
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 30)

            await supabase
                .from('profiles')
                .update({
                    plan: 'premium',
                    asaas_subscription_id: subscription.id,
                    premium_starts_at: now.toISOString(),
                    premium_expires_at: expiresAt.toISOString()
                })
                .eq('id', user_id)

            await supabase.from('notifications').insert({
                user_id,
                title: '🎉 Bem-vinda ao Premium!',
                message: 'Suas funções avançadas e todos os módulos de gestão já estão disponíveis.',
                type: 'success'
            })
        }

        // Após assinatura criada com sucesso, incrementar uso do cupom se foi usado um válido
        if (couponId) {
            await supabase.rpc('increment_coupon_use', { coupon_id: couponId })
        }

        return new Response(JSON.stringify({
            success: true,
            subscription_id: subscription.id,
            forma_pagamento: subscriptionBody.billingType,
            pix: pixData,
            boleto: boletoData
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('ERRO CRIAR-ASSINATURA:', JSON.stringify(err, null, 2), err.message)
        return new Response(
            JSON.stringify({ success: false, error: err.message || 'Erro interno' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
