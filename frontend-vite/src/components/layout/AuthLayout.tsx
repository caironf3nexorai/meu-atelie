import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
    return (
        <div className="flex min-h-screen bg-background text-foreground selection:bg-primary-light">
            {/* Esquerda: Decoração Imersiva (Oculta no mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-gradient-to-br from-primary-light/40 to-surface-warm border-r border-border-light overflow-hidden">
                {/* Elemento Decorativo SVG Exemplo */}
                <div className="absolute inset-0 opacity-[0.08]"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-primary) 1.5px, transparent 0)', backgroundSize: '32px 32px' }}
                />

                <div className="relative z-10 max-w-lg text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="font-display text-5xl lg:text-6xl text-text leading-tight drop-shadow-sm">
                        Toda a arte começa<br />com um único ponto.
                    </h1>
                    <p className="font-ui text-text-light text-lg">
                        Um ateliê digital pensado exclusivamente para simplificar a vida, a gestão e a arte das bordadeiras do Brasil.
                    </p>
                    <div className="pt-8">
                        <div className="w-16 h-16 rounded-full border border-primary-light bg-surface-warm/50 flex items-center justify-center mx-auto shadow-sm">
                            <span className="text-3xl">🧵</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Direita: Formulários (Login, Cadastro) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative">
                <div className="w-full max-w-[420px] bg-surface sm:bg-transparent rounded-2xl shadow-xl sm:shadow-none p-6 sm:p-0">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
