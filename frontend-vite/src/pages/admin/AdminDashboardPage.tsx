import React, { useEffect, useState, useCallback } from 'react';
import { Users, CreditCard, ImageIcon, Activity, Loader2, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Link, NavLink } from 'react-router-dom';

export default function AdminDashboardPage() {
    const supabase = createClient();
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeSubs: 0,
        totalGens: 0,
        gensRisco: 0,
        gensColorido: 0,
        geminiCost: 0,
    });
    const [recentUsers, setRecentUsers] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | '12m'>('7d');

    // Status resumido para card de infraestrutura
    const [infraStatus, setInfraStatus] = useState<'loading' | 'healthy' | 'attention' | 'critical'>('loading');

    useEffect(() => {
        const checkInfraStatus = async () => {
            try {
                const [{ data: limitesData }, { count: usuarios }, { data: dbData }] = await Promise.all([
                    supabase.from('config_limites').select('*'),
                    supabase.from('profiles').select('*', { count: 'exact', head: true }),
                    supabase.rpc('get_db_size'),
                ]);
                const limitesMap: any = {};
                limitesData?.forEach((l: any) => { limitesMap[l.chave] = l; });
                const userLimite = limitesMap['usuarios_total'];
                const dbLimite = limitesMap['db_mb'];
                const dbSize = dbData?.[0]?.size_mb || 0;
                const userCount = usuarios || 0;
                let status: 'healthy' | 'attention' | 'critical' = 'healthy';
                if (userLimite) {
                    const pct = (userCount / userLimite.valor_limite) * 100;
                    if (pct >= userLimite.valor_critico) status = 'critical';
                    else if (pct >= userLimite.valor_alerta) status = 'attention';
                }
                if (dbLimite) {
                    const pct = (dbSize / dbLimite.valor_limite) * 100;
                    if (pct >= dbLimite.valor_critico) status = 'critical';
                    else if (pct >= dbLimite.valor_alerta && status !== 'critical') status = 'attention';
                }
                setInfraStatus(status);
            } catch {
                setInfraStatus('healthy');
            }
        };
        checkInfraStatus();
    }, [supabase]);

    const loadAdminData = useCallback(async (isInitial = true) => {
        if (isInitial) setLoading(true);
        const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: premiumCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'premium');
        const { count: gensRiscoCount } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('generation_type', 'risco');
        const { count: gensColoridoCount } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('generation_type', 'bordado_colorido');

        const { data: configData } = await supabase.from('plan_config').select('usd_to_brl_rate').maybeSingle();
        const COTACAO_USD_BRL = configData?.usd_to_brl_rate || 5.80;

        const CUSTO_RISCO_USD = 0.039;
        const CUSTO_COLORIDO_USD = 0.134;

        const totalRiscoUSD = (gensRiscoCount || 0) * CUSTO_RISCO_USD;
        const totalColoridoUSD = (gensColoridoCount || 0) * CUSTO_COLORIDO_USD;
        const custoEstimadoBRL = (totalRiscoUSD + totalColoridoUSD) * COTACAO_USD_BRL;

        setStats({
            totalUsers: usersCount || 0,
            activeSubs: premiumCount || 0,
            totalGens: (gensRiscoCount || 0) + (gensColoridoCount || 0),
            gensRisco: gensRiscoCount || 0,
            gensColorido: gensColoridoCount || 0,
            geminiCost: custoEstimadoBRL,
        });

        const { data: recent } = await supabase.from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        setRecentUsers(recent || []);
        if (isInitial) setLoading(false);
    }, [supabase]);

    // Função separada para carregar gráfico baseado no período
    const loadChartData = useCallback(async (range: '7d' | '30d' | '90d' | '12m') => {
        const hoje = new Date();
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

        let dataInicio = new Date(hoje);
        if (range === '7d') dataInicio.setDate(hoje.getDate() - 6);
        else if (range === '30d') dataInicio.setDate(hoje.getDate() - 29);
        else if (range === '90d') dataInicio.setDate(hoje.getDate() - 89);
        else dataInicio.setMonth(hoje.getMonth() - 11);
        dataInicio.setHours(0, 0, 0, 0);

        const { data: profiles } = await supabase
            .from('profiles')
            .select('created_at')
            .gte('created_at', dataInicio.toISOString());

        const registros = profiles || [];

        if (range === '7d') {
            const dados: { name: string; users: number }[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(hoje);
                d.setDate(hoje.getDate() - i);
                dados.push({ name: dias[d.getDay()], users: 0 });
            }
            registros.forEach(p => {
                const dc = new Date(p.created_at);
                const diff = Math.floor((hoje.getTime() - dc.getTime()) / (1000 * 60 * 60 * 24));
                const idx = 6 - diff;
                if (idx >= 0 && idx < 7) dados[idx].users++;
            });
            setChartData(dados);
        } else if (range === '30d') {
            // Agrupar por semana (4-5 semanas)
            const semanas: { name: string; users: number }[] = [];
            for (let i = 4; i >= 0; i--) {
                const inicio = new Date(hoje);
                inicio.setDate(hoje.getDate() - (i * 7 + 6));
                const fim = new Date(hoje);
                fim.setDate(hoje.getDate() - (i * 7));
                semanas.push({ name: `${inicio.getDate()}/${inicio.getMonth() + 1}-${fim.getDate()}/${fim.getMonth() + 1}`, users: 0 });
            }
            registros.forEach(p => {
                const dc = new Date(p.created_at);
                const diffDias = Math.floor((hoje.getTime() - dc.getTime()) / (1000 * 60 * 60 * 24));
                const semanaIdx = 4 - Math.floor(diffDias / 7);
                if (semanaIdx >= 0 && semanaIdx < 5) semanas[semanaIdx].users++;
            });
            setChartData(semanas);
        } else if (range === '90d') {
            // Agrupar por mês (3 meses)
            const mesesData: { name: string; users: number }[] = [];
            for (let i = 2; i >= 0; i--) {
                const d = new Date(hoje);
                d.setMonth(hoje.getMonth() - i);
                mesesData.push({ name: meses[d.getMonth()], users: 0 });
            }
            registros.forEach(p => {
                const dc = new Date(p.created_at);
                const diffMeses = (hoje.getFullYear() - dc.getFullYear()) * 12 + (hoje.getMonth() - dc.getMonth());
                const idx = 2 - diffMeses;
                if (idx >= 0 && idx < 3) mesesData[idx].users++;
            });
            setChartData(mesesData);
        } else {
            // 12 meses
            const mesesData: { name: string; users: number }[] = [];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(hoje);
                d.setMonth(hoje.getMonth() - i);
                mesesData.push({ name: meses[d.getMonth()], users: 0 });
            }
            registros.forEach(p => {
                const dc = new Date(p.created_at);
                const diffMeses = (hoje.getFullYear() - dc.getFullYear()) * 12 + (hoje.getMonth() - dc.getMonth());
                const idx = 11 - diffMeses;
                if (idx >= 0 && idx < 12) mesesData[idx].users++;
            });
            setChartData(mesesData);
        }
    }, [supabase]);

    useEffect(() => {
        loadAdminData();
        loadChartData(periodo);

        // Inscrevendo-se em mudanças em tempo real focadas em Gerações (uso primário)
        const channel = supabase
            .channel('admin-metrics')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'generations' }, () => {
                // Atualização stealth sem trigger de loading spinner
                loadAdminData(false);
            })
            // Opcional: ouvir também novos usuários se quiser a tabela debaixo pipocando real-time
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
                loadAdminData(false);
                loadChartData(periodo);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadAdminData, loadChartData, supabase, periodo]);

    // Recarregar gráfico ao mudar período
    const handlePeriodoChange = (p: '7d' | '30d' | '90d' | '12m') => {
        setPeriodo(p);
        loadChartData(p);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-primary">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-ui text-text-light">Sincronizando banco de dados...</p>
            </div>
        );
    }

    const temCritico = infraStatus === 'critical';
    const temAtencao = infraStatus === 'attention';

    const metrics = [
        { title: 'Total de Usuários', value: stats.totalUsers.toLocaleString(), desc: 'Desde o lançamento', icon: Users, color: 'text-primary', link: '/admin/usuarios' },
        { title: 'Pagamentos (MRR)', value: stats.activeSubs.toLocaleString(), desc: `R$ ${(stats.activeSubs * 29.90).toLocaleString('pt-BR')} MRR`, icon: CreditCard, color: 'text-accent', link: '/admin/pagamentos' },
        { title: 'Gerações (Total)', value: stats.totalGens.toLocaleString(), desc: 'Riscos e Coloridos', icon: ImageIcon, color: 'text-warn', link: '#' },
        {
            title: 'Custos Gemini (Est.)',
            value: `R$ ${stats.geminiCost.toFixed(2)}`,
            desc: (
                <div className="flex flex-col mt-1 font-mono text-xs opacity-90">
                    <span>Riscos: {stats.gensRisco} × $0.039</span>
                    <span>Bordados coloridos: {stats.gensColorido} × $0.134</span>
                </div>
            ),
            icon: Activity,
            color: 'text-primary-dark',
            link: '#'
        },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="font-display text-4xl text-text mb-2">Visão Geral</h1>
                <p className="font-ui text-text-light text-base">Indicadores operacionais e controle em tempo real do sistema.</p>
            </div>

            {/* Card resumido — Infraestrutura */}
            <div style={{
                background: 'white', borderRadius: '16px', padding: '20px',
                border: `1px solid ${temCritico ? '#DC2626' : temAtencao ? '#C29A51' : '#E5D9CC'}`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>🏥</span>
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#1A1A1A', fontSize: '14px' }}>
                                Infraestrutura
                            </p>
                            <p style={{
                                margin: 0, fontSize: '12px',
                                color: temCritico ? '#DC2626' : temAtencao ? '#C29A51' : '#16A34A',
                                fontWeight: 600
                            }}>
                                {temCritico ? '🔴 Ação necessária' : temAtencao ? '🟡 Atenção' : '🟢 Tudo saudável'}
                            </p>
                        </div>
                    </div>
                    <NavLink to="/admin/infraestrutura" style={{
                        background: '#F2E9DB', border: 'none', borderRadius: '10px',
                        padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
                        fontWeight: 700, color: '#AC5148', textDecoration: 'none'
                    }}>
                        Ver detalhes →
                    </NavLink>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((m, i) => {
                    const content = (
                        <>
                            <div className="flex justify-between items-start">
                                <h3 className="font-ui text-text-muted text-sm font-medium uppercase tracking-wider">{m.title}</h3>
                                <div className={`p-3 rounded-2xl bg-stone-50 ${m.color} ${m.link !== '#' ? 'group-hover:bg-[#FAF0EF] transition-colors' : ''}`}>
                                    <m.icon className="w-6 h-6" />
                                </div>
                            </div>
                            <div>
                                <p className="font-display text-4xl text-text leading-none mb-2">{m.value}</p>
                                <div className={`font-ui text-sm text-text-light ${m.link !== '#' ? 'group-hover:text-primary transition-colors flex items-center gap-1' : ''}`}>
                                    {m.desc} {m.link !== '#' && <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </div>
                            </div>
                        </>
                    );

                    if (m.link === '#') {
                        return (
                            <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-border-light flex flex-col gap-4 group transition-all">
                                {content}
                            </div>
                        );
                    }

                    return (
                        <Link to={m.link} key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-border-light flex flex-col gap-4 group hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                            {content}
                        </Link>
                    );
                })}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-border-light flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-8">
                        <h3 className="font-display text-2xl text-text">Novos Cadastros</h3>
                        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
                            {([['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias'], ['12m', '12 meses']] as const).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => handlePeriodoChange(key)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                        background: periodo === key ? 'white' : 'transparent',
                                        color: periodo === key ? '#AC5148' : '#6B6B6B',
                                        boxShadow: periodo === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 min-h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 13 }} dy={10} />
                                <Tooltip cursor={{ fill: 'var(--color-surface-warm)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                                <Bar dataKey="users" radius={[6, 6, 6, 6]} barSize={40}>
                                    {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={'var(--color-primary-light)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-8">
                    <div className="bg-white p-0 rounded-3xl shadow-sm border border-border-light overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-border/50 bg-stone-50/50">
                            <h3 className="font-display text-xl text-text">Usuários Recentes</h3>
                        </div>
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <tbody>
                                    {recentUsers.map((user) => (
                                        <tr key={user.id} className="border-b border-border/30 hover:bg-stone-50 transition-colors">
                                            <td className="p-5">
                                                <p className="font-ui font-semibold text-text">{user.full_name}</p>
                                                <p className="font-ui text-xs text-text-muted mt-1 font-mono">{user.email || 'Email oculto'}</p>
                                            </td>
                                            <td className="p-5 text-right">
                                                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${user.plan === 'premium' ? 'bg-accent/10 text-accent' : 'bg-stone-100 text-text-muted'}`}>
                                                    {user.plan || 'free'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Link to="/admin/usuarios" className="w-full p-5 text-center text-sm font-ui font-semibold text-primary hover:bg-[#FAF0EF] transition-colors border-t border-border-light block">
                            Ver Base Completa <ArrowRight className="w-4 h-4 ml-1 inline" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
