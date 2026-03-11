
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, MessageCircle, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatMsg {
    role: 'user' | 'assistant';
    content: string;
}
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useModal } from '@/contexts/ModalContext';
import { useAuth } from '@/lib/hooks/useAuth';

export default function EstrategiaPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const { showConfirm, showAlert } = useModal();
    const { user } = useAuth();

    const [messages, setMessages] = useState<ChatMsg[]>([
        { role: 'assistant', content: 'Olá! Sou a Lia, sua consultora especialista em negócios de bordado. Como posso te ajudar hoje?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const [chats, setChats] = useState<{ id: string, title: string, updated_at: string }[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchChats();
        }
    }, [user]);

    const fetchChats = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('strategy_conversations')
            .select('id, title, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
        if (data) setChats(data);
    };

    const loadChat = async (id: string, title: string) => {
        setActiveChatId(id);
        const { data } = await supabase.from('strategy_conversations').select('messages').eq('id', id).single();
        if (data) {
            setMessages(data.messages || []);
        }
    };

    const handleNewChat = () => {
        setActiveChatId(null);
        setMessages([{ role: 'assistant', content: 'Olá! Sou a Lia, sua consultora especialista em negócios de bordado. Como posso te ajudar hoje?' }]);
    };

    const handleDeleteChat = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        showConfirm('Excluir Conversa', 'Tem certeza que deseja excluir definitivamente esta conversa do seu histórico?', async () => {
            try {
                if (!user) return;
                const { error } = await supabase.from('strategy_conversations').delete().eq('id', id).eq('user_id', user.id);
                if (error) throw error;
                setChats(prev => prev.filter(c => c.id !== id));
                if (activeChatId === id) {
                    handleNewChat();
                }
            } catch (err) {
                console.error(err);
                showAlert('Erro', 'Não foi possível excluir a conversa.');
            }
        });
    };

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const currentInput = input;
        setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
        setInput('');
        setIsTyping(true);

        try {
            const { data, error } = await supabase.functions.invoke('chat-estrategia', {
                body: { message: currentInput, conversationId: activeChatId }
            });

            if (error) throw error;

            if (data?.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
                if (!activeChatId && data.conversationId) {
                    setActiveChatId(data.conversationId);
                    fetchChats();
                }
            } else {
                toast({ title: "Erro", description: data?.error || "Falha na comunicação", variant: "destructive" });
            }
        } catch (err: any) {
            console.error(err);
            toast({ title: "Erro", description: "Falha ao enviar mensagem.", variant: "destructive" });
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] lg:h-[calc(100vh-64px)] w-full max-w-6xl mx-auto flex gap-6 pb-4">

            {/* Sidebar de Historico (Desktop) */}
            <div className="hidden lg:flex flex-col w-[300px] h-full bg-surface rounded-3xl border border-border-light shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border/50">
                    <Button onClick={handleNewChat} className="w-full h-12 rounded-xl bg-[#FAF0EF] text-primary hover:bg-[#EBDAD8] shadow-none font-semibold">
                        <Plus className="w-4 h-4 mr-2" /> Nova Conversa
                    </Button>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto flex-1">
                    {chats.length === 0 ? (
                        <div className="text-center p-6 text-text-light font-ui text-sm">
                            Nenhuma conversa ainda. Comece uma nova conversa com a Lia!
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <div key={chat.id} className="relative group w-full">
                                <button
                                    onClick={() => loadChat(chat.id, chat.title)}
                                    className={`w-full text-left p-3 pr-10 rounded-xl font-ui text-sm flex items-center gap-2 transition-colors ${activeChatId === chat.id ? 'bg-surface-warm border border-border-light text-text shadow-sm' : 'hover:bg-surface-warm text-text-light'}`}
                                >
                                    <MessageCircle className={`w-4 h-4 shrink-0 ${activeChatId === chat.id ? 'text-primary' : 'text-text-muted'}`} />
                                    <span className="truncate">{chat.title || 'Conversa'}</span>
                                </button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 w-8 h-8 rounded-full text-text-muted hover:text-destructive hover:bg-destructive/10 hidden group-hover:flex"
                                    onClick={(e) => handleDeleteChat(e, chat.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 h-full bg-surface rounded-3xl border border-border-light shadow-sm flex flex-col overflow-hidden relative">
                {/* Header Chat */}
                <div className="h-20 border-b border-border-light bg-surface/80 backdrop-blur-md px-6 flex items-center justify-between absolute top-0 left-0 right-0 z-10 rounded-t-3xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent/20 flex flex-col items-center justify-center text-accent shadow-sm border border-accent/20 relative">
                            <Sparkles className="w-6 h-6" />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-surface" />
                        </div>
                        <div>
                            <h2 className="font-display text-lg text-text leading-tight">Lia</h2>
                            <p className="text-xs font-ui text-accent font-semibold">Consultora de Vendas IA</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-text-muted rounded-full lg:hidden"><MessageCircle className="w-5 h-5" /></Button>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-28 pb-32 space-y-6">
                    <AnimatePresence initial={false}>
                        {messages.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0 mr-3 mt-1">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-2xl p-4 font-ui text-sm shadow-sm
                    ${msg.role === 'user'
                                            ? 'bg-primary text-white rounded-tr-sm'
                                            : 'bg-surface-warm border border-border-light text-text rounded-tl-sm'}`}
                                >
                                    {msg.content}
                                </div>
                            </motion.div>
                        ))}

                        {isTyping && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="bg-surface-warm border border-border-light rounded-2xl rounded-tl-sm p-4 w-20 flex gap-1 items-center justify-center shadow-sm">
                                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={endRef} />
                </div>

                {/* Input Área */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-surface via-surface to-transparent">
                    <div className="relative max-w-4xl mx-auto rounded-full shadow-[0_8px_30px_rgba(61,43,43,0.08)]">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Pergunte à Lia sobre vendas e negócios..."
                            className="w-full h-14 pl-6 pr-16 rounded-full bg-white border-border focus-visible:ring-primary/50 text-base shadow-inner"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                            className="absolute right-1 top-1 w-12 h-12 rounded-full bg-primary hover:bg-primary-dark p-0 text-white"
                        >
                            <Send className="w-5 h-5 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
