import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Outlet } from 'react-router-dom';

export default function DashboardLayout() {
    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Desktop Sidebar (>= lg) */}
            <Sidebar />

            {/* Mobile Top Navigation (< lg) */}
            <TopBar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full w-full overflow-y-auto lg:pl-[260px] pt-16 lg:pt-0 pb-16 lg:pb-0">
                <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 animate-in fade-in duration-500">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation (< lg) */}
            <BottomNav />
        </div>
    );
}
