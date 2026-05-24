import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { Sparkles, ArrowRight, X } from 'lucide-react';

export default function TrialExpiredPopup() {
    const { profile, loading } = useAuth();
    const supabase = createClient();
    const navigate = useNavigate();
    
    const [open, setOpen] = useState(false);
    const [founderCouponAvailable, setFounderCouponAvailable] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (loading) return;

        // Regra: Se o usuário já teve trial e agora o plano é free, o trial expirou.
        if (profile?.had_trial && profile?.plan === 'free') {
            checkCouponAndShow();
        } else {
            setChecking(false);
        }
    }, [profile, loading]);

    const checkCouponAndShow = async () => {
        try {
            const { data } = await supabase
                .from('coupons')
                .select('current_uses, max_uses')
                .eq('code', 'FUNDADORA20')
                .eq('active', true)
                .single();
            
            if (data && data.max_uses && data.current_uses < data.max_uses) {
                setFounderCouponAvailable(true);
            }
        } catch (error) {
            console.error('Error checking founder coupon', error);
        } finally {
            setChecking(false);
            setOpen(true);
        }
    };

    if (checking || !open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#F2E9DB] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-300">
                <button 
                    onClick={() => setOpen(false)}
                    className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5 text-[#7A6A5A]" />
                </button>
                
                <div className="bg-[#AC5148] p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, white 2px, transparent 2.5px)', backgroundSize: '20px 20px' }}></div>
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-[#F7E1D7] relative z-10" />
                    <h2 className="font-display text-2xl font-bold relative z-10">Seu período de teste terminou!</h2>
                    <p className="mt-2 text-[#F7E1D7] relative z-10 font-ui text-sm">Esperamos que você tenha adorado a experiência.</p>
                </div>

                <div className="p-8 text-center">
                    <p className="text-[#1C1410] font-ui mb-6">
                        Para continuar gerando riscos exclusivos, utilizando nossa precificação inteligente e organizando suas encomendas, faça o upgrade da sua conta.
                    </p>

                    {founderCouponAvailable && (
                        <div className="bg-[#AC5148]/10 border border-[#AC5148]/20 rounded-xl p-4 mb-6">
                            <span className="inline-block bg-[#AC5148] text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider mb-2">Temos uma surpresa</span>
                            <p className="text-sm font-ui text-[#AC5148]">
                                Você ainda pode garantir a assinatura vitalícia por apenas <strong className="text-lg">R$ 77/mês</strong> utilizando o cupom <strong className="bg-[#AC5148]/10 px-1 rounded">FUNDADORA20</strong>.
                            </p>
                            <p className="text-xs text-[#AC5148]/70 mt-1 font-bold">Mas corra, restam pouquíssimos cupons disponíveis!</p>
                        </div>
                    )}

                    <button 
                        onClick={() => navigate('/dashboard/assinar')}
                        className="w-full py-4 bg-[#AC5148] hover:bg-[#8A413A] text-white rounded-xl font-bold font-ui text-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#AC5148]/30"
                    >
                        Assinar o Meu Ateliê <ArrowRight className="w-5 h-5" />
                    </button>
                    
                    <button 
                        onClick={() => setOpen(false)}
                        className="mt-4 text-sm font-ui text-[#7A6A5A] hover:text-[#1C1410] transition-colors"
                    >
                        Continuar no plano gratuito
                    </button>
                </div>
            </div>
        </div>
    );
}
