'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useModal } from '@/contexts/ModalContext';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';

interface UpgradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
    const { showAlert } = useModal();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const supabase = createClient();
    const [planPrice, setPlanPrice] = useState(97);

    useEffect(() => {
        const fetchPlanConfig = async () => {
            const { data } = await supabase.from('plan_config').select('premium_price_brl').maybeSingle();
            if (data?.premium_price_brl) setPlanPrice(data.premium_price_brl);
        };
        fetchPlanConfig();
    }, [supabase]);

    const handleCheckout = () => {
        onOpenChange(false);
        navigate('/dashboard/assinar');
    };

    const ContentBody = () => (
        <>
            <div className="flex flex-col items-center text-center space-y-4 pt-4 pb-2">
                <div className="w-16 h-16 bg-primary-light/30 text-primary rounded-full flex items-center justify-center mb-2 shadow-sm">
                    <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="font-display text-2xl text-text font-medium tracking-tight">
                    Desbloqueie todo o seu <br /> Potencial Criativo
                </h2>
                <p className="text-text-light font-ui px-4">
                    Tenha acesso ilimitado a todos os módulos exclusivos da plataforma e impulsione o seu ateliê.
                </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border-light my-4">
                <div className="flex justify-between items-baseline mb-6">
                    <span className="text-text-muted font-ui">Plano Premium</span>
                    <div className="text-right">
                        <span className="font-display text-3xl text-text">R$ {Math.floor(planPrice)},{String(planPrice.toFixed(2)).split('.')[1]}</span>
                        <span className="text-text-light font-ui text-sm">/mês</span>
                    </div>
                </div>

                <ul className="space-y-3 mb-6">
                    {[
                        'Gerador de Bordado Colorido',
                        'Ferramenta de Precificação',
                        'Planilha Financeira Completa',
                        'Chat com IA Consultora de Vendas',
                        'Geração de Riscos Ilimitada'
                    ].map((benefit, i) => (
                        <li key={i} className="flex items-start gap-3 text-text-light font-ui text-sm break-words">
                            <Check className="w-5 h-5 text-accent shrink-0" />
                            <span>{benefit}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex flex-col gap-3 pb-4">
                <Button
                    onClick={handleCheckout}
                    className="w-full h-12 rounded-full font-ui text-base bg-primary hover:bg-primary-dark shadow-md"
                >
                    Quero Assinar Agora
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="w-full h-12 text-text-light hover:text-text hover:bg-transparent font-ui"
                >
                    Continuar no plano Grátis
                </Button>
            </div>
        </>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md bg-surface-warm border-none shadow-xl rounded-[24px]">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Upgrade para Premium</DialogTitle>
                    </DialogHeader>
                    <ContentBody />
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="bg-surface-warm border-none rounded-t-[24px] px-4 pt-8 pb-4 max-h-[90vh] overflow-y-auto">
                <SheetHeader className="sr-only">
                    <SheetTitle>Upgrade para Premium</SheetTitle>
                </SheetHeader>
                <ContentBody />
            </SheetContent>
        </Sheet>
    );
}
