import React, { useEffect, useState } from 'react';
import { gestaoApi } from '@/lib/api/gestao';
import type { Order } from '@/lib/api/gestao';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Calendar as CalendarIcon, List, Archive, CheckCircle, Package, Trash2, Edit, Clock, DollarSign, AlertTriangle, ArrowRight, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModal } from '@/contexts/ModalContext';
import { useLocation } from 'react-router-dom';

export default function AgendaPage() {
    const location = useLocation();
    const { showAlert, showConfirm } = useModal();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<any[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        client_id: '',
        description: '',
        start_date: '',
        delivery_date: '',
        value: 0,
        notes: '',
        status: 'em_aberto' as any,
        photo_url: null as string | null,
        orcamento_id: undefined as string | undefined
    });

    const [prazoDiasExtra, setPrazoDiasExtra] = useState<number | null>(null);

    const [finishModalOpen, setFinishModalOpen] = useState(false);
    const [selectedOrderToFinish, setSelectedOrderToFinish] = useState<any>(null);

    // History Drawer State
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any>(null);

    const [inventory, setInventory] = useState<any[]>([]);
    const [materialsUsed, setMaterialsUsed] = useState<{ inventory_item_id: string, item_name: string, quantity: number, unit_cost: number }[]>([]);
    const [finishing, setFinishing] = useState(false);

    // Relativos ao Calendário
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const handlePrevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
        else setCurrentMonth(currentMonth - 1);
        setSelectedDay(null);
    };
    const handleNextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
        else setCurrentMonth(currentMonth + 1);
        setSelectedDay(null);
    };

    useEffect(() => {
        loadOrders();
        gestaoApi.getClients().then(setClients).catch(console.error);
        gestaoApi.getInventory().then(setInventory).catch(console.error);
    }, []);

    // Recepcionar dados do OrçamentosPage via location.state
    useEffect(() => {
        if (location.state?.novoAgendamento && clients.length > 0) {
            const { client_id, description, value, notes, prazoDias, cliente_nome, orcamento_id } = location.state.novoAgendamento;
            
            let matchedClientId = client_id;
            if (!matchedClientId && cliente_nome) {
                const found = clients.find(c => c.name.toLowerCase() === cliente_nome.toLowerCase());
                if (found) matchedClientId = found.id;
            }

            setFormData(prev => ({
                ...prev,
                client_id: matchedClientId || '',
                description: description || '',
                value: value || 0,
                notes: notes || '',
                orcamento_id: orcamento_id || undefined
            }));
            
            if (prazoDias) {
                const matches = prazoDias.match(/\d+/);
                if (matches) {
                    setPrazoDiasExtra(Number(matches[0]));
                }
            }
            
            setIsCreateOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, clients]);

    // Calcular data de entrega automática baseada no prazo do orçamento
    useEffect(() => {
        if (formData.start_date && prazoDiasExtra && formData.start_date.length === 10) {
            const yearAsNumber = parseInt(formData.start_date.split('-')[0], 10);
            if (yearAsNumber >= 2000) {
                const startDate = new Date(formData.start_date + 'T12:00:00Z');
                // Adiciona dias corridos baseado no numero extraído
                startDate.setDate(startDate.getDate() + prazoDiasExtra);
                const yyyy = startDate.getFullYear();
                const mm = String(startDate.getMonth() + 1).padStart(2, '0');
                const dd = String(startDate.getDate()).padStart(2, '0');
                
                setFormData(prev => ({ ...prev, delivery_date: `${yyyy}-${mm}-${dd}` }));
                setPrazoDiasExtra(null); // Limpa para não recalcular se o user mexer dps
                showAlert('Prazo Calculado', `A data de entrega foi definida automaticamente para somar os ${prazoDiasExtra} dias do orçamento.`);
            }
        }
    }, [formData.start_date]);

    async function loadOrders() {
        try {
            const data = await gestaoApi.getOrders();
            setOrders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingOrderId) {
                await gestaoApi.updateOrder(editingOrderId, formData);
            } else {
                await gestaoApi.createOrder(formData);
            }

            // Reload para trazer client joinado
            await loadOrders();
            setIsCreateOpen(false);
            setFormData({ client_id: '', description: '', start_date: '', delivery_date: '', value: 0, notes: '', status: 'em_aberto' as any, photo_url: null, orcamento_id: undefined });
            setEditingOrderId(null);
        } catch (e) {
            console.error(e);
            showAlert('Erro', 'Erro ao salvar encomenda');
        } finally {
            setSaving(false);
        }
    }

    function openEditModal(order: any) {
        setEditingOrderId(order.id);
        setFormData({
            client_id: order.client_id,
            description: order.description,
            start_date: order.start_date || '',
            delivery_date: order.delivery_date || '',
            value: order.value,
            notes: order.notes || '',
            status: order.status || 'em_aberto',
            photo_url: order.photo_url,
            orcamento_id: order.orcamento_id
        });
        setIsCreateOpen(true);
    }

    const emAberto = orders.filter(o => o.status !== 'entregue');
    const historico = orders.filter(o => o.status === 'finalizado' || o.status === 'entregue');

    // Métricas Resumo
    const hojeLocal = new Date();
    hojeLocal.setHours(0, 0, 0, 0);

    const proximos7dias = new Date(hojeLocal);
    proximos7dias.setDate(proximos7dias.getDate() + 7);

    const mesAtual = hojeLocal.getMonth();
    const anoAtual = hojeLocal.getFullYear();

    const entregasProximaSemana = emAberto.filter((o: any) => {
        if (!o.delivery_date) return false;
        const [year, month, day] = o.delivery_date.split('T')[0].split('-');
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        d.setHours(0, 0, 0, 0);
        return d >= hojeLocal && d <= proximos7dias;
    }).length;

    const faturamentoMes = historico.filter((o: any) => {
        if (!o.delivery_date) return false;
        const [year, month, day] = o.delivery_date.split('T')[0].split('-');
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        // Consider both 'finalizado' and 'entregue' for monthly revenue
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }).reduce((acc: number, o: any) => acc + Number(o.value), 0);

    const isAtrasado = (date: string) => {
        if (!date) return false;
        const [year, month, day] = date.split('T')[0].split('-');
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        d.setHours(0, 0, 0, 0);
        return d < hojeLocal;
    };

    async function handleDeleteOrder(id: string) {
        showConfirm('Excluir Encomenda', 'Deseja excluir definitivamente esta encomenda?', async () => {
            try {
                await gestaoApi.deleteOrder(id);
                setOrders(orders.filter(o => o.id !== id));
            } catch (e) {
                console.error(e);
                showAlert('Erro', 'Falha ao excluir');
            }
        });
    }

    function openFinishModal(order: any) {
        setSelectedOrderToFinish(order);
        setMaterialsUsed([]); // reset list
        setFinishModalOpen(true);
    }

    async function handleFinishOrder() {
        if (!selectedOrderToFinish) return;
        setFinishing(true);
        try {
            // Registrar cada material utilizado na API (que automaticamente dá baixa no estoque via backend se tiver ID acoplado)
            for (const mat of materialsUsed) {
                if (mat.quantity > 0) {
                    await gestaoApi.addOrderMaterial({
                        order_id: selectedOrderToFinish.id,
                        inventory_item_id: mat.inventory_item_id || null,
                        item_name: mat.item_name,
                        quantity: mat.quantity,
                        unit_cost: mat.unit_cost
                    });
                }
            }
            // Atualizar status finalizado
            await gestaoApi.updateOrderStatus(selectedOrderToFinish.id, 'finalizado');
            await loadOrders();
            setFinishModalOpen(false);
        } catch (e) {
            console.error(e);
            showAlert('Erro', 'Erro ao finalizar encomenda e abater estoque');
        } finally {
            setFinishing(false);
        }
    }

    // Variáveis úteis pro Calendário
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const ordersThisMonth = orders.filter(o => {
        // Ignora tz offsets localmente, usa a string limpa
        const d = new Date(o.delivery_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display text-3xl text-text">Agenda de Produção</h1>
                    <p className="font-ui text-text-light">Acompanhe suas encomendas, prazos e faturamento.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) {
                        setEditingOrderId(null);
                        setFormData({ client_id: '', description: '', start_date: '', delivery_date: '', value: 0, notes: '', status: 'em_aberto' as any, photo_url: null, orcamento_id: undefined });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary-dark shadow-sm">
                            <Plus className="w-5 h-5 mr-2" />
                            Nova Encomenda
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
                        <DialogHeader><DialogTitle>{editingOrderId ? 'Editar Encomenda' : 'Registrar Encomenda'}</DialogTitle></DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <select required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    <option value="" disabled>Selecione uma cliente...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição do Bordado</Label>
                                <Input required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Bastidor porta-maternidade 20cm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Data de Início</Label>
                                    <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Data de Entrega</Label>
                                    <Input required type="date" value={formData.delivery_date} onChange={e => setFormData({ ...formData, delivery_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Status da Encomenda</Label>
                                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    <option value="em_aberto">⏳ Em aberto</option>
                                    <option value="em_andamento">🪡 Em andamento</option>
                                    <option value="pronto">✅ Pronto</option>
                                    <option value="entregue">📦 Entregue</option>
                                    <option value="finalizado">✅ Finalizado (Estoque abatido)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Valor Cobrado (R$)</Label>
                                <Input required type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Observações</Label>
                                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>
                            <Button type="submit" disabled={saving || !formData.client_id} className="w-full bg-primary mt-2">Salvar Encomenda</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div className="bg-surface p-4 rounded-xl border border-border-light shadow-sm flex flex-col justify-center">
                    <div className="text-sm text-text-light mb-1 font-ui">Em Andamento</div>
                    <div className="text-3xl font-display text-text">{emAberto.length}</div>
                </div>
                <div className={`bg-surface p-4 rounded-xl border shadow-sm flex flex-col justify-center ${entregasProximaSemana > 0 ? 'border-warn/50' : 'border-border-light'}`}>
                    <div className="text-sm text-text-light flex items-center mb-1 font-ui">
                        Prazo esta semana
                        {entregasProximaSemana > 0 && <Badge className="ml-2 bg-warn/20 text-warn-dark border-0 hover:bg-warn/30">{entregasProximaSemana} vencendo</Badge>}
                    </div>
                    <div className={`text-3xl font-display ${entregasProximaSemana > 0 ? 'text-warn-dark' : 'text-text'}`}>
                        {entregasProximaSemana}
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border-light shadow-sm flex flex-col justify-center">
                    <div className="text-sm text-text-light mb-1 font-ui">Faturamento do Mês</div>
                    <div className="text-3xl font-display text-success-dark font-medium">
                        R$ {faturamentoMes.toFixed(2)}
                    </div>
                </div>
            </div>

            <Tabs defaultValue="lista" className="w-full">
            <div className="sticky top-[-1px] z-30 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:relative sm:top-0 sm:bg-transparent sm:py-0 sm:mx-0 sm:px-0 sm:mb-6">
                <TabsList className="flex gap-2 w-full justify-start overflow-x-auto border-0 bg-transparent p-0 font-ui no-scrollbar relative min-w-0 pr-4 -mx-1 px-1">
                    <TabsTrigger value="lista" className="rounded-full px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-surface data-[state=inactive]:text-text data-[state=inactive]:border data-[state=inactive]:border-border-light shadow-sm transition-all whitespace-nowrap">
                        <List className="w-4 h-4 mr-2" /> Em Aberto
                    </TabsTrigger>
                    <TabsTrigger value="calendario" className="rounded-full px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-surface data-[state=inactive]:text-text data-[state=inactive]:border data-[state=inactive]:border-border-light shadow-sm transition-all whitespace-nowrap">
                        <CalendarIcon className="w-4 h-4 mr-2" /> Calendário
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="rounded-full px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-surface data-[state=inactive]:text-text data-[state=inactive]:border data-[state=inactive]:border-border-light shadow-sm transition-all whitespace-nowrap">
                        <Archive className="w-4 h-4 mr-2" /> Histórico
                    </TabsTrigger>
                </TabsList>
            </div>

                <TabsContent value="lista" className="space-y-4 min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : emAberto.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-text-light font-ui bg-surface border border-border-light rounded-2xl shadow-sm">
                            <Package className="w-16 h-16 mb-4 text-border" strokeWidth={1} />
                            <h3 className="text-xl font-display text-text mb-2">Nenhuma encomenda ainda</h3>
                            <p className="mb-6">Crie sua primeira encomenda para começar a organizar sua produção.</p>
                            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary-dark shadow-sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Criar primeira encomenda
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {emAberto.map(order => {
                                const atrasada = order.status === 'em_andamento' && isAtrasado(order.delivery_date);
                                const borderColor = order.status === 'em_andamento' ? 'border-l-warn' : order.status === 'finalizado' ? 'border-l-success' : 'border-l-accent';
                                const badgeColor = order.status === 'em_andamento' ? 'bg-warn/20 text-warn-dark hover:bg-warn/30' : order.status === 'finalizado' ? 'bg-success/20 text-success-dark hover:bg-success/30' : 'bg-accent/20 text-accent hover:bg-accent/30';
                                const statusLabel = order.status === 'em_andamento' ? 'Em andamento' : order.status === 'finalizado' ? 'Finalizado' : 'Entregue';

                                return (
                                    <div key={order.id} className={`bg-surface rounded-xl border border-border-light shadow-sm flex flex-col justify-between overflow-hidden relative border-l-4 ${borderColor}`}>
                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <h3 className="font-display font-medium text-lg text-text leading-tight truncate">{order.clients?.name}</h3>
                                                <div className="flex flex-col gap-1 items-end">
                                                    <Badge className={`border-0 whitespace-nowrap ${badgeColor}`}>
                                                        {statusLabel}
                                                    </Badge>
                                                    {atrasada && <Badge variant="destructive" className="border-0 capitalize whitespace-nowrap bg-destructive/10 text-destructive hover:bg-destructive/20">Atrasada</Badge>}
                                                </div>
                                            </div>
                                            <p className="text-text-light font-ui text-sm line-clamp-2 mb-4 min-h-[40px]">
                                                {order.description}
                                            </p>
                                            <div className="flex items-center justify-between text-sm font-ui mb-4">
                                                <div className="flex items-center text-text-muted gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {new Date(order.delivery_date).toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="flex items-center text-success-dark font-medium gap-1 bg-success/10 px-2 py-1 rounded-md">
                                                    <DollarSign className="w-4 h-4" />
                                                    {Number(order.value).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-surface-warm border-t border-border-light grid grid-cols-2 gap-2">
                                            {order.status === 'em_andamento' && (
                                                <Button size="sm" onClick={() => openFinishModal(order)} className="w-full bg-primary hover:bg-primary-dark text-white font-medium col-span-2">
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Finalizar
                                                </Button>
                                            )}
                                            {order.status === 'finalizado' && (
                                                <Button size="sm" variant="outline" onClick={() => gestaoApi.updateOrderStatus(order.id, 'entregue').then(loadOrders)} className="w-full bg-white border-primary text-primary-dark hover:bg-[#FDF0F0] hover:text-primary-dark col-span-2">
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Marcar como Entregue
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => openEditModal(order)} className="w-full bg-white text-text-light hover:text-text border-border-light">
                                                <Edit className="w-4 h-4 mr-2" />
                                                Editar
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleDeleteOrder(order.id)} className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 border-border-light">
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Excluir
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="calendario" className="space-y-6 min-h-[400px]">
                    <div className="bg-surface border border-border-light rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-display text-xl text-text font-medium">{monthNames[currentMonth]} {currentYear}</h3>
                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="w-5 h-5" /></Button>
                                <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="w-5 h-5" /></Button>
                            </div>
                        </div>
                        {/* Headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} className="gap-2 text-center font-ui text-text-light text-sm mb-2 font-medium">
                            <div className="py-2 hidden md:block">Domingo</div><div className="py-2 md:hidden">Dom</div>
                            <div className="py-2 hidden md:block">Segunda</div><div className="py-2 md:hidden">Seg</div>
                            <div className="py-2 hidden md:block">Terça</div><div className="py-2 md:hidden">Ter</div>
                            <div className="py-2 hidden md:block">Quarta</div><div className="py-2 md:hidden">Qua</div>
                            <div className="py-2 hidden md:block">Quinta</div><div className="py-2 md:hidden">Qui</div>
                            <div className="py-2 hidden md:block">Sexta</div><div className="py-2 md:hidden">Sex</div>
                            <div className="py-2 hidden md:block">Sábado</div><div className="py-2 md:hidden">Sáb</div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px 0', marginBottom: '16px' }}>
                            {[
                                { status: 'em_aberto', label: 'Em aberto' },
                                { status: 'em_andamento', label: 'Em andamento' },
                                { status: 'pronto', label: 'Pronto' },
                                { status: 'entregue', label: 'Entregue' },
                            ].map(item => (
                                <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '24px', height: '6px', borderRadius: '999px', background: ({'em_aberto': '#9CA3AF', 'em_andamento': '#C29A51', 'pronto': '#16A34A', 'entregue': '#AC5148', 'finalizado': '#16A34A'} as any)[item.status] || '#6B6B6B' }} />
                                    <span style={{ fontSize: '12px', color: '#6B6B6B', fontWeight: 600 }}>{item.label}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '24px', height: '6px', borderRadius: '999px', background: 'linear-gradient(to right, #C29A51, #16A34A)' }} />
                                <span style={{ fontSize: '12px', color: '#6B6B6B', fontWeight: 600 }}>Período do bordado</span>
                            </div>
                        </div>

                        {/* Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} className="gap-2">
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="min-h-24 md:min-h-32 rounded-xl bg-surface-warm/30 border border-transparent" />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const currDate = new Date(currentYear, currentMonth, day);
                                const dailyOrders = ordersThisMonth.filter(o => {
                                    if (!o.delivery_date) return false;
                                    const dEnd = new Date(o.delivery_date + 'T12:00:00Z'); dEnd.setHours(0,0,0,0);
                                    if (o.start_date) {
                                        const dStart = new Date(o.start_date + 'T12:00:00Z'); dStart.setHours(0,0,0,0);
                                        return currDate >= dStart && currDate <= dEnd;
                                    }
                                    return dEnd.getDate() === day;
                                });
                                const hasOrders = dailyOrders.length > 0;
                                const isSelected = selectedDay === day;
                                const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
                                return (
                                    <div
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        className={`min-h-24 md:min-h-32 border rounded-xl p-1 md:p-2 cursor-pointer transition-all relative flex flex-col items-center justify-start pt-2 shadow-sm hover:shadow-md
                                        ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border-light bg-surface hover:border-primary/40'}
                                        ${isToday && !isSelected ? 'border-primary/50 bg-primary/5' : ''}`}
                                    >
                                        <span className={`text-sm md:text-base font-medium w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full ${isSelected ? 'bg-primary text-white' : isToday ? 'text-primary bg-primary/10' : 'text-text'}`}>
                                            {day}
                                        </span>
                                        {hasOrders && (
                                            <div className="mt-1 md:mt-2 flex flex-col gap-1 w-full px-1">
                                                {/* Desktop Cards */}
                                                <div className="hidden md:flex flex-col gap-1 w-full">
                                                    {dailyOrders.slice(0, 3).map((o, idx) => {
                                                        const isPeriod = Boolean(o.start_date);
                                                        const dEnd = new Date(o.delivery_date + 'T12:00:00Z'); dEnd.setHours(0,0,0,0);
                                                        const dStart = o.start_date ? new Date(o.start_date + 'T12:00:00Z') : null; if(dStart) dStart.setHours(0,0,0,0);
                                                        
                                                        const isStartDay = dStart && currDate.getTime() === dStart.getTime();
                                                        const isEndDay = currDate.getTime() === dEnd.getTime();
                                                        const isMiddle = isPeriod && !isStartDay && !isEndDay;
                                                        
                                                        const bg = ({'em_aberto': '#9CA3AF', 'em_andamento': '#C29A51', 'pronto': '#16A34A', 'entregue': '#AC5148', 'finalizado': '#16A34A'} as any)[o.status] || '#6B6B6B';
                                                        
                                                        return (
                                                            <div key={idx}
                                                                onClick={(e) => { e.stopPropagation(); setSelectedHistoryOrder(o); setIsHistoryDrawerOpen(true); }}
                                                                className={`text-[10px] text-white p-1 cursor-pointer hover:opacity-80 transition-opacity font-medium pointer-events-auto z-10`}
                                                                style={{ 
                                                                    backgroundColor: bg,
                                                                    width: isPeriod ? 'calc(100% + 16px)' : '100%',
                                                                    marginLeft: isPeriod && !isStartDay ? '-8px' : '0',
                                                                    marginRight: isPeriod && !isEndDay ? '-8px' : '0',
                                                                    paddingLeft: isPeriod && !isStartDay ? '0' : '4px',
                                                                    borderTopLeftRadius: isStartDay || !isPeriod ? '4px' : '0',
                                                                    borderBottomLeftRadius: isStartDay || !isPeriod ? '4px' : '0',
                                                                    borderTopRightRadius: isEndDay || !isPeriod ? '4px' : '0',
                                                                    borderBottomRightRadius: isEndDay || !isPeriod ? '4px' : '0',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'clip'
                                                                }}>
                                                                {(isStartDay || !isPeriod || currDate.getDay() === 0) ? <span className="truncate block">{o.clients?.name}</span> : <span className="opacity-0">{o.clients?.name}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                    {dailyOrders.length > 3 && <div className="text-[10px] text-text-muted text-center font-medium py-0.5">+{dailyOrders.length - 3} encomendas</div>}
                                                </div>

                                                {/* Mobile Dots */}
                                                <div className="flex md:hidden flex-wrap justify-center gap-1 mt-1">
                                                    {dailyOrders.slice(0, 4).map((o, idx) => {
                                                        const bg = ({'em_aberto': '#9CA3AF', 'em_andamento': '#C29A51', 'pronto': '#16A34A', 'entregue': '#AC5148', 'finalizado': '#16A34A'} as any)[o.status] || '#6B6B6B';
                                                        return <div key={idx} className="w-2 h-2 rounded-full" style={{ backgroundColor: bg }} />
                                                    })}
                                                    {dailyOrders.length > 4 && <div className="text-[8px] text-text-light font-ui leading-none flex items-center">+{dailyOrders.length - 4}</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Pedidos do dia selecionado */}
                    {/* Pedidos do dia selecionado (Desktop List) */}
                    {selectedDay && (
                        <div className="hidden md:block bg-surface border border-border-light rounded-2xl p-6 shadow-sm mt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-display text-lg text-text">Entregas para {selectedDay} de {monthNames[currentMonth]}</h4>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)} className="text-text-light hover:bg-surface-warm"><X className="w-4 h-4" /></Button>
                            </div>
                            {(() => {
                                const dailyOrders = ordersThisMonth.filter(o => new Date(o.delivery_date).getDate() === selectedDay);
                                if (dailyOrders.length === 0) return <p className="text-sm text-text-light font-ui">Livre! Sem entregas agendadas hoje.</p>;
                                return (
                                    <div className="space-y-3">
                                        {dailyOrders.map(o => (
                                            <div key={o.id} onClick={() => { setSelectedHistoryOrder(o); setIsHistoryDrawerOpen(true); }} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border-light cursor-pointer hover:border-primary/50 transition-colors">
                                                <div className="flex-1 pr-4">
                                                    <div className="font-medium text-text">{o.clients?.name}</div>
                                                    <div className="text-sm text-text-light line-clamp-1">{o.description}</div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-accent">R$ {Number(o.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                    <Badge className={`whitespace-nowrap ${o.status === 'em_andamento' ? 'bg-warn/20 text-warn-dark border-0' : o.status === 'finalizado' ? 'bg-success/20 text-success-dark border-0' : 'bg-accent/20 text-accent border-0'}`}>
                                                        {o.status === 'em_andamento' ? 'Em andamento' : o.status === 'finalizado' ? 'Pronta' : 'Entregue'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Pedidos do dia selecionado (Mobile Bottom Sheet) */}
                    <Sheet open={!!selectedDay && window.innerWidth < 768} onOpenChange={(open) => !open && setSelectedDay(null)}>
                        <SheetContent side="bottom" className="w-full rounded-t-2xl px-4 pb-8 h-[80vh] overflow-y-auto block md:hidden">
                            <SheetHeader className="mb-4 text-left border-b border-border-light pb-4">
                                <SheetTitle className="font-display text-xl text-text leading-tight">Agendamentos</SheetTitle>
                                <SheetDescription className="font-ui text-text-light">
                                    Dia {selectedDay} de {monthNames[currentMonth]}
                                </SheetDescription>
                            </SheetHeader>
                            {(() => {
                                if (!selectedDay) return null;
                                const dailyOrders = ordersThisMonth.filter(o => new Date(o.delivery_date).getDate() === selectedDay);
                                if (dailyOrders.length === 0) return <div className="text-center p-8 border border-dashed border-border-light rounded-xl mt-4"><p className="text-sm text-text-light font-ui">Agenda livre neste dia.</p></div>;
                                return (
                                    <div className="space-y-3 mt-4">
                                        {dailyOrders.map(o => (
                                            <div key={o.id} onClick={() => { setSelectedDay(null); setTimeout(() => { setSelectedHistoryOrder(o); setIsHistoryDrawerOpen(true); }, 300); }} className="flex flex-col bg-surface p-4 rounded-xl border border-border-light cursor-pointer active:scale-[0.98] transition-all">
                                                <div className="flex justify-between items-start mb-2 gap-2">
                                                    <div className="font-medium text-text leading-tight">{o.clients?.name}</div>
                                                    <div className="font-bold text-accent whitespace-nowrap">R$ {Number(o.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-sm text-text-light line-clamp-2 mb-3 leading-relaxed">{o.description}</div>
                                                <div className="flex items-center">
                                                    <Badge className={`px-2 py-0.5 text-[10px] whitespace-nowrap border-0 ${o.status === 'em_andamento' ? 'bg-warn/20 text-warn-dark' : o.status === 'finalizado' ? 'bg-success/20 text-success-dark' : 'bg-accent/20 text-accent'}`}>
                                                        {o.status === 'em_andamento' ? 'Em andamento' : o.status === 'finalizado' ? 'Pronta' : 'Entregue'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </SheetContent>
                    </Sheet>
                </TabsContent>

                <TabsContent value="historico" className="space-y-4 min-h-[400px]">
                    {historico.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-text-light font-ui bg-surface border border-border-light rounded-2xl shadow-sm">
                            <Archive className="w-16 h-16 mb-4 text-border" strokeWidth={1} />
                            <h3 className="text-xl font-display text-text mb-2">Histórico vazio</h3>
                            <p>Finalize encomendas organizá-las aqui e analisar seu Lucro Líquido.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {historico.map((order: any) => {
                                // Cálculo Lucro
                                const materialsCost = order.order_materials?.reduce((sum: number, mat: any) => sum + Number(mat.total_cost || 0), 0) || 0;
                                const lucroLiquido = Number(order.value) - materialsCost;

                                return (
                                    <div key={order.id} onClick={() => { setSelectedHistoryOrder(order); setIsHistoryDrawerOpen(true); }} className="flex flex-col sm:flex-row justify-between items-center border border-border-light p-4 rounded-xl hover:border-primary/50 cursor-pointer bg-surface shadow-sm">
                                        <div className="flex flex-col w-full sm:w-1/2 mb-3 sm:mb-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-medium text-text text-lg">{order.clients?.name}</span>
                                                <Badge className="bg-transparent border border-border text-text-light font-normal text-xs">{new Date(order.delivery_date).toLocaleDateString('pt-BR')}</Badge>
                                            </div>
                                            <span className="text-sm text-text-light line-clamp-1">{order.description}</span>
                                        </div>
                                        <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
                                            <div className="text-right">
                                                <span className="text-xs text-text-light block uppercase tracking-wide">Valor Bruto</span>
                                                <span className="font-medium text-text">R$ {Number(order.value).toFixed(2)}</span>
                                            </div>
                                            <div className="h-8 w-px bg-border-light hidden sm:block"></div>
                                            <div className="text-right">
                                                <span className="text-xs text-success block uppercase tracking-wide font-medium">Lucro Líquido</span>
                                                <span className="font-bold text-success-dark text-lg">R$ {lucroLiquido.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={finishModalOpen} onOpenChange={setFinishModalOpen}>
                <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Fechamento e Baixa de Estoque</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <p className="text-sm text-text-light font-ui">
                            Adicione todos os materiais que foram utilizados na produção para que o sistema de ERP dê baixa do estoque e calcule o custo exato desta peça.
                        </p>

                        <div className="space-y-3 bg-surface-warm p-4 rounded-xl border border-border-light max-h-[320px] overflow-y-auto">
                            {materialsUsed.map((mat, idx) => (
                                <div key={idx} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-border-light shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium flex-1 truncate text-text">{mat.item_name}</span>
                                        <Button variant="ghost" size="icon" onClick={() => setMaterialsUsed(m => m.filter((_, i) => i !== idx))} className="h-8 w-8 text-warn hover:text-warn-dark hover:bg-warn/10"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 items-end">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-text-light">Qtd Usada</Label>
                                            <Input type="number" step="0.01" value={mat.quantity || ''} onChange={e => {
                                                const newM = [...materialsUsed];
                                                newM[idx].quantity = Number(e.target.value);
                                                setMaterialsUsed(newM);
                                            }} className="h-8 text-sm px-2" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-text-light">Custo Un. (R$)</Label>
                                            <Input type="number" step="0.01" value={mat.unit_cost || ''} onChange={e => {
                                                const newM = [...materialsUsed];
                                                newM[idx].unit_cost = Number(e.target.value);
                                                setMaterialsUsed(newM);
                                            }} className="h-8 text-sm px-2" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-text-light">Total (R$)</Label>
                                            <div className="h-8 flex items-center px-2 border border-border-light rounded-md bg-surface-warm text-sm font-medium text-text">
                                                {(Number(mat.quantity || 0) * Number(mat.unit_cost || 0)).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {materialsUsed.length === 0 && <span className="text-sm text-text-muted italic block text-center py-2">Nenhum material listado. Adicione insumos para finalizar a encomenda.</span>}
                        </div>

                        <div className="flex gap-2">
                            <select
                                id="item-selector"
                                className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={""}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const item = inventory.find(i => i.id === e.target.value);
                                        if (item) {
                                            setMaterialsUsed([...materialsUsed, {
                                                inventory_item_id: item.id,
                                                item_name: item.name,
                                                quantity: 1,
                                                unit_cost: Number(item.unit_cost) || 0
                                            }]);
                                        }
                                    }
                                }}
                            >
                                <option value="">+ Selecionar Insumo Usado...</option>
                                {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} disp)</option>)}
                            </select>
                        </div>

                        <Button
                            onClick={handleFinishOrder}
                            disabled={finishing || materialsUsed.length === 0 || !materialsUsed.some(m => Number(m.unit_cost) > 0)}
                            className="w-full bg-primary hover:bg-primary-dark text-white disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-border-light disabled:opacity-100 mt-4"
                        >
                            {finishing ? 'Processando baixa...' : 'Concluir Encomenda'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Drawer de Histórico de Encomenda */}
            <Sheet open={isHistoryDrawerOpen} onOpenChange={setIsHistoryDrawerOpen}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto pb-24">
                    {selectedHistoryOrder && (
                        <>
                            <SheetHeader className="pb-4 border-b border-border-light mb-6">
                                <div className="flex justify-between items-start">
                                    <SheetTitle className="font-display text-2xl text-text text-left break-words pr-4">{selectedHistoryOrder.clients?.name}</SheetTitle>
                                    <Badge className={selectedHistoryOrder.status === 'finalizado' ? 'bg-success/20 text-success-dark hover:bg-success/30' : 'bg-accent/20 text-accent hover:bg-accent/30'}>
                                        {selectedHistoryOrder.status === 'finalizado' ? 'Finalizado' : 'Entregue'}
                                    </Badge>
                                </div>
                                <SheetDescription className="text-left font-ui">
                                    Entrega em: {new Date(selectedHistoryOrder.delivery_date).toLocaleDateString('pt-BR')}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-6">
                                {/* Seção Bordado */}
                                <div>
                                    <h3 className="font-medium text-text mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Bordado</h3>
                                    <div className="bg-surface-warm p-4 rounded-xl border border-border-light text-sm text-text-light font-ui space-y-3">
                                        <p><strong>Descrição:</strong> {selectedHistoryOrder.description}</p>
                                        {selectedHistoryOrder.notes && <p><strong>Observações:</strong> {selectedHistoryOrder.notes}</p>}
                                        {selectedHistoryOrder.photo_url && (
                                            <div className="mt-2">
                                                <strong>Foto:</strong>
                                                <img src={selectedHistoryOrder.photo_url} alt="Bordado" className="mt-2 rounded-lg max-h-48 object-cover border border-border-light" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Seção Materiais */}
                                <div>
                                    <h3 className="font-medium text-text mb-2 flex items-center gap-2"><List className="w-4 h-4 text-primary" /> Materiais Utilizados</h3>
                                    <div className="bg-surface-warm rounded-xl border border-border-light overflow-hidden">
                                        {selectedHistoryOrder.order_materials && selectedHistoryOrder.order_materials.length > 0 ? (
                                            <div className="divide-y divide-border-light">
                                                {selectedHistoryOrder.order_materials.map((mat: any, idx: number) => (
                                                    <div key={idx} className="p-3 text-sm flex justify-between items-center hover:bg-white/50 transition-colors">
                                                        <span className="font-medium text-text">{mat.quantity}x {mat.item_name}</span>
                                                        <div className="text-right">
                                                            <div className="text-text font-medium">R$ {Number(mat.total_cost).toFixed(2)}</div>
                                                            <div className="text-[10px] text-text-muted">R$ {Number(mat.unit_cost).toFixed(2)} / un</div>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="p-3 bg-primary/5 flex justify-between items-center border-t-primary/20">
                                                    <strong className="text-sm text-primary-dark">Custo Total de Insumos</strong>
                                                    <strong className="text-sm text-primary-dark">R$ {selectedHistoryOrder.order_materials.reduce((acc: number, mat: any) => acc + Number(mat.total_cost || 0), 0).toFixed(2)}</strong>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 text-sm text-text-muted text-center italic">Nenhum material registrado.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Seção Financeiro */}
                                <div>
                                    <h3 className="font-medium text-text mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Financeiro</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-surface-warm p-3 rounded-lg border border-border-light">
                                            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Valor Cobrado</div>
                                            <div className="font-medium text-text text-lg">R$ {Number(selectedHistoryOrder.value).toFixed(2)}</div>
                                        </div>
                                        <div className="bg-success/5 p-3 rounded-lg border border-success/20">
                                            <div className="text-xs text-success uppercase tracking-wider mb-1 font-medium">Lucro Líquido</div>
                                            <div className="font-bold text-success-dark text-lg">
                                                R$ {(Number(selectedHistoryOrder.value) - (selectedHistoryOrder.order_materials?.reduce((acc: number, mat: any) => acc + Number(mat.total_cost || 0), 0) || 0)).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Drawer Footer Actions */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border-light flex flex-col gap-2">
                                {selectedHistoryOrder.status === 'finalizado' && (
                                    <Button
                                        className="w-full bg-success hover:bg-success-dark text-white"
                                        onClick={() => {
                                            gestaoApi.updateOrderStatus(selectedHistoryOrder.id, 'entregue').then(() => {
                                                loadOrders();
                                                setIsHistoryDrawerOpen(false);
                                            });
                                        }}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Entregue
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="w-full text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/30"
                                    onClick={() => {
                                        showConfirm('Excluir do Histórico', 'Deseja excluir definitivamente esta encomenda do histórico?', async () => {
                                            try {
                                                await gestaoApi.deleteOrder(selectedHistoryOrder.id);
                                                setOrders(orders.filter(o => o.id !== selectedHistoryOrder.id));
                                                setIsHistoryDrawerOpen(false);
                                            } catch (e) {
                                                showAlert('Erro', 'Falha ao excluir');
                                            }
                                        });
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir do Histórico
                                </Button>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

        </div>
    );
}
