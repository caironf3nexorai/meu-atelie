import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, MoreVertical, ShieldAlert, ShieldCheck, Loader2, Filter, User, Calendar, CreditCard, Activity, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useModal } from '@/contexts/ModalContext';
import { useToast } from '@/hooks/use-toast';

// --- MODAL DE ALTERAÇÃO DE PLANO ---
function PlanModal({ user, onClose, onRefresh }: { user: any, onClose: () => void, onRefresh: () => void }) {
    const supabase = createClient();
    const { toast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState(user.plan || 'free');
    const [days, setDays] = useState(30);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates: any = { plan: selectedPlan };

            if (selectedPlan === 'premium') {
                const startsAt = new Date();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);

                updates.premium_starts_at = startsAt.toISOString();
                updates.premium_expires_at = expiresAt.toISOString();
            } else {
                updates.premium_expires_at = null;
                updates.premium_starts_at = null;
                updates.asaas_subscription_id = null;
            }

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            toast({
                title: "Plano Atualizado",
                description: `O plano de ${user.full_name || 'Usuário'} foi alterado para ${selectedPlan.toUpperCase()}.`
            });
            onRefresh();
            onClose();
        } catch (error: any) {
            toast({
                title: "Falha ao salvar",
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-5 sm:p-8 max-w-md w-full shadow-2xl relative font-ui text-[#2D2D2D]">
                <button onClick={onClose} className="absolute top-6 right-6 text-[#2D2D2D]/50 hover:text-[#2D2D2D]">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="font-display text-2xl font-bold mb-1">Alterar plano</h3>
                <p className="mb-6 truncate text-[#6B6B6B]">{user.full_name || 'Sem Nome'} ({user.email})</p>

                <div className="flex gap-3 my-5">
                    {['free', 'premium'].map(plan => (
                        <button
                            key={plan}
                            onClick={() => setSelectedPlan(plan)}
                            className="flex-1 py-3 rounded-xl border-2 font-semibold transition-all"
                            style={{
                                borderColor: selectedPlan === plan ? '#AC5148' : '#E5D9CC',
                                background: selectedPlan === plan ? '#FDF0EE' : 'white',
                                color: selectedPlan === plan ? '#AC5148' : '#6B6B6B',
                            }}
                        >
                            {plan === 'premium' ? '⭐ Premium' : 'Free'}
                        </button>
                    ))}
                </div>

                {selectedPlan === 'premium' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="text-sm font-bold text-[#2D2D2D]/60 uppercase tracking-wider block mb-2">Duração (dias)</label>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {[7, 15, 30, 60, 90, 365].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    className="px-3.5 py-2 rounded-lg border font-medium transition-all"
                                    style={{
                                        borderColor: days === d ? '#AC5148' : '#E5D9CC',
                                        background: days === d ? '#AC5148' : 'white',
                                        color: days === d ? 'white' : '#1A1A1A',
                                    }}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 mt-8">
                    <button disabled={saving} onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-[#E5D9CC] bg-white font-semibold">
                        Cancelar
                    </button>
                    <button disabled={saving} onClick={handleSave} className="flex-1 py-3.5 rounded-xl bg-[#AC5148] text-white border-0 font-semibold flex justify-center items-center">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alteração'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const supabase = createClient();
    const { showAlert, showConfirm } = useModal();
    const { toast } = useToast();
    const [usuariosTab, setUsuariosTab] = useState<'ativos' | 'espera'>('ativos');
    const [users, setUsers] = useState<any[]>([]);
    const [waitlistUsers, setWaitlistUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Sheet State
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [creditAdjustment, setCreditAdjustment] = useState<number>(0);
    const [isAdjusting, setIsAdjusting] = useState(false);

    // Filter and Cards State
    const [waitlistCount, setWaitlistCount] = useState(0);
    const [filterPlan, setFilterPlan] = useState('todos');

    // Modal Plano State
    const [modalUser, setModalUser] = useState<any | null>(null);

    useEffect(() => {
        fetchUsers();
    }, [supabase]);

    async function fetchUsers() {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        else setUsers(data || []);

        const { data: waitlistData, count } = await supabase.from('waitlist').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        setWaitlistCount(count || 0);
        setWaitlistUsers(waitlistData || []);

        setLoading(false);
    }

    const toggleUserStatus = async (userId: string, currentStatus: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Previne abrir o drawer ao clicar no menu
        const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
        const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId);

        if (error) showAlert('Erro', 'Erro ao atualizar usuário');
        else {
            fetchUsers();
            if (selectedUser?.id === userId) {
                setSelectedUser({ ...selectedUser, status: newStatus });
            }
        }
    };

    const toggleUserRole = async (userId: string, currentRole: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) showAlert('Erro', 'Erro ao atualizar permissão');
        else {
            fetchUsers();
            if (selectedUser?.id === userId) {
                setSelectedUser({ ...selectedUser, role: newRole });
            }
            toast({
                title: "Permissão Atualizada",
                description: `O usuário agora é ${newRole === 'admin' ? 'Administrador' : 'Usuário Padrão'}.`
            });
        }
    };

    const handleAdjustCredits = async () => {
        if (!selectedUser) return;
        if (creditAdjustment === 0) return;

        const action = creditAdjustment > 0 ? 'adicionar' : 'remover';
        const absoluteAmount = Math.abs(creditAdjustment);

        const confirmMsg = `Isso irá ${action} ${absoluteAmount} créditos de ${selectedUser.full_name}. Confirmar?`;

        showConfirm('Ajustar Créditos', confirmMsg, async () => {
            setIsAdjusting(true);
            const novoSaldo = (selectedUser.extra_credits || 0) + creditAdjustment;

            const { error } = await supabase
                .from('profiles')
                .update({ extra_credits: novoSaldo })
                .eq('id', selectedUser.id);

            setIsAdjusting(false);

            if (error) {
                showAlert('Erro', 'Erro ao ajustar créditos: ' + error.message);
            } else {
                setCreditAdjustment(0);
                fetchUsers();
                setSelectedUser({ ...selectedUser, extra_credits: novoSaldo });
                showAlert('Sucesso', 'Créditos ajustados com sucesso!');
            }
        });
    };

    const openUserDetails = (user: any) => {
        setSelectedUser(user);
        setIsSheetOpen(true);
    };

    const filteredUsers = users.filter(u => {
        const matchSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.cpf?.includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchPlan = filterPlan === 'todos' ? true : u.plan === filterPlan;

        return matchSearch && matchPlan;
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-primary">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-ui text-text-light">Buscando base de usuários...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            <div className="flex flex-col justify-start items-start gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-4xl text-text mb-2">Gerenciamento de Usuários</h1>
                    <p className="font-ui text-text-light text-base">Controle de acesso, permissões e análise da base de clientes.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div 
                    onClick={() => setUsuariosTab('ativos')}
                    style={{ background: usuariosTab === 'ativos' ? '#FDF0EE' : 'white', borderRadius: '16px', padding: '24px', border: usuariosTab === 'ativos' ? '2px solid #AC5148' : '1px solid #E5D9CC', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                    <p style={{ fontSize: '36px', fontWeight: 700, color: '#AC5148', margin: 0, lineHeight: 1 }}>{users.length}</p>
                    <p style={{ color: '#6B6B6B', marginTop: '8px', fontWeight: 500, fontSize: '14px' }}>Total de usuários</p>
                </div>
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5D9CC', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <p style={{ fontSize: '36px', fontWeight: 700, color: '#AC5148', margin: 0, lineHeight: 1 }}>{users.filter(u => u.plan === 'premium').length}</p>
                    <p style={{ color: '#6B6B6B', marginTop: '8px', fontWeight: 500, fontSize: '14px' }}>Assinantes Premium</p>
                </div>
                <div 
                    onClick={() => setUsuariosTab('espera')}
                    style={{ background: usuariosTab === 'espera' ? '#FDF0EE' : 'white', borderRadius: '16px', padding: '24px', border: usuariosTab === 'espera' ? '2px solid #AC5148' : '1px solid #E5D9CC', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                    <p style={{ fontSize: '36px', fontWeight: 700, color: '#AC5148', margin: 0, lineHeight: 1 }}>{waitlistCount}</p>
                    <p style={{ color: '#6B6B6B', marginTop: '8px', fontWeight: 500, fontSize: '14px' }}>Lista de espera</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full border border-border bg-white p-3 rounded-2xl shadow-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <Input
                            placeholder="Buscar por nome ou email..."
                            className="pl-12 h-12 rounded-xl border-none shadow-none font-ui focus-visible:ring-0"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-px h-8 bg-border-light hidden sm:block mx-2"></div>
                    <select
                        value={filterPlan}
                        onChange={e => setFilterPlan(e.target.value)}
                        className="w-full sm:w-64 h-12 rounded-xl border-none pl-4 pr-10 appearance-none bg-stone-50 font-ui font-medium text-text-muted focus:outline-none focus:ring-0 hover:bg-stone-100 transition-colors"
                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em' }}
                    >
                        <option value="todos">Todos os planos</option>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-border-light overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-stone-50/50 border-b border-border-light">
                            <tr>
                                <th className="p-5 pl-6 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Usuário</th>
                                <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Contato / Local</th>
                                <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Plano Atual</th>
                                <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Saldo (Créditos)</th>
                                <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Status da Conta</th>
                                <th className="p-5 pr-6 w-10 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 font-ui">
                            {usuariosTab === 'ativos' && (
                                filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-16 text-center text-text-light italic">Nenhum usuário foi encontrado para essa busca.</td>
                                    </tr>
                                ) : filteredUsers.map((user) => (
                                    <tr key={user.id} onClick={() => openUserDetails(user)} className="hover:bg-stone-50/80 transition-colors cursor-pointer group">
                                        <td className="p-5 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <User className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-text group-hover:text-primary transition-colors">{user.full_name}</p>
                                                    <p className="text-xs text-text-muted font-mono mt-0.5">ID: {user.id.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <p className="text-sm text-text font-medium">{user.email || 'Email Indisponível'}</p>
                                            <p className="text-xs text-text-muted mt-0.5">{user.cpf ? `CPF: ${user.cpf}` : 'Sem registro documental'}</p>
                                        </td>
                                        <td className="p-5 whitespace-nowrap">
                                            <Badge variant="outline" className={user.plan === 'premium' ? 'bg-accent/10 text-accent border-accent/20 px-3 py-1' : 'bg-stone-100 text-text-muted border-transparent px-3 py-1'}>
                                                {user.plan === 'premium' ? 'Plano Premium' : 'Free (Básico)'}
                                            </Badge>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm text-text font-medium">{user.free_generations_used || 0} ut. mensais</span>
                                                <span className="text-xs text-primary font-bold">+{user.extra_credits || 0} avulsos saldos</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${user.status === 'blocked' ? 'bg-destructive' : 'bg-green-500'}`} />
                                                <span className={`text-sm font-medium ${user.status === 'blocked' ? 'text-destructive' : 'text-green-600'}`}>
                                                    {user.status === 'blocked' ? 'Bloqueado' : 'Operacional'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5 pr-6 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="rounded-full shadow-none border-0 text-text-light hover:text-text hover:bg-stone-200" onClick={(e) => e.stopPropagation()}>
                                                        <MoreVertical className="w-5 h-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-xl border-border-light bg-white min-w-[180px] p-2">
                                                    <DropdownMenuItem
                                                        onClick={(e) => toggleUserStatus(user.id, user.status, e)}
                                                        className={`py-3 px-4 rounded-lg cursor-pointer ${user.status === 'blocked' ? 'text-green-600 focus:bg-green-50 focus:text-green-600' : 'text-destructive focus:bg-destructive/10 focus:text-destructive'}`}
                                                    >
                                                        {user.status === 'blocked' ? (
                                                            <><ShieldCheck className="w-4 h-4 mr-3" /> Reativar Conta</>
                                                        ) : (
                                                            <><ShieldAlert className="w-4 h-4 mr-3" /> Suspender Acesso</>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={(e) => { e.stopPropagation(); setModalUser(user); }}
                                                        className="py-3 px-4 rounded-lg cursor-pointer text-[#AC5148] focus:bg-[#AC5148]/10 focus:text-[#AC5148] font-medium"
                                                    >
                                                        <Calendar className="w-4 h-4 mr-3" /> Alterar Plano Manual
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={(e) => toggleUserRole(user.id, user.role, e)}
                                                        className="py-3 px-4 rounded-lg cursor-pointer text-blue-600 focus:bg-blue-50 focus:text-blue-600 font-medium"
                                                    >
                                                        <ShieldAlert className="w-4 h-4 mr-3" /> {user.role === 'admin' ? 'Remover Admin' : 'Promover a Admin'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}

                            {usuariosTab === 'espera' && (
                                waitlistUsers.filter(w => (w.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (w.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-16 text-center text-text-light italic">Nenhum registro encontrado na lista de espera.</td>
                                    </tr>
                                ) : waitlistUsers.filter(w => (w.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (w.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())).map((wuser) => (
                                    <tr key={wuser.id} className="hover:bg-stone-50/80 transition-colors group">
                                        <td className="p-5 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-border-light flex items-center justify-center shrink-0">
                                                    <User className="w-5 h-5 text-text-muted" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-text">{wuser.name || 'Sem Nome'}</p>
                                                    <p className="text-xs text-text-muted font-mono mt-0.5">ID: {wuser.id.toString().slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <p className="text-sm text-text font-medium">{wuser.email || 'Sem Email'}</p>
                                        </td>
                                        <td className="p-5 whitespace-nowrap">
                                            <Badge variant="outline" className="bg-stone-100 text-text-muted border-transparent px-3 py-1">
                                                Lista de Espera
                                            </Badge>
                                        </td>
                                        <td className="p-5">
                                            <span className="text-sm text-text-muted italic">Inativo</span>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                                <span className="text-sm font-medium text-yellow-600">
                                                    Aguardando
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5 pr-6 text-right">
                                            {/* Sem ações complexas por enquanto para leads da waitlist */}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Painel Lateral Oculto (Drawer) */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-md border-l border-border bg-background shadow-2xl overflow-y-auto font-ui text-text">
                    {selectedUser && (
                        <div className="space-y-8 py-6">
                            <SheetHeader>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                                        <User className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <SheetTitle className="font-display text-2xl text-text leading-none">{selectedUser.full_name}</SheetTitle>
                                        <SheetDescription className="font-mono text-xs mt-1 text-text-muted">
                                            {selectedUser.id}
                                        </SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="space-y-6">
                                <section>
                                    <h4 className="font-ui text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Status e Plano</h4>
                                    <div className="bg-white rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light flex items-center gap-2"><CreditCard className="w-4 h-4" /> Plano Vigente</span>
                                            <Badge variant="outline" className={selectedUser.plan === 'premium' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-stone-50'}>
                                                {selectedUser.plan === 'premium' ? 'Premium' : 'Free'}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light flex items-center gap-2"><Activity className="w-4 h-4" /> Status da Conta</span>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${selectedUser.status === 'blocked' ? 'bg-destructive' : 'bg-green-500'}`} />
                                                <span className={`text-sm font-semibold ${selectedUser.status === 'blocked' ? 'text-destructive' : 'text-green-600'}`}>
                                                    {selectedUser.status === 'blocked' ? 'Suspensa' : 'Ativa'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light flex items-center gap-2"><Calendar className="w-4 h-4" /> Tipo de Perfil (Role)</span>
                                            <span className="font-ui text-sm font-medium text-text bg-surface-warm px-3 py-1 rounded-lg">
                                                {selectedUser.role === 'admin' ? 'Administrador' : 'Usuária'}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                <Separator className="bg-border-light" />

                                <section>
                                    <h4 className="font-ui text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Cadastro e Dados Pessoais</h4>
                                    <div className="bg-white rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light flex items-center gap-2"><User className="w-4 h-4" /> Nome Completo</span>
                                            <span className="font-ui text-sm font-medium text-text">{selectedUser.full_name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light">E-mail Pessoal</span>
                                            <span className="font-ui text-sm font-medium text-text">{selectedUser.email || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light">Telefone WhatsApp</span>
                                            <span className="font-ui text-sm font-medium text-text">{selectedUser.phone || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light">Documento (CPF)</span>
                                            <span className="font-ui text-sm font-medium text-text">{selectedUser.cpf || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light flex items-center gap-2"><MapPin className="w-4 h-4" /> Estado Geográfico</span>
                                            <span className="font-ui text-sm font-medium text-text">
                                                {selectedUser.address_city && selectedUser.address_state
                                                    ? `${selectedUser.address_city} / ${selectedUser.address_state}`
                                                    : 'Não informado'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light flex items-center gap-2"><Calendar className="w-4 h-4" /> Data do Cadastro</span>
                                            <span className="font-ui text-sm font-medium text-text">{new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                    </div>
                                </section>

                                <Separator className="bg-border-light" />

                                <section>
                                    <h4 className="font-ui text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Auditoria de Custo IA (Créditos)</h4>
                                    <div className="bg-white rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light">Ciclo Mensal Consumido</span>
                                            <span className="font-ui text-sm font-medium text-text">{selectedUser.free_generations_used} util.</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light">Banco Avulso (Acumulado)</span>
                                            <span className="font-ui text-sm font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">+{selectedUser.extra_credits} u.t.</span>
                                        </div>
                                    </div>

                                    <h4 className="font-ui text-xs font-bold text-text-muted uppercase tracking-wider mt-6 mb-3">Ajuste Manual de Créditos</h4>
                                    <div className="bg-white rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-xs font-ui text-text-light block">Quantidade (Use - para remover)</label>
                                                <Input
                                                    type="number"
                                                    value={creditAdjustment || ''}
                                                    onChange={(e) => setCreditAdjustment(parseInt(e.target.value) || 0)}
                                                    placeholder="Ex: 50 ou -10"
                                                    className="w-full text-center font-bold font-ui rounded-xl h-11"
                                                />
                                            </div>
                                            <Button
                                                onClick={handleAdjustCredits}
                                                disabled={isAdjusting || creditAdjustment === 0}
                                                className="bg-primary hover:bg-primary-dark text-white rounded-xl h-11 px-5 shadow-sm font-semibold whitespace-nowrap"
                                            >
                                                {isAdjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar Ajuste'}
                                            </Button>
                                        </div>
                                    </div>
                                </section>

                                <div className="pt-4">
                                    <Button
                                        variant={selectedUser.status === 'blocked' ? 'default' : 'destructive'}
                                        className="w-full h-12 rounded-xl font-bold uppercase tracking-wider text-xs"
                                        onClick={(e) => toggleUserStatus(selectedUser.id, selectedUser.status, e)}
                                    >
                                        {selectedUser.status === 'blocked' ? 'Ativar Conta do Cliente' : 'Suspender Integralmente Esta Conta'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {modalUser && (
                <PlanModal
                    user={modalUser}
                    onClose={() => setModalUser(null)}
                    onRefresh={fetchUsers}
                />
            )}
        </div>
    );
}
