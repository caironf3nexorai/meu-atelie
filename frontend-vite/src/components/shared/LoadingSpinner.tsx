import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: number;
    label?: string;
    themeColor?: 'primary' | 'accent' | 'warn' | 'muted';
}

export function LoadingSpinner({
    size = 24,
    label,
    themeColor = 'primary',
    className,
    ...props
}: LoadingSpinnerProps) {
    const colorMap = {
        primary: 'text-primary',
        accent: 'text-accent',
        warn: 'text-warn',
        muted: 'text-muted'
    };

    return (
        <div className={cn('flex flex-col items-center justify-center gap-3', className)} {...props}>
            <Loader2
                size={size}
                className={cn('animate-spin', colorMap[themeColor])}
            />
            {label && <p className="text-sm font-ui text-text-light animate-pulse">{label}</p>}
        </div>
    );
}
