import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { useModal } from '@/contexts/ModalContext'

function LoadingSpinner() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2E9DB' }}>
            <div className="font-ui text-text-light text-sm animate-pulse">Carregando Arte...</div>
        </div>
    )
}

export default function AprovarArtePage() {
    const { showAlert } = useModal()
    const { token } = useParams()
    const [arte, setArte] = useState<any>(null)
    const [perfil, setPerfil] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState<'idle' | 'aprovando' | 'recusando' | 'concluido'>('idle')
    const [motivoRecusa, setMotivoRecusa] = useState('')

    useEffect(() => {
        const fetchArte = async () => {
            const { data: arteData } = await supabase
                .from('aprovacao_arte')
                .select('*, orcamentos(numero, cliente_nome)')
                .eq('token_publico', token)
                .single()

            if (!arteData) { setLoading(false); return }

            const { data: perfilData } = await supabase
                .from('profiles')
                .select('full_name, atelie_nome, atelie_logo_url, atelie_whatsapp, atelie_instagram, atelie_cidade, atelie_estado')
                .eq('id', arteData.user_id)
                .single()

            setArte(arteData)
            setPerfil(perfilData)
            setLoading(false)
        }

        fetchArte()
    }, [token])

    const handleAprovar = async () => {
        setStatus('aprovando')
        const { data, error } = await supabase
            .from('aprovacao_arte')
            .update({
                status: 'aprovado',
                aprovado_em: new Date().toISOString()
            })
            .eq('token_publico', token)
            .select()

        if (error || !data || data.length === 0) {
            console.error('Erro ao aprovar:', error)
            showAlert('Erro', 'Erro ao aprovar. Tente novamente.')
            setStatus('idle')
            return
        }

        // Notificar artesã
        await supabase.from('notificacoes').insert({
            user_id: arte.user_id,
            titulo: '🎨 Arte aprovada!',
            mensagem: `${arte.orcamentos?.cliente_nome} aprovou a arte "${arte.arquivo_nome}" (Orçamento Nº ${String(arte.orcamentos?.numero).padStart(3, '0')})`,
            tipo: 'success'
        })

        setStatus('concluido')
        setArte((prev: any) => ({ ...prev, status: 'aprovado' }))
    }

    const handleRecusar = async () => {
        setStatus('recusando')
        const { data, error } = await supabase
            .from('aprovacao_arte')
            .update({
                status: 'recusado',
                recusado_em: new Date().toISOString(),
                motivo_recusa: motivoRecusa || null
            })
            .eq('token_publico', token)
            .select()

        if (error || !data || data.length === 0) {
            console.error('Erro ao recusar:', error)
            showAlert('Erro', 'Erro ao recusar. Tente novamente.')
            setStatus('idle')
            return
        }

        await supabase.from('notificacoes').insert({
            user_id: arte.user_id,
            titulo: '❌ Arte recusada',
            mensagem: `${arte.orcamentos?.cliente_nome} recusou a arte "${arte.arquivo_nome}"${motivoRecusa ? `: "${motivoRecusa}"` : ''}`,
            tipo: 'warning'
        })

        setStatus('concluido')
        setArte((prev: any) => ({ ...prev, status: 'recusado', motivo_recusa: motivoRecusa }))
    }

    if (loading) return <LoadingSpinner />

    if (!arte) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2E9DB' }}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '48px' }}>🎨</p>
                <h2 style={{ color: '#AC5148' }}>Arte não encontrada</h2>
                <p style={{ color: '#6B6B6B' }}>Este link pode ter expirado ou sido removido.</p>
            </div>
        </div>
    )

    const isExpirado = new Date() > new Date(arte.expires_at)
    const jaRespondido = arte.status === 'aprovado' || arte.status === 'recusado'
    const isImagem = ['png', 'jpg', 'jpeg'].includes(arte.arquivo_tipo.toLowerCase())

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
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px' }}>

                {/* STATUS BADGE */}
                {jaRespondido && (
                    <div style={{
                        background: arte.status === 'aprovado' ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${arte.status === 'aprovado' ? '#16A34A' : '#DC2626'}`,
                        borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center'
                    }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: arte.status === 'aprovado' ? '#16A34A' : '#DC2626' }}>
                            {arte.status === 'aprovado' ? '✅ Arte aprovada!' : '❌ Arte recusada'}
                        </p>
                        {arte.status === 'aprovado' ? (
                            <p style={{ margin: '4px 0 0', color: '#6B6B6B', fontSize: '14px' }}>
                                Obrigada! Em breve daremos andamento ao seu pedido.
                            </p>
                        ) : (
                            <p style={{ margin: '4px 0 0', color: '#6B6B6B', fontSize: '14px' }}>
                                {arte.motivo_recusa && `Motivo: "${arte.motivo_recusa}"`}
                            </p>
                        )}
                    </div>
                )}

                {/* CARD PRINCIPAL */}
                <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #E5D9CC', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ background: '#2D2D2D', padding: '20px 24px' }}>
                        <p style={{ color: '#F7E1D7', fontSize: '12px', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Aprovação de Arte
                        </p>
                        <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
                            Projeto de Bordado — {arte.orcamentos?.cliente_nome}
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: 0 }}>
                            Orçamento Nº {String(arte.orcamentos?.numero).padStart(3, '0')}
                        </p>
                    </div>

                    <div style={{ padding: '24px' }}>
                        <h4 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1A1A1A' }}>{arte.arquivo_nome}</h4>

                        {isImagem ? (
                            <div style={{ background: '#F2E9DB', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'center' }}>
                                <img src={arte.arquivo_url} alt="Arte" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }} />
                            </div>
                        ) : (
                            <div style={{ background: '#F2E9DB', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                                <a href={arte.arquivo_url} target="_blank" rel="noreferrer"
                                    style={{ display: 'inline-block', background: '#AC5148', color: 'white', padding: '10px 24px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>
                                    Baixar Documento para Visualizar
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* AÇÕES DO CLIENTE */}
                {!jaRespondido && !isExpirado && (
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5D9CC', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 16px', color: '#1A1A1A', fontSize: '15px' }}>
                            A arte está de acordo com o desejado?
                        </h4>

                        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }} className="sm:flex-row">
                            <button
                                onClick={handleAprovar}
                                disabled={status === 'aprovando' || status === 'recusando'}
                                style={{ flex: 1, padding: '16px', borderRadius: '12px', background: '#16A34A', color: 'white', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer', width: '100%' }}
                            >
                                {status === 'aprovando' ? 'Aprovando...' : '✅ Aprovar Arte'}
                            </button>
                            <button
                                onClick={() => {
                                    const motivo = prompt('Por que deseja recusar? (Informe o que precisa ser ajustado):')
                                    if (motivo !== null) {
                                        setMotivoRecusa(motivo || '')
                                        handleRecusar()
                                    }
                                }}
                                disabled={status === 'recusando' || status === 'aprovando'}
                                style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'white', color: '#DC2626', border: '1px solid #DC2626', fontWeight: 600, fontSize: '14px', cursor: 'pointer', width: '100%', marginTop: '8px' }}
                            >
                                {status === 'recusando' ? 'Recusando...' : '✕ Solicitar Alteração (Recusar)'}
                            </button>
                        </div>
                        <p style={{ color: '#6B6B6B', fontSize: '12px', marginTop: '16px', marginBottom: 0, textAlign: 'center' }}>
                            Ao aprovar você confirma o projeto, permitindo o início do bordado.
                        </p>
                    </div>
                )}

                {/* EXPIRADO */}
                {isExpirado && !jaRespondido && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #DC2626', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                        <p style={{ color: '#DC2626', fontWeight: 700, margin: '0 0 8px' }}>⚠️ Este link expirou</p>
                        <p style={{ color: '#6B6B6B', fontSize: '14px', margin: 0 }}>
                            A arte estava disponível para aprovação até {format(new Date(arte.expires_at), 'dd/MM/yyyy')}. Entre em contato com a artesã.
                        </p>
                    </div>
                )}

                {/* RODAPÉ */}
                <p style={{ textAlign: 'center', color: '#AAAAAA', fontSize: '12px', marginTop: '24px' }}>
                    Aprovação gerada via <strong style={{ color: '#AC5148' }}>Meu Ateliê</strong>
                </p>
            </div>
        </div>
    )
}
