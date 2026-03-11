import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    className
}: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center text-center p-8 rounded-xl bg-surface-warm/50 border border-border-light shadow-sm', className)}>
            {icon && (
                <div className="w-16 h-16 rounded-full bg-primary-light/20 text-primary flex items-center justify-center mb-4">
                    {icon}
                </div>
            )}
            <h3 className="text-xl font-display text-text mb-2">{title}</h3>
            <p className="text-sm font-ui text-text-light max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button onClick={onAction} className="bg-primary hover:bg-primary-dark text-white rounded-full px-6 transition-all duration-300 shadow-md hover:shadow-lg">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
