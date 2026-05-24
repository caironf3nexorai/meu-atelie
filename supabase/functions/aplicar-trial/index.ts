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

        // Use service_role to bypass RLS for campaign_config updates
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get user token
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing authorization header')
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        
        if (authError || !user) throw new Error('Invalid token')

        const { partner_id } = await req.json()

        // 1. Check if user already had trial
        const { data: profile } = await supabase
            .from('profiles')
            .select('had_trial')
            .eq('id', user.id)
            .single()

        if (profile?.had_trial) {
            return new Response(
                JSON.stringify({ success: false, error: 'Você já utilizou o período de teste gratuito.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Fetch campaign config
        const { data: campaignConfig } = await supabase
            .from('campaign_config')
            .select('*')
            .limit(1)
            .single()

        if (!campaignConfig) throw new Error('Campaign config not found')

        let isPartnerTrial = !!partner_id;

        // 3. Check limits
        if (isPartnerTrial) {
            if (campaignConfig.partner_trial_used >= campaignConfig.partner_trial_limit) {
                return new Response(
                    JSON.stringify({ success: false, error: 'As vagas de teste gratuito para parceiras estão esgotadas.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        } else {
            if (campaignConfig.general_trial_used >= campaignConfig.general_trial_limit) {
                return new Response(
                    JSON.stringify({ success: false, error: 'As vagas de teste gratuito geral estão esgotadas.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 4. Update campaign limits
        if (isPartnerTrial) {
            await supabase.from('campaign_config')
                .update({ partner_trial_used: campaignConfig.partner_trial_used + 1 })
                .eq('id', campaignConfig.id)
        } else {
            await supabase.from('campaign_config')
                .update({ general_trial_used: campaignConfig.general_trial_used + 1 })
                .eq('id', campaignConfig.id)
        }

        // 5. Update user profile to premium for 15 days
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 15);

        await supabase.from('profiles')
            .update({
                plan: 'premium',
                had_trial: true,
                trial_starts_at: new Date().toISOString(),
                trial_expires_at: trialExpiresAt.toISOString(),
                premium_starts_at: new Date().toISOString(),
                premium_expires_at: trialExpiresAt.toISOString(),
            })
            .eq('id', user.id)

        // 6. Link referral if partner_id is provided
        if (isPartnerTrial) {
            await supabase.from('referrals').insert({
                referrer_id: partner_id,
                referred_id: user.id
            });
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Teste gratuito ativado com sucesso!' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: any) {
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
