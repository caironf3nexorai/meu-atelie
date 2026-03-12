import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function InfraestruturaPage() {
    const supabase = createClient();

    const [metricas, setMetricas] = useState({
        usuarios: 0,
        premium: 0,
        free: 0,
        waitlist: 0,
        orcamentos: 0,
        dbSizeMB: 0,
        storageMB: 0,
        edgeCalls: 0,
        emailsEnviados: 0,
        realtimePico: 0,
    });
    const [circuitBreakers, setCircuitBreakers] = useState<any[]>([]);
    const [limites, setLimites] = useState<any>({});
    const [loadingMetricas, setLoadingMetricas] = useState(true);

    useEffect(() => {
        const fetchTudo = async () => {
            const mes = new Date().toISOString().slice(0, 7);

            const [
                { count: usuarios },
                { count: premium },
                { count: waitlist },
                { count: orcamentos },
                { data: dbData },
                { data: storageData },
                { data: usoData },
                { data: cbData },
                { data: limitesData },
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'premium'),
                supabase.from('waitlist').select('*', { count: 'exact', head: true }),
                supabase.from('orcamentos').select('*', { count: 'exact', head: true }),
                supabase.rpc('get_db_size'),
                supabase.rpc('get_storage_size'),
                supabase.from('uso_infraestrutura').select('*').eq('mes', mes).single(),
                supabase.from('circuit_breakers').select('*'),
                supabase.from('config_limites').select('*'),
            ]);

            const limitesMap: any = {};
            limitesData?.forEach((l: any) => { limitesMap[l.chave] = l; });

            setMetricas({
                usuarios: usuarios || 0,
                premium: premium || 0,
                free: (usuarios || 0) - (premium || 0),
                waitlist: waitlist || 0,
                orcamentos: orcamentos || 0,
                dbSizeMB: dbData?.[0]?.size_mb || 0,
                storageMB: storageData?.[0]?.size_mb || 0,
                edgeCalls: usoData?.edge_functions_calls || 0,
                emailsEnviados: usoData?.emails_enviados || 0,
                realtimePico: usoData?.realtime_pico || 0,
            });
            setCircuitBreakers(cbData || []);
            setLimites(limitesMap);
            setLoadingMetricas(false);
        };
        fetchTudo();
    }, [supabase]);

    // Helper cor por status
    const getStatus = (atual: number, limiteObj: any) => {
        if (!limiteObj) return { cor: '#16A34A', bg: '#F0FDF4', label: 'OK', pct: 0 };
        const pct = (atual / limiteObj.valor_limite) * 100;
        if (pct >= limiteObj.valor_critico) return { cor: '#DC2626', bg: '#FEF2F2', label: 'Crítico', pct };
        if (pct >= limiteObj.valor_alerta) return { cor: '#C29A51', bg: '#FDF8F0', label: 'Atenção', pct };
        return { cor: '#16A34A', bg: '#F0FDF4', label: 'OK', pct };
    };

    // Toggle manual de circuit breaker
    const toggleCircuitBreaker = async (chave: string, ativar: boolean) => {
        await supabase.from('circuit_breakers').update({
            ativo: ativar,
            motivo: ativar ? 'Desativado manualmente pelo admin' : null,
            ativado_em: ativar ? new Date().toISOString() : null,
            desativado_manualmente: !ativar
        }).eq('chave', chave);

        setCircuitBreakers(prev =>
            prev.map(cb => cb.chave === chave ? { ...cb, ativo: ativar } : cb)
        );
    };

    const recursos = [
        { chave: 'usuarios_total', label: 'Usuários cadastrados', icon: '👥', atual: metricas.usuarios, sub: `${metricas.premium} premium · ${metricas.free} free`, periodo: 'total' },
        { chave: 'edge_functions_mes', label: 'Edge Functions', icon: '⚡', atual: metricas.edgeCalls, sub: 'chamadas este mês', periodo: 'mês' },
        { chave: 'emails_mes', label: 'Emails (Resend)', icon: '📧', atual: metricas.emailsEnviados, sub: 'enviados este mês', periodo: 'mês' },
        { chave: 'db_mb', label: 'Banco de Dados', icon: '🗄️', atual: metricas.dbSizeMB, sub: 'MB utilizados', periodo: 'total', unidade: 'MB' },
        { chave: 'storage_mb', label: 'Storage (arquivos)', icon: '📁', atual: metricas.storageMB, sub: 'MB em logos e arquivos', periodo: 'total', unidade: 'MB' },
        { chave: 'realtime_simultaneo', label: 'Realtime (pico)', icon: '🔄', atual: metricas.realtimePico, sub: 'conexões simultâneas (pico)', periodo: 'mês' },
    ] as const;

    const temCritico = recursos.some(r => getStatus(r.atual, limites[r.chave]).label === 'Crítico');
    const temAtencao = recursos.some(r => getStatus(r.atual, limites[r.chave]).label === 'Atenção');
    const statusGeral = temCritico ? 'Crítico' : temAtencao ? 'Atenção' : 'Saudável';

    if (loadingMetricas) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-primary">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-ui text-text-light">Carregando métricas de infraestrutura...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header da página */}
            <div style={{ marginBottom: '8px' }}>
                <h1 style={{ fontFamily: 'Playfair Display', fontSize: '28px', color: '#1A1A1A', margin: '0 0 8px' }}>
                    🏥 Infraestrutura
                </h1>
                <p style={{ color: '#6B6B6B', margin: 0, fontSize: '15px' }}>
                    Monitoramento em tempo real dos limites do plano gratuito.
                    Atue antes que qualquer serviço seja interrompido.
                </p>
            </div>

            {/* Status geral — banner no topo */}
            <div style={{
                padding: '16px 20px', borderRadius: '14px',
                background: statusGeral === 'Crítico' ? '#FEF2F2' : statusGeral === 'Atenção' ? '#FDF8F0' : '#F0FDF4',
                border: `1px solid ${statusGeral === 'Crítico' ? '#DC2626' : statusGeral === 'Atenção' ? '#C29A51' : '#16A34A'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>
                        {statusGeral === 'Crítico' ? '🔴' : statusGeral === 'Atenção' ? '🟡' : '🟢'}
                    </span>
                    <div>
                        <p style={{
                            margin: 0, fontWeight: 700, fontSize: '16px',
                            color: statusGeral === 'Crítico' ? '#DC2626' : statusGeral === 'Atenção' ? '#C29A51' : '#16A34A'
                        }}>
                            {statusGeral === 'Saudável'
                                ? 'Todos os serviços operando normalmente'
                                : statusGeral === 'Atenção'
                                    ? 'Atenção — alguns recursos se aproximando do limite'
                                    : 'Ação necessária — limite crítico atingido'}
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6B6B6B' }}>
                            Última atualização: {new Date().toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'white', border: '1px solid #E5D9CC', borderRadius: '10px',
                        padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#6B6B6B'
                    }}
                >
                    🔄 Atualizar
                </button>
            </div>

            {/* Seção: Recursos de infraestrutura */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #E5D9CC' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📊 Uso de Recursos
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B6B6B' }}>— plano gratuito</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '20px' }}>
                    {recursos.map((recurso) => {
                        const s = getStatus(recurso.atual, limites[recurso.chave]);
                        const limite = limites[recurso.chave];
                        return (
                            <div key={recurso.chave}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>{recurso.icon}</span>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A' }}>{recurso.label}</span>
                                        <span style={{ fontSize: '11px', color: '#AAAAAA', background: '#F2E9DB', padding: '2px 8px', borderRadius: '999px' }}>por {recurso.periodo}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', color: '#6B6B6B' }}>{recurso.sub}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: s.cor }}>
                                            {recurso.atual.toLocaleString('pt-BR')}{'unidade' in recurso ? ` ${recurso.unidade}` : ''}
                                            {' / '}
                                            {limite?.valor_limite?.toLocaleString('pt-BR') || '?'}{'unidade' in recurso ? ` ${recurso.unidade}` : ''}
                                            {' '}<span style={{ fontSize: '11px' }}>({s.pct.toFixed(1)}%)</span>
                                        </span>
                                        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.cor }}>{s.label}</span>
                                    </div>
                                </div>
                                <div style={{ height: '6px', background: '#F2E9DB', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: '999px', width: `${Math.min(s.pct, 100)}%`, background: s.cor, transition: 'width 1.2s ease' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Seção: Circuit Breakers */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #E5D9CC' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔌 Circuit Breakers
                </h2>
                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '0 0 20px' }}>
                    Pause serviços manualmente em caso de emergência ou quando se aproximar de limites críticos.
                    Os bloqueios automáticos também aparecem aqui.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
                    {circuitBreakers.map((cb) => {
                        const labels: Record<string, { icon: string; label: string; desc: string }> = {
                            gerar_bordado: { icon: '🎨', label: 'Gerador de Riscos', desc: 'Geração por texto e por foto' },
                            envio_email: { icon: '📧', label: 'Envio de Emails', desc: 'Confirmações e campanhas' },
                            novo_cadastro: { icon: '👤', label: 'Novos Cadastros', desc: 'Bloquear novas contas' },
                        };
                        const info = labels[cb.chave] || { icon: '⚙️', label: cb.chave, desc: '' };
                        return (
                            <div key={cb.chave} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '14px 16px', borderRadius: '12px',
                                background: cb.ativo ? '#FEF2F2' : '#FAFAFA',
                                border: `1px solid ${cb.ativo ? '#DC2626' : '#E5D9CC'}`
                            }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '20px' }}>{info.icon}</span>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: cb.ativo ? '#DC2626' : '#1A1A1A' }}>
                                            {info.label}{cb.ativo && ' — BLOQUEADO'}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#6B6B6B' }}>
                                            {cb.ativo ? cb.motivo : info.desc}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleCircuitBreaker(cb.chave, !cb.ativo)}
                                    style={{
                                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                                        fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                                        background: cb.ativo ? '#16A34A' : '#DC2626',
                                        color: 'white', flexShrink: 0
                                    }}
                                >
                                    {cb.ativo ? '▶ Reativar' : '⏸ Pausar'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Seção: Upgrade */}
            <div style={{ background: '#1C1410', borderRadius: '20px', padding: '24px', border: '1px solid #2D2D2D' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
                    🚀 Planos pagos — quando fazer upgrade
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 20px' }}>
                    Você será alertado automaticamente. Mas aqui estão os limites para referência.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
                    {[
                        { servico: 'Supabase Pro', preco: '$25/mês (~R$150)', resolve: 'Usuários até 100k, banco até 8GB, 2M Edge Functions', link: 'https://supabase.com/dashboard/project/axtstqzxpelxbzwplufy/settings/billing' },
                        { servico: 'Resend Pro', preco: '$20/mês (~R$120)', resolve: '50.000 emails/mês', link: 'https://resend.com/settings/billing' },
                    ].map((plano, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '18px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <p style={{ color: 'white', fontWeight: 700, margin: '0 0 4px', fontSize: '15px' }}>{plano.servico}</p>
                            <p style={{ color: '#F7E1D7', fontWeight: 600, margin: '0 0 8px', fontSize: '14px' }}>{plano.preco}</p>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 16px', lineHeight: 1.5 }}>{plano.resolve}</p>
                            <a href={plano.link} target="_blank" rel="noreferrer"
                                style={{
                                    display: 'block', textAlign: 'center', background: '#AC5148', color: 'white',
                                    padding: '10px', borderRadius: '10px', textDecoration: 'none',
                                    fontWeight: 700, fontSize: '13px'
                                }}>
                                Fazer upgrade →
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
