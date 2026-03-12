'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Sparkles, User, X, ShoppingBag, Home, Image as ImageIcon, Paintbrush, DollarSign, PieChart, LogOut, Lock, Shield, Gift, Calendar, Users, Package, Timer, FileText } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '../shared/NotificationBell';
import { UpgradeModal } from '../shared/UpgradeModal';
import { usePlatform } from '@/contexts/PlatformContext';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, isPremium: false },
    { href: '/gerar/risco', label: 'Gerador de Riscos', icon: ImageIcon, isPremium: false },
    { href: '/gerar/bordado-colorido', label: 'Gerar Bordado', icon: Paintbrush, isPremium: false },
    { href: '/dashboard/loja', label: 'Loja de Créditos', icon: ShoppingBag, isPremium: false },
    { href: '/dashboard/agenda', label: 'Agenda', icon: Calendar, isPremium: true },
    { href: '/dashboard/clientes', label: 'Clientes', icon: Users, isPremium: true },
    { href: '/dashboard/orcamentos', label: 'Orçamentos', icon: FileText, isPremium: true },
    { href: '/dashboard/estoque', label: 'Estoque', icon: Package, isPremium: true },
    { href: '/dashboard/cronometro', label: 'Cronômetro', icon: Timer, isPremium: true },
    { href: '/indicacoes', label: 'Indicações', icon: Gift, isPremium: false },
    { href: '/precificacao', label: 'Precificação', icon: DollarSign, isPremium: true },
    { href: '/financeiro', label: 'Financeiro', icon: PieChart, isPremium: true },
    { href: '/estrategia', label: 'IA Estratégia', icon: Sparkles, isPremium: true },
    { href: '/perfil', label: 'Meu Perfil', icon: User, isPremium: false },
];

export function TopBar() {
    const [open, setOpen] = useState(false);
    const { platformName, platformLogo } = usePlatform();
    const [isPremium, setIsPremium] = useState(false);
    const [role, setRole] = useState('user');

    const supabase = createClient();
    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role, plan').eq('id', user.id).single();
                if (data) {
                    setRole(data.role);
                    if (data.plan !== 'free') setIsPremium(true);
                }
            }
        }
        loadProfile();
    }, []);

    const location = useLocation();
    const pathname = location.pathname;
    const navigate = useNavigate();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setOpen(false);
        navigate('/login');
    };

    return (
        <>
            <header className="fixed top-0 left-0 right-0 h-16 bg-[#F7E1D7] border-b border-black/10 z-30 lg:hidden flex items-center justify-between px-4 shadow-sm">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <button className="p-2 -ml-2 text-[#2D2D2D] hover:bg-[#C9BC6A] rounded-full transition-colors">
                            <Menu className="w-6 h-6" />
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 bg-[#F7E1D7] border-r border-black/10 flex flex-col">
                        {/* Brand */}
                        <Link to="/dashboard" onClick={() => setOpen(false)} className="pt-6 pb-4 px-6 flex items-center gap-3 border-b border-black/10 hover:bg-[#C9BC6A]/40 transition-colors">
                            <img
                                src={platformLogo || '/logo.png'}
                                alt={`Logo ${platformName}`}
                                onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                                style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
                            />
                            <span className="font-display text-xl text-[#2D2D2D] tracking-wide">{platformName}</span>
                        </Link>

                        <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto pb-6">
                            {navItems.map((item) => {
                                const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : (pathname === item.href || pathname.startsWith(item.href + '/'));
                                const isLocked = item.isPremium && !isPremium;
                                const Element = isLocked ? 'button' : Link;
                                const linkProps = isLocked ? { onClick: () => { setShowUpgradeModal(true); setOpen(false); } } : { to: item.href, onClick: () => setOpen(false) };

                                return (
                                    <Element
                                        key={item.href}
                                        {...(linkProps as any)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-ui text-sm group text-left relative',
                                            isActive
                                                ? 'bg-[#AC5148] text-white font-medium shadow-sm'
                                                : 'text-[#2D2D2D] hover:bg-[#C9BC6A] hover:text-[#2D2D2D]',
                                            isLocked && 'opacity-60'
                                        )}
                                    >
                                        <item.icon className={cn("w-5 h-5 shrink-0", isActive ? 'text-white' : 'text-[#2D2D2D]/70 group-hover:text-[#2D2D2D]')} />
                                        <span className="flex-1">{item.label}</span>
                                        {isLocked && <Lock className="w-4 h-4 text-[#AC5148]" aria-label="Recurso Premium" />}
                                    </Element>
                                );
                            })}

                            {role === 'admin' && (
                                <Link
                                    to="/admin"
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-ui text-sm group text-left relative mt-3',
                                        pathname.startsWith('/admin')
                                            ? 'bg-[#AC5148] text-white font-medium shadow-sm'
                                            : 'text-[#2D2D2D] hover:bg-[#C9BC6A] hover:text-[#2D2D2D]'
                                    )}
                                >
                                    <Shield className={cn("w-5 h-5 shrink-0", pathname.startsWith('/admin') ? 'text-white' : 'text-[#2D2D2D]/70 group-hover:text-[#2D2D2D]')} />
                                    <span className="flex-1">Painel Admin</span>
                                </Link>
                            )}
                        </nav>
                        <div className="p-4 border-t border-black/10 bg-[#F7E1D7]">
                            <button onClick={handleSignOut} className="flex items-center justify-center gap-2 w-full p-2 text-sm text-[#2D2D2D]/60 hover:text-[#2D2D2D] transition-colors rounded-lg hover:bg-[#C9BC6A] border border-transparent hover:border-black/10">
                                <LogOut className="w-4 h-4" /> Sair da Conta
                            </button>
                        </div>
                    </SheetContent>
                </Sheet>

                <h1 className="font-display text-xl text-[#2D2D2D] absolute left-1/2 -translate-x-1/2">{platformName}</h1>

                <div className="absolute right-4 flex items-center gap-2 text-[#2D2D2D]">
                    <NotificationBell />
                    <Link to="/perfil" className="w-8 h-8 rounded-full bg-[#AC5148]/10 flex items-center justify-center text-[#AC5148] hover:bg-[#AC5148]/20 transition-colors">
                        <User className="w-5 h-5" />
                    </Link>
                </div>
            </header>

            <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
        </>
    );
}
