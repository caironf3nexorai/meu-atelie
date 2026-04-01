import React, { useEffect, useState } from 'react';
import { gestaoApi } from '@/lib/api/gestao';
import type { Client } from '@/lib/api/gestao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Plus, User, MessageCircle, Edit } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

export default function ClientesPage() {
    const { showAlert } = useModal();
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    // Form states
    const initialFormData = { name: '', whatsapp: '', city: '', birthday: '', notes: '', cpf: '', email: '', endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_bairro: '', endereco_cidade: '', endereco_estado: '' };
    const [formData, setFormData] = useState(initialFormData);
    const [saving, setSaving] = useState(false);

    // Edit states
    const [clienteEditando, setClienteEditando] = useState<any>(null);
    const [showModalEdicao, setShowModalEdicao] = useState(false);

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
            setFormData(initialFormData);
            showAlert('Sucesso', 'Cliente cadastrada com sucesso!');
        } catch (e: any) {
            console.error(e);
            showAlert('Erro', `Erro ao criar cliente: ${e.message || JSON.stringify(e)}`);
        } finally {
            setSaving(false);
        }
    }

    const handleSalvarEdicaoCliente = async () => {
        try {
            const payload = {
                name: clienteEditando.name,
                whatsapp: clienteEditando.whatsapp,
                email: clienteEditando.email,
                cpf: clienteEditando.cpf,
                endereco_rua: clienteEditando.endereco_rua,
                endereco_numero: clienteEditando.endereco_numero,
                endereco_bairro: clienteEditando.endereco_bairro,
                endereco_cidade: clienteEditando.endereco_cidade,
                endereco_estado: clienteEditando.endereco_estado,
                endereco_cep: clienteEditando.endereco_cep,
                city: clienteEditando.endereco_cidade || clienteEditando.city,
                birthday: clienteEditando.birthday,
                notes: clienteEditando.notes
            };
            const updated = await gestaoApi.updateClient(clienteEditando.id, payload);
            setClients(prev => prev.map(c => c.id === clienteEditando.id ? { ...c, ...updated } : c));
            setShowModalEdicao(false);
            setClienteEditando(null);
            showAlert('Sucesso', 'Cliente atualizado!');
            
            // se tiver com o sheet aberto, atualiza também
            if (selectedClient?.id === clienteEditando.id) {
                setSelectedClient({ ...selectedClient, ...updated });
            }
        } catch (error) {
            console.error(error);
            showAlert('Erro', 'Erro ao salvar o cliente. Tente novamente.');
        }
    };

    const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-12">
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
                        <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
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
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cpf">CPF</Label>
                                    <Input id="cpf" value={formData.cpf} onChange={e => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" />
                                </div>

                                <div className="space-y-2 col-span-full pt-4 border-t border-border mt-4">
                                    <h4 className="font-semibold text-primary uppercase tracking-wide text-xs">Endereço</h4>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endereco_cep">CEP</Label>
                                    <Input id="endereco_cep" value={formData.endereco_cep} onChange={e => setFormData({ ...formData, endereco_cep: e.target.value })} placeholder="00000-000" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endereco_rua">Rua / Logradouro</Label>
                                    <Input id="endereco_rua" value={formData.endereco_rua} onChange={e => setFormData({ ...formData, endereco_rua: e.target.value })} placeholder="Rua, Avenida, etc." />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endereco_numero">Número</Label>
                                    <Input id="endereco_numero" value={formData.endereco_numero} onChange={e => setFormData({ ...formData, endereco_numero: e.target.value })} placeholder="123" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endereco_bairro">Bairro</Label>
                                    <Input id="endereco_bairro" value={formData.endereco_bairro} onChange={e => setFormData({ ...formData, endereco_bairro: e.target.value })} placeholder="Bairro" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endereco_cidade">Cidade</Label>
                                    <Input id="endereco_cidade" value={formData.endereco_cidade} onChange={e => setFormData({ ...formData, endereco_cidade: e.target.value })} placeholder="Ex: São Paulo" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endereco_estado">Estado</Label>
                                    <Input id="endereco_estado" value={formData.endereco_estado} onChange={e => setFormData({ ...formData, endereco_estado: e.target.value })} placeholder="SP" />
                                </div>

                                <div className="space-y-2 col-span-full pt-4 border-t border-border mt-4">
                                    <Label htmlFor="birthday">Data de Aniversário</Label>
                                    <Input id="birthday" type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-full">
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
                                    <div key={client.id} onClick={() => setSelectedClient(client)} className="border border-border-light p-4 rounded-xl flex flex-col hover:border-primary/50 cursor-pointer transition-colors bg-surface relative group">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-medium text-lg text-text truncate max-w-[80%]">{client.name}</h3>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setClienteEditando(client); setShowModalEdicao(true); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-primary hover:bg-primary/10"
                                                title="Editar Cliente">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </div>
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

            {/* Modal de Edição */}
            <Dialog open={showModalEdicao} onOpenChange={setShowModalEdicao}>
                <DialogContent className="sm:max-w-[540px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Cliente</DialogTitle>
                    </DialogHeader>
                    {clienteEditando && (
                        <form onSubmit={(e) => { e.preventDefault(); handleSalvarEdicaoCliente(); }} className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-full">
                                    <Label htmlFor="edit_name">Nome Completo *</Label>
                                    <Input id="edit_name" required value={clienteEditando.name || ''} onChange={e => setClienteEditando({ ...clienteEditando, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_whatsapp">WhatsApp / Telefone</Label>
                                    <Input id="edit_whatsapp" value={clienteEditando.whatsapp || ''} onChange={e => setClienteEditando({ ...clienteEditando, whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_email">Email</Label>
                                    <Input id="edit_email" type="email" value={clienteEditando.email || ''} onChange={e => setClienteEditando({ ...clienteEditando, email: e.target.value })} placeholder="email@exemplo.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_cpf">CPF</Label>
                                    <Input id="edit_cpf" value={clienteEditando.cpf || ''} onChange={e => setClienteEditando({ ...clienteEditando, cpf: e.target.value })} placeholder="000.000.000-00" />
                                </div>

                                <div className="space-y-2 col-span-full pt-4 border-t border-border mt-2">
                                    <h4 className="font-semibold text-primary uppercase tracking-wide text-xs">Endereço</h4>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_cep">CEP</Label>
                                    <Input id="edit_cep" value={clienteEditando.endereco_cep || ''} onChange={e => setClienteEditando({ ...clienteEditando, endereco_cep: e.target.value })} placeholder="00000-000" />
                                </div>
                                <div className="space-y-2 col-span-full">
                                    <Label htmlFor="edit_rua">Rua / Logradouro</Label>
                                    <Input id="edit_rua" value={clienteEditando.endereco_rua || ''} onChange={e => setClienteEditando({ ...clienteEditando, endereco_rua: e.target.value })} placeholder="Rua, Avenida, etc." />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_numero">Número</Label>
                                    <Input id="edit_numero" value={clienteEditando.endereco_numero || ''} onChange={e => setClienteEditando({ ...clienteEditando, endereco_numero: e.target.value })} placeholder="123" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_bairro">Bairro</Label>
                                    <Input id="edit_bairro" value={clienteEditando.endereco_bairro || ''} onChange={e => setClienteEditando({ ...clienteEditando, endereco_bairro: e.target.value })} placeholder="Bairro" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_cidade">Cidade</Label>
                                    <Input id="edit_cidade" value={clienteEditando.endereco_cidade || ''} onChange={e => setClienteEditando({ ...clienteEditando, endereco_cidade: e.target.value })} placeholder="Cidade" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit_estado">Estado</Label>
                                    <Input id="edit_estado" value={clienteEditando.endereco_estado || ''} onChange={e => setClienteEditando({ ...clienteEditando, endereco_estado: e.target.value })} placeholder="MG" />
                                </div>
                            </div>
                            
                            <div className="flex gap-3 justify-end pt-4 mt-2">
                                <Button type="button" variant="outline" onClick={() => { setShowModalEdicao(false); setClienteEditando(null); }} className="w-full sm:w-auto">
                                    Cancelar
                                </Button>
                                <Button type="submit" className="w-full sm:w-auto bg-primary hover:bg-primary-dark shadow-sm">
                                    💾 Salvar alterações
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
