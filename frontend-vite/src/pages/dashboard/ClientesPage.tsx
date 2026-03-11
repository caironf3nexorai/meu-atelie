import React, { useEffect, useState } from 'react';
import { gestaoApi } from '@/lib/api/gestao';
import type { Client } from '@/lib/api/gestao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Plus, User, MessageCircle } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

export default function ClientesPage() {
    const { showAlert } = useModal();
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    // Form states
    const [formData, setFormData] = useState({ name: '', whatsapp: '', city: '', birthday: '', notes: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadClients();
    }, []);

    async function loadClients() {
        try {
            // Ajustamos dps a query para trazer as ordens
            const data = await gestaoApi.getClients();
            setClients(data);
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
            const newClient = await gestaoApi.createClient(formData);
            setClients([...clients, newClient]);
            setIsCreateOpen(false);
            setFormData({ name: '', whatsapp: '', city: '', birthday: '', notes: '' });
        } catch (e) {
            console.error(e);
            showAlert('Erro', 'Erro ao criar cliente');
        } finally {
            setSaving(false);
        }
    }

    const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6 pb-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="font-display text-3xl text-text">Banco de Clientes</h1>
                        <p className="font-ui text-text-light">Gerencie e acompanhe as clientes do seu ateliê.</p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary-dark">
                                <Plus className="w-5 h-5 mr-2" />
                                Novo Cliente
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Cadastrar Nova Cliente</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreate} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome Completo</Label>
                                    <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Maria Carolina" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="whatsapp">WhatsApp</Label>
                                    <Input id="whatsapp" value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="city">Cidade</Label>
                                    <Input id="city" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Ex: São Paulo - SP" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="birthday">Data de Aniversário</Label>
                                    <Input id="birthday" type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Observações</Label>
                                    <Textarea id="notes" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Estilo favorito, restrições..." />
                                </div>
                                <div className="pt-4">
                                    <Button type="submit" disabled={saving} className="w-full bg-primary hover:bg-primary-dark shadow-sm">
                                        {saving ? 'Salvando...' : 'Cadastrar Cliente'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="bg-surface border border-border-light rounded-2xl p-6 shadow-sm">
                    <div className="relative mb-6 max-w-md">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-text-muted" />
                        <Input
                            placeholder="Buscar cliente por nome..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-text-light font-ui">
                            <User className="w-12 h-12 mx-auto mb-4 text-border" />
                            Nenhum cliente encontrado.
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map(client => {
                                const totalOrders = client.orders?.length || 0;
                                const totalSpent = client.orders?.reduce((sum: number, o: any) => sum + (Number(o.value) || 0), 0) || 0;

                                return (
                                    <div key={client.id} onClick={() => setSelectedClient(client)} className="border border-border-light p-4 rounded-xl flex flex-col hover:border-primary/50 cursor-pointer transition-colors bg-surface">
                                        <h3 className="font-medium text-lg text-text truncate">{client.name}</h3>
                                        {client.whatsapp && (
                                            <a
                                                href={`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="text-sm text-accent hover:underline flex items-center mt-1 w-fit"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MessageCircle className="w-4 h-4 mr-1" /> {client.whatsapp}
                                            </a>
                                        )}
                                        <div className="mt-4 pt-4 border-t border-border-light/50 flex justify-between text-sm text-text-light">
                                            <span>{totalOrders} encomenda{totalOrders !== 1 && 's'}</span>
                                            <span className="font-medium text-accent">R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Sheet Lateral do Cliente */}
            <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
                <SheetContent side="right" className="w-[400px] sm:w-[540px] max-w-full overflow-y-auto pb-safe">
                    {selectedClient && (
                        <>
                            <SheetHeader className="mb-6">
                                <SheetTitle className="font-display text-text text-xl">Detalhes da Cliente</SheetTitle>
                                <SheetDescription className="font-ui text-text-light text-base">{selectedClient.name}</SheetDescription>
                            </SheetHeader>

                            <div className="space-y-6">
                                <section>
                                    <h4 className="font-semibold text-text mb-3">Resumo da Conta</h4>
                                    <div className="bg-surface-warm p-4 rounded-xl border border-border-light flex justify-between">
                                        <div>
                                            <p className="text-xs text-text-muted mb-1">Total de Encomendas</p>
                                            <p className="font-ui text-text font-semibold">{(selectedClient as any).orders?.length || 0}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-text-muted mb-1">Valor Total Gasto</p>
                                            <p className="font-ui text-accent font-semibold">R$ {((selectedClient as any).orders?.reduce((acc: number, o: any) => acc + (Number(o.value) || 0), 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                    {(selectedClient as any).orders?.length > 0 && (
                                        <div className="mt-3 text-xs text-text-light p-3 bg-surface border border-border-light rounded-lg">
                                            <strong className="text-text font-medium block mb-1">Último pedido ({(new Date((selectedClient as any).orders.sort((a: any, b: any) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime())[0].delivery_date).toLocaleDateString('pt-BR'))}):</strong>
                                            <span className="line-clamp-2">{(selectedClient as any).orders.sort((a: any, b: any) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime())[0].description}</span>
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <h4 className="font-semibold text-text mb-3">Histórico de Encomendas</h4>
                                    {(selectedClient as any).orders?.length === 0 ? (
                                        <div className="text-center p-6 border border-dashed border-border-light rounded-xl text-text-muted text-sm">
                                            Nenhuma encomenda registrada.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {(selectedClient as any).orders?.sort((a: any, b: any) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime()).map((order: any) => (
                                                <div key={order.id} className="p-3 bg-surface border border-border-light rounded-xl flex flex-col gap-2">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <span className="font-medium text-sm text-text line-clamp-2 leading-relaxed">{order.description}</span>
                                                        <span className="font-semibold text-sm whitespace-nowrap text-accent">R$ {Number(order.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-text-light mt-1 pt-2 border-t border-border-light/50">
                                                        <span>Entrega: {new Date(order.delivery_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${order.status === 'finalizado' ? 'bg-success/10 text-success border-success/20' :
                                                            order.status === 'entregue' ? 'bg-info/10 text-info border-info/20' :
                                                                'bg-warn/10 text-warn-dark border-warn/20'
                                                            }`}>
                                                            {order.status === 'finalizado' ? 'Pronta' : order.status === 'entregue' ? 'Entregue' : 'Em Andamento'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
