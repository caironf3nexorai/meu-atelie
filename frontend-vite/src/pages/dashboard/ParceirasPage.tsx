import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Percent, Users, User, Copy, Check, DollarSign, Calendar, CreditCard, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function ParceirasPage() {
    const supabase = createClient();
    const { profile } = useAuth();
    const { toast } = useToast();
    
    const [commissions, setCommissions] = useState<any[]>([]);
    const [referredUsers, setReferredUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [copiedTrial, setCopiedTrial] = useState(false);
    const [trialSpots, setTrialSpots] = useState(0);

    useEffect(() => {
        if (profile) {
            fetchPartnerData();
        }
    }, [profile]);

    const fetchPartnerData = async () => {
        setLoading(true);
        try {
            // 1. Buscar comissões (Ganhos a receber e pagos)
            const { data: commData, error: commError } = await supabase
                .from('partner_commissions')
                .select(`
                    id, amount, status, created_at,
                    referred:profiles!referred_id(full_name, email)
                `)
                .eq('partner_id', profile?.id)
                .order('created_at', { ascending: false });
                
            if (commError) throw commError;
            setCommissions(commData || []);

            // 2. Buscar Indicações (Pessoas que se cadastraram)
            const { data: refData, error: refError } = await supabase
                .from('referrals')
                .select(`
                    created_at,
                    referred:profiles!referred_id(full_name, email, plan)
                `)
                .eq('referrer_id', profile?.id)
                .order('created_at', { ascending: false });

            if (refError) throw refError;
            setReferredUsers(refData || []);

            // 3. Buscar limites da campanha de trial
            const { data: campaignData, error: campaignError } = await supabase
                .from('campaign_config')
                .select('*')
                .limit(1)
                .single();

            if (!campaignError && campaignData) {
                setTrialSpots(campaignData.partner_trial_limit - campaignData.partner_trial_used);
            }

        } catch (error: any) {
            console.error("Erro ao buscar dados de parceira:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const referralLink = `${window.location.origin}/cadastro?ref=${profile?.referral_code || ''}`;
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        toast({
            title: "Link Copiado!",
            description: "O link de parceria foi copiado para sua área de transferência."
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const copyTrialLink = () => {
        const trialLink = `${window.location.origin}/cadastro?trial=true&ref=${profile?.referral_code || ''}`;
        navigator.clipboard.writeText(trialLink);
        setCopiedTrial(true);
        toast({
            title: "Link Copiado!",
            description: "O link de 15 Dias Grátis foi copiado para sua área de transferência."
        });
        setTimeout(() => setCopiedTrial(false), 2000);
    };

    if (!profile?.is_partner) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <Percent className="w-16 h-16 text-text-muted mb-4 opacity-50" />
                <h2 className="text-xl font-display font-bold text-text mb-2">Acesso Restrito</h2>
                <p className="text-text-light font-ui max-w-md text-center">
                    Esta página é exclusiva para as Parceiras Oficiais da plataforma. 
                </p>
            </div>
        );
    }

    const totalToReceive = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0);
    const totalPaid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0);
    const referralLink = `${window.location.origin}/cadastro?ref=${profile?.referral_code || ''}`;
    const trialLink = `${window.location.origin}/cadastro?trial=true&ref=${profile?.referral_code || ''}`;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-4 px-4 sm:px-0">
            {/* Cabeçalho */}
            <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-text mb-2">Painel de Parceira</h1>
                <p className="font-ui text-text-light">Acompanhe seus ganhos, comissões e sua rede de indicadas.</p>
            </div>

            {/* Link Generator Card */}
            <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <div className="flex-1">
                            <h3 className="font-display font-bold text-xl text-text mb-2 flex items-center gap-2">
                                <Percent className="w-5 h-5 text-primary" />
                                Seu Link de Parceria
                            </h3>
                            <p className="text-sm font-ui text-text-muted mb-4">
                                Compartilhe este link com sua audiência. Você receberá {profile.partner_commission_percent}% 
                                de comissão sobre cada assinatura realizada através dele.
                            </p>
                            <div className="flex gap-2 w-full max-w-md">
                                <Input 
                                    readOnly 
                                    value={referralLink} 
                                    className="font-mono text-sm bg-stone-50 border-border-light h-12 rounded-xl focus-visible:ring-0" 
                                />
                                <Button 
                                    onClick={copyToClipboard}
                                    className="h-12 w-12 shrink-0 rounded-xl bg-primary hover:bg-primary-dark text-white"
                                >
                                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>
                        <div className="hidden md:block w-px h-24 bg-border-light mx-4" />
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex-shrink-0 w-full md:w-auto">
                            <p className="text-xs font-bold text-primary tracking-wider uppercase mb-1">Sua Comissão Atual</p>
                            <p className="font-display text-4xl font-bold text-text">{profile.partner_commission_percent}%</p>
                            <p className="text-xs text-text-muted mt-1 font-ui">Por cada assinatura ativa</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Trial Campaign Card */}
            {trialSpots > 0 && (
                <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-white">
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                            <div className="flex-1">
                                <h3 className="font-display font-bold text-xl text-[#15803d] mb-2 flex items-center gap-2">
                                    <Percent className="w-5 h-5" />
                                    Campanha Especial: 15 Dias Grátis
                                </h3>
                                <p className="text-sm font-ui text-text-muted mb-4">
                                    Ofereça um teste VIP de 15 dias para sua audiência. Se elas assinarem depois, 
                                    a comissão é sua! As vagas são limitadas na rede de parceiras.
                                </p>
                                <div className="flex gap-2 w-full max-w-md">
                                    <Input 
                                        readOnly 
                                        value={trialLink} 
                                        className="font-mono text-sm bg-stone-50 border-border-light h-12 rounded-xl focus-visible:ring-0" 
                                    />
                                    <Button 
                                        onClick={copyTrialLink}
                                        className="h-12 w-12 shrink-0 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white"
                                    >
                                        {copiedTrial ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="hidden md:block w-px h-24 bg-border-light mx-4" />
                            <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-2xl p-5 flex-shrink-0 w-full md:w-auto">
                                <p className="text-xs font-bold text-[#15803d] tracking-wider uppercase mb-1">Vagas Restantes</p>
                                <p className="font-display text-4xl font-bold text-[#15803d]">{trialSpots}</p>
                                <p className="text-xs text-[#15803d] mt-1 font-ui">Disponíveis na rede</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <DollarSign className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="font-ui font-bold text-text-muted text-sm uppercase tracking-wider">A Receber</h3>
                        </div>
                        <p className="font-display text-4xl font-bold text-text">
                            R$ {totalToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="font-ui text-xs text-text-light mt-2">Acumulado do mês / Pendente de pagamento</p>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5 text-green-600" />
                            </div>
                            <h3 className="font-ui font-bold text-text-muted text-sm uppercase tracking-wider">Total Pago</h3>
                        </div>
                        <p className="font-display text-4xl font-bold text-text">
                            R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="font-ui text-xs text-text-light mt-2">Valor já recebido por você</p>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="font-ui font-bold text-text-muted text-sm uppercase tracking-wider">Sua Rede</h3>
                        </div>
                        <p className="font-display text-4xl font-bold text-text">
                            {referredUsers.length}
                        </p>
                        <p className="font-ui text-xs text-text-light mt-2">Pessoas que se cadastraram pelo seu link</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tabela de Comissões */}
                <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <div className="p-6 border-b border-border-light">
                            <h3 className="font-display font-bold text-xl text-text">Extrato de Ganhos</h3>
                            <p className="text-sm font-ui text-text-muted">Detalhes das comissões geradas por assinaturas.</p>
                        </div>
                        <div className="h-[400px] overflow-y-auto custom-scrollbar">
                            {commissions.length === 0 ? (
                                <div className="p-8 text-center text-text-light font-ui italic">
                                    Nenhuma comissão gerada ainda.
                                </div>
                            ) : (
                                <div className="divide-y divide-border/40">
                                    {commissions.map((comm) => (
                                        <div key={comm.id} className="p-5 flex items-center justify-between hover:bg-stone-50 transition-colors">
                                            <div>
                                                <p className="font-medium font-ui text-text">{comm.referred?.full_name || 'Usuário Desconhecido'}</p>
                                                <p className="text-xs font-ui text-text-muted flex items-center gap-1 mt-0.5">
                                                    <Calendar className="w-3 h-3" /> 
                                                    {new Date(comm.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold font-ui text-text">
                                                    R$ {Number(comm.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <Badge variant="outline" className={`mt-1 font-ui text-[10px] ${comm.status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-yellow-50 text-yellow-600 border-yellow-200'}`}>
                                                    {comm.status === 'paid' ? 'Pago' : 'A Receber'}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Tabela de Rede (Cadastros) */}
                <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <div className="p-6 border-b border-border-light">
                            <h3 className="font-display font-bold text-xl text-text">Sua Rede (Cadastros)</h3>
                            <p className="text-sm font-ui text-text-muted">Pessoas que se cadastraram usando seu link.</p>
                        </div>
                        <div className="h-[400px] overflow-y-auto custom-scrollbar">
                            {referredUsers.length === 0 ? (
                                <div className="p-8 text-center text-text-light font-ui italic">
                                    Ninguém se cadastrou usando seu link ainda.
                                </div>
                            ) : (
                                <div className="divide-y divide-border/40">
                                    {referredUsers.map((user, idx) => (
                                        <div key={idx} className="p-5 flex items-center gap-4 hover:bg-stone-50 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <User className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium font-ui text-text truncate">{user.referred?.full_name || 'Usuário Desconhecido'}</p>
                                                <p className="text-xs font-ui text-text-muted truncate">{user.referred?.email}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <Badge variant="outline" className={`font-ui text-[10px] ${user.referred?.plan === 'premium' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-stone-100 text-text-muted border-stone-200'}`}>
                                                    {user.referred?.plan === 'premium' ? 'Premium' : 'Free'}
                                                </Badge>
                                                <p className="text-[10px] text-text-muted mt-1 font-ui">
                                                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
