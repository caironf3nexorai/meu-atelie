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
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const ASAAS_KEY = Deno.env.get('ASAAS_API_KEY')
        const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL')

        if (!SUPABASE_URL || !SUPABASE_KEY || !ASAAS_KEY || !ASAAS_URL) {
            throw new Error('Variáveis de ambiente não configuradas')
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

        const body = await req.json()
        const { user_id, package_id, forma_pagamento, holder } = body

        console.log('[comprar-creditos] Dados recebidos:', { user_id, package_id, forma_pagamento })

        if (!user_id || !package_id || !forma_pagamento || !holder) {
            return new Response(JSON.stringify({ error: 'Faltam parâmetros obrigatórios (user_id, package_id, forma_pagamento, holder)' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. Buscar perfil do usuário
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user_id)
            .single()

        if (profileError || !profile) {
            throw new Error('Usuário não encontrado.')
        }

        // 2. Buscar pacote de créditos
        const { data: pkg, error: pkgError } = await supabase
            .from('credit_packages')
            .select('*')
            .eq('id', package_id)
            .eq('active', true)
            .single()

        if (pkgError || !pkg) {
            throw new Error('Pacote de créditos não encontrado ou inativo.')
        }

        console.log('[comprar-creditos] Pacote:', pkg.name, 'Valor:', pkg.price_brl, 'Créditos:', pkg.credit_amount)

        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_KEY
        }

        // 3. Criar ou reutilizar customer no Asaas
        let customerId = profile.asaas_customer_id

        if (!customerId) {
            console.log('[comprar-creditos] Criando cliente no Asaas...')
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

            if (customer.errors) {
                throw new Error('Erro ao criar cliente no Asaas: ' + JSON.stringify(customer.errors))
            }

            customerId = customer.id

            await supabase
                .from('profiles')
                .update({ asaas_customer_id: customerId })
                .eq('id', user_id)
        }

        // 4. Criar PAGAMENTO AVULSO (one-time) — NÃO é assinatura
        const dueDate = new Date().toISOString().split('T')[0]

        const paymentBody: any = {
            customer: customerId,
            billingType: forma_pagamento, // PIX ou BOLETO
            value: Number(pkg.price_brl),
            dueDate,
            description: `Pacote de Créditos: ${pkg.name} (${pkg.credit_amount} criações)`,
            externalReference: `credits_${package_id}_${user_id}` // Crucial para o webhook identificar
        }

        console.log('[comprar-creditos] Criando pagamento avulso no Asaas...', paymentBody)

        const paymentRes = await fetch(`${ASAAS_URL}/payments`, {
            method: 'POST',
            headers,
            body: JSON.stringify(paymentBody)
        })

        const payment = await paymentRes.json()
        console.log('[comprar-creditos] Resposta Asaas payment:', JSON.stringify(payment))

        if (payment.errors) {
            throw new Error('Erro ao criar pagamento: ' + JSON.stringify(payment.errors))
        }

        // 5. Buscar dados do Pix ou Boleto
        let pixData = null
        let boletoData = null

        if (forma_pagamento === 'PIX') {
            // Aguardar um pouco para o Asaas processar
            await new Promise(r => setTimeout(r, 1500))

            const pixRes = await fetch(
                `${ASAAS_URL}/payments/${payment.id}/pixQrCode`,
                { headers }
            )
            const pix = await pixRes.json()

            if (pix.success) {
                pixData = {
                    encodedImage: pix.encodedImage,
                    payload: pix.payload,
                    expirationDate: pix.expirationDate
                }
            } else {
                console.log('[comprar-creditos] Erro PIX QRCode:', JSON.stringify(pix))
            }
        }

        if (forma_pagamento === 'BOLETO') {
            boletoData = {
                bankSlipUrl: payment.bankSlipUrl,
                dueDate: payment.dueDate,
                identificationField: payment.identificationField
            }
        }

        // 6. Salvar referência do pagamento (opcional, para auditoria)
        await supabase.from('invoices').insert({
            user_id,
            asaas_payment_id: payment.id,
            value: Number(pkg.price_brl),
            status: 'pending',
            description: `Créditos: ${pkg.name} (${pkg.credit_amount})`
        }).then(res => {
            if (res.error) console.log('[comprar-creditos] Erro ao salvar invoice (não crítico):', res.error.message)
        })

        return new Response(JSON.stringify({
            success: true,
            payment_id: payment.id,
            forma_pagamento,
            pix: pixData,
            boleto: boletoData,
            package_name: pkg.name,
            credit_amount: pkg.credit_amount
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('[comprar-creditos] ERRO:', err.message)
        return new Response(
            JSON.stringify({ success: false, error: err.message || 'Erro interno' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
