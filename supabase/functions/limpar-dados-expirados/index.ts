// supabase/functions/limpar-dados-expirados/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const resultado = {
    artes_expiradas: 0,
    notificacoes_antigas: 0,
    orcamento_arquivos_antigos: 0,
    storage_liberado_mb: 0,
    executado_em: new Date().toISOString()
  }

  // ─── 1. LIMPAR ARTES EXPIRADAS (7 dias) ───────────────────────
  const { data: artesExpiradas } = await supabase
    .from('aprovacao_arte')
    .select('id, arquivo_url')
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'pendente')

  if (artesExpiradas && artesExpiradas.length > 0) {
    // Deletar arquivos do storage
    for (const arte of artesExpiradas) {
      try {
        // Extrair path do arquivo da URL pública
        const url = new URL(arte.arquivo_url)
        const path = url.pathname.split('/atelie-assets/')[1]
        if (path) {
          const { data } = await supabase.storage
            .from('atelie-assets')
            .remove([path])
          if (data) resultado.storage_liberado_mb += 0.5 // estimativa
        }
      } catch (e) {
        console.error('Erro ao deletar arquivo de arte:', e)
      }
    }

    // Deletar registros do banco
    const { count } = await supabase
      .from('aprovacao_arte')
      .delete({ count: 'exact' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'pendente')

    resultado.artes_expiradas = count || 0
  }

  // ─── 2. LIMPAR NOTIFICAÇÕES ANTIGAS (30 dias se lidas, 90 dias se não lidas) ───
  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

  const noventaDiasAtras = new Date()
  noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90)

  // Notificações lidas com mais de 30 dias
  const { count: count1 } = await supabase
    .from('notificacoes')
    .delete({ count: 'exact' })
    .eq('lida', true)
    .lt('created_at', trintaDiasAtras.toISOString())

  // Notificações não lidas com mais de 90 dias
  const { count: count2 } = await supabase
    .from('notificacoes')
    .delete({ count: 'exact' })
    .eq('lida', false)
    .lt('created_at', noventaDiasAtras.toISOString())

  resultado.notificacoes_antigas = (count1 || 0) + (count2 || 0)

  // ─── 3. LIMPAR ARQUIVOS DE ORÇAMENTOS FINALIZADOS (60 dias após conclusão) ───
  const sessentaDiasAtras = new Date()
  sessentaDiasAtras.setDate(sessentaDiasAtras.getDate() - 60)

  // Buscar arquivos de orçamentos antigos finalizados
  const { data: arquivosAntigos } = await supabase
    .from('orcamento_arquivos')
    .select(`
      id,
      url,
      orcamento_id,
      orcamentos!inner(status, created_at)
    `)
    .in('orcamentos.status', ['aceito', 'recusado'])
    .lt('orcamentos.created_at', sessentaDiasAtras.toISOString())
    .eq('enviado_por', 'cliente') // só arquivos enviados pelo cliente

  if (arquivosAntigos && arquivosAntigos.length > 0) {
    for (const arquivo of arquivosAntigos) {
      try {
        const url = new URL(arquivo.url)
        const path = url.pathname.split('/atelie-assets/')[1]
        if (path) {
          await supabase.storage.from('atelie-assets').remove([path])
          resultado.storage_liberado_mb += 0.3
        }
      } catch (e) {
        console.error('Erro ao deletar arquivo de orçamento:', e)
      }
    }

    const ids = arquivosAntigos.map((a: any) => a.id)
    const { count } = await supabase
      .from('orcamento_arquivos')
      .delete({ count: 'exact' })
      .in('id', ids)

    resultado.orcamento_arquivos_antigos = count || 0
  }

  // ─── 4. REGISTRAR LOG NO BANCO ───────────────────────────────
  const totalDeletados = resultado.artes_expiradas +
    resultado.notificacoes_antigas +
    resultado.orcamento_arquivos_antigos

  if (totalDeletados > 0) {
    await supabase.from('log_limpeza').insert([
      {
        tipo: 'artes_expiradas',
        registros_deletados: resultado.artes_expiradas,
        storage_liberado_mb: resultado.storage_liberado_mb * 0.5
      },
      {
        tipo: 'notificacoes',
        registros_deletados: resultado.notificacoes_antigas,
        storage_liberado_mb: 0
      },
      {
        tipo: 'orcamento_arquivos',
        registros_deletados: resultado.orcamento_arquivos_antigos,
        storage_liberado_mb: resultado.storage_liberado_mb * 0.5
      }
    ])
  }

  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
