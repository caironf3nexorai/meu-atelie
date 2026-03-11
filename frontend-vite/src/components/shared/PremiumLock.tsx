import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface PremiumLockProps {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    isLocked?: boolean;
}

export function PremiumLock({ children, onClick, className, isLocked = true }: PremiumLockProps) {
    if (!isLocked) return <>{children}</>;

    return (
        <div
            className={cn("relative group overflow-hidden rounded-xl", className)}
            onClick={onClick}
        >
            {/* O conteúdo por baixo fica com blur */}
            <div className="blur-sm opacity-40 select-none pointer-events-none transition-all duration-300 group-hover:blur-md">
                {children}
            </div>

            {/* Overlay absoluto */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/30 backdrop-blur-[2px] cursor-pointer">
                <motion.div
                    whileHover={{ scale: 1.1, rotate: [-5, 5, -5, 0] }}
                    transition={{ duration: 0.4 }}
                    className="bg-primary/10 text-primary p-4 rounded-full shadow-sm mb-2"
                >
                    <Lock className="w-8 h-8" />
                </motion.div>
                <span className="font-display text-lg text-text font-medium bg-background/80 px-4 py-1 rounded-full shadow-sm">
                    Recurso Premium
                </span>
            </div>
        </div>
    );
}
