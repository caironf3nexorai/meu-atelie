import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
    const { user } = useAuth();
    const supabase = createClient();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            fetchNotifications();
            // Optional: Realtime subscription here if needed later
        }
    }, [user]);

    const fetchNotifications = async () => {
        const { data } = await supabase
            .from('notificacoes')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.lida).length);
        }
    };

    const markAsRead = async (id: string, link?: string) => {
        await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
        fetchNotifications();
        if (link) {
            setOpen(false);
            navigate(link);
        }
    };

    const markAllAsRead = async () => {
        await supabase.from('notificacoes').update({ lida: true }).eq('user_id', user?.id).eq('lida', false);
        fetchNotifications();
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full text-text-light hover:text-text hover:bg-surface-warm">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl bg-surface border-border-light shadow-xl shadow-black/5 overflow-hidden">
                <div className="p-4 border-b border-border-light bg-surface-warm/30 flex items-center justify-between">
                    <h3 className="font-display font-semibold text-text">Notificações</h3>
                    {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors flex items-center gap-1">
                            <Check className="w-3 h-3" /> Marcar lidas
                        </button>
                    )}
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-text-muted font-ui text-sm">
                            Nenhuma notificação por enquanto.
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                onClick={() => markAsRead(n.id, n.link)}
                                className={`p-4 border-b border-border-light/50 font-ui text-sm cursor-pointer transition-colors ${!n.lida ? 'bg-[#FAF0EF] hover:bg-[#F2D7D4]' : 'hover:bg-surface-warm'}`}
                            >
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <p className={`font-semibold ${!n.lida ? 'text-text' : 'text-text-light'}`}>{n.titulo}</p>
                                    {!n.lida && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                                </div>
                                <p className="text-text-muted text-xs leading-relaxed">{n.mensagem}</p>
                            </div>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
