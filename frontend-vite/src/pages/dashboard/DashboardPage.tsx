import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Image as ImageIcon, Paintbrush, DollarSign, PieChart, ArrowRight, Lock, Loader2, Download } from 'lucide-react';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { PremiumLock } from '@/components/shared/PremiumLock';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';

export default function DashboardPage() {
    const supabase = createClient();
    const [profile, setProfile] = useState<any>(null);
    const [planConfig, setPlanConfig] = useState<any>(null);
    const [generations, setGenerations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [showAllGenerations, setShowAllGenerations] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setProfile(prof);

                if (prof) {
                    const { data: pConfig } = await supabase.from('plan_config').select('*').single();
                    setPlanConfig(pConfig);
                }

                const { data: gens } = await supabase.from('generations')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(40);
                setGenerations(gens || []);
            }
            setLoading(false);
        }
        loadData();
    }, [supabase]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-primary">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="font-ui text-text-light">Preparando seu ateliê...</p>
            </div>
        );
    }

    const isPremium = profile?.plan === 'premium';
    const extraCredits = profile?.extra_credits || 0;
    const welcomeUsed = profile?.welcome_credits_used || false;
    const freeGenerationsUsed = profile?.free_generations_used || 0;

    const premiumMonthlyTotal = planConfig?.premium_generations_limit || 15;
    const freeMonthlyTotal = planConfig?.free_generations_limit || 3;
    const monthlyTotal = isPremium ? premiumMonthlyTotal : freeMonthlyTotal;

    const cycleExpired = profile?.free_cycle_expires_at
        ? new Date(profile.free_cycle_expires_at) < new Date()
        : false;

    const monthlyAvailable = cycleExpired
        ? monthlyTotal
        : Math.max(0, monthlyTotal - freeGenerationsUsed);

    const totalAvailable = monthlyAvailable + extraCredits;
    const userName = profile?.full_name?.split(' ')[0] || 'Artesã';

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Hero Section */}
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <h1 className="font-display text-4xl text-text">
                        Olá, {userName} <span className="inline-block animate-wave">👋</span>
                    </h1>
                    <p className="font-ui text-text-light text-lg">Pronta para transformar linhas em arte hoje?</p>
                </div>

                <div className="bg-surface p-4 rounded-2xl shadow-sm border border-border-light min-w-[240px] space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                        <Badge variant="outline" className={isPremium ? "text-accent border-accent/30 bg-accent/10" : "text-text-muted border-text-muted/30"}>
                            {isPremium ? <><Sparkles className="w-3 h-3 mr-1" /> Premium</> : 'Plano Grátis'}
                        </Badge>
                        <Link to="/dashboard/loja" className="text-xs text-primary font-medium hover:text-primary-dark transition-colors px-2 py-1 rounded-md hover:bg-[#FDF0F0]">
                            Comprar + Créditos
                        </Link>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-light">Mensais restantes</span>
                            <span className="font-semibold text-text">{monthlyAvailable} de {monthlyTotal}</span>
                        </div>
                        <Progress value={(freeGenerationsUsed / monthlyTotal) * 100} className="h-1.5 bg-border-light [&>div]:bg-primary" />

                        {!welcomeUsed && extraCredits >= 2 && (
                            <div className="flex justify-between items-center text-sm pt-1">
                                <span className="text-text-light flex items-center"><span className="mr-1">🎁</span> Boas-vindas (Não expiram)</span>
                                <span className="font-semibold text-accent">2</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center text-sm pt-1">
                            <span className="text-text-light flex items-center"><Sparkles className="w-3 h-3 mr-1 text-accent" /> Pacotes (Não expiram)</span>
                            <span className="font-semibold text-accent">{(!welcomeUsed && extraCredits >= 2) ? extraCredits - 2 : extraCredits}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Primary Actions */}
            <section className="grid md:grid-cols-2 gap-6">
                <motion.div whileHover={{ y: -4, boxShadow: 'var(--shadow-md)' }} className="transition-all">
                    <Link to="/gerar/risco" className="block relative overflow-hidden rounded-[24px] bg-gradient-to-br from-surface to-primary-light/10 border border-primary-light/20 p-8 h-full group">
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-display text-2xl text-text mb-2">Gerar Risco de Bordado</h3>
                        <p className="font-ui text-text-light mb-8 max-w-sm">
                            Transforme fotos ou textos em riscos minimalistas perfeitos para transferir para o tecido.
                        </p>
                        <div className="flex items-center text-primary font-semibold group-hover:gap-3 transition-all">
                            Criar novo risco <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                    </Link>
                </motion.div>

                <motion.div whileHover={{ y: -4, boxShadow: 'var(--shadow-md)' }} className="transition-all h-full">
                    <Link to="/gerar/bordado-colorido" className="block relative overflow-hidden rounded-[24px] bg-gradient-to-br from-surface to-primary-light/10 border border-primary-light/20 p-8 h-full group">
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                            <Paintbrush className="w-6 h-6" />
                        </div>
                        <h3 className="font-display text-2xl text-text mb-2">Gerar Bordado Colorido</h3>
                        <p className="font-ui text-text-light mb-8 max-w-sm">
                            Crie composições hiper-realistas com simulação de pontos texturizados e paleta de fios da meada.
                        </p>
                        <div className="flex items-center text-primary font-semibold group-hover:gap-3 transition-all">
                            Criar bordado <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                    </Link>
                </motion.div>
            </section>

            {/* Ferramentas de Gestao */}
            <section>
                <h2 className="font-display text-2xl text-text mb-6">Ferramentas de Gestão</h2>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {[
                        { title: 'Precificação', desc: 'Calcule o preço perfeito com IA.', icon: DollarSign, color: 'text-warn', bg: 'bg-warn/10', href: '/precificacao' },
                        { title: 'Gestão Financeira', desc: 'Controle de caixa organizado.', icon: PieChart, color: 'text-primary-dark', bg: 'bg-primary-dark/10', href: '/financeiro' },
                        { title: 'Consultoria de Vendas', desc: 'Chat com IA especialista.', icon: Sparkles, color: 'text-accent', bg: 'bg-accent/10', href: '/estrategia' }
                    ].map((tool, idx) => (
                        <motion.div key={idx} variants={itemVariants}>
                            <PremiumLock isLocked={!isPremium} onClick={() => !isPremium && setShowUpgrade(true)} className="h-full">
                                <div className="bg-surface rounded-2xl p-6 border border-border-light hover:border-text-muted/30 transition-colors h-full flex flex-col cursor-pointer group">
                                    <div className={`w-10 h-10 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center mb-4`}>
                                        <tool.icon className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-ui font-semibold text-text mb-1 flex justify-between items-center">
                                        {tool.title}
                                        {!isPremium && <Lock className="w-3.5 h-3.5 text-text-muted opacity-50 group-hover:hidden" />}
                                    </h4>
                                    <p className="font-ui text-sm text-text-light flex-1">{tool.desc}</p>
                                </div>
                            </PremiumLock>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Ultimas criacoes (Mock Masonry) */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="font-display text-2xl text-text">Últimas Criações</h2>
                    {generations.length > 4 && (
                        <Button onClick={() => setShowAllGenerations(!showAllGenerations)} variant="ghost" className="text-primary hover:text-primary-dark hover:bg-[#F5F5F5]">
                            {showAllGenerations ? 'Ver menos' : 'Ver todas'}
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {generations.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-text-muted border-2 border-dashed border-border-light rounded-2xl w-full">
                            <ImageIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                            <p className="font-ui text-sm">Nenhum risco gerado ainda.</p>
                        </div>
                    ) : (
                        (showAllGenerations ? generations : generations.slice(0, 4)).map((gen, i) => {
                            const isExpired = gen.image_expires_at ? new Date(gen.image_expires_at) < new Date() : false;
                            const isProcessing = gen.status === 'processing';

                            return (
                                <div key={gen.id} className="relative rounded-xl overflow-hidden group shadow-sm h-56 bg-border-light flex flex-col items-center justify-center">
                                    {isProcessing ? (
                                        <div className="w-full h-full flex items-center justify-center bg-surface-warm animate-pulse">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : isExpired || !gen.image_public_url ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-warm text-text-muted p-4 text-center">
                                            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                            <span className="text-xs font-ui">Imagem expirada ou indisponível</span>
                                        </div>
                                    ) : (
                                        <>
                                            <img src={gen.image_public_url} alt="Geração" className="absolute inset-0 w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-text/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                                <Badge variant="secondary" className="w-fit mb-2 bg-surface/20 text-surface backdrop-blur-md border-none capitalize">{gen.generation_type?.replace('_', ' ')}</Badge>
                                                <div className="flex gap-2">
                                                    <a href={gen.image_public_url} target="_blank" rel="noopener noreferrer" className="bg-primary hover:bg-primary-dark w-full text-xs py-2 rounded-lg text-center text-white font-medium block">Visualizar</a>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                setDownloadingId(gen.id);
                                                                const response = await fetch(gen.image_public_url);
                                                                const blob = await response.blob();
                                                                const url = window.URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `criacao-${gen.id.substring(0, 8)}.png`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(url);
                                                            } catch (error) {
                                                                console.error("Erro ao baixar imagem:", error);
                                                            } finally {
                                                                setDownloadingId(null);
                                                            }
                                                        }}
                                                        disabled={downloadingId === gen.id}
                                                        className="bg-surface hover:bg-surface-warm w-10 flex items-center justify-center rounded-lg text-text border border-border-light shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                                        {downloadingId === gen.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Download className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>
    );
}
