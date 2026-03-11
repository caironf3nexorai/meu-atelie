import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Copy, Users, Gift, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function IndicacoesPage() {
    const { profile, user } = useAuth();
    const supabase = createClient();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);
    const [referrals, setReferrals] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetchReferrals();
        }
    }, [user]);

    const fetchReferrals = async () => {
        const { data, error } = await supabase
            .from('referrals')
            .select(`
                id,
                created_at,
                credits_granted,
                referred:profiles!referred_id(full_name, email)
            `)
            .eq('referrer_id', user?.id)
            .order('created_at', { ascending: false });

        if (data && !error) {
            setReferrals(data);
        }
    };

    const referralLink = `${window.location.origin}/cadastro?ref=${profile?.referral_code || ''}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        toast({ title: 'Link Copiado!', description: 'Seu link de indicação foi copiado para a área de transferência.' });
        setTimeout(() => setCopied(false), 3000);
    };

    const handleWhatsAppShare = () => {
        const text = encodeURIComponent(`Olha essa plataforma incrível para bordadeiras! ${referralLink}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div className="max-w-4xl mx-auto pb-24 lg:pb-12 space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-8">
                <h1 className="font-display text-4xl text-text font-bold mb-2">Indique e Ganhe</h1>
                <p className="text-text-light font-ui w-full md:w-2/3">
                    A cada amiga que se cadastrar pelo seu link exclusivo, você ganha 2 créditos extras para gerar mais bordados!
                </p>
            </div>

            {/* Banner Referral */}
            <div className="bg-gradient-to-r from-primary to-accent text-white p-6 sm:p-8 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Gift className="w-32 h-32" />
                </div>
                <div className="flex-1 relative z-10 w-full">
                    <h2 className="font-display text-2xl font-bold mb-2">Seu Link de Indicação</h2>
                    <p className="text-white/80 font-ui text-sm mb-6">Compartilhe este link com outras artesãs</p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Input
                                readOnly
                                value={referralLink}
                                className="h-14 bg-white/10 border-white/20 text-white font-ui pl-4 pr-12 focus-visible:ring-white/30 truncate rounded-xl"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 rounded-lg h-10 w-10"
                                onClick={handleCopy}
                            >
                                {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                            </Button>
                        </div>
                        <Button
                            onClick={handleWhatsAppShare}
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white h-14 px-6 rounded-xl font-semibold shadow-lg shrink-0 flex gap-2 w-full sm:w-auto"
                        >
                            <Share2 className="w-5 h-5" /> Compartilhar no WhatsApp
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-surface border border-border-light rounded-[2rem] p-8 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="font-ui text-text-light text-sm mb-1">Amigas indicadas</p>
                        <p className="font-display text-4xl text-text font-bold">{referrals.length}</p>
                    </div>
                </div>
                <div className="bg-surface border border-border-light rounded-[2rem] p-8 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Gift className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="font-ui text-text-light text-sm mb-1">Créditos ganhos (Total)</p>
                        <p className="font-display text-4xl text-text font-bold">{referrals.filter(r => r.credits_granted).length * 2}</p>
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-3xl border border-border-light shadow-sm overflow-hidden mt-8">
                <div className="p-6 border-b border-border-light/50 bg-surface-warm/30">
                    <h3 className="font-display text-xl text-text font-bold">Histórico de Indicações</h3>
                </div>
                <div className="p-6">
                    {referrals.length === 0 ? (
                        <div className="text-center py-10">
                            <Users className="w-12 h-12 text-border mx-auto mb-4" />
                            <p className="text-text-muted font-ui">Você ainda não indicou nenhuma amiga.</p>
                            <p className="text-text-muted font-ui text-sm mt-1">Compartilhe o link acima para ganhar créditos!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {referrals.map((ref) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={ref.id}
                                    className="flex items-center justify-between p-4 rounded-xl border border-border-light hover:bg-surface-warm transition-colors"
                                >
                                    <div>
                                        <p className="font-ui font-semibold text-text">{ref.referred?.full_name || 'Usuária Anônima'}</p>
                                        <p className="text-xs text-text-muted">{new Date(ref.created_at).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    {ref.credits_granted ? (
                                        <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-emerald-100">
                                            <CheckCircle2 className="w-3 h-3" /> +2 Créditos
                                        </div>
                                    ) : (
                                        <span className="text-xs text-text-muted bg-surface-warm px-3 py-1 rounded-full border border-border-light">Pendente</span>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
