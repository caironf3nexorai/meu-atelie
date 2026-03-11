import React, { useEffect, useState } from 'react';
import { gestaoApi } from '@/lib/api/gestao';
import type { InventoryItem, InventoryMovement } from '@/lib/api/gestao';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, AlertCircle, Package, Trash2, Edit2, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

export default function EstoquePage() {
    const { showAlert, showConfirm } = useModal();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Repor Modal State
    const [isReporOpen, setIsReporOpen] = useState(false);
    const [selectedItemForRepor, setSelectedItemForRepor] = useState<InventoryItem | null>(null);
    const [reporData, setReporData] = useState({ quantity: 0, unit_cost: 0 });
    const [savingRepor, setSavingRepor] = useState(false);

    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Main Tab State
    const [mainTab, setMainTab] = useState('itens');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        category: 'Linha',
        quantity: 0,
        min_quantity: 5,
        unit_cost: 0,
        unit: 'unidades'
    });

    useEffect(() => {
        loadInventory();
    }, []);

    async function loadInventory() {
        try {
            const [data, movs] = await Promise.all([
                gestaoApi.getInventory(),
                gestaoApi.getInventoryMovements()
            ]);
            setItems(data);
            setMovements(movs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function handleOpenCreate() {
        setFormData({ name: '', category: 'Linha', quantity: 0, min_quantity: 5, unit_cost: 0, unit: 'unidades' });
        setEditingItemId(null);
        setIsCreateOpen(true);
    }

    function handleOpenEdit(item: InventoryItem) {
        setFormData({
            name: item.name,
            category: item.category,
            quantity: Number(item.quantity),
            min_quantity: Number(item.min_quantity),
            unit_cost: Number(item.unit_cost),
            unit: item.unit
        });
        setEditingItemId(item.id);
        setIsCreateOpen(true);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingItemId) {
                const updatedItem = await gestaoApi.updateInventoryItem(editingItemId, formData as any);
                setItems(items.map(i => i.id === editingItemId ? updatedItem : i));
            } else {
                const newItem = await gestaoApi.createInventoryItem(formData as any);
                setItems([...items, newItem]);
            }
            setIsCreateOpen(false);
            setFormData({ name: '', category: 'Linha', quantity: 0, min_quantity: 5, unit_cost: 0, unit: 'unidades' });
            setEditingItemId(null);
            loadInventory(); // reload to get new movements
        } catch (e) {
            console.error(e);
            showAlert('Erro', 'Erro ao salvar item.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        showConfirm('Apagar Item', 'Tem certeza que deseja apagar este item?', async () => {
            try {
                await gestaoApi.deleteInventoryItem(id);
                setItems(items.filter(i => i.id !== id));
            } catch (e) {
                showAlert('Erro', 'Erro ao apagar');
            }
        });
    }

    async function handleRepor(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedItemForRepor || reporData.quantity <= 0) return;
        setSavingRepor(true);
        try {
            await gestaoApi.addInventoryMovement({
                inventory_item_id: selectedItemForRepor.id,
                movement_type: 'entrada',
                quantity: reporData.quantity,
                unit_cost: reporData.unit_cost,
                total_cost: reporData.quantity * reporData.unit_cost,
                notes: 'Reposição manual'
            });
            setIsReporOpen(false);
            setSelectedItemForRepor(null);
            setReporData({ quantity: 0, unit_cost: 0 });
            loadInventory();
        } catch (e) {
            showAlert('Erro', 'Erro ao repor estoque');
        } finally {
            setSavingRepor(false);
        }
    }

    const lowStockItems = items.filter(i => Number(i.quantity) <= Number(i.min_quantity));

    const categories = ['Todas', 'Linha', 'Tecido', 'Bastidor', 'Agulha', 'Outros'];
    const [activeTab, setActiveTab] = useState('Todas');

    const filteredItems = activeTab === 'Todas' ? items : items.filter(i => i.category === activeTab);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display text-3xl text-text">Estoque e Insumos</h1>
                    <p className="font-ui text-text-light">Controle os materiais do seu ateliê e previna faltas.</p>
                </div>
            </div>

            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full space-y-6">
                <TabsList className="bg-surface border border-border-light h-12 p-1">
                    <TabsTrigger value="itens" className="px-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        Estoque
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="px-6 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        Histórico
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="itens" className="space-y-8">
                    <div className="flex justify-end">
                        <Dialog open={isCreateOpen} onOpenChange={(open) => {
                            setIsCreateOpen(open);
                            if (!open) setEditingItemId(null);
                        }}>
                            <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary-dark shadow-sm">
                                <Plus className="w-5 h-5 mr-2" />
                                Novo Item
                            </Button>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>{editingItemId ? 'Editar Material' : 'Adicionar Material'}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSave} className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nome do Item</Label>
                                        <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Linha Cléia Cru" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Categoria</Label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            {categories.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Quantidade Atual</Label>
                                            <Input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Alerta Mínimo</Label>
                                            <Input type="number" step="0.01" required value={formData.min_quantity} onChange={e => setFormData({ ...formData, min_quantity: Number(e.target.value) })} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Custo Unitário (R$)</Label>
                                            <Input type="number" step="0.01" required value={formData.unit_cost} onChange={e => setFormData({ ...formData, unit_cost: Number(e.target.value) })} placeholder="Ex: 3,50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Unidade de Medida</Label>
                                            <Input required value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="metros, un..." />
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <Button type="submit" disabled={saving} className="w-full bg-primary hover:bg-primary-dark shadow-sm">
                                            {saving ? 'Salvando...' : editingItemId ? 'Atualizar Item' : 'Cadastrar Item'}
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-surface p-4 rounded-xl border border-border-light shadow-sm">
                            <div className="text-sm text-text-light mb-1">Total de Itens</div>
                            <div className="text-3xl font-display text-text">{items.length}</div>
                        </div>
                        <div className="bg-surface p-4 rounded-xl border border-warn/30 shadow-sm bg-warn/5">
                            <div className="text-sm text-warn-dark flex items-center mb-1"><AlertCircle className="w-4 h-4 mr-1" /> Estoque Baixo</div>
                            <div className="text-3xl font-display text-warn-dark font-medium">{lowStockItems.length}</div>
                        </div>
                    </div>

                    <div className="bg-surface border border-border-light rounded-2xl shadow-sm overflow-hidden">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="p-4 border-b border-border-light overflow-x-auto">
                                <TabsList className="w-max inline-flex">
                                    {categories.map(cat => (
                                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </div>

                            <div className="p-6 min-h-[400px]">
                                {loading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                                ) : items.length === 0 ? (
                                    <div className="text-center py-12 text-text-light font-ui">
                                        <Package className="w-12 h-12 mx-auto mb-4 text-border" />
                                        Seu estoque está vazio. Adicione linhas, tecidos e materiais.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredItems.map(item => {
                                            const isLow = Number(item.quantity) <= Number(item.min_quantity);
                                            return (
                                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border-light rounded-xl hover:border-primary/30 transition-colors bg-surface gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-medium text-text text-lg">{item.name}</h4>
                                                            {isLow && <Badge variant="destructive" className="bg-warn text-warn-dark border-0">Estoque Baixo</Badge>}
                                                        </div>
                                                        <div className="text-sm text-text-light flex gap-3">
                                                            <span>Categoria: {item.category}</span>
                                                            <span>|</span>
                                                            <span className={isLow ? 'text-warn-dark font-medium' : ''}>Disp: {item.quantity} {item.unit}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <Button variant="outline" size="sm" onClick={() => { setSelectedItemForRepor(item); setIsReporOpen(true); }} className="text-sm h-8 border-primary text-primary hover:bg-[#FDF0F0] hover:text-primary mr-2">
                                                            <RefreshCw className="w-3 h-3 mr-1" /> Repor
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)} className="text-text-muted hover:text-primary"><Edit2 className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-text-muted hover:bg-warn hover:text-warn-dark"><Trash2 className="w-4 h-4" /></Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {filteredItems.length === 0 && (
                                            <div className="text-center py-12 text-text-light font-ui">Nenhum item nesta categoria.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Tabs>
                    </div>
                </TabsContent>

                <TabsContent value="historico" className="bg-surface border border-border-light rounded-2xl shadow-sm p-6 overflow-hidden min-h-[400px]">
                    <h3 className="text-lg font-display text-text mb-4">Registro de Movimentações</h3>
                    {movements.length === 0 ? (
                        <div className="text-center py-12 text-text-light font-ui">
                            Nenhum registro de movimentação encontrado.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {movements.map((mov) => {
                                const isEntrada = mov.movement_type === 'entrada';
                                return (
                                    <div key={mov.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-border-light rounded-xl bg-background">
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isEntrada ? 'bg-success/20 text-success-dark' : 'bg-warn/20 text-warn-dark'}`}>
                                                {isEntrada ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-text">{mov.inventory_items?.name || 'Item Removido'}</p>
                                                <p className="text-sm text-text-light mt-0.5">
                                                    {isEntrada ? '+' : '-'}{mov.quantity} un {mov.total_cost ? ` • R$ ${Number(mov.total_cost).toFixed(2).replace('.', ',')}` : ''}
                                                </p>
                                                <p className="text-xs text-text-muted mt-1">{mov.notes}</p>
                                                {mov.movement_type === 'saida' && mov.orders?.clients && (
                                                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                                        Utilizado em: <strong>{mov.orders.clients.name}</strong>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-text-muted mt-4 sm:mt-0">
                                            {mov.created_at ? new Date(mov.created_at).toLocaleString('pt-BR') : ''}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Modal Reposição */}
            <Dialog open={isReporOpen} onOpenChange={setIsReporOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Repor: {selectedItemForRepor?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRepor} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Qtd. de Entrada</Label>
                                <Input type="number" step="0.01" required min="0.01" value={reporData.quantity || ''} onChange={e => setReporData({ ...reporData, quantity: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo Unit. (R$)</Label>
                                <Input type="number" step="0.01" value={reporData.unit_cost || ''} onChange={e => setReporData({ ...reporData, unit_cost: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div className="p-3 bg-surface border border-border-light rounded mt-2">
                            <p className="text-sm text-text-light flex justify-between">Custo Total: <span className="font-semibold text-text">R$ {(reporData.quantity * reporData.unit_cost).toFixed(2).replace('.', ',')}</span></p>
                        </div>
                        <Button type="submit" disabled={savingRepor || reporData.quantity <= 0} className="w-full bg-primary hover:bg-primary-dark mt-4">
                            {savingRepor ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Entrada'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
}
