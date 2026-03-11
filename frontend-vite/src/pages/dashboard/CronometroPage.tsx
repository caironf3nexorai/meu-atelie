import React, { useState, useEffect } from 'react';
import { Play, Square, Timer, CheckCircle, Search, Trash2, Hash } from 'lucide-react';
import { gestaoApi, type TimeSession, type Order } from '@/lib/api/gestao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useModal } from '@/contexts/ModalContext';
import { PremiumLock } from '@/components/shared/PremiumLock';
import { useAuth } from '@/lib/hooks/useAuth';

export default function CronometroPage() {
    const { profile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const { showConfirm, showAlert } = useModal();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [sessions, setSessions] = useState<TimeSession[]>([]);

    // Nova Sessão Form
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [activityDesc, setActivityDesc] = useState('');
    const [starting, setStarting] = useState(false);
    const [activeTab, setActiveTab] = useState('timer');

    // Cronômetros Ativos
    const [activeTimers, setActiveTimers] = useState<{ [id: string]: number }>({}); // Session ID -> Elapsed Seconds

    useEffect(() => {
        if (!authLoading) {
            fetchData();
        }
    }, [authLoading]);

    // O relógio mestre para atualizar a UI a cada segundo
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveTimers(prev => {
                const next = { ...prev };
                const now = new Date().getTime();

                sessions.filter(s => !s.stopped_at).forEach(session => {
                    const started = new Date(session.started_at).getTime();
                    next[session.id] = Math.max(0, Math.floor((now - started) / 1000));
                });
                return next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [sessions]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [fetchedOrders, fetchedSessions] = await Promise.all([
                gestaoApi.getOrders(),
                gestaoApi.getTimeSessions()
            ]);
            setOrders(fetchedOrders);
            setSessions(fetchedSessions);
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleStartSession = async () => {
        if (!activityDesc.trim()) {
            showAlert('Atenção', 'Digite o que você vai fazer antes de iniciar.');
            return;
        }

        const activeForThisActivity = sessions.find(s => !s.stopped_at && s.activity_description.toLowerCase() === activityDesc.trim().toLowerCase());

        if (activeForThisActivity) {
            showConfirm('Aviso', `Você já tem um cronômetro rodando para '${activityDesc}'. Iniciar mais de um ao mesmo tempo pode dificultar saber quanto tempo cada etapa levou. Tem certeza que quer iniciar outro?`, async () => {
                executeStart();
            });
        } else {
            executeStart();
        }
    };

    const executeStart = async () => {
        try {
            setStarting(true);
            const orderId = selectedOrderId === '' ? null : selectedOrderId;
            const newSession = await gestaoApi.startTimeSession({
                order_id: orderId,
                activity_description: activityDesc.trim()
            });

            // Enriquecer temporariamente os dados para tela
            if (newSession.order_id) {
                const orderMatch = orders.find(o => o.id === newSession.order_id);
                newSession.orders = { description: orderMatch?.description || '', clients: { name: (orderMatch as any)?.clients?.name || '' } };
            }

            setSessions([newSession, ...sessions]);
            setActivityDesc('');
            setSelectedOrderId('');
            toast({ title: 'Sessão Iniciada!', description: 'O cronômetro está rodando.' });
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setStarting(false);
        }
    };

    const handleStopSession = async (id: string) => {
        try {
            const updated = await gestaoApi.stopTimeSession(id);
            setSessions(sessions.map(s => s.id === id ? { ...s, stopped_at: updated.stopped_at, duration_minutes: updated.duration_minutes } : s));
            toast({ title: 'Sessão Pausada', description: 'Tempo registrado com sucesso.' });
        } catch (error: any) {
            toast({ title: 'Erro ao pausar', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeleteSession = async (id: string) => {
        showConfirm('Excluir Registro', 'Deseja excluir este registro de horas permanentemente?', async () => {
            try {
                await gestaoApi.deleteTimeSession(id);
                setSessions(sessions.filter(s => s.id !== id));
                toast({ title: 'Sucesso', description: 'Sessão excluída.' });
            } catch (error: any) {
                toast({ title: 'Erro', description: error.message, variant: 'destructive' });
            }
        });
    };

    const handleContinueSession = async (orderId: string | null, description: string) => {
        try {
            setStarting(true);
            const newSession = await gestaoApi.startTimeSession({
                order_id: orderId,
                activity_description: description
            });

            if (newSession.order_id) {
                const orderMatch = orders.find(o => o.id === newSession.order_id);
                newSession.orders = { description: orderMatch?.description || '', clients: { name: (orderMatch as any)?.clients?.name || '' } };
            }

            setSessions([newSession, ...sessions]);
            toast({ title: 'Sessão Retomada!', description: `Continuando '${description}'...` });
            setActiveTab('timer');
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setStarting(false);
        }
    };

    const formatTimeElapsed = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatDurationMinutes = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        if (h > 0) return `${h}h ${m}min`;
        return `${m}min`;
    };

    if (authLoading) return <div className="p-8"><div className="animate-pulse flex items-center gap-2"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> Carregando Cronômetro...</div></div>;
    if (profile?.plan === 'free') return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
            <PremiumLock>
                <div className="bg-surface border border-border-light border-dashed rounded-xl p-12 text-center text-text-muted mt-12 min-h-[400px]">
                    Este Módulo é exclusivo para assinantes Premium.
                </div>
            </PremiumLock>
        </div>
    );

    const activeSessions = sessions.filter(s => !s.stopped_at);
    const historySessions = sessions.filter(s => s.stopped_at);

    // Agrupar Histórico por Order -> Atividades
    const groupedHistory: {
        [key: string]: {
            orderName: string,
            totalMinutes: number,
            activities: {
                [desc: string]: { description: string; totalMinutes: number; sessions: TimeSession[] }
            }
        }
    } = {};

    historySessions.forEach(s => {
        const key = s.order_id || 'geral';
        if (!groupedHistory[key]) {
            const oName = s.order_id ? `${s.orders?.clients?.name || 'Cliente'} - ${s.orders?.description || 'Encomenda'}` : 'Atividades Gerais';
            groupedHistory[key] = { orderName: oName, totalMinutes: 0, activities: {} };
        }

        const actDesc = s.activity_description || 'Sem Descrição';
        if (!groupedHistory[key].activities[actDesc]) {
            groupedHistory[key].activities[actDesc] = { description: actDesc, totalMinutes: 0, sessions: [] };
        }

        groupedHistory[key].activities[actDesc].sessions.push(s);
        groupedHistory[key].activities[actDesc].totalMinutes += Number(s.duration_minutes || 0);
        groupedHistory[key].totalMinutes += Number(s.duration_minutes || 0);
    });

    // Resumo Geral
    const totalMinutesAll = historySessions.reduce((acc, s) => acc + Number(s.duration_minutes || 0), 0);
    let topOrder = { name: '-', mins: 0 };
    Object.values(groupedHistory).forEach(g => {
        if (g.totalMinutes > topOrder.mins && g.orderName !== 'Atividades Gerais') {
            topOrder = { name: g.orderName, mins: g.totalMinutes };
        }
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h2 className="font-display text-3xl text-text tracking-tight flex items-center gap-3">
                        <Timer className="w-8 h-8 text-primary" /> Cronômetro de Produção
                    </h2>
                    <p className="text-text-light font-ui mt-1">Rastreie o tempo gasto em cada encomenda com precisão.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-6 flex gap-2 overflow-x-auto no-scrollbar justify-start border-0 bg-transparent p-0">
                    <TabsTrigger value="timer" className="rounded-full px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-surface data-[state=inactive]:border-border-light shadow-sm transition-all whitespace-nowrap">
                        <Play className="w-4 h-4 mr-2" /> Cronômetro Ativo
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="rounded-full px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-surface data-[state=inactive]:border-border-light shadow-sm transition-all whitespace-nowrap">
                        <CheckCircle className="w-4 h-4 mr-2" /> Histórico de Horas
                    </TabsTrigger>
                </TabsList>

                {/* ABA DE CRONÔMETRO */}
                <TabsContent value="timer" className="space-y-6">
                    {/* Painel de Iniciação */}
                    <div className="bg-surface p-6 rounded-2xl border border-border-light shadow-sm">
                        <h3 className="font-display text-lg text-text mb-4">Iniciar Nova Sessão</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1 space-y-2">
                                <label className="text-sm font-medium text-text-light">Vincular a qual encomenda?</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                    value={selectedOrderId}
                                    onChange={(e) => setSelectedOrderId(e.target.value)}
                                >
                                    <option value="">(Nenhuma) Atividades Gerais</option>
                                    {orders.filter(o => o.status === 'em_andamento').map(o => (
                                        <option key={o.id} value={o.id}>{o.clients?.name} - {o.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-medium text-text-light">O que você vai fazer?</label>
                                <Input
                                    placeholder="Ex: Bordar preenchimento floral, Limpeza de avessos..."
                                    value={activityDesc}
                                    onChange={(e) => setActivityDesc(e.target.value)}
                                    maxLength={50}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <Button disabled={starting || !activityDesc.trim()} onClick={handleStartSession} className="w-full bg-primary hover:bg-primary-dark shadow-sm">
                                    <Play className="w-4 h-4 mr-2" /> {starting ? 'Iniciando...' : 'Começar!'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Lista Cronomêtros Ativos */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-xl text-text font-display flex items-center gap-2">
                            Mão na massa! Registrando agora:
                            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-ui">{activeSessions.length}</span>
                        </h4>

                        {activeSessions.length === 0 ? (
                            <div className="bg-surface border border-border-light border-dashed rounded-xl p-8 text-center text-text-muted">
                                Nenhum cronômetro ativo no momento. Inicie um acima para começar a computar.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeSessions.map(session => (
                                    <div key={session.id} className="bg-surface rounded-xl border border-primary/40 shadow-sm p-5 relative overflow-hidden flex flex-col justify-between">
                                        <div className="absolute top-0 right-0 p-3 opacity-10">
                                            <Timer className="w-24 h-24 text-primary animate-pulse" />
                                        </div>
                                        <div className="relative z-10 flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Rodando</span>
                                            </div>
                                            <h3 className="text-xl font-display text-text truncate pr-8">{session.activity_description}</h3>
                                            <p className="text-sm text-text-light mt-1 font-ui truncate pr-8">
                                                {session.order_id ? `${session.orders?.clients?.name} - ${session.orders?.description}` : 'Atividade Geral Sem Vínculo'}
                                            </p>
                                        </div>
                                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between mt-6 gap-4">
                                            <div className="text-4xl font-display text-text tracking-tight font-variant-numeric tabular-nums">
                                                {formatTimeElapsed(activeTimers[session.id] || 0)}
                                            </div>
                                            <Button variant="outline" onClick={() => handleStopSession(session.id)} className="border-border text-text hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                                                <Square className="w-4 h-4 mr-2" /> Parar
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ABA DE HISTÓRICO */}
                <TabsContent value="historico" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-surface p-4 rounded-xl border border-border-light shadow-sm flex flex-col justify-center">
                            <div className="text-sm text-text-light mb-1 font-ui">Tempo Total Registrado</div>
                            <div className="text-3xl font-display text-primary">{formatDurationMinutes(totalMinutesAll)}</div>
                        </div>
                        <div className="bg-surface p-4 rounded-xl border border-border-light shadow-sm flex flex-col justify-center">
                            <div className="text-sm text-text-light mb-1 font-ui">Encomenda com + Trabalho</div>
                            <div className="text-xl font-display text-text leading-tight truncate">{topOrder.name}</div>
                            <div className="text-xs text-text-muted mt-1">{formatDurationMinutes(topOrder.mins)}</div>
                        </div>
                    </div>

                    {Object.keys(groupedHistory).length === 0 ? (
                        <div className="text-center p-8 text-text-muted bg-surface rounded-xl border border-border-light border-dashed">
                            Nenhum histórico concluído. As sessões finalizadas ficarão salvas aqui.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedHistory).map(([key, group]) => (
                                <div key={key} className="bg-surface border border-border-light rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-surface-warm p-4 border-b border-border-light flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <Hash className="w-5 h-5 text-text-light" />
                                            <h3 className="font-display font-medium text-lg truncate flex-1">{group.orderName}</h3>
                                        </div>
                                        <div className="bg-white px-3 py-1.5 rounded-md border border-border-light font-medium text-sm text-text whitespace-nowrap hidden sm:flex items-center gap-2">
                                            Soma da Encomenda: <span className="text-primary font-bold">{formatDurationMinutes(group.totalMinutes)}</span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-border-light/60 bg-surface">
                                        {Object.values(group.activities).map(act => (
                                            <div key={act.description} className="p-4 sm:p-5 hover:bg-surface-warm transition-colors">
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                                                    <div className="font-medium text-text text-base">{act.description}</div>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span className="text-xs text-text-light font-medium bg-primary/10 text-primary px-2.5 py-1.5 rounded-md border border-primary/20">Total: {formatDurationMinutes(act.totalMinutes)}</span>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs bg-white" onClick={() => handleContinueSession(key !== 'geral' ? key : null, act.description)}>
                                                            <Play className="w-3.5 h-3.5 mr-1.5 text-primary" /> Retomar tarefa
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="pl-4 sm:pl-6 border-l-2 border-border-light/50 space-y-3">
                                                    {act.sessions.map(s => (
                                                        <div key={s.id} className="flex justify-between items-center text-sm group/item">
                                                            <div className="text-text-muted font-ui flex flex-col sm:flex-row sm:gap-3">
                                                                <span className="font-medium">{new Date(s.started_at).toLocaleDateString('pt-BR')}</span>
                                                                <span>{new Date(s.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até {new Date(s.stopped_at!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 sm:gap-4">
                                                                <span className="font-medium text-text tabular-nums bg-surface-warm px-2 py-0.5 rounded border border-border-light">{formatDurationMinutes(Number(s.duration_minutes || 0))}</span>
                                                                <button onClick={() => handleDeleteSession(s.id)} className="p-1.5 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 text-text-muted hover:text-destructive hover:bg-destructive/10 rounded-md transition-all focus:opacity-100">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="p-4 sm:hidden bg-surface-warm border-t border-border-light flex justify-between">
                                            <span className="font-medium text-sm">Soma da Encomenda:</span>
                                            <span className="font-bold text-primary">{formatDurationMinutes(group.totalMinutes)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
