import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkCircuitBreaker, verificarLimiteEmails, incrementarEmail } from '../_shared/circuit-breaker.ts'

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
        const resendApiKey = Deno.env.get('RESEND_API_KEY')

        if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
            throw new Error('Supabase environment variables or Resend API key missing.')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Circuit Breaker — verificar se emails estão bloqueados
        const cb = await checkCircuitBreaker(supabase, 'envio_email')
        if (cb.bloqueado) {
            return new Response(JSON.stringify({
                error: 'emails_temporariamente_indisponiveis',
                mensagem: 'Envio de emails temporariamente pausado.',
                motivo: cb.motivo
            }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Verificar limite de emails do mês
        const limiteEmail = await verificarLimiteEmails(supabase)
        if (limiteEmail.bloqueado) {
            return new Response(JSON.stringify({
                error: 'limite_emails_atingido',
                mensagem: limiteEmail.motivo
            }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Verify authentication and admin rights
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Auth missing' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Fetch the waitlist
        const { data: waitlist, error: waitlistError } = await supabase
            .from('waitlist')
            .select('name, email')

        console.log('Waitlist count:', waitlist?.length)
        console.log('Waitlist error:', waitlistError)
        console.log('Waitlist data:', JSON.stringify(waitlist))

        if (waitlistError || !waitlist) {
            throw new Error('Failed to fetch waitlist: ' + waitlistError?.message)
        }

        let sentCount = 0

        // Enviar email para cada pessoa
        for (const person of waitlist) {
            const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
            const link = `${appUrl}/cadastro?cupom=FUNDADORA77`

            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendApiKey}`
                },
                body: JSON.stringify({
                    from: 'Meu Ateliê <ola@meuateliegestao.com>',
                    to: person.email,
                    subject: '🎉 Meu Ateliê está aberto! Sua vaga de fundadora te espera',
                    html: `
            <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #F2E9DB;">
              <h1 style="color: #AC5148; font-size: 28px;">Oi, ${person.name}! 🧵</h1>
              <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6;">
                O <strong>Meu Ateliê</strong> está oficialmente aberto! E como você entrou na lista de espera, tem direito à oferta exclusiva de fundadora.
              </p>
              
              <div style="background: #AC5148; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
                <p style="color: white; font-size: 14px; margin: 0 0 4px;">Oferta exclusiva de fundadora</p>
                <p style="color: #DED181; font-size: 36px; font-weight: bold; margin: 0;">R$77/mês</p>
                <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 4px 0 0;">para sempre</p>
              </div>

              <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6;">
                Corre! As vagas são extremamente limitadas e estão sendo preenchidas rápido.
              </p>

              <a href="${link}" style="display: block; background: #AC5148; color: white; text-align: center; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 18px; margin: 24px 0;">
                Garantir minha vaga de fundadora →
              </a>

              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                O desconto é aplicado automaticamente ao clicar no link acima ou digitando o código <b>FUNDADORA77</b> no Carrinho de Compra ao criar a conta.
              </p>

              <p style="color: #AC5148; font-size: 14px; margin-top: 32px;">
                Com carinho,<br/>
                <strong>Equipe Meu Ateliê</strong>
              </p>
            </div>
          `
                })
            })

            if (res.ok) {
                sentCount++
            } else {
                console.error('Failed to send email to', person.email, await res.text())
            }
        }

        // Registrar campanha
        await supabase.from('email_campaigns').insert({
            title: 'Email de inauguração',
            sent_count: sentCount,
            sent_by: user.id
        })

        // Incrementar contador de emails enviados
        if (sentCount > 0) {
            await incrementarEmail(supabase, sentCount)
        }

        return new Response(
            JSON.stringify({ success: true, sent_count: sentCount }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
