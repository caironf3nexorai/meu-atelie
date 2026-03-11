
import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Check, PackageOpen, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

export default function StorePage() {
    const supabase = createClient();
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPackages() {
            const { data } = await supabase.from('credit_packages')
                .select('*')
                .eq('active', true)
                .order('display_order', { ascending: true });
            setPackages(data || []);
            setLoading(false);
        }
        fetchPackages();
    }, [supabase]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-primary">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="font-ui text-text-light">Listando pacotes disponíveis...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-12 space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" asChild className="rounded-full">
                    <Link to="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
                </Button>
                <div>
                    <h1 className="font-display text-3xl text-text">Loja de Fios (Créditos)</h1>
                    <p className="font-ui text-text-light">Seus créditos mensais acabaram? Adquira pacotes avulsos que <strong className="text-primary">nunca expiram</strong>.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {packages.map((pkg, i) => (
                    <motion.div
                        key={pkg.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`relative flex flex-col p-8 rounded-3xl border-2 bg-surface transition-all hover:-translate-y-2 hover:shadow-xl ${pkg.name === 'Pacote Popular' ? 'border-primary shadow-lg ring-4 ring-primary/10 scale-105' : 'border-border-light hover:border-primary/50'}`}
                    >
                        {pkg.credit_amount === 30 && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white border-0 px-3 py-1 shadow-sm uppercase tracking-wider text-xs">
                                Melhor Oferta
                            </Badge>
                        )}
                        {pkg.name === 'Pacote Popular' && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white border-0 px-3 py-1 shadow-sm uppercase tracking-wider text-xs">
                                Mais Escolhido
                            </Badge>
                        )}

                        <div className="mb-6 space-y-2 text-center">
                            <h3 className="font-display text-2xl text-text">{pkg.name}</h3>
                            <div className="flex justify-center items-end gap-1">
                                <span className="text-4xl font-bold text-text mb-1">{pkg.credit_amount}</span>
                                <span className="text-text-light font-ui pb-2">criações</span>
                            </div>
                        </div>

                        <ul className="mb-8 space-y-3 font-ui text-text flex-1">
                            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> Uso nas ferramentas VIP</li>
                            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> Uso no Risco Simples</li>
                            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> <strong>Sem data de validade</strong></li>
                        </ul>

                        <div className="pt-6 border-t border-border-light text-center">
                            <div className="text-3xl font-display text-text mb-4">R$ {Number(pkg.price_brl ?? pkg.price ?? 0).toFixed(2).replace('.', ',')}</div>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full h-14 rounded-2xl text-base shadow-md bg-primary hover:bg-primary-dark text-white transition-colors">
                                        Comprar com Pix
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl border-border-light bg-surface">
                                    <DialogHeader>
                                        <DialogTitle className="font-display text-2xl text-text flex items-center gap-2">
                                            <Sparkles className="w-6 h-6 text-accent" /> Em Breve!
                                        </DialogTitle>
                                        <DialogDescription className="font-ui text-text-light text-lg">
                                            A integração com o gateway de pagamento (Pix/Cartão) está sendo finalizada pela nossa equipe.
                                            <br /><br />
                                            Em alguns dias você poderá recarregar seus fios automaticamente aqui!
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex justify-end pt-4">
                                        <Button onClick={() => { }} className="bg-primary hover:bg-primary-dark rounded-full px-8">Entendi</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </motion.div>
                ))}
            </div>

            <section className="mt-16 bg-surface-warm/50 rounded-3xl p-8 border border-border-light text-center">
                <PackageOpen className="w-12 h-12 text-primary-light mx-auto mb-4" />
                <h3 className="font-display text-2xl text-text mb-2">Já pensou em ser assinante?</h3>
                <p className="font-ui text-text-light mb-6 max-w-xl mx-auto">
                    A Assinatura Premium custa menos que o Pacote Prata e te oferece uma recarga automática todos os meses, além de destravar todas as áreas do painel (como a Aba Financeira e Precificação IA).
                </p>
                <Button className="border border-primary text-primary hover:text-primary bg-transparent hover:bg-[#FDF0F0] rounded-full px-8 transition-colors">Explorar Clube Premium</Button>
            </section>
        </div>
    );
}
