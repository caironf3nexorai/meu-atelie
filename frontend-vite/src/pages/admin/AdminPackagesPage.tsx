import React, { useEffect, useState } from 'react';
import { PackageOpen, Plus, Tag, ToggleLeft, ToggleRight, Edit2, Trash2, CheckCircle2, Loader2, X, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import { createClient } from '@/lib/supabase/client';
import { useModal } from '@/contexts/ModalContext';

export default function AdminPackagesPage() {
    const supabase = createClient();
    const { showAlert, showConfirm } = useModal();
    const [pacotes, setPacotes] = useState<any[]>([]);
    const [loadingPacotes, setLoadingPacotes] = useState(true);
    const [isEditingPkg, setIsEditingPkg] = useState<string | null>(null);
    const [editPkgForm, setEditPkgForm] = useState({ name: '', credit_amount: 0, price: 0 });

    const [bulkAmount, setBulkAmount] = useState(5);
    const [isSendingBulk, setIsSendingBulk] = useState(false);
    const [successModal, setSuccessModal] = useState(false);

    useEffect(() => {
        fetchPacotes();
    }, [supabase]);

    async function fetchPacotes() {
        setLoadingPacotes(true);
        const { data } = await supabase.from('credit_packages').select('*').order('credit_amount', { ascending: true });
        setPacotes(data || []);
        setLoadingPacotes(false);
    }

    const togglePkgStatus = async (id: string, current: boolean) => {
        const { error } = await supabase.from('credit_packages').update({ active: !current }).eq('id', id);
        if (error) showAlert('Erro', 'Erro ao atualizar status do pacote');
        else fetchPacotes();
    };

    const handleDeletePkg = async (id: string) => {
        showConfirm('Apagar Pacote', 'Deseja excluir este pacote?', async () => {
            const { error } = await supabase.from('credit_packages').delete().eq('id', id);
            if (error) showAlert('Erro', 'Erro: ' + error.message);
            else fetchPacotes();
        });
    };

    const startEditPkg = (pkg: any) => {
        setIsEditingPkg(pkg.id);
        setEditPkgForm({ name: pkg.name, credit_amount: pkg.credit_amount, price: Number(pkg.price_brl ?? pkg.price ?? 0) });
    };

    const handleSavePkg = async (id: string) => {
        const payload = { name: editPkgForm.name, credit_amount: editPkgForm.credit_amount, price_brl: editPkgForm.price };
        const { error } = await supabase.from('credit_packages').update(payload).eq('id', id);
        if (error) showAlert('Erro', 'Erro ao salvar pacote: ' + error.message);
        else {
            setIsEditingPkg(null);
            fetchPacotes();
        }
    };

    const handleCreatePkg = async () => {
        const newPkg = { name: 'Novo Pacote', credit_amount: 10, price_brl: 19.90, active: false };
        const { data, error } = await supabase.from('credit_packages').insert(newPkg).select().single();
        if (error) showAlert('Erro', 'Erro: ' + error.message);
        else if (data) startEditPkg(data);
    };

    const handleBulkCredits = async () => {
        showConfirm('Mutirão de Fichas', `Deseja enviar ${bulkAmount} fichas para todos os usuários elegíveis?`, async () => {
            setIsSendingBulk(true);
            try {
                const { error } = await supabase.rpc('grant_bulk_credits', { p_amount: bulkAmount });
                if (error) showAlert('Erro', 'Erro no mutirão: ' + error.message);
                else setSuccessModal(true);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSendingBulk(false);
            }
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-16">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display text-4xl text-text mb-2">Pacotes de Crédito</h1>
                    <p className="font-ui text-text-light">Crie, edite ou desative pacotes que serão ofertados aos usuários sem assinatura Premium.</p>
                </div>
                <Button onClick={handleCreatePkg} className="bg-primary hover:bg-primary-dark shadow-sm rounded-xl h-12">
                    <Plus className="w-5 h-5 mr-2" /> Criar Pacote
                </Button>
            </div>

            <div className="bg-white rounded-3xl border border-border-light shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-stone-50/50 border-b border-border-light">
                                <th className="p-4 pl-6 font-ui font-semibold text-text-muted text-sm uppercase tracking-wider">Identificação do Pacote</th>
                                <th className="p-4 font-ui font-semibold text-text-muted text-sm text-center uppercase tracking-wider">Gerações (+Saldo)</th>
                                <th className="p-4 font-ui font-semibold text-text-muted text-sm text-right uppercase tracking-wider">Valor Monetário (R$)</th>
                                <th className="p-4 text-center font-ui font-semibold text-text-muted text-sm uppercase tracking-wider">Visibilidade na Loja</th>
                                <th className="p-4 pr-6 text-right font-ui font-semibold text-text-muted text-sm uppercase tracking-wider">Ações Gerenciais</th>
                            </tr>
                        </thead>
                        <tbody className="font-ui text-text">
                            {loadingPacotes ? (
                                <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary inline-block" /></td></tr>
                            ) : pacotes.map((pkg) => (
                                <tr key={pkg.id} className="border-b border-border/30 hover:bg-stone-50 transition-colors">
                                    <td className="p-5 pl-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                <Tag className="w-6 h-6 text-primary" />
                                            </div>
                                            {isEditingPkg === pkg.id ? (
                                                <Input
                                                    value={editPkgForm.name}
                                                    onChange={(e) => setEditPkgForm({ ...editPkgForm, name: e.target.value })}
                                                    className="h-10 max-w-[200px] rounded-lg border-border"
                                                />
                                            ) : (
                                                <span className="font-display font-medium text-lg text-text tracking-wide">{pkg.name}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        {isEditingPkg === pkg.id ? (
                                            <Input
                                                value={editPkgForm.credit_amount}
                                                type="number"
                                                onChange={(e) => setEditPkgForm({ ...editPkgForm, credit_amount: parseInt(e.target.value) || 0 })}
                                                className="h-10 w-[100px] text-center mx-auto rounded-lg border-border"
                                            />
                                        ) : (
                                            <Badge variant="outline" className="border-accent/40 text-accent font-semibold text-base bg-accent/5 px-4 py-1">+{pkg.credit_amount} Créditos</Badge>
                                        )}
                                    </td>
                                    <td className="p-5 text-right">
                                        {isEditingPkg === pkg.id ? (
                                            <Input
                                                value={editPkgForm.price}
                                                type="number"
                                                step="0.01"
                                                onChange={(e) => setEditPkgForm({ ...editPkgForm, price: parseFloat(e.target.value) || 0 })}
                                                className="h-10 w-[100px] text-right ml-auto rounded-lg border-border"
                                            />
                                        ) : (
                                            <span className="font-ui font-medium text-lg text-text">R$ {Number(pkg.price_brl ?? pkg.price ?? 0).toFixed(2).replace('.', ',')}</span>
                                        )}
                                    </td>
                                    <td className="p-5 text-center">
                                        <button onClick={() => togglePkgStatus(pkg.id, pkg.active)} className={`flex items-center justify-center w-full transition-all hover:scale-105 ${pkg.active ? 'text-accent' : 'text-border-light'}`}>
                                            {pkg.active ? <ToggleRight className="w-10 h-10 drop-shadow-sm" /> : <ToggleLeft className="w-10 h-10" />}
                                        </button>
                                        <span className="text-[10px] uppercase font-bold text-text-muted mt-1 inline-block">
                                            {pkg.active ? 'Visível na Loja' : 'Oculto'}
                                        </span>
                                    </td>
                                    <td className="p-5 pr-6 text-right space-x-2">
                                        {isEditingPkg === pkg.id ? (
                                            <>
                                                <Button variant="ghost" size="icon" onClick={() => handleSavePkg(pkg.id)} className="text-green-600 bg-green-50 hover:bg-green-100 rounded-lg h-10 w-10">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setIsEditingPkg(null)} className="text-text-muted hover:text-text rounded-lg h-10 w-10">
                                                    <X className="w-5 h-5" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => startEditPkg(pkg)} className="text-text-light hover:text-primary rounded-lg h-10 w-10">
                                                <Edit2 className="w-5 h-5" />
                                            </Button>
                                        )}
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-text-light hover:text-destructive hover:bg-destructive/10 rounded-lg h-10 w-10">
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="rounded-3xl bg-surface border-border-light">
                                                <DialogHeader>
                                                    <DialogTitle className="font-display text-2xl text-text">Excluir Pacote?</DialogTitle>
                                                    <DialogDescription className="font-ui text-text-light text-base pt-2">
                                                        Tem certeza que deseja excluir permanentemente o pacote <strong className="text-primary font-bold">{pkg.name}</strong>?
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter className="pt-4">
                                                    <DialogClose asChild>
                                                        <Button variant="ghost" className="rounded-xl font-ui">Cancelar</Button>
                                                    </DialogClose>
                                                    <DialogClose asChild>
                                                        <Button onClick={() => handleDeletePkg(pkg.id)} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl shadow-sm">Excluir Pacote</Button>
                                                    </DialogClose>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SEÇÃO: Mutirão Globais */}
            <section className="bg-gradient-to-br from-primary/10 to-accent/10 p-10 rounded-[2rem] border border-primary/20 shadow-sm flex flex-col md:flex-row gap-8 items-center justify-between mt-12">
                <div className="flex-1 space-y-4 text-center md:text-left">
                    <div className="flex items-center gap-4 justify-center md:justify-start">
                        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                            <Gift className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="font-display text-3xl text-text">Mutirão de Moedas Globais</h2>
                    </div>
                    <p className="font-ui text-text-light text-base max-w-xl">Injete saldo extra monetário virtual para todas as contas logadas da plataforma simultaneamente.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto p-4 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                    <Input
                        type="number"
                        value={bulkAmount}
                        onChange={(e) => setBulkAmount(parseInt(e.target.value) || 0)}
                        className="w-28 text-center h-14 rounded-xl border-border bg-white font-ui font-bold text-xl"
                    />
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button disabled={isSendingBulk} className="h-14 bg-primary hover:bg-primary-dark text-white rounded-xl shadow-md min-w-[160px] text-base font-semibold">
                                {isSendingBulk ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Distribuir Lote'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl bg-surface border-border-light">
                            <DialogHeader>
                                <DialogTitle className="font-display text-3xl text-text">Confirmar Injeção?</DialogTitle>
                                <DialogDescription className="font-ui text-text-light text-lg pt-4">
                                    Esta ação distribuirá <strong className="text-primary font-bold">{bulkAmount} créditos avulsos</strong> para TODOS os usuários da plataforma.<br /><br />Esta ação não pode ser desfeita. Confirmar disparo?
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="pt-6">
                                <Button variant="ghost" className="rounded-xl h-12 font-ui px-6">Cancelar</Button>
                                <Button onClick={handleBulkCredits} className="bg-primary hover:bg-primary-dark text-white rounded-xl h-12 px-8 shadow-md font-semibold">Confirmar Operação</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </section>

            <Dialog open={successModal} onOpenChange={setSuccessModal}>
                <DialogContent className="rounded-3xl bg-surface border-border-light text-center max-w-sm">
                    <DialogHeader>
                        <div className="w-16 h-16 bg-green-100/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <DialogTitle className="font-display text-2xl text-text text-center">Sucesso!</DialogTitle>
                        <DialogDescription className="font-ui text-text-light text-base pt-2 text-center">
                            A injeção mensal de <strong className="text-primary">{bulkAmount} créditos</strong> foi aplicada para todos os usuários com sucesso.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-4 flex justify-center">
                        <Button onClick={() => setSuccessModal(false)} className="bg-primary hover:bg-primary-dark w-full text-white rounded-xl h-12 shadow-md font-semibold">Ciente</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
