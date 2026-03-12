'use client';

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, PackageOpen, Settings, LogOut, Link2, Mail, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { usePlatform } from '@/contexts/PlatformContext';

const adminNavItems = [
    { href: '/admin', label: 'Visão Geral', icon: LayoutDashboard, exact: true },
    { href: '/admin/usuarios', label: 'Usuários', icon: Users, exact: false },
    { href: '/admin/pagamentos', label: 'Pagamentos', icon: CreditCard, exact: false },
    { href: '/admin/pacotes', label: 'Pacotes de Crédito', icon: PackageOpen, exact: false },
    { href: '/admin/convites', label: 'Convites', icon: Link2, exact: false },
    { href: '/admin/emails', label: 'Emails', icon: Mail, exact: false },
    { href: '/admin/infraestrutura', label: 'Infraestrutura', icon: Shield, exact: false },
    { href: '/admin/configuracoes', label: 'Configurações', icon: Settings, exact: false },
];

export function AdminSidebar() {
    const location = useLocation();
    const pathname = location.pathname;
    const navigate = useNavigate();
    const supabase = createClient();

    const { platformName, platformLogo } = usePlatform();
    const [profileName, setProfileName] = useState('Admin');

    useEffect(() => {
        async function loadProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                if (data && data.full_name) {
                    setProfileName(data.full_name.split(' ')[0]);
                }
            }
        }
        loadProfile();
    }, [supabase]);

    const handleExitAdmin = () => {
        navigate('/dashboard');
    };

    return (
        <aside className="hidden lg:flex flex-col w-[260px] h-screen fixed top-0 left-0 bg-[#F7E1D7] border-r border-black/10 z-20 shadow-md">
            <div className="pt-6 pb-6 px-6 flex flex-col items-center justify-center border-b border-black/10">
                <img
                    src={platformLogo || '/logo.png'}
                    alt={`Logo ${platformName}`}
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                    style={{ height: '80px', width: 'auto', objectFit: 'contain', marginBottom: '8px' }}
                />
                <span className="text-[#AC5148] font-bold text-xs tracking-widest uppercase">Admin</span>
            </div>

            <nav className="flex-1 py-4 px-4 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {adminNavItems.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-ui text-sm group text-left',
                                isActive
                                    ? 'bg-[#AC5148] text-white font-medium shadow-sm'
                                    : 'text-[#2D2D2D] hover:bg-[#E2C5B9] hover:text-[#2D2D2D]'
                            )}
                        >
                            <item.icon className={cn("w-5 h-5 shrink-0", isActive ? 'text-white' : 'text-[#2D2D2D]/70 group-hover:text-[#2D2D2D]')} />
                            <span className="flex-1">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-black/10 bg-[#F7E1D7]">
                <div className="p-3 bg-[#E2C5B9]/40 rounded-xl border border-black/10 flex items-center gap-3 shadow-sm mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#AC5148] flex items-center justify-center text-white font-display flex-shrink-0 uppercase font-bold shadow-sm">
                        {profileName.charAt(0)}
                    </div>
                    <div className="overflow-hidden flex-1">
                        <p className="text-sm font-semibold text-[#2D2D2D] truncate">{profileName}</p>
                        <span className="text-[10px] font-bold text-[#AC5148] tracking-wider uppercase">Administrador</span>
                    </div>
                </div>
                <button onClick={handleExitAdmin} className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-medium text-[#2D2D2D] bg-white hover:bg-[#AC5148] hover:text-white transition-all duration-200 rounded-xl border border-black/10 shadow-sm">
                    <LogOut className="w-4 h-4" /> Voltar ao Painel
                </button>
            </div>
        </aside>
    );
}
