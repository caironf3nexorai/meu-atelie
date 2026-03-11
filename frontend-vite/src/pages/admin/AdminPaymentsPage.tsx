import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Loader2, ArrowDownCircle, ArrowUpCircle, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function AdminPaymentsPage() {
    const supabase = createClient();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPayments();
    }, []);

    async function fetchPayments() {
        setLoading(true);
        // Busca pagamentos junto com os dados do perfil do usuário para exibir email
        const { data, error } = await supabase
            .from('payments')
            .select(`
                *,
                profiles (
                    email,
                    full_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) console.error("Erro ao buscar pagamentos:", error);
        else setPayments(data || []);

        setLoading(false);
    }

    const filtered = payments.filter(p => {
        const term = searchTerm.toLowerCase();
        const idMatches = p.id.toLowerCase().includes(term);
        const emailMatches = p.profiles?.email?.toLowerCase().includes(term);
        const nameMatches = p.profiles?.full_name?.toLowerCase().includes(term);
        return idMatches || emailMatches || nameMatches;
    });

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h1 className="font-display text-3xl text-text">Gestão Financeira</h1>
                    <p className="font-ui text-text-light text-sm">Histórico de compras de assinaturas e pacotes de créditos.</p>
                </div>

                <div className="flex bg-white rounded-xl shadow-sm border border-border-light p-1 gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <Input
                            placeholder="Buscar Transação ou E-mail..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm"
                        />
                    </div>
                    <div className="w-[1px] bg-border-light my-1" />
                    <button className="flex items-center gap-2 px-3 hover:bg-surface-warm rounded-lg text-text-muted transition-colors text-sm font-ui">
                        <Filter className="w-4 h-4" /> Filtros
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-border-light overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-surface-warm/50 border-b border-border-light">
                        <tr>
                            <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Transação / Referência</th>
                            <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Cliente</th>
                            <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Produto/Serviço</th>
                            <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider text-right">Valor Líquido</th>
                            <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider text-center">Data</th>
                            <th className="p-5 font-ui text-xs font-bold text-text-muted uppercase tracking-wider text-center">Situação do Pgto.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {loading ? (
                            <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary inline-block" /></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-text-muted font-ui">Nenhum pagamento registrado nesta busca.</td></tr>
                        ) : filtered.map((tx) => (
                            <tr key={tx.id} className="hover:bg-surface-warm transition-colors">
                                <td className="p-5">
                                    <div className="font-ui font-medium text-text bg-surface-warm px-2 py-1 rounded inline-block text-xs border border-border/50 font-mono">
                                        {tx.id.slice(0, 18)}...
                                    </div>
                                </td>
                                <td className="p-5 font-ui text-sm text-text-light">{tx.profiles?.email || 'N/A'}</td>
                                <td className="p-5 font-ui text-sm text-text font-medium">{tx.metadata?.product_name || tx.payment_method || 'Assinatura/Pacote'}</td>
                                <td className="p-5 text-right font-display text-lg text-text">
                                    <div className="flex items-center justify-end gap-1">
                                        {tx.status === 'paid' ? <ArrowUpCircle className="w-4 h-4 text-accent" /> : <ArrowDownCircle className="w-4 h-4 text-destructive" />}
                                        R$ {Number(tx.amount).toFixed(2).replace('.', ',')}
                                    </div>
                                </td>
                                <td className="p-5 text-center font-ui text-sm text-text-light">
                                    {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="p-5 text-center">
                                    <Badge className={
                                        tx.status === 'paid' ? 'bg-accent/10 text-accent border-0' :
                                            tx.status === 'pending' ? 'bg-amber-100 text-amber-700 border-0' :
                                                'bg-destructive/10 text-destructive border-0'
                                    }>
                                        {tx.status === 'paid' ? 'Pago' : tx.status === 'pending' ? 'Pendente' : 'Falha'}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
