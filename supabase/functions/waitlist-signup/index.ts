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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Circuit Breaker — verificar se emails estão bloqueados
    const cb = await checkCircuitBreaker(supabase, 'envio_email')
    if (cb.bloqueado) {
      // Salvar no banco mesmo assim (só bloqueia o email)
      const { name, email } = await req.json()
      if (name && email) {
        await supabase.from('waitlist').upsert({ name, email }, { onConflict: 'email' })
      }
      return new Response(JSON.stringify({
        success: true,
        aviso: 'Cadastro salvo, mas envio de email temporariamente pausado.'
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verificar limite de emails do mês
    const limiteEmail = await verificarLimiteEmails(supabase)
    const emailBloqueado = limiteEmail.bloqueado

    const { name, email } = await req.json()

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Nome e email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Salvar no banco — ignorar se email já existe
    const { error: dbError } = await supabase
      .from('waitlist')
      .upsert({ name, email }, { onConflict: 'email' })

    if (dbError) throw dbError

    // Enviar email de confirmação via Resend (se não bloqueado)
    if (!emailBloqueado) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
        },
        body: JSON.stringify({
          from: 'Meu Ateliê <ola@meuateliegestao.com>',
          to: email,
          subject: '🎉 Você está na lista! Meu Ateliê',
          html: `
            <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; background: #F2E9DB;">
              <h1 style="color: #AC5148; font-size: 28px; margin-bottom: 8px;">Oi, ${name}! 🧵</h1>
              <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6;">
                Você está na lista de espera do <strong>Meu Ateliê</strong> — a plataforma de IA feita para bordadeiras e bordadeiros.
              </p>
              <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6;">
                Em breve você receberá um email exclusivo com acesso antecipado e uma condição especial de fundadora.
              </p>
              <div style="background: #AC5148; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                <p style="color: white; font-size: 18px; margin: 0; font-weight: bold;">
                  🎁 Oferta de fundadora<br/>
                  <span style="font-size: 14px; font-weight: normal;">R$77/mês vitalício para as primeiras 30 assinantes</span>
                </p>
              </div>
              <p style="color: #6B6B6B; font-size: 14px;">
                Enquanto isso, compartilhe com outras bordadeiras e amigas — quanto mais gente, mais rápido abrimos! 🌸
              </p>
              <p style="color: #AC5148; font-size: 14px;">
                Com carinho,<br/>
                <strong>Equipe Meu Ateliê</strong>
              </p>
            </div>
          `
        })
      })

      if (resendRes.ok) {
        // Incrementar contador de emails enviados
        await incrementarEmail(supabase, 1)
      } else {
        console.error('Resend error:', await resendRes.text())
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('ERRO WAITLIST:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
