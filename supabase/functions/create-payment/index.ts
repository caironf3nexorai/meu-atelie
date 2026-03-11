import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseClient } from "../_shared/supabase-client.ts";
import { PaymentRequest } from "../_shared/types.ts";

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        // 1. Verificar JWT → extrair user_id
        const { data: { user }, error: userError } = await supabaseClient(authHeader).auth.getUser();
        if (userError || !user) throw new Error('Unauthorized');
        const userId = user.id;

        const { paymentMethod, cardData } = await req.json() as PaymentRequest;

        // 2. Verificar profile e premium ativo
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('plan, premium_expires_at')
            .eq('id', userId)
            .single();

        if (profile?.plan === 'premium') {
            const expiresAt = new Date(profile.premium_expires_at).getTime();
            if (expiresAt > Date.now()) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Usuário já possui premium ativo.'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
            }
        }

        // 3. Buscar plan_config
        const { data: planConfig } = await supabaseAdmin
            .from('plan_config')
            .select('id, premium_price_brl')
            .single();

        if (!planConfig) throw new Error('Configuração de plano não encontrada.');

        // 4. Inserir em payments como pending
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                user_id: userId,
                plan_config_id: planConfig.id,
                amount_brl: planConfig.premium_price_brl,
                status: 'pending',
                payment_method: paymentMethod
            })
            .select('id')
            .single();

        if (paymentError || !payment) throw new Error('Erro ao registrar pagamento.');

        // 5. [PLACEHOLDER] Chamar API da operadora de pagamento
        // Simulação do comportamento:
        console.log(`[SIMULAÇÃO] Iniciando pagamento via ${paymentMethod} no valor de R$ ${planConfig.premium_price_brl} (ID: ${payment.id})`);

        // Se a operadora aprovar o fluxo de cartão síncrono imediatamente:
        if (paymentMethod === 'credit_card') {
            const simulatedGatewayTxId = `sim_cc_${Date.now()}`;

            // Update com gateway infos placeholder
            await supabaseAdmin.from('payments').update({
                gateway_transaction_id: simulatedGatewayTxId,
                gateway_response: { note: 'Mocked CC payment for dev' }
            }).eq('id', payment.id);

            // Aprovar imediatamente para fins de desenvolvimento
            await supabaseAdmin.rpc('activate_premium', {
                p_user_id: userId,
                p_payment_id: payment.id,
                p_duration_months: 12
            });

            return new Response(JSON.stringify({
                success: true,
                paymentId: payment.id,
                status: 'approved'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else if (paymentMethod === 'pix') {
            // Retornar um payload mock de PIX aguardando webhook
            const mockPixData = {
                qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', // Imagem invalida basica (1x1px)
                pixKey: '00020126480014br.gov.bcb.pix0114+5511999999999...mock',
                gatewayTxId: `sim_pix_${Date.now()}`
            };

            await supabaseAdmin.from('payments').update({
                gateway_transaction_id: mockPixData.gatewayTxId,
                gateway_response: { note: 'Mocked PIX payment for dev' }
            }).eq('id', payment.id);

            return new Response(JSON.stringify({
                success: true,
                paymentId: payment.id,
                status: 'pending',
                pixQrCode: mockPixData.qrCode,
                pixKey: mockPixData.pixKey
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        throw new Error('Método de pagamento inválido.');

    } catch (err: any) {
        console.error('Erro geral no Edge Function:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
