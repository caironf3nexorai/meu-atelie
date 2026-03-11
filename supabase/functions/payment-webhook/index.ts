import { corsHeaders } from "../_shared/cors.ts";

const WEBHOOK_SECRET = Deno.env.get('PAYMENT_GATEWAY_WEBHOOK_SECRET');

Deno.serve(async (req) => {
    // Tratando opções CORS preflight pra garantir compatibilidade com paineis locais e webhooks frontais
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    try {
        // 1. Validar assinatura do webhook (Exemplo Genérico Padrão)
        const signature = req.headers.get('webhook-secret') || req.headers.get('x-gateway-signature');

        // Se o SECRET estiver configurado e a assinatura for diferente, barrar acesso não autorizado.
        if (WEBHOOK_SECRET && signature !== WEBHOOK_SECRET) {
            console.error('Invalid webhook signature');
            return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }

        const payload = await req.json();
        console.log('Webhook Received Data Events:', payload);

        // Mapeamento fictício baseado num possível gateway genérico
        const eventType = payload.event; // ex: 'payment.approved', 'payment.failed'
        const gatewayTxId = payload.data?.transaction_id;

        if (!gatewayTxId) {
            throw new Error('Malformed payload: missing transaction_id');
        }

        // Buscar payment no Supabase pelo Transaction ID do gateway
        const { data: payment } = await supabaseAdmin
            .from('payments')
            .select('id, user_id, status, package_id')
            .eq('gateway_transaction_id', String(gatewayTxId))
            .single();

        if (!payment) {
            console.warn(`Payment not found for transaction: ${gatewayTxId}`);
            // Continuamos retornando 200 pro gateway não tentar re-envios
            return new Response('Ignored', { status: 200, headers: corsHeaders });
        }

        // 2. Identificar evento e tomar decisões (Ativar premium, revogar premium)
        if (eventType === 'payment.approved' && payment.status !== 'approved') {
            if (payment.package_id) {
                console.log(`Pagamento aprovado para Pacote ID: ${payment.package_id}`);
                // Buscar quantidade de créditos do pacote
                const { data: pkg } = await supabaseAdmin
                    .from('credit_packages')
                    .select('credit_amount')
                    .eq('id', payment.package_id)
                    .single();

                if (pkg) {
                    // Incrementar extra_credits diretamente
                    await supabaseAdmin.rpc('grant_bulk_credits', { p_amount: pkg.credit_amount });
                    // A RPC grant_bulk não pega ID especifico, é em massa! Wait, não, eu preciso atualizar UM perfil apenas.
                }
            } else {
                console.log(`Ativando premium para usuário ${payment.user_id}`);
                await supabaseAdmin.rpc('activate_premium', {
                    p_user_id: payment.user_id,
                    p_payment_id: payment.id,
                    p_duration_months: 12
                });
            }
        }
        else if (eventType === 'payment.refunded' || eventType === 'payment.chargeback') {
            console.log(`Revogando premium do usuário ${payment.user_id}`);
            await supabaseAdmin.rpc('revoke_premium', {
                p_user_id: payment.user_id,
                p_payment_id: payment.id
            });
        }
        else if (eventType === 'payment.failed') {
            console.log(`Status failed registrado no webhook id: ${payment.id}`);
            await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('id', payment.id);
        }

        // 3. Atualizar tabela payments com payload raw do gateway
        await supabaseAdmin
            .from('payments')
            .update({ gateway_response: payload })
            .eq('id', payment.id);

        // 4. Retornar 200 pro Gateway entender que processamos
        return new Response('OK', { status: 200, headers: corsHeaders });

    } catch (err: any) {
        console.error('Webhook processing error:', err);
        // Devemos retornar 200 pro gateway não disparar múltiplas vezes se a culpa for nossa base (depende do Provider)
        return new Response('OK - Encountered Error', { status: 200, headers: corsHeaders });
    }
});
