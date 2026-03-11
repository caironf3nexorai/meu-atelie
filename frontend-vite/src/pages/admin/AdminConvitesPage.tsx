import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Copy, Link2, Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminConvitesPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const { toast } = useToast();

    const [convites, setConvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [emailDestino, setEmailDestino] = useState('');
    const [gerando, setGerando] = useState(false);

    const fetchConvites = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('invites')
            .select('*')
            .order('created_at', { ascending: false });
        setConvites(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchConvites();
    }, []);

    const gerarConvite = async () => {
        if (!user) return;
        setGerando(true);

        const code = Math.random().toString(36).substring(2, 10).toUpperCase();

        const { error } = await supabase
            .from('invites')
            .insert({
                code,
                email: emailDestino?.trim() || null,
                created_by: user.id
            });

        if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
            setGerando(false);
            return;
        }

        const link = `${window.location.origin}/cadastro?convite=${code}`;

        try {
            await navigator.clipboard.writeText(link);
            toast({ title: '✅ Link copiado!', description: link });
        } catch {
            toast({ title: 'Convite criado', description: `Código: ${code}` });
        }

        setEmailDestino('');
        setGerando(false);
        fetchConvites();
    };

    const copiarLink = async (code: string) => {
        const link = `${window.location.origin}/cadastro?convite=${code}`;
        try {
            await navigator.clipboard.writeText(link);
            toast({ title: '📋 Link copiado!', description: link });
        } catch {
            toast({ title: 'Código', description: code });
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-16">
            <div>
                <h1 className="font-display text-4xl text-text mb-2">Convites de Acesso</h1>
                <p className="font-ui text-text-light text-base">Gere links exclusivos para parceiras cadastrarem durante o pré-lançamento.</p>
            </div>

            {/* GERADOR */}
            <div className="bg-white rounded-2xl p-6 border border-border-light shadow-sm">
                <h3 className="font-display text-lg font-bold text-text mb-1">Gerar novo convite</h3>
                <p className="text-sm text-text-muted mb-4">O link será copiado automaticamente para a área de transferência.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder="Email da parceira (opcional)"
                        value={emailDestino}
                        onChange={e => setEmailDestino(e.target.value)}
                        className="flex-1 h-12 rounded-xl"
                    />
                    <Button
                        onClick={gerarConvite}
                        disabled={gerando}
                        className="h-12 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold whitespace-nowrap"
                    >
                        {gerando ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Gerar link</>}
                    </Button>
                </div>
            </div>

            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-sm text-center">
                    <p className="text-3xl font-bold text-primary">{convites.length}</p>
                    <p className="text-sm text-text-muted mt-1">Total gerados</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-sm text-center">
                    <p className="text-3xl font-bold text-green-600">{convites.filter(c => c.used).length}</p>
                    <p className="text-sm text-text-muted mt-1">Utilizados</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border-light shadow-sm text-center">
                    <p className="text-3xl font-bold text-primary">{convites.filter(c => !c.used).length}</p>
                    <p className="text-sm text-text-muted mt-1">Disponíveis</p>
                </div>
            </div>

            {/* TABELA */}
            <div className="bg-white rounded-2xl border border-border-light shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="bg-stone-50/50 border-b border-border-light">
                            <tr>
                                <th className="p-4 pl-6 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Código</th>
                                <th className="p-4 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Email</th>
                                <th className="p-4 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Status</th>
                                <th className="p-4 font-ui text-xs font-bold text-text-muted uppercase tracking-wider">Usado em</th>
                                <th className="p-4 pr-6 font-ui text-xs font-bold text-text-muted uppercase tracking-wider text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 font-ui">
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center text-text-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                            ) : convites.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-text-muted italic">Nenhum convite gerado ainda.</td></tr>
                            ) : convites.map(convite => (
                                <tr key={convite.id} className="hover:bg-stone-50/50 transition-colors">
                                    <td className="p-4 pl-6 font-mono font-bold text-text tracking-wider">{convite.code}</td>
                                    <td className="p-4 text-text-muted">{convite.email || '—'}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${convite.used ? 'bg-green-50 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                            {convite.used ? <><CheckCircle2 className="w-3 h-3" /> Usado</> : <><Link2 className="w-3 h-3" /> Disponível</>}
                                        </span>
                                    </td>
                                    <td className="p-4 text-text-muted text-sm">
                                        {convite.used_at
                                            ? new Date(convite.used_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : '—'
                                        }
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        {!convite.used && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copiarLink(convite.code)}
                                                className="rounded-lg text-xs font-semibold"
                                            >
                                                <Copy className="w-3 h-3 mr-1.5" /> Copiar
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
