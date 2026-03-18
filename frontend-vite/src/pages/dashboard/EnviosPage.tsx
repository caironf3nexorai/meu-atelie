import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useModal } from '@/contexts/ModalContext';
import { Package, Truck, Search, CheckCircle2, MessageSquare } from 'lucide-react';
import type { Order } from '@/lib/api/gestao';

export default function EnviosPage() {
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [encomendas, setEncomendas] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        carregarEnvios();
    }, [user]);

    const carregarEnvios = async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*, clients(*)')
            .eq('user_id', user.id)
            .in('status', ['finalizado', 'entregue'])
            .order('delivery_date', { ascending: false });

        if (error) {
            console.error(error);
            showAlert('Erro', 'Não foi possível carregar as encomendas para envio.');
        } else {
            setEncomendas(data as any[]);
        }
        setLoading(false);
    };

    const handleSalvarRastreio = async (id: string, codigo: string) => {
        const { error } = await supabase
            .from('orders')
            .update({ codigo_rastreio: codigo })
            .eq('id', id);
        
        if (error) {
            showAlert('Erro', 'Falha ao salvar o código de rastreio.');
        } else {
            setEncomendas(prev => prev.map(e => e.id === id ? { ...e, codigo_rastreio: codigo } : e));
            showAlert('Sucesso', 'Código salvo com sucesso!');
        }
    };

    const handleEnviarWhatsApp = async (encomenda: any) => {
        const { id, codigo_rastreio, clients, description } = encomenda;
        if (!codigo_rastreio) {
            showAlert('Atenção', 'Insira um código de rastreio antes de enviar.');
            return;
        }

        const numero = clients?.whatsapp?.replace(/\D/g, '');
        if (!numero) {
            showAlert('Atenção', 'O cliente não possui WhatsApp cadastrado.');
            return;
        }

        const texto = encodeURIComponent(
            `Olá ${clients?.name}! 😊\n\n` +
            `Sua encomenda "${description}" já foi postada!\n\n` +
            `📦 *Código de Rastreio:* ${codigo_rastreio}\n\n` +
            `Você já pode acompanhar a entrega. Qualquer dúvida estou à disposição! 🧵`
        );

        // Registrar timestamp do envio
        await supabase
            .from('orders')
            .update({ rastreio_enviado_em: new Date().toISOString() })
            .eq('id', id);

        setEncomendas(prev => prev.map(e => e.id === id ? { ...e, rastreio_enviado_em: new Date().toISOString() } : e));

        window.open(`https://wa.me/55${numero}?text=${texto}`, '_blank');
    };

    const filteredEncomendas = encomendas.filter(e => 
        e.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.codigo_rastreio?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendentesCount = encomendas.filter(e => !e.rastreio_enviado_em).length;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 animate-in fade-in pb-20 pt-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
                <div>
                    <h1 className="font-display text-3xl text-text">🚚 Envios e Rastreio</h1>
                    <p className="font-ui text-text-light mt-1 text-sm max-w-xl">
                        Gerencie os envios das encomendas prontas, salve códigos de rastreio e notifique os clientes facilmente.
                    </p>
                </div>
                {pendentesCount > 0 && (
                    <div className="bg-[#FFFBEB] text-[#D97706] px-4 py-2 rounded-xl text-sm font-semibold flex items-center border border-[#F59E0B]/20">
                        <Truck className="w-4 h-4 mr-2" />
                        {pendentesCount} {pendentesCount === 1 ? 'pacote aguarda envio' : 'pacotes aguardam envio'} de rastreio
                    </div>
                )}
            </div>

            <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, pedido ou código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-12 text-text-light font-ui animate-pulse">Carregando pedidos prontos...</div>
                    ) : filteredEncomendas.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="w-12 h-12 text-text-light/30 mx-auto mb-3" />
                            <h3 className="text-text font-display text-lg">Nenhum envio encontrado</h3>
                            <p className="text-text-light text-sm mt-1">
                                {encomendas.length === 0 
                                    ? 'Conclua uma encomenda na Agenda para ela aparecer aqui.' 
                                    : 'Nenhum resultado para sua busca.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredEncomendas.map(encomenda => (
                                <div key={encomenda.id} className="border border-border rounded-2xl p-5 flex flex-col md:flex-row gap-6 items-start md:items-center bg-white hover:border-primary/30 transition-colors shadow-sm">
                                    
                                    <div className="flex-1 flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-[#FAF0EF] text-primary flex items-center justify-center shrink-0">
                                            <Package className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-text text-lg leading-tight mb-1">
                                                {encomenda.clients?.name}
                                            </h4>
                                            <p className="text-sm text-text-light font-ui">
                                                {encomenda.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="w-full md:w-64">
                                        <label className="text-xs text-text-muted font-ui block mb-1">Código de Rastreio</label>
                                        <div className="flex">
                                            <input 
                                                type="text" 
                                                placeholder="Ex: QU123456789BR"
                                                defaultValue={encomenda.codigo_rastreio || ''}
                                                onBlur={(e) => {
                                                    const val = e.target.value.trim();
                                                    if (val !== encomenda.codigo_rastreio) {
                                                        handleSalvarRastreio(encomenda.id, val);
                                                    }
                                                }}
                                                className="w-full bg-background border border-border rounded-l-xl px-3 py-2 text-sm uppercase tracking-wide focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                            />
                                            <button 
                                                title="Salvar Código"
                                                className="bg-[#FAF0EF] border-y border-r border-border rounded-r-xl px-3 text-primary hover:bg-primary hover:text-white transition-colors border-l-0"
                                                onClick={(e) => {
                                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                    handleSalvarRastreio(encomenda.id, input.value.trim());
                                                }}
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full md:w-auto flex flex-col gap-2 shrink-0">
                                        <button 
                                            onClick={() => handleEnviarWhatsApp(encomenda)}
                                            disabled={!encomenda.codigo_rastreio}
                                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm
                                                ${encomenda.rastreio_enviado_em 
                                                    ? 'bg-white border-2 border-[#16A34A] text-[#16A34A] hover:bg-[#F0FDF4]' 
                                                    : encomenda.codigo_rastreio 
                                                        ? 'bg-[#16A34A] text-white hover:bg-[#15803d]'
                                                        : 'bg-surface border border-border text-text-light cursor-not-allowed'
                                                }`}
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            {encomenda.rastreio_enviado_em ? 'Reenviar no WhatsApp' : 'Enviar no WhatsApp'}
                                        </button>
                                        {encomenda.rastreio_enviado_em && (
                                            <p className="text-[10px] text-center text-text-light font-ui">
                                                Enviado: {new Date(encomenda.rastreio_enviado_em).toLocaleDateString()} {new Date(encomenda.rastreio_enviado_em).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}
