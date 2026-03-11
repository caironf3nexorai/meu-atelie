import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Sparkles, AlertCircle, Clock, ChevronRight, Timer, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { gestaoApi, type Order, type TimeSession } from '@/lib/api/gestao';
import { useAuth } from '@/lib/hooks/useAuth';

export default function PrecificacaoPage() {
    const { loading: authLoading } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [sessions, setSessions] = useState<TimeSession[]>([]);
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [custoMaterial, setCustoMaterial] = useState('');
    const [horasTrabalho, setHorasTrabalho] = useState('');
    const [valorHora, setValorHora] = useState('');
    const [margemLucro, setMargemLucro] = useState('');

    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const totalCalculado =
        (Number(custoMaterial) || 0) +
        ((Number(horasTrabalho) || 0) * (Number(valorHora) || 0)) *
        (1 + (Number(margemLucro) || 0) / 100);

    const lucroLiquido = totalCalculado - (Number(custoMaterial) || 0) - ((Number(horasTrabalho) || 0) * (Number(valorHora) || 0));

    useEffect(() => {
        if (!authLoading) {
            Promise.all([gestaoApi.getOrders(), gestaoApi.getTimeSessions()])
                .then(([fetchedOrders, fetchedSessions]) => {
                    setOrders(fetchedOrders.filter(o => o.status !== 'entregue'));
                    setSessions(fetchedSessions.filter(s => s.stopped_at)); // Apenas sessões finalizadas
                }).catch(err => console.error("Erro ao carregar dados:", err));
        }
    }, [authLoading]);

    // Calcula horas da encomenda selecionada
    const orderSessions = sessions.filter(s => s.order_id === selectedOrderId);
    const totalMinutesLogged = orderSessions.reduce((acc, s) => acc + Number(s.duration_minutes || 0), 0);
    const hasLoggedTime = totalMinutesLogged > 0;

    const applyLoggedTime = () => {
        const hoursRounded = (totalMinutesLogged / 60).toFixed(1);
        setHorasTrabalho(hoursRounded);
    };

    const handleAnalyzeAI = () => {
        setIsLoading(true);
        setAiAnalysis(null);
        setTimeout(() => {
            setIsLoading(false);
            setAiAnalysis(`A Lia recomenda: Este valor de **R$ ${totalCalculado.toFixed(2)}** parece justo para um bordado de ${horasTrabalho} horas se considerarmos materiais premium. No entanto, sua margem de ${margemLucro}% pode limitar vendas para o mercado C. Experimente criar um segundo produto similar, com fios comuns, e reduzir a margem para 30% em kits promocionais.`);
        }, 3000);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="font-display text-4xl text-text">Precificação Inteligente</h1>
                    <p className="font-ui text-text-light mt-2">Nunca mais perca no lucro. A matemática que valoriza sua arte associada com a nossa IA.</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Esquerda: Calculadora */}
                <div className="lg:w-1/2 space-y-6">
                    <div className="bg-surface rounded-3xl p-8 border border-border-light shadow-sm">
                        <h2 className="font-display text-2xl text-text border-b border-border/50 pb-4 mb-6 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-primary" /> Variáveis Base
                        </h2>

                        <div className="space-y-6">
                            {/* Cronômetro Integration */}
                            <div className="space-y-2 pb-4 border-b border-border/50">
                                <Label className="text-text-light font-ui flex items-center gap-2"><Timer className="w-4 h-4 text-primary" /> Importar Horas do Cronômetro (Opcional)</Label>
                                <select
                                    className="flex h-12 w-full rounded-2xl border border-border-light bg-surface px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                    value={selectedOrderId}
                                    onChange={(e) => setSelectedOrderId(e.target.value)}
                                >
                                    <option value="">Selecione a encomenda para puxar as horas...</option>
                                    {orders.map(o => (
                                        <option key={o.id} value={o.id}>{o.clients?.name} - {o.description}</option>
                                    ))}
                                </select>

                                <AnimatePresence>
                                    {selectedOrderId && hasLoggedTime && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2">
                                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                                                <div className="text-sm font-ui text-text flex-1">
                                                    ⏱ Você registrou <strong className="text-primary">{Math.floor(totalMinutesLogged / 60)}h {Math.floor(totalMinutesLogged % 60)}min</strong> trabalhando nesta encomenda.<br />
                                                    Usar esse tempo na precificação?
                                                </div>
                                                <Button size="sm" onClick={applyLoggedTime} className="bg-primary hover:bg-primary-dark whitespace-nowrap">
                                                    Sim, usar
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-text-light font-ui">Custo Estimado de Materiais (Fio, Bastidor, Tecido)</Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-ui">R$</span>
                                    <Input
                                        type="number"
                                        value={custoMaterial} onChange={e => setCustoMaterial(e.target.value)}
                                        className="pl-10 h-14 rounded-2xl bg-surface border-border-light text-lg font-ui shadow-inner focus-visible:ring-primary/50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-text-light font-ui flex items-center gap-1"><Clock className="w-3 h-3" /> Horas de Ateliê</Label>
                                    <Input
                                        type="number"
                                        value={horasTrabalho} onChange={e => setHorasTrabalho(e.target.value)}
                                        className="h-14 rounded-2xl bg-surface border-border-light text-lg font-ui shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-text-light font-ui">Seu valor / Hora</Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
                                        <Input
                                            type="number"
                                            value={valorHora} onChange={e => setValorHora(e.target.value)}
                                            className="pl-10 h-14 rounded-2xl bg-surface border-border-light text-lg font-ui shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-border-light">
                                <Label className="text-text-light font-ui">Margem de Lucro Desejada (%)</Label>
                                <div className="relative">
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-ui">%</span>
                                    <Input
                                        type="number"
                                        value={margemLucro} onChange={e => setMargemLucro(e.target.value)}
                                        className="pr-10 h-14 rounded-2xl bg-surface border-border-light text-lg font-ui shadow-inner"
                                    />
                                </div>
                                <p className="text-xs text-text-muted mt-1 px-1 flex gap-1 items-center"><AlertCircle className="w-3 h-3" /> O lucro financiará o crescimento, não é salário.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Direita: Resultado em Tempo Real e IA */}
                <div className="lg:w-1/2 space-y-6">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gradient-to-br from-primary-light/5 via-surface to-primary/5 rounded-3xl p-8 border border-primary-light/30 shadow-md relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Calculator className="w-32 h-32" />
                        </div>

                        <p className="font-ui text-text-light uppercase tracking-wider text-sm mb-2 font-semibold">Preço Final Sugerido</p>
                        <div className="font-display text-5xl text-text mb-6">
                            <span className="text-3xl text-text-muted">R$</span> {totalCalculado.toFixed(2)}
                        </div>

                        <div className="flex gap-8 border-t border-primary-light/20 pt-6 mt-4 font-ui">
                            <div>
                                <p className="text-text-muted text-sm mb-1">Custo Base</p>
                                <p className="text-text font-medium text-lg">R$ {((Number(custoMaterial) || 0) + ((Number(horasTrabalho) || 0) * (Number(valorHora) || 0))).toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-accent text-sm mb-1 font-semibold">Lucro Líquido</p>
                                <p className="text-accent-light text-xl font-bold">R$ {Math.max(0, lucroLiquido).toFixed(2)}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* AI Advisor Block */}
                    <div className="bg-surface-warm rounded-3xl p-6 border border-border-light relative overflow-hidden group">
                        <h3 className="font-display text-xl text-text mb-4 flex items-center gap-2">
                            Lia, a Consultora de Preços <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                        </h3>

                        <AnimatePresence mode="wait">
                            {!aiAnalysis && !isLoading && (
                                <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <p className="font-ui text-sm text-text-light mb-6">A IA cruza seus dados de custo com padrões de concorrência orgânica para dizer se esse preço perfomará no ateliê atual.</p>
                                    <Button
                                        onClick={handleAnalyzeAI}
                                        className="w-full bg-accent hover:bg-accent-light text-white font-ui h-12 rounded-xl"
                                    >
                                        Analisar viabilidade do Preço
                                    </Button>
                                </motion.div>
                            )}

                            {isLoading && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center p-8">
                                    <Calculator className="w-8 h-8 text-accent animate-bounce" />
                                </motion.div>
                            )}

                            {aiAnalysis && !isLoading && (
                                <motion.div key="analysis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 shadow-sm border border-border/50 text-sm font-ui text-text-light leading-relaxed">
                                    <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\*\*(.*?)\*\*/g, '<b class="text-text">$1</b>') }} />
                                    <Button variant="link" onClick={() => setAiAnalysis(null)} className="p-0 text-primary hover:text-primary-dark mt-4">
                                        Fazer nova análise <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
