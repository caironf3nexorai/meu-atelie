import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';

/* --- PAGES --- */
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard/DashboardPage'));
const GenerateRiscoPage = React.lazy(() => import('@/pages/dashboard/GenerateRiscoPage'));
const GenerateBordadoPage = React.lazy(() => import('@/pages/dashboard/GenerateBordadoPage'));
const LojaPage = React.lazy(() => import('@/pages/dashboard/LojaPage'));
const PerfilPage = React.lazy(() => import('@/pages/dashboard/PerfilPage'));
const PrecificacaoPage = React.lazy(() => import('@/pages/dashboard/PrecificacaoPage'));
const FinanceiroPage = React.lazy(() => import('@/pages/dashboard/FinanceiroPage'));
const EstrategiaPage = React.lazy(() => import('@/pages/dashboard/EstrategiaPage'));
const AgendaPage = React.lazy(() => import('@/pages/dashboard/AgendaPage'));
const ClientesPage = React.lazy(() => import('@/pages/dashboard/ClientesPage'));
const EstoquePage = React.lazy(() => import('@/pages/dashboard/EstoquePage'));
const CronometroPage = React.lazy(() => import('@/pages/dashboard/CronometroPage'));
const AssinarPage = React.lazy(() => import('@/pages/dashboard/AssinarPage'));
const OrcamentosPage = React.lazy(() => import('@/pages/dashboard/OrcamentosPage'));

/* --- LAYOUTS (To Be Migrated) --- */
const DashboardLayout = React.lazy(() => import('@/components/layout/DashboardLayout'));

import { useAuth } from '@/lib/hooks/useAuth';
import { usePlatform } from '@/contexts/PlatformContext';

/* --- GUARDS --- */
// Placeholder simple AuthGuard
const AuthGuard = () => {
    // In future: verify global context or supabase.auth.getSession()
    const { user, loading } = useAuth();
    const { platformName } = usePlatform();
    if (loading) return <div className="min-h-screen flex items-center justify-center font-ui text-sm text-text-light animate-pulse">Carregando {platformName}...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return <Outlet />;
};

const AdminGuard = () => {
    const { user, profile, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center font-ui text-sm text-text-light animate-pulse">Verificando Credenciais...</div>;
    if (!user || profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
    return <Outlet />;
};

const AdminDashboardPage = React.lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminUsersPage = React.lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminPaymentsPage = React.lazy(() => import('@/pages/admin/AdminPaymentsPage'));
const AdminSettingsPage = React.lazy(() => import('@/pages/admin/AdminSettingsPage'));
const AdminPackagesPage = React.lazy(() => import('@/pages/admin/AdminPackagesPage'));
const AdminConvitesPage = React.lazy(() => import('@/pages/admin/AdminConvitesPage'));
const AdminEmailsPage = React.lazy(() => import('@/pages/admin/AdminEmailsPage'));
const InfraestruturaPage = React.lazy(() => import('@/pages/admin/InfraestruturaPage'));
const AdminLayout = React.lazy(() => import('@/components/layout/AdminLayout'));

const LandingPage = React.lazy(() => import('@/pages/public/LandingPage'));
const IndicacoesPage = React.lazy(() => import('@/pages/dashboard/IndicacoesPage'));

const AuthLayout = React.lazy(() => import('@/components/layout/AuthLayout'));

const OrcamentoPublicoPage = React.lazy(() => import('@/pages/public/OrcamentoPublicoPage'));
const TermosDeUsoPage = React.lazy(() => import('@/pages/public/TermosDeUsoPage'));
const PrivacidadePage = React.lazy(() => import('@/pages/public/PrivacidadePage'));
const ResetarSenhaPage = React.lazy(() => import('@/pages/public/ResetarSenhaPage'));

const router = createBrowserRouter([
    {
        path: '/',
        element: <LandingPage />
    },
    {
        path: '/orcamento/:token',
        element: <OrcamentoPublicoPage />
    },
    {
        path: '/termos',
        element: <TermosDeUsoPage />
    },
    {
        path: '/privacidade',
        element: <PrivacidadePage />
    },
    {
        path: '/resetar-senha',
        element: <ResetarSenhaPage />
    },
    {
        element: <AuthLayout />,
        children: [
            {
                path: '/login',
                element: <LoginPage />
            },
            {
                path: '/cadastro',
                element: <RegisterPage />
            }
        ]
    },
    {
        // Rotas Protegidas do Painel (Free / Premium)
        element: <AuthGuard />,
        children: [
            {
                path: '/',
                element: <DashboardLayout />,
                children: [
                    { path: 'dashboard', element: <DashboardPage /> },
                    { path: 'gerar/risco', element: <GenerateRiscoPage /> },
                    { path: 'gerar/bordado-colorido', element: <GenerateBordadoPage /> },
                    { path: 'dashboard/loja', element: <LojaPage /> },
                    { path: 'dashboard/agenda', element: <AgendaPage /> },
                    { path: 'dashboard/clientes', element: <ClientesPage /> },
                    { path: 'dashboard/estoque', element: <EstoquePage /> },
                    { path: 'dashboard/cronometro', element: <CronometroPage /> },
                    { path: 'dashboard/assinar', element: <AssinarPage /> },
                    { path: 'dashboard/orcamentos', element: <OrcamentosPage /> },
                    { path: 'precificacao', element: <PrecificacaoPage /> },
                    { path: 'financeiro', element: <FinanceiroPage /> },
                    { path: 'estrategia', element: <EstrategiaPage /> },
                    { path: 'indicacoes', element: <IndicacoesPage /> },
                    { path: 'perfil', element: <PerfilPage /> },
                ]
            }
        ]
    },
    {
        // Rotas Protegidas do Painel Admin
        element: <AdminGuard />,
        children: [
            {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                    { index: true, element: <AdminDashboardPage /> },
                    { path: 'usuarios', element: <AdminUsersPage /> },
                    { path: 'pagamentos', element: <AdminPaymentsPage /> },
                    { path: 'pacotes', element: <AdminPackagesPage /> },
                    { path: 'convites', element: <AdminConvitesPage /> },
                    { path: 'emails', element: <AdminEmailsPage /> },
                    { path: 'infraestrutura', element: <InfraestruturaPage /> },
                    { path: 'configuracoes', element: <AdminSettingsPage /> },
                ]
            }
        ]
    },
    {
        path: '*',
        element: <Navigate to="/dashboard" replace />
    }
]);

export default function AppRouter() {
    return <RouterProvider router={router} />;
}
