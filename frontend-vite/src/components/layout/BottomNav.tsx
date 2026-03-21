'use client';

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusCircle, PieChart, User, ShoppingBag, Shield, Calendar, Users, Package, FileText, Truck, Paintbrush, Gift, Lock, DollarSign, Sparkles, Timer } from 'lucide-react';
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
                <SheetContent side="bottom" className="rounded-t-3xl pb-safe h-[85vh] overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="font-display text-text text-xl">Menu Completo</SheetTitle>
                    </SheetHeader>
                    
                    <div className="flex flex-col gap-6">
                        {/* Ferramentas e Loja */}
                        <div>
                            <h3 className="text-[10px] font-bold text-[#2D2D2D]/60 tracking-wider uppercase ml-2 mb-3">Estúdio & Loja</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Link to="/gerar/risco" onClick={() => setShowGestaoSheet(false)} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                                    <div className="bg-[#E2C5B9]/30 p-2.5 rounded-xl text-[#2D2D2D]"><PlusCircle className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Gerador P&B</span>
                                </Link>
                                <Link to="/gerar/bordado-colorido" onClick={() => setShowGestaoSheet(false)} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                                    <div className="bg-[#E2C5B9]/30 p-2.5 rounded-xl text-[#2D2D2D]"><Paintbrush className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Bordado Colorido</span>
                                </Link>
                                <Link to="/dashboard/loja" onClick={() => setShowGestaoSheet(false)} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                                    <div className="bg-[#E2C5B9]/30 p-2.5 rounded-xl text-[#2D2D2D]"><ShoppingBag className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Loja</span>
                                </Link>
                                <Link to="/indicacoes" onClick={() => setShowGestaoSheet(false)} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm">
                                    <div className="bg-[#E2C5B9]/30 p-2.5 rounded-xl text-[#2D2D2D]"><Gift className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Indicações</span>
                                </Link>
                            </div>
                        </div>

                        {/* Gestão e Financeiro Premium */}
                        <div>
                            <h3 className="text-[10px] font-bold text-[#AC5148] tracking-wider uppercase ml-2 mb-3 flex items-center gap-1">
                                Premium <Lock className="w-3 h-3 font-normal opacity-70" />
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Link to="/precificacao" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><DollarSign className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Precificação</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/financeiro" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><PieChart className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Financeiro</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/estrategia" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Sparkles className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Estratégia IA</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/dashboard/agenda" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Calendar className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Agenda</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/dashboard/clientes" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Users className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Clientes</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/dashboard/orcamentos" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><FileText className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Orçamentos</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/dashboard/envios" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Truck className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Envios</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/dashboard/estoque" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Package className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Estoque</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                                <Link to="/dashboard/cronometro" onClick={(e) => { if(!isPremium) { e.preventDefault(); setShowUpgradeModal(true); } else { setShowGestaoSheet(false); } }} className="flex flex-col items-center gap-2 p-4 col-span-2 rounded-2xl bg-surface hover:bg-surface-warm border border-border-light text-text transition-colors shadow-sm relative">
                                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Timer className="w-5 h-5" /></div>
                                    <span className="font-medium font-ui text-xs text-center">Cronômetro</span>
                                    {!isPremium && <Lock className="w-3 h-3 absolute top-3 right-3 text-primary/40" />}
                                </Link>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
        </>
    );
}
