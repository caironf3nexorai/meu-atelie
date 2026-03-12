import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { Outlet } from 'react-router-dom';
import { Menu, LogOut, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Desktop Sidebar (>= lg) */}
            <AdminSidebar />

            {/* Mobile Top Navigation (< lg) */}
            <header className="lg:hidden fixed top-0 w-full h-16 bg-stone-100 border-b border-border z-30 flex items-center justify-between px-4">
                <h1 className="font-display text-xl text-text font-bold"><span className="text-primary">Admin</span> Ateliê</h1>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    {mobileMenuOpen ? <X className="w-6 h-6 text-text" /> : <Menu className="w-6 h-6 text-text" />}
                </Button>
            </header>

            {/* Mobile Menu Drawer */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-20 bg-stone-100 pt-16 flex flex-col">
                    <nav className="flex-1 p-4 space-y-2">
                        <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Visão Geral</Link>
                        <Link to="/admin/usuarios" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Usuários</Link>
                        <Link to="/admin/pagamentos" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Pagamentos</Link>
                        <Link to="/admin/pacotes" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Pacotes de Crédito</Link>
                        <Link to="/admin/convites" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Convites</Link>
                        <Link to="/admin/emails" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Emails</Link>
                        <Link to="/admin/configuracoes" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">Configurações</Link>
                        <Link to="/admin/infraestrutura" onClick={() => setMobileMenuOpen(false)} className="block p-4 rounded-xl text-text font-ui font-medium bg-white shadow-sm border border-border-light">🏥 Infraestrutura</Link>
                    </nav>
                    <div className="p-4 border-t border-border-light">
                        <Button onClick={() => navigate('/dashboard')} className="w-full bg-primary hover:bg-primary-dark h-12 rounded-xl text-white">
                            <LogOut className="w-4 h-4 mr-2" /> Voltar ao Painel Aluno
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full w-full overflow-y-auto lg:pl-[260px] pt-16 lg:pt-0">
                <div className="flex-1 w-full mx-auto p-4 md:p-8 animate-in fade-in duration-500 bg-stone-50/30">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
