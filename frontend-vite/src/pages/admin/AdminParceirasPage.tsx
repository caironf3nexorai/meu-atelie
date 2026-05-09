import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Loader2, Users, Percent, DollarSign, Calendar, Copy, Check, Ticket, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- MODAL DE CUPOM PARA PARCEIRA ---
function CouponModal({ partner, onClose, onRefresh }: { partner: any, onClose: () => void, onRefresh: () => void }) {
    const supabase = createClient();
    const { toast } = useToast();
    const [code, setCode] = useState(`${partner.full_name?.split(' ')[0]?.toUpperCase() || 'CUPOM'}10`);
    const [discount, setDiscount] = useState(10);
    const [maxUses, setMaxUses] = useState(100);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('coupons')
                .insert({
                    code: code.toUpperCase(),
                    discount_value: discount,
                    max_uses: maxUses,
                    active: true,
                    partner_id: partner.id,
                    is_partner_coupon: true
                });

            if (error) throw error;

            toast({
                title: "Cupom Criado!",
                description: `O cupom ${code.toUpperCase()} foi gerado para ${partner.full_name}.`
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
                <h3 className="font-display text-2xl font-bold mb-1">Gerar Cupom</h3>
                <p className="mb-6 truncate text-[#6B6B6B]">Para {partner.full_name}</p>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-[#2D2D2D]/60 uppercase tracking-wider block mb-2">Código do Cupom</label>
                        <Input 
                            value={code} 
                            onChange={(e) => setCode(e.target.value.toUpperCase())} 
                            placeholder="Ex: SUELEN10" 
                            className="uppercase h-12 rounded-xl border-[#E5D9CC] focus-visible:ring-[#AC5148]"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-[#2D2D2D]/60 uppercase tracking-wider block mb-2">% de Desconto</label>
                        <Input 
                            type="number"
                            value={discount} 
                            onChange={(e) => setDiscount(Number(e.target.value))} 
                            className="h-12 rounded-xl border-[#E5D9CC] focus-visible:ring-[#AC5148]"
                        />
                        <p className="text-xs text-text-muted mt-1">Este valor será convertido em % de desconto na assinatura.</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-[#2D2D2D]/60 uppercase tracking-wider block mb-2">Limite de Usos</label>
                        <Input 
                            type="number"
                            value={maxUses} 
                            onChange={(e) => setMaxUses(Number(e.target.value))} 
                            className="h-12 rounded-xl border-[#E5D9CC] focus-visible:ring-[#AC5148]"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button disabled={saving} onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-[#E5D9CC] bg-white font-semibold">
                        Cancelar
                    </button>
                    <button disabled={saving} onClick={handleSave} className="flex-1 py-3.5 rounded-xl bg-[#AC5148] text-white border-0 font-semibold flex justify-center items-center">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Cupom'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminParceirasPage() {
    const supabase = createClient();
    const { toast } = useToast();
    
    const [partners, setPartners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPartner, setSelectedPartner] = useState<any>(null);
    const [processingPayout, setProcessingPayout] = useState<string | null>(null);

    const fetchPartners = async () => {
        setLoading(true);
        try {
            // Fetch partners with their commissions and coupons
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, full_name, email, phone, partner_commission_percent, created_at,
                    partner_commissions!partner_commissions_partner_id_fkey (id, amount, status),
                    coupons (id, code, discount_value, max_uses, current_uses, active)
                `)
                .eq('is_partner', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPartners(data || []);
        } catch (error: any) {
            console.error("Erro ao carregar parceiras:", error);
            toast({ title: 'Erro', description: `Não foi possível carregar as parceiras: ${error.message}`, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPartners();
    }, []);

    const processPayout = async (partnerId: string, pendingAmount: number) => {
        if (!confirm(`Confirmar o pagamento de R$ ${pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para esta parceira?`)) return;
        
        setProcessingPayout(partnerId);
        try {
            const { error } = await supabase
                .from('partner_commissions')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('partner_id', partnerId)
                .eq('status', 'pending');

            if (error) throw error;

            toast({ title: "Pagamento Registrado!", description: "As comissões foram marcadas como pagas com sucesso." });
            fetchPartners();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: 'destructive' });
        } finally {
            setProcessingPayout(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copiado!", description: "Código do cupom copiado para a área de transferência." });
    };

    const filteredPartners = partners.filter(p => 
        (p.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const totalToPay = partners.reduce((acc, partner) => {
        const pending = (partner.partner_commissions || [])
            .filter((c: any) => c.status === 'pending')
            .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
        return acc + pending;
    }, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="font-display text-3xl font-bold text-text">Parceiras</h1>
                    <p className="text-text-light font-ui mt-1">Gerencie afiliadas, comissões e cupons de desconto.</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-primary uppercase tracking-wider">Total a Pagar (Geral)</p>
                        <p className="font-display text-2xl font-bold text-text">
                            R$ {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="p-4 sm:p-6 border-b border-border-light flex flex-col sm:flex-row gap-4 items-center justify-between bg-stone-50/50">
                        <div className="relative w-full sm:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <Input
                                placeholder="Buscar parceira por nome ou email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-11 rounded-xl bg-white border-border-light"
                            />
                        </div>
                        <Badge variant="outline" className="bg-white py-1.5 px-3">
                            <Users className="w-4 h-4 mr-2 text-primary" />
                            {filteredPartners.length} Parceiras Ativas
                        </Badge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-stone-50/80 text-text-muted font-ui font-bold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-xl">Parceira</th>
                                    <th className="px-6 py-4">Taxa</th>
                                    <th className="px-6 py-4">Financeiro</th>
                                    <th className="px-6 py-4">Cupons Cadastrados</th>
                                    <th className="px-6 py-4 rounded-tr-xl text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                                            <p className="text-text-muted font-ui">Carregando parceiras...</p>
                                        </td>
                                    </tr>
                                ) : filteredPartners.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <p className="text-text-muted font-ui">Nenhuma parceira encontrada.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPartners.map((partner) => {
                                        const commissions = partner.partner_commissions || [];
                                        const pendingAmount = commissions.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + Number(c.amount), 0);
                                        const paidAmount = commissions.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + Number(c.amount), 0);
                                        
                                        // Filtra apenas os cupons de parceira deste user (eles já vêm filtrados pela relação, mas garantimos)
                                        const coupons = partner.coupons || [];

                                        return (
                                            <tr key={partner.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                            <Users className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold font-display text-text">{partner.full_name || 'Sem Nome'}</p>
                                                            <p className="text-xs text-text-muted font-ui">{partner.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
                                                        {partner.partner_commission_percent}%
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                            <span className="font-ui text-xs text-text-light">Pendente:</span>
                                                            <span className="font-bold text-text ml-auto">R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                            <span className="font-ui text-xs text-text-light">Pago:</span>
                                                            <span className="font-bold text-text ml-auto">R$ {paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {coupons.length > 0 ? (
                                                        <div className="flex flex-col gap-2">
                                                            {coupons.map((c: any) => (
                                                                <div key={c.id} className="flex items-center gap-2 bg-stone-100 border border-border-light px-2 py-1.5 rounded-lg">
                                                                    <Ticket className="w-3.5 h-3.5 text-primary" />
                                                                    <span className="text-xs font-bold font-mono text-text">{c.code}</span>
                                                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] ml-auto hover:bg-green-100">
                                                                        {c.discount_value}% OFF
                                                                    </Badge>
                                                                    <button 
                                                                        onClick={() => copyToClipboard(c.code)}
                                                                        className="p-1 hover:bg-white rounded-md text-text-muted hover:text-primary transition-colors ml-1"
                                                                        title="Copiar cupom"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-text-light font-ui italic">Nenhum cupom gerado.</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Abrir menu</span>
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 font-ui">
                                                            <DropdownMenuItem onClick={() => setSelectedPartner(partner)} className="rounded-xl cursor-pointer">
                                                                <Ticket className="w-4 h-4 mr-2 text-primary" />
                                                                Gerar Cupom
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                onClick={() => processPayout(partner.id, pendingAmount)}
                                                                disabled={pendingAmount <= 0 || processingPayout === partner.id}
                                                                className="rounded-xl cursor-pointer mt-1"
                                                            >
                                                                {processingPayout === partner.id ? (
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-green-600" />
                                                                ) : (
                                                                    <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                                                                )}
                                                                Dar Baixa no Pagamento
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {selectedPartner && (
                <CouponModal 
                    partner={selectedPartner} 
                    onClose={() => setSelectedPartner(null)} 
                    onRefresh={fetchPartners} 
                />
            )}
        </div>
    );
}
