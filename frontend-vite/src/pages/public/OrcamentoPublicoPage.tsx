import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { format, addDays } from 'date-fns'
import { useModal } from '@/contexts/ModalContext'

function LoadingSpinner() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2E9DB' }}>
            <div className="font-ui text-text-light text-sm animate-pulse">Carregando Orçamento...</div>
        </div>
    )
}

export default function OrcamentoPublicoPage() {
    const { showAlert } = useModal()
    const { token } = useParams()
    const [orcamento, setOrcamento] = useState<any>(null)
    const [perfil, setPerfil] = useState<any>(null)
    const [itens, setItens] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState<'idle' | 'aprovando' | 'recusando' | 'concluido'>('idle')
    const [motivoRecusa, setMotivoRecusa] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [arquivos, setArquivos] = useState<any[]>([])
    const [uploadingArquivo, setUploadingArquivo] = useState(false)

    useEffect(() => {
        const fetchOrcamento = async () => {
            const { data: orc } = await supabase
                .from('orcamentos')
                .select('*')
                .eq('token_publico', token)
                .single()

            if (!orc) { setLoading(false); return }

            const { data: itensData } = await supabase
                .from('orcamento_itens')
                .select('*')
                .eq('orcamento_id', orc.id)

            const { data: perfilData } = await supabase
                .from('profiles')
                .select('full_name, atelie_nome, atelie_logo_url, atelie_whatsapp, atelie_email, atelie_instagram, atelie_cidade, atelie_estado')
                .eq('id', orc.user_id)
                .single()

            const { data: arquivosData } = await supabase
                .from('orcamento_arquivos')
                .select('*')
                .eq('orcamento_id', orc.id)

            setOrcamento(orc)
            setItens(itensData || [])
            setPerfil(perfilData)
            setArquivos(arquivosData || [])
            setLoading(false)
        }

        fetchOrcamento()
    }, [token])

    const handleAprovar = async () => {
        setStatus('aprovando')
        const { data, error } = await supabase
            .from('orcamentos')
            .update({
                status: 'aceito',
                aprovado_em: new Date().toISOString(),
                cliente_observacoes: observacoes || null
            })
            .eq('token_publico', token)
            .select()

        if (error) {
            console.error('Erro ao aprovar:', error)
            showAlert('Erro', 'Erro ao aprovar. Tente novamente.')
            setStatus('idle')
            return
        }

        // Verificar se realmente atualizou
        if (!data || data.length === 0) {
            showAlert('Erro', 'Não foi possível salvar a aprovação. Verifique sua conexão e tente novamente.')
            setStatus('idle')
            return
        }

        // Notificar artesã
        await supabase.from('notificacoes').insert({
            user_id: orcamento.user_id,
            titulo: '✅ Orçamento aprovado!',
            mensagem: `${orcamento.cliente_nome} aprovou o orçamento Nº ${String(orcamento.numero).padStart(3, '0')} — R$${Number(orcamento.total).toFixed(2)}`,
            tipo: 'success',
            link: '/dashboard/orcamentos'
        })

        setStatus('concluido')
        setOrcamento((prev: any) => ({ ...prev, status: 'aceito' }))
    }

    const handleRecusar = async () => {
        setStatus('recusando')
        const { data, error } = await supabase
            .from('orcamentos')
            .update({
                status: 'recusado',
                recusado_em: new Date().toISOString(),
                motivo_recusa: motivoRecusa || null
            })
            .eq('token_publico', token)
            .select()

        if (error) {
            console.error('Erro ao recusar:', error)
            showAlert('Erro', 'Erro ao recusar. Tente novamente.')
            setStatus('idle')
            return
        }

        if (!data || data.length === 0) {
            showAlert('Erro', 'Não foi possível salvar a recusa. Verifique sua conexão e tente novamente.')
            setStatus('idle')
            return
        }

        await supabase.from('notificacoes').insert({
            user_id: orcamento.user_id,
            titulo: '❌ Orçamento recusado',
            mensagem: `${orcamento.cliente_nome} recusou o orçamento Nº ${String(orcamento.numero).padStart(3, '0')}${motivoRecusa ? `: "${motivoRecusa}"` : ''}`,
            tipo: 'warning',
            link: '/dashboard/orcamentos'
        })

        setStatus('concluido')
        setOrcamento((prev: any) => ({ ...prev, status: 'recusado' }))
    }

    const handleUploadArquivo = async (file: File) => {
        if (!orcamento) return;
        setUploadingArquivo(true)
        const path = `orcamentos/${orcamento.id}/${Date.now()}_${file.name}`

        const { error } = await supabase.storage
            .from('atelie-assets')
            .upload(path, file)

        if (!error) {
            const { data } = supabase.storage.from('atelie-assets').getPublicUrl(path)
            await supabase.from('orcamento_arquivos').insert({
                orcamento_id: orcamento.id,
                nome: file.name,
                url: data.publicUrl,
                tipo: 'referencia',
                enviado_por: 'cliente'
            })
            setArquivos(prev => [...prev, { nome: file.name, url: data.publicUrl }])
            showAlert('Sucesso', 'Arquivo enviado com sucesso!')
        } else {
            showAlert('Atenção', 'Erro ao enviar arquivo. Verifique se o tamanho é menor que 5MB e tente novamente.')
        }
        setUploadingArquivo(false)
    }

    if (loading) return <LoadingSpinner />

    if (!orcamento) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2E9DB' }}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '48px' }}>🔍</p>
                <h2 style={{ color: '#AC5148' }}>Orçamento não encontrado</h2>
                <p style={{ color: '#6B6B6B' }}>Este link pode ter expirado ou sido removido.</p>
            </div>
        </div>
    )

    const isExpirado = new Date() > addDays(new Date(orcamento.created_at), orcamento.validade_dias || 7)
    const jaRespondido = orcamento.status === 'aceito' || orcamento.status === 'recusado'

    return (
        <div style={{ minHeight: '100vh', background: '#F2E9DB', fontFamily: 'Nunito, sans-serif' }}>

            {/* CABEÇALHO DA ARTESÃ */}
            <div style={{ background: 'white', borderBottom: '1px solid #E5D9CC', padding: '20px 24px' }}>
                <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {perfil?.atelie_logo_url && (
                        <img src={perfil.atelie_logo_url} alt="Logo" style={{ height: '56px', objectFit: 'contain' }} />
                    )}
                    <div>
                        <h2 style={{ margin: 0, color: '#AC5148', fontSize: '18px', fontWeight: 700 }}>
                            {perfil?.atelie_nome || perfil?.full_name}
                        </h2>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {perfil?.atelie_whatsapp && (
                                <span style={{ color: '#6B6B6B', fontSize: '13px' }}>📱 {perfil.atelie_whatsapp}</span>
                            )}
                            {perfil?.atelie_instagram && (
                                <span style={{ color: '#6B6B6B', fontSize: '13px' }}>📸 {perfil.atelie_instagram}</span>
                            )}
                            {perfil?.atelie_cidade && (
                                <span style={{ color: '#6B6B6B', fontSize: '13px' }}>📍 {perfil.atelie_cidade}, {perfil.atelie_estado}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px' }}>

                {/* STATUS BADGE */}
                {jaRespondido && (
                    <div style={{
                        background: orcamento.status === 'aceito' ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${orcamento.status === 'aceito' ? '#16A34A' : '#DC2626'}`,
                        borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center'
                    }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: orcamento.status === 'aceito' ? '#16A34A' : '#DC2626' }}>
                            {orcamento.status === 'aceito' ? '✅ Orçamento aprovado!' : '❌ Orçamento recusado'}
                        </p>
                        {orcamento.status === 'aceito' && (
                            <p style={{ margin: '4px 0 0', color: '#6B6B6B', fontSize: '14px' }}>
                                Obrigada! Em breve entraremos em contato para confirmar os detalhes.
                            </p>
                        )}
                    </div>
                )}

                {/* CARD PRINCIPAL */}
                <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #E5D9CC', overflow: 'hidden', marginBottom: '16px' }}>

                    {/* Header do orçamento */}
                    <div style={{ background: '#2D2D2D', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#F7E1D7', fontSize: '12px', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Orçamento
                            </p>
                            <h3 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: 0 }}>
                                Nº {String(orcamento.numero).padStart(3, '0')}
                            </h3>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 2px' }}>
                                Emitido em {format(new Date(orcamento.created_at), 'dd/MM/yyyy')}
                            </p>
                            <p style={{ color: isExpirado ? '#FCA5A5' : '#F7E1D7', fontSize: '12px', margin: 0, fontWeight: 600 }}>
                                {isExpirado ? '⚠️ Expirado' : `Válido até ${format(addDays(new Date(orcamento.created_at), orcamento.validade_dias || 7), 'dd/MM/yyyy')}`}
                            </p>
                        </div>
                    </div>

                    {/* Dados do cliente */}
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #F2E9DB', background: '#FAFAFA' }}>
                        <p style={{ color: '#6B6B6B', fontSize: '12px', margin: '0 0 2px', textTransform: 'uppercase' }}>Para</p>
                        <p style={{ color: '#1A1A1A', fontWeight: 700, fontSize: '16px', margin: 0 }}>{orcamento.cliente_nome}</p>
                    </div>

                    {/* Itens */}
                    <div style={{ padding: '20px 24px' }}>
                        {itens.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: i < itens.length - 1 ? '1px solid #F2E9DB' : 'none' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 600, color: '#1A1A1A', fontSize: '15px' }}>{item.descricao}</p>
                                    <p style={{ margin: '2px 0 0', color: '#6B6B6B', fontSize: '13px' }}>
                                        {item.quantidade}x · R${Number(item.valor_unitario).toFixed(2)} cada
                                    </p>
                                </div>
                                <span style={{ fontWeight: 700, color: '#1A1A1A', fontSize: '15px', marginLeft: '16px' }}>
                                    R${(item.quantidade * item.valor_unitario).toFixed(2)}
                                </span>
                            </div>
                        ))}

                        {/* Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #AC5148' }}>
                            <span style={{ fontWeight: 700, fontSize: '16px', color: '#1A1A1A' }}>Total</span>
                            <span style={{ fontWeight: 800, fontSize: '24px', color: '#AC5148' }}>
                                R${Number(orcamento.total).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Condições */}
                    {(orcamento.condicoes_pagamento || orcamento.prazo_entrega) && (
                        <div style={{ padding: '16px 24px', background: '#FAFAFA', borderTop: '1px solid #F2E9DB' }}>
                            {orcamento.condicoes_pagamento && (
                                <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#1A1A1A' }}>
                                    <strong>Pagamento:</strong> {orcamento.condicoes_pagamento}
                                </p>
                            )}
                            {orcamento.prazo_entrega && (
                                <p style={{ margin: 0, fontSize: '14px', color: '#1A1A1A' }}>
                                    <strong>Prazo:</strong> {orcamento.prazo_entrega}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Observações da artesã */}
                    {orcamento.observacoes && (
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #F2E9DB' }}>
                            <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '13px', color: '#AC5148', textTransform: 'uppercase' }}>Observações</p>
                            <p style={{ margin: 0, color: '#6B6B6B', fontSize: '14px', lineHeight: 1.6 }}>{orcamento.observacoes}</p>
                        </div>
                    )}
                </div>

                {/* UPLOAD DE ARQUIVOS DO CLIENTE */}
                {!jaRespondido && !isExpirado && (
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5D9CC', padding: '20px', marginBottom: '16px' }}>
                        <h4 style={{ margin: '0 0 8px', color: '#1A1A1A', fontSize: '15px' }}>
                            📎 Enviar arquivos de referência
                        </h4>
                        <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '0 0 16px' }}>
                            Envie fotos ou imagens de referência para ajudar na criação do seu bordado.
                        </p>

                        {/* Arquivos já enviados */}
                        {arquivos.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                {arquivos.map((arq, i) => (
                                    <a key={i} href={arq.url} target="_blank" rel="noreferrer"
                                        style={{ background: '#F2E9DB', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: '#AC5148', textDecoration: 'none', fontWeight: 600 }}>
                                        📄 {arq.nome}
                                    </a>
                                ))}
                            </div>
                        )}

                        <label style={{ display: 'block', cursor: 'pointer' }}>
                            <div style={{ border: '2px dashed #E5D9CC', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                                <p style={{ margin: 0, color: '#6B6B6B', fontSize: '14px' }}>
                                    {uploadingArquivo ? 'Enviando...' : '📁 Clique para enviar uma foto ou imagem'}
                                </p>
                            </div>
                            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                                onChange={e => e.target.files?.[0] && handleUploadArquivo(e.target.files[0])} />
                        </label>
                    </div>
                )}

                {/* AÇÕES DO CLIENTE */}
                {!jaRespondido && !isExpirado && (
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5D9CC', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 8px', color: '#1A1A1A', fontSize: '15px' }}>
                            Sua resposta
                        </h4>

                        <textarea
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                            placeholder="Alguma observação ou dúvida? (opcional)"
                            rows={3}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5D9CC', fontSize: '14px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '16px' }}
                        />

                        <p style={{ color: '#6B6B6B', fontSize: '12px', marginTop: '0', marginBottom: '16px', lineHeight: 1.5 }}>
                            <strong>Atenção:</strong> Ao aprovar este orçamento, você concorda com as condições, prazos e valores aqui descritos, validando o documento para fins de cobrança e prestação do serviço.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleAprovar}
                                disabled={status === 'aprovando'}
                                style={{ flex: 2, padding: '16px', borderRadius: '12px', background: '#16A34A', color: 'white', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}
                            >
                                {status === 'aprovando' ? 'Aprovando...' : '✅ Aprovar Orçamento'}
                            </button>
                            <button
                                onClick={() => {
                                    const motivo = prompt('Motivo da recusa (opcional):')
                                    if (motivo !== null) {
                                        setMotivoRecusa(motivo || '')
                                        handleRecusar()
                                    }
                                }}
                                disabled={status === 'recusando'}
                                style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'white', color: '#DC2626', border: '1px solid #DC2626', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                            >
                                {status === 'recusando' ? 'Recusando...' : '✕ Recusar'}
                            </button>
                        </div>
                    </div>
                )}

                {/* EXPIRADO */}
                {isExpirado && !jaRespondido && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #DC2626', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                        <p style={{ color: '#DC2626', fontWeight: 700, margin: '0 0 8px' }}>⚠️ Este orçamento expirou</p>
                        <p style={{ color: '#6B6B6B', fontSize: '14px', margin: 0 }}>
                            Entre em contato com a artesã para solicitar um novo orçamento.
                        </p>
                        {perfil?.atelie_whatsapp && (
                            <a
                                href={`https://wa.me/55${perfil.atelie_whatsapp.replace(/\D/g, '')}`}
                                target="_blank" rel="noreferrer"
                                style={{ display: 'inline-block', marginTop: '12px', background: '#25D366', color: 'white', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}
                            >
                                💬 Falar com a artesã
                            </a>
                        )}
                    </div>
                )}

                {/* RODAPÉ */}
                <p style={{ textAlign: 'center', color: '#AAAAAA', fontSize: '12px', marginTop: '24px' }}>
                    Orçamento gerado via <strong style={{ color: '#AC5148' }}>Meu Ateliê</strong>
                </p>
            </div>
        </div>
    )
}
