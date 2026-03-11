import React, { Suspense } from 'react';
import AppRouter from './router';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { ModalProvider } from '@/contexts/ModalContext';
import { PlatformProvider } from '@/contexts/PlatformContext';

export default function App() {
  return (
    <PlatformProvider>
      <AuthProvider>
        <ModalProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-ui text-text-light text-sm animate-pulse">Carregando Plataforma...</div>}>
            <AppRouter />
            <Toaster />
          </Suspense>
        </ModalProvider>
      </AuthProvider>
    </PlatformProvider>
  );
}
