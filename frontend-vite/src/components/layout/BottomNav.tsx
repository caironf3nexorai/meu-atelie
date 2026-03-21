'use client';

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, PieChart, User, ShoppingBag, Shield, Calendar, Users, Package, FileText, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UpgradeModal } from '../shared/UpgradeModal';
import { useAuth } from '@/lib/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function BottomNav() {
    const location = useLocation();
    const pathname = location.pathname;
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showGestaoSheet, setShowGestaoSheet] = useState(false);

    // Obtenção correta de estado síncrono da plataforma usando o Provider Global
    const { profile } = useAuth();
    const role = profile?.role || 'user';
    const isPremium = profile?.plan === 'premium';

    const navItems = [
        { href: '/dashboard', label: 'Início', icon: Home, isPremium: false },
        { href: '/gerar/risco', label: 'Criar', icon: PlusCircle, isPremium: false },
        { href: '/dashboard/loja', label: 'Loja', icon: ShoppingBag, isPremium: false },
        { isSheet: true, label: 'Gestão', icon: PieChart, isPremium: true },
        { href: '/perfil', label: 'Perfil', icon: User, isPremium: false },
    ];

    if (role === 'admin') {
        const profileIndex = navItems.findIndex(i => i.href === '/perfil');
        navItems.splice(profileIndex, 0, { href: '/admin', label: 'Admin', icon: Shield, isPremium: false });
    }

    return (
        <>
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-warm border-t border-border-light flex items-center justify-around px-2 z-30 pb-safe shadow-[0_-4px_20px_rgba(61,43,43,0.03)]">
                {navItems.map((item, index) => {
                    // Aproximação de active state
                    const isActive = item.href ? (pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')) : false;
                    const isLocked = item.isPremium && !isPremium;

                    const handleClick = (e: React.MouseEvent) => {
                        if (isLocked) {
                            e.preventDefault();
                            setShowUpgradeModal(true);
                        } else if (item.isSheet) {
                            e.preventDefault();
                            setShowGestaoSheet(true);
                        }
                    };

                    const Element = item.href ? Link : 'button';
                    const props = item.href ? { to: item.href, onClick: handleClick } : { onClick: handleClick };

                    return (
                        <Element
                            key={item.href || index}
                            {...(props as any)}
                            className={cn(
                                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
                                isActive ? 'text-primary' : 'text-text-muted hover:text-text-light'
                            )}
                        >
                            <item.icon className={cn('w-5 h-5', isActive && 'fill-current opacity-20', item.href === '/admin' && 'text-accent')} />
                            <span className={cn("text-[10px] font-ui font-medium", item.href === '/admin' && 'text-accent')}>
                                {item.label}
                            </span>
                        </Element>
                    );
                })}
            </nav>

            <Sheet open={showGestaoSheet} onOpenChange={setShowGestaoSheet}>
                <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="font-display text-text text-xl">Gestão do Ateliê</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-3">
                        <Link to="/dashboard/agenda" onClick={() => setShowGestaoSheet(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                            <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Calendar className="w-5 h-5" /></div>
                            <span className="font-medium font-ui text-base">Agenda</span>
                        </Link>
                        <Link to="/dashboard/clientes" onClick={() => setShowGestaoSheet(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                            <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Users className="w-5 h-5" /></div>
                            <span className="font-medium font-ui text-base">Clientes</span>
                        </Link>
                        <Link to="/dashboard/orcamentos" onClick={() => setShowGestaoSheet(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                            <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><FileText className="w-5 h-5" /></div>
                            <span className="font-medium font-ui text-base">Orçamentos</span>
                        </Link>
                        <Link to="/dashboard/estoque" onClick={() => setShowGestaoSheet(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                            <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Package className="w-5 h-5" /></div>
                            <span className="font-medium font-ui text-base">Estoque</span>
                        </Link>
                        <Link to="/dashboard/envios" onClick={() => setShowGestaoSheet(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                            <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Truck className="w-5 h-5" /></div>
                            <span className="font-medium font-ui text-base">Envios</span>
                        </Link>
                    </div>
                </SheetContent>
            </Sheet>

            <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
        </>
    );
}
