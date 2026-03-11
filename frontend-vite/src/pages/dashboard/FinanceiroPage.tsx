
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Plus, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function FinanceiroPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [filter, setFilter] = useState('mes');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAllTransactionsOpen, setIsAllTransactionsOpen] = useState(false);

    // Filter states
    const [filterPeriod, setFilterPeriod] = useState('este_mes');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterType, setFilterType] = useState('Todos');
    const [filterCat, setFilterCat] = useState('Todas');

    // States list & metrics
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [monthlyReceitas, setMonthlyReceitas] = useState(0);
    const [monthlyDespesas, setMonthlyDespesas] = useState(0);
    const [chartData, setChartData] = useState<any[]>([]);

    // Form states
    const [txType, setTxType] = useState('receita');
    const [txAmount, setTxAmount] = useState('');
    const [txDesc, setTxDesc] = useState('');
    const [txCat, setTxCat] = useState('Vendas');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            fetchFinancialData();
        }
    }, [user]);

    const fetchFinancialData = async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfYear = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString(); // L12M

        // 1. Fetch Transações Recentes (Últimas 5)
        const { data: recents } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('user_id', user?.id)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(5);

        if (recents) setRecentTransactions(recents);

        // 2. Transações do Mês Atual (para KPIs)
        const { data: currentMonthTx } = await supabase
            .from('financial_transactions')
            .select('amount, type')
            .eq('user_id', user?.id)
            .gte('transaction_date', startOfMonth);

        let rec = 0, des = 0;
        if (currentMonthTx) {
            currentMonthTx.forEach(tx => {
                if (tx.type === 'receita') rec += Number(tx.amount);
                else des += Number(tx.amount);
            });
        }
        setMonthlyReceitas(rec);
        setMonthlyDespesas(des);

        // 3. Agregação p/ Gráfico (Últimos 12 meses)
        const { data: allYearTx } = await supabase
            .from('financial_transactions')
            .select('amount, type, transaction_date')
            .eq('user_id', user?.id)
            .gte('transaction_date', startOfYear);

        const monthsMap: Record<string, number> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            monthsMap[label] = 0; // init 0
        }

        if (allYearTx) {
            allYearTx.forEach(tx => {
                const date = new Date(tx.transaction_date + 'T12:00:00Z');
                const label = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                if (monthsMap[label] !== undefined) {
                    // Somamos no gráfico a Receita? Ou Lucro? O Mock chama de "Fluxo". Fluxo = Entradas. Vamos pôr Receitas
                    if (tx.type === 'receita') {
                        monthsMap[label] += Number(tx.amount);
                    }
                }
            });
        }

        const buildChart = Object.keys(monthsMap).map(k => ({
            name: k.charAt(0).toUpperCase() + k.slice(1),
            value: monthsMap[k]
        }));
        setChartData(buildChart);
    };

    const fetchFilteredTransactions = async () => {
        if (!user) return;
        let query = supabase
            .from('financial_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false });

        const today = new Date();
        if (filterPeriod === 'este_mes') {
            query = query.gte('transaction_date', new Date(today.getFullYear(), today.getMonth(), 1).toISOString());
        } else if (filterPeriod === 'ultimos_3_meses') {
            query = query.gte('transaction_date', new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString());
        } else if (filterPeriod === 'este_ano') {
            query = query.gte('transaction_date', new Date(today.getFullYear(), 0, 1).toISOString());
        } else if (filterPeriod === 'personalizado' && filterDateStart && filterDateEnd) {
            query = query.gte('transaction_date', new Date(filterDateStart).toISOString());
            query = query.lte('transaction_date', new Date(filterDateEnd).toISOString());
        }

        if (filterType !== 'Todos') {
            query = query.eq('type', filterType === 'Receitas' ? 'receita' : 'despesa');
        }

        if (filterCat !== 'Todas') {
            query = query.eq('category', filterCat);
        }

        query = query.limit(50); // Aumentado limite para filtros verem ais

        const { data } = await query;
        if (data) setRecentTransactions(data);
    };

    useEffect(() => {
        fetchFilteredTransactions();
    }, [filterPeriod, filterDateStart, filterDateEnd, filterType, filterCat, user]);

    const handleSaveTransaction = async () => {
        if (!txAmount || !txDesc || isNaN(Number(txAmount))) {
            toast({ title: "Incompleto", description: "Preencha valor e descrição corretamente.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const { error } = await supabase.from('financial_transactions').insert({
            user_id: user?.id,
            description: txDesc,
            amount: Number(txAmount),
            type: txType,
            category: txCat,
        });
        setIsSaving(false);

        if (!error) {
            toast({ title: "Sucesso", description: "Transação adicionada!" });
            setIsAddOpen(false);
            setTxAmount(''); setTxDesc(''); setTxCat('Vendas'); setTxType('receita');
            fetchFinancialData();
            fetchFilteredTransactions();
        } else {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-24 lg:pb-12 relative min-h-screen">
            <div className="flex justify-between items-end mb-8 sm:hidden">
                <h1 className="font-display text-3xl text-text">Caixa</h1>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-surface rounded-3xl p-6 border border-border-light shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingUp className="w-24 h-24" /></div>
                    <p className="font-ui text-text-light text-sm mb-2 flex items-center gap-2">Receitas Mês <ArrowUpRight className="w-4 h-4 text-accent" /></p>
                    <p className="font-display text-xl sm:text-3xl text-text">R$ {monthlyReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-surface rounded-3xl p-6 border border-border-light shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingDown className="w-24 h-24" /></div>
                    <p className="font-ui text-text-light text-sm mb-2 flex items-center gap-2">Despesas Mês <ArrowDownRight className="w-4 h-4 text-warn" /></p>
                    <p className="font-display text-xl sm:text-3xl text-text">R$ {monthlyDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-gradient-to-br from-primary-light/10 to-surface rounded-3xl p-6 border border-primary-light/30 shadow-sm">
                    <p className="font-ui text-text-light text-sm mb-2 flex items-center gap-2">Saldo Mês <DollarSign className="w-4 h-4 text-primary" /></p>
                    <p className="font-display text-xl sm:text-3xl text-primary-dark">R$ {(monthlyReceitas - monthlyDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border-light shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-display text-2xl text-text">Fluxo Anual</h2>
                            <Tabs value={filter} onValueChange={setFilter}>
                                <TabsList className="bg-surface-warm">
                                    <TabsTrigger value="mes" className="rounded-lg">Mês</TabsTrigger>
                                    <TabsTrigger value="ano" className="rounded-lg">Ano</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="h-[220px] sm:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} dx={-10} />
                                    <Tooltip
                                        cursor={{ fill: 'var(--color-surface-warm)' }}
                                        contentStyle={{ borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? 'var(--color-primary)' : 'var(--color-border)'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="flex justify-between items-center hidden lg:flex">
                        <h2 className="font-display text-2xl text-text">Transações</h2>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-text-muted hover:text-text rounded-full"><Filter className="w-5 h-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 p-4 space-y-4 rounded-xl border-border-light shadow-md bg-surface">
                                <DropdownMenuLabel className="font-display text-lg px-0">Filtros</DropdownMenuLabel>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-text-light font-ui uppercase font-bold tracking-wider">Período</Label>
                                    <select
                                        value={filterPeriod}
                                        onChange={(e) => setFilterPeriod(e.target.value)}
                                        className="w-full text-sm rounded-lg border border-border-light bg-background p-2 focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="este_mes">Este mês</option>
                                        <option value="ultimos_3_meses">Últimos 3 meses</option>
                                        <option value="este_ano">Este ano</option>
                                        <option value="personalizado">Personalizado</option>
                                    </select>
                                </div>

                                {filterPeriod === 'personalizado' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-text-light">De</Label>
                                            <Input type="date" className="h-8 text-xs px-2" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-text-light">Até</Label>
                                            <Input type="date" className="h-8 text-xs px-2" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-text-light font-ui uppercase font-bold tracking-wider">Tipo</Label>
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="w-full text-sm rounded-lg border border-border-light bg-background p-2 focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="Todos">Todos</option>
                                        <option value="Receitas">Receitas</option>
                                        <option value="Despesas">Despesas</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-text-light font-ui uppercase font-bold tracking-wider">Categoria</Label>
                                    <select
                                        value={filterCat}
                                        onChange={(e) => setFilterCat(e.target.value)}
                                        className="w-full text-sm rounded-lg border border-border-light bg-background p-2 focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="Todas">Todas</option>
                                        <option value="Vendas">Vendas</option>
                                        <option value="Materiais">Materiais</option>
                                        <option value="Fixos">Fixos</option>
                                        <option value="Serviços">Serviços</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>

                                <DropdownMenuSeparator className="bg-border-light" />

                                <Button
                                    variant="outline"
                                    className="w-full text-text-light hover:text-text border-border-light"
                                    onClick={() => {
                                        setFilterPeriod('este_mes');
                                        setFilterType('Todos');
                                        setFilterCat('Todas');
                                        setFilterDateStart('');
                                        setFilterDateEnd('');
                                    }}
                                >
                                    Limpar Filtros
                                </Button>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-3">
                        {recentTransactions.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-text-muted font-ui text-sm mb-4">Nenhuma transação ainda.</p>
                                <Button onClick={() => setIsAddOpen(true)} variant="outline" className="rounded-full shadow-sm text-primary">
                                    Adicionar primeira transação
                                </Button>
                            </div>
                        ) : (
                            recentTransactions.map((rec) => (
                                <motion.div
                                    key={rec.id}
                                    whileHover={{ y: -2 }}
                                    className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-light shadow-sm"
                                >
                                    <div className="flex items-center gap-4 max-w-[65%]">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rec.type === 'receita' ? 'bg-accent/10 text-accent' : 'bg-warn/10 text-warn'}`}>
                                            {rec.type === 'receita' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                        </div>
                                        <div className="truncate">
                                            <p className="font-ui font-semibold text-text text-sm truncate">{rec.description}</p>
                                            <p className="font-ui text-xs text-text-light flex gap-2">
                                                <span>{new Date(rec.transaction_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span> • <span className="opacity-70 truncate">{rec.category}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`font-ui font-semibold shrink-0 ${rec.type === 'receita' ? 'text-accent' : 'text-text'}`}>
                                        {rec.type === 'receita' ? '+' : '-'}R$ {Number(rec.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {recentTransactions.length > 0 && (
                        <Button onClick={() => setIsAllTransactionsOpen(true)} variant="outline" className="w-full rounded-xl border-dashed border-2 border-border-light text-text-muted hover:text-text hover:border-primary-light h-12">
                            Ver todas transações
                        </Button>
                    )}
                </div>
            </div>

            {/* Sheet para Todas as Transações */}
            <Sheet open={isAllTransactionsOpen} onOpenChange={setIsAllTransactionsOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl pb-safe h-[85vh] flex flex-col items-center">
                    <SheetHeader className="mb-4 w-full text-left">
                        <SheetTitle className="font-display text-text text-xl pt-2">Todas as Transações</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto w-full space-y-3 pb-8 px-1">
                        {recentTransactions.map((rec) => (
                            <div
                                key={`${rec.id}-all`}
                                className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border-light shadow-sm"
                            >
                                <div className="flex items-center gap-4 max-w-[65%]">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rec.type === 'receita' ? 'bg-accent/10 text-accent' : 'bg-warn/10 text-warn'}`}>
                                        {rec.type === 'receita' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                    </div>
                                    <div className="truncate">
                                        <p className="font-ui font-semibold text-text text-sm truncate">{rec.description}</p>
                                        <p className="font-ui text-xs text-text-light flex gap-2">
                                            <span>{new Date(rec.transaction_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span> • <span className="opacity-70 truncate">{rec.category}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className={`font-ui font-semibold shrink-0 ${rec.type === 'receita' ? 'text-accent' : 'text-text'}`}>
                                    {rec.type === 'receita' ? '+' : '-'}R$ {Number(rec.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            {/* FAB Mobile & Desktop Inject */}
            <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
                <SheetTrigger asChild>
                    <Button className="fixed bottom-20 lg:bottom-12 right-6 lg:right-12 w-14 h-14 rounded-full bg-primary hover:bg-primary-dark shadow-[0_8px_30px_rgba(201,123,132,0.4)] text-white p-0 hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md bg-surface-warm border-l border-border-light p-6 sm:p-8 overflow-y-auto">
                    <SheetHeader className="mb-8">
                        <SheetTitle className="font-display text-3xl text-text text-left">Novo Registro</SheetTitle>
                    </SheetHeader>

                    <form className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div
                                onClick={() => setTxType('receita')}
                                className={`border-2 rounded-2xl p-4 text-center cursor-pointer font-semibold font-ui shadow-sm transition-all ${txType === 'receita' ? 'border-accent bg-accent/5 text-accent' : 'border-border-light text-text-muted hover:border-accent/40'}`}
                            >
                                <ArrowUpRight className="w-6 h-6 mx-auto mb-2" /> Receita
                            </div>
                            <div
                                onClick={() => setTxType('despesa')}
                                className={`border-2 rounded-2xl p-4 text-center cursor-pointer font-semibold font-ui shadow-sm transition-all ${txType === 'despesa' ? 'border-warn bg-warn/5 text-warn' : 'border-border-light text-text-muted hover:border-warn/40'}`}
                            >
                                <ArrowDownRight className="w-6 h-6 mx-auto mb-2" /> Despesa
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-ui text-text-light">Valor</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-ui">R$</span>
                                <Input type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className="pl-10 h-14 rounded-2xl font-display text-2xl text-text shadow-inner" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-ui text-text-light">Descrição</Label>
                            <Input value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Ex: Venda Risco Minimalista" className="h-14 rounded-2xl shadow-inner" />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-ui text-text-light">Categoria</Label>
                            <select value={txCat} onChange={e => setTxCat(e.target.value)} className="flex h-14 w-full items-center justify-between rounded-2xl border border-input bg-surface px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/50 text-text">
                                <option value="Vendas">Vendas</option>
                                <option value="Materiais">Materiais</option>
                                <option value="Fixos">Fixos</option>
                                <option value="Serviços">Serviços</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>

                        <Button type="button" disabled={isSaving} onClick={handleSaveTransaction} className="w-full h-14 rounded-full bg-primary hover:bg-primary-dark shadow-md text-base mt-4">
                            {isSaving ? 'Salvando...' : 'Salvar Registro'}
                        </Button>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    );
}
