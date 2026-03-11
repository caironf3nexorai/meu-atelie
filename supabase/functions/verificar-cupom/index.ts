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
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase environment variables missing.')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { code } = await req.json()

        if (!code) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Código não informado' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { data: coupon, error: couponError } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('active', true)
            .single()

        if (couponError || !coupon) {
            return new Response(
                JSON.stringify({ valid: false, error: 'Cupom inválido ou expirado' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (coupon.current_uses >= coupon.max_uses) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    esgotado: true,
                    error: `Esse benefício já foi resgatado pelas ${coupon.max_uses} primeiras fundadoras. Você ainda pode assinar por R$97/mês!`
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                valid: true,
                discount_value: coupon.discount_value,
                remaining: coupon.max_uses - coupon.current_uses,
                message: `🎉 Cupom aplicado! Apenas ${coupon.max_uses - coupon.current_uses} vagas restantes.`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: any) {
        return new Response(
            JSON.stringify({ valid: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
