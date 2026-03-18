import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') // Precisa de permissão total para deletar

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase variables missing')
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar artes expiradas
        const { data: artes, error: fetchError } = await supabase
            .from('aprovacao_arte')
            .select('*')
            .lt('expires_at', new Date().toISOString())

        if (fetchError) throw fetchError

        if (!artes || artes.length === 0) {
            return new Response(JSON.stringify({ message: 'Nenhuma arte expirada encontrada' }), {
                headers: { 'Content-Type': 'application/json' },
            })
        }

        console.log(`Encontradas ${artes.length} artes expiradas para limpeza.`)

        let deletedCount = 0

        for (const arte of artes) {
            try {
                // Tenta extrair o path do bucket 'atelie-assets' pela URL pública
                // Exemplo: https://[project].supabase.co/storage/v1/object/public/atelie-assets/aprovacao-arte/[user_id]/[timestamp].[ext]
                const urlObj = new URL(arte.arquivo_url)
                const pathParts = urlObj.pathname.split('atelie-assets/')
                
                if (pathParts.length > 1) {
                    const filePath = pathParts[1]
                    
                    // 1. Deletar do storage
                    const { error: storageError } = await supabase.storage
                        .from('atelie-assets')
                        .remove([decodeURIComponent(filePath)])

                    if (storageError) {
                        console.error(`Erro ao deletar arquivo ${filePath}:`, storageError)
                    }
                }

                // 2. Deletar do banco de dados (mesmo se falhou no storage por já não existir)
                const { error: dbError } = await supabase
                    .from('aprovacao_arte')
                    .delete()
                    .eq('id', arte.id)

                if (dbError) throw dbError

                deletedCount++
                console.log(`Arte ${arte.id} removida.`)
            } catch (err) {
                console.error(`Falha ao limpar arte ${arte.id}:`, err)
            }
        }

        return new Response(JSON.stringify({ message: 'Limpeza concluída', deletedCount }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
