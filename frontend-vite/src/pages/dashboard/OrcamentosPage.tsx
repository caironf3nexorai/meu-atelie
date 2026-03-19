import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Download, MessageSquare, Edit, Trash2, Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, addDays } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useModal } from '@/contexts/ModalContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrcamentoItem {
    descricao: string;
    quantidade: number;
    valor_unitario: string;
}

export default function OrcamentosPage() {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useModal();
    const supabase = createClient();

    const [orcamentos, setOrcamentos] = useState<any[]>([]);
    const [encomendas, setEncomendas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [orcamentoParaEnviar, setOrcamentoParaEnviar] = useState<any>(null);

    // Form states
    const [clienteNome, setClienteNome] = useState('');
    const [clienteContato, setClienteContato] = useState('');
    const [validadeDias, setValidadeDias] = useState(7);
    const [condicoes, setCondicoes] = useState('');
    const [prazoEntrega, setPrazoEntrega] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [itens, setItens] = useState<OrcamentoItem[]>([{ descricao: '', quantidade: 1, valor_unitario: '' }]);
    const [vincularEncomenda, setVincularEncomenda] = useState(false);
    const [encomendaId, setEncomendaId] = useState<string>('');

    // Novos Campos
    const [clienteCpf, setClienteCpf] = useState('');
    const [clienteCep, setClienteCep] = useState('');
    const [clienteRua, setClienteRua] = useState('');
    const [clienteNumero, setClienteNumero] = useState('');
    const [clienteBairro, setClienteBairro] = useState('');
    const [clienteCidade, setClienteCidade] = useState('');
    const [clienteEstado, setClienteEstado] = useState('');
    const [valorFrete, setValorFrete] = useState<string>('');

    // Aba ativa
    const [abaAtiva, setAbaAtiva] = useState<'orcamentos' | 'aprovacao_arte'>('orcamentos');
    const [editingOrcamentoId, setEditingOrcamentoId] = useState<string | null>(null);
    const [visualizandoOrc, setVisualizandoOrc] = useState<any>(null);

    // Estados da aba Aprovação de Arte
    const [artes, setArtes] = useState<any[]>([]);
    const [orcamentosAprovados, setOrcamentosAprovados] = useState<any[]>([]);
    const [showNovaArte, setShowNovaArte] = useState(false);
    const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<any>(null);
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [uploadingArte, setUploadingArte] = useState(false);

    // Autocomplete de Clientes
    const [clientesDb, setClientesDb] = useState<any[]>([]);
    const [filteredClientes, setFilteredClientes] = useState<any[]>([]);
    const [showClienteDropdown, setShowClienteDropdown] = useState(false);

    useEffect(() => {
        let channel: any;

        const initRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Ouve atualizações em tempo real (ex: quando o cliente aprova/recusa no link público)
            channel = supabase
                .channel('orcamentos_changes')
                .on(
                    'postgres_changes',
                    { 
                        event: 'UPDATE', 
                        schema: 'public', 
                        table: 'orcamentos',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        const novoRegistro = payload.new as any;
                        setOrcamentos(prev => prev.map(orc =>
                            orc.id === novoRegistro.id ? { ...orc, ...novoRegistro } : orc
                        ));
                    }
                )
                .subscribe();
        };

        fetchData();
        initRealtime();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Orçamentos
        const { data: orcs, error: orcsError } = await supabase
            .from('orcamentos')
            .select('*, orcamento_itens(*), orcamento_arquivos(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!orcsError && orcs) {
            setOrcamentos(orcs);
        }

        // Fetch Encomendas for linking
        const { data: encs } = await supabase
            .from('orders')
            .select('id, titulo, cliente_nome, total, cliente_telefone')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (encs) setEncomendas(encs);

        // --- Dados da aba de Aprovação de Arte ---
        const { data: artesData } = await supabase
            .from('aprovacao_arte')
            .select('*, orcamentos(numero, cliente_nome, cliente_contato)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        const { data: orcsData } = await supabase
            .from('orcamentos')
            .select('id, numero, cliente_nome, cliente_contato')
            .eq('user_id', user.id)
            .eq('status', 'aceito')
            .order('created_at', { ascending: false });

        if (artesData) setArtes(artesData);
        if (orcsData) setOrcamentosAprovados(orcsData);

        // Fetch Clientes for autocomplete
        const { data: clientesData } = await supabase
            .from('clients')
            .select('id, name, whatsapp, cpf, endereco_cep, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado')
            .eq('user_id', user.id)
            .order('name');
        if (clientesData) setClientesDb(clientesData);

        setLoading(false);
    };

    const preencherDeEncomenda = (id: string) => {
        setEncomendaId(id);
        const enc = encomendas.find(e => e.id === id);
        if (enc) {
            setClienteNome(enc.cliente_nome || '');
            setClienteContato(enc.cliente_telefone || '');
            setItens([{ descricao: enc.titulo || 'Bordado', quantidade: 1, valor_unitario: enc.total ? String(enc.total) : '' }]);
        }
    };

    const addItem = () => setItens([...itens, { descricao: '', quantidade: 1, valor_unitario: '' }]);
    const removeItem = (i: number) => setItens(itens.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: keyof OrcamentoItem, value: string | number) => {
        const newItens = [...itens];
        newItens[i] = { ...newItens[i], [field]: value };
        setItens(newItens);
    };

    const totalGeral = itens.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_unitario.replace(',', '.') || 0)), 0);

    const resetForm = () => {
        setClienteNome('');
        setClienteContato('');
        setValidadeDias(7);
        setCondicoes('');
        setPrazoEntrega('');
        setObservacoes('');
        setItens([{ descricao: '', quantidade: 1, valor_unitario: '' }]);
        setVincularEncomenda(false);
        setEncomendaId('');
        setShowClienteDropdown(false);
        setShowForm(false);
        setClienteCpf('');
        setClienteCep('');
        setClienteRua('');
        setClienteNumero('');
        setClienteBairro('');
        setClienteCidade('');
        setClienteEstado('');
        setValorFrete('');
        setEditingOrcamentoId(null);
    };

    const handleEditarOrcamento = (orc: any) => {
        setEditingOrcamentoId(orc.id);
        setClienteNome(orc.cliente_nome || '');
        setClienteContato(orc.cliente_contato || '');
        setClienteCpf(orc.cliente_cpf || '');
        setClienteCep(orc.cliente_endereco_cep || '');
        setClienteRua(orc.cliente_endereco_rua || '');
        setClienteNumero(orc.cliente_endereco_numero || '');
        setClienteBairro(orc.cliente_endereco_bairro || '');
        setClienteCidade(orc.cliente_endereco_cidade || '');
        setClienteEstado(orc.cliente_endereco_estado || '');
        setValorFrete(orc.valor_frete ? String(orc.valor_frete).replace('.', ',') : '');
        setValidadeDias(orc.validade_dias || 7);
        setCondicoes(orc.condicoes_pagamento || '');
        setPrazoEntrega(orc.prazo_entrega || '');
        setObservacoes(orc.observacoes || '');
        setVincularEncomenda(!!orc.encomenda_id);
        setEncomendaId(orc.encomenda_id || '');
        
        if (orc.orcamento_itens && orc.orcamento_itens.length > 0) {
            setItens(orc.orcamento_itens.map((i: any) => ({
                descricao: i.descricao,
                quantidade: i.quantidade,
                valor_unitario: String(i.valor_unitario).replace('.', ',')
            })));
        } else {
            setItens([{ descricao: '', quantidade: 1, valor_unitario: '' }]);
        }
        setShowForm(true);
    };

    const handleSalvar = async () => {
        if (!clienteNome || itens.some(i => !i.descricao || !i.valor_unitario)) {
            showAlert('Atenção', 'Preencha o nome do cliente e todos os itens do orçamento.');
            return;
        }

        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Create Orcamento
        const payload = {
            cliente_nome: clienteNome,
            cliente_contato: clienteContato,
            cliente_cpf: clienteCpf,
            cliente_endereco_cep: clienteCep,
            cliente_endereco_rua: clienteRua,
            cliente_endereco_numero: clienteNumero,
            cliente_endereco_bairro: clienteBairro,
            cliente_endereco_cidade: clienteCidade,
            cliente_endereco_estado: clienteEstado,
            valor_frete: valorFrete ? Number(valorFrete.replace(',', '.')) : null,
            validade_dias: validadeDias,
            condicoes_pagamento: condicoes,
            prazo_entrega: prazoEntrega,
            observacoes: observacoes,
            encomenda_id: vincularEncomenda && encomendaId ? encomendaId : null,
            total: totalGeral + (valorFrete ? Number(valorFrete.replace(',', '.')) : 0)
        };

        let orcData: any = null;
        let orcError: any = null;

        if (editingOrcamentoId) {
            // Edit existing
            const res = await supabase.from('orcamentos').update(payload).eq('id', editingOrcamentoId).select().single();
            orcData = res.data;
            orcError = res.error;

            if (!orcError && orcData) {
                // Remove old items
                await supabase.from('orcamento_itens').delete().eq('orcamento_id', editingOrcamentoId);
            }
        } else {
            // Insert brand new
            const { data: nextNumObj } = await supabase.rpc('get_next_orcamento_numero', { p_user_id: user.id });
            const nextNum = nextNumObj || 1;

            const res = await supabase.from('orcamentos').insert({
                ...payload,
                user_id: user.id,
                numero: nextNum,
                status: 'pendente'
            }).select().single();
            orcData = res.data;
            orcError = res.error;
        }

        if (orcError || !orcData) {
            console.error(orcError);
            showAlert('Erro', `Ocorreu um erro ao ${editingOrcamentoId ? 'atualizar' : 'salvar'} o orçamento: ${orcError?.message || 'Erro desconhecido'}`);
            setSaving(false);
            return;
        }

        // Create Items
        const itemsToInsert = itens.map(i => ({
            orcamento_id: orcData.id,
            descricao: i.descricao,
            quantidade: Number(i.quantidade),
            valor_unitario: Number(i.valor_unitario.replace(',', '.'))
        }));

        const { error: itemsError } = await supabase.from('orcamento_itens').insert(itemsToInsert);

        if (itemsError) {
            console.error(itemsError);
        }

        showAlert('Sucesso', 'Orçamento salvo com sucesso!');

        // Refresh list
        await fetchData();

        setSaving(false);
        resetForm();
    };

    // PDF Generation Logic
    const loadImageAsBase64 = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    reject(new Error('Canvas context failed'));
                }
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    const handleGerarPDF = async (orcamento: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!profile) return;

        const doc = new jsPDF();

        const primaryColor: [number, number, number] = [172, 81, 72]; // #AC5148
        const darkColor: [number, number, number] = [45, 45, 45];     // #2D2D2D
        const lightColor: [number, number, number] = [242, 233, 219]; // #F2E9DB

        // CABEÇALHO
        if (profile.atelie_logo_url) {
            try {
                const imgBase64 = await loadImageAsBase64(profile.atelie_logo_url);
                doc.addImage(imgBase64, 'PNG', 14, 10, 35, 20, undefined, 'FAST');
            } catch (e) {
                console.error("Erro ao carregar logo pro PDF", e);
            }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text(profile.atelie_nome || profile.full_name, 55, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 107, 107);
        const contatos = [
            profile.atelie_whatsapp,
            profile.atelie_email,
            profile.atelie_instagram,
            profile.atelie_cidade && profile.atelie_estado
                ? `${profile.atelie_cidade}, ${profile.atelie_estado}`
                : profile.atelie_cidade
        ].filter(Boolean);

        contatos.forEach((c, i) => doc.text(c, 55, 24 + (i * 5)));

        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.line(14, 38, 196, 38);

        // TÍTULO
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...darkColor);
        doc.text(`ORÇAMENTO Nº ${String(orcamento.numero).padStart(3, '0')}`, 14, 48);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 107, 107);
        const dataEmissao = format(new Date(orcamento.created_at), 'dd/MM/yyyy');
        const dataValidade = format(addDays(new Date(orcamento.created_at), orcamento.validade_dias || 7), 'dd/MM/yyyy');
        doc.text(`Data de emissão: ${dataEmissao}`, 140, 44);
        doc.text(`Válido até: ${dataValidade}`, 140, 50);

        // CLIENTE
        doc.setFillColor(...lightColor);
        doc.roundedRect(14, 54, 182, 18, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...darkColor);
        doc.text('CLIENTE', 18, 61);
        doc.setFont('helvetica', 'normal');
        doc.text(orcamento.cliente_nome, 18, 67);
        if (orcamento.cliente_contato) {
            doc.text(`Contato: ${orcamento.cliente_contato}`, 100, 67);
        }

        // ITENS
        const itemsForTable = orcamento.itens || orcamento.orcamento_itens || [];
        autoTable(doc, {
            startY: 78,
            head: [['Descrição', 'Qtd', 'Valor Unit.', 'Total']],
            body: itemsForTable.map((item: any) => [
                item.descricao,
                item.quantidade,
                `R$ ${Number(item.valor_unitario).toFixed(2).replace('.', ',')}`,
                `R$ ${(item.quantidade * item.valor_unitario).toFixed(2).replace('.', ',')}`
            ]),
            foot: [['', '', 'TOTAL', `R$ ${Number(orcamento.total).toFixed(2).replace('.', ',')}`]],
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            footStyles: {
                fillColor: darkColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: { fontSize: 9, textColor: darkColor },
            alternateRowStyles: { fillColor: [252, 248, 244] },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' }
            },
            margin: { left: 14, right: 14 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // CONDIÇÕES
        if (orcamento.condicoes_pagamento || orcamento.prazo_entrega) {
            doc.setFillColor(...lightColor);
            doc.roundedRect(14, finalY, 182, 22, 3, 3, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...darkColor);
            if (orcamento.condicoes_pagamento) {
                doc.text(`Pagamento: `, 18, finalY + 8);
                doc.setFont('helvetica', 'normal');
                doc.text(orcamento.condicoes_pagamento, 46, finalY + 8);
            }
            if (orcamento.prazo_entrega) {
                doc.setFont('helvetica', 'bold');
                doc.text(`Prazo: `, 18, finalY + 16);
                doc.setFont('helvetica', 'normal');
                doc.text(orcamento.prazo_entrega, 36, finalY + 16);
            }
        }

        // OBSERVAÇÕES
        if (orcamento.observacoes) {
            const obsY = (orcamento.condicoes_pagamento || orcamento.prazo_entrega) ? finalY + 30 : finalY + 10;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...primaryColor);
            doc.text('OBSERVAÇÕES', 14, obsY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 107, 107);
            const obsLines = doc.splitTextToSize(orcamento.observacoes, 182);
            doc.text(obsLines, 14, obsY + 6);
        }

        // ACEITE
        const aceiteY = 240;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, aceiteY, 100, aceiteY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(orcamento.cliente_nome, 14, aceiteY + 5);
        doc.text('Data: ___/___/______', 130, aceiteY + 5);

        // RODAPÉ
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.3);
        doc.line(14, 278, 196, 278);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `${profile.atelie_nome || 'Meu Ateliê'} · Orçamento gerado via Meu Ateliê`,
            105, 283, { align: 'center' }
        );

        doc.save(`Orcamento_${String(orcamento.numero).padStart(3, '0')}_${orcamento.cliente_nome.replace(/\s/g, '_')}.pdf`);
    };

    const handleEnviarWhatsApp = async (orcamento: any) => {
        // Guardar orçamento e abrir modal
        setOrcamentoParaEnviar(orcamento);
        setShowWhatsAppModal(true);
    };

    const handleConfirmarWhatsApp = () => {
        if (!orcamentoParaEnviar) return;
        const orc = orcamentoParaEnviar;
        const numero = orc.cliente_contato?.replace(/\D/g, '');
        const baseUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
        const linkOrcamento = `${baseUrl}/orcamento/${orc.token_publico}`;

        const texto = encodeURIComponent(
            `Olá ${orc.cliente_nome}! \n\n` +
            `Preparei um orçamento especial para você.\n\n` +
            `Acesse pelo link abaixo para ver todos os detalhes e aprovar:\n` +
            `${linkOrcamento}\n\n` +
            `Qualquer dúvida estou à disposição!`
        );

        const url = numero
            ? `https://wa.me/55${numero}?text=${texto}`
            : `https://wa.me/?text=${texto}`;

        window.open(url, '_blank');
        setShowWhatsAppModal(false);
        setOrcamentoParaEnviar(null);
    };

    const handleDeleteOrcamento = (id: string) => {
        showConfirm('Confirmação', 'Deseja realmente excluir este orçamento?', async () => {
            try {
                const { error } = await supabase.from('orcamentos').delete().eq('id', id);

                if (error) throw error;

                setOrcamentos(prev => prev.filter(o => o.id !== id));
                showAlert('Sucesso', 'Orçamento excluído com sucesso!');
            } catch (error) {
                console.error('Erro ao excluir orçamento:', error);
                showAlert('Erro', 'Não foi possível excluir o orçamento.');
            }
        });
    };

    const handleEditarStatus = async (orcamento: any, novoStatus: string) => {
        const { error } = await supabase.from('orcamentos').update({ status: novoStatus }).eq('id', orcamento.id);
        if (!error) {
            showAlert('Sucesso', 'Status atualizado com sucesso!');
            fetchData();
        }
    };

    const handleEnviarArte = async () => {
        if (!arquivo || !orcamentoSelecionado) return;
        setUploadingArte(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setUploadingArte(false);
            return;
        }

        const ext = arquivo.name.split('.').pop();
        const path = `aprovacao-arte/${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('atelie-assets')
            .upload(path, arquivo, { upsert: true });

        if (uploadError) {
            showAlert('Erro', 'Erro ao enviar arquivo para o storage.');
            console.error(uploadError);
            setUploadingArte(false);
            return;
        }

        const { data: urlData } = supabase.storage
            .from('atelie-assets')
            .getPublicUrl(path);

        const { data: novaArte, error } = await supabase
            .from('aprovacao_arte')
            .insert({
                orcamento_id: orcamentoSelecionado.id,
                user_id: user.id,
                arquivo_nome: arquivo.name,
                arquivo_url: urlData.publicUrl,
                arquivo_tipo: ext || 'arquivo',
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select('*, orcamentos(numero, cliente_nome, cliente_contato)')
            .single();

        if (!error && novaArte) {
            setArtes(prev => [novaArte, ...prev]);
            setShowNovaArte(false);
            setArquivo(null);
            setOrcamentoSelecionado(null);
            showAlert('Sucesso', 'Arte enviada para aprovação!');
        } else {
            console.error(error);
            showAlert('Erro', 'Erro ao salvar o registro da arte no banco.');
        }
        setUploadingArte(false);
    };

    const handleEnviarArteWhatsApp = (arte: any) => {
        const link = `${import.meta.env.VITE_APP_URL}/aprovar-arte/${arte.token_publico}`;
        const numero = arte.orcamentos?.cliente_contato?.replace(/\D/g, '');
        const texto = encodeURIComponent(
            `Ola ${arte.orcamentos?.cliente_nome}!\n\n` +
            `O projeto do seu bordado esta pronto para aprovacao.\n\n` +
            `Acesse o link para visualizar e aprovar:\n${link}\n\n` +
            `Aguardo sua confirmacao!`
        );
        const url = numero
            ? `https://wa.me/55${numero}?text=${texto}`
            : `https://wa.me/?text=${texto}`;
        window.open(url, '_blank');
    };

    if (loading) {
        return <div className="p-12 text-center text-text-light font-ui animate-pulse">Carregando orçamentos...</div>;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 animate-in fade-in pb-20">

            {/* Abas */}
            <div style={{ display: 'flex', background: '#F2E9DB', padding: '5px',
                borderRadius: '14px', gap: '6px', marginBottom: '24px' }}>
                {[
                    { id: 'orcamentos', label: '📋 Orçamentos' },
                    { id: 'aprovacao_arte', label: '🎨 Aprovação de Arte' },
                ].map(aba => (
                    <button key={aba.id} onClick={() => setAbaAtiva(aba.id as any)}
                        style={{
                            flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none',
                            fontFamily: 'Nunito', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                            background: abaAtiva === aba.id ? '#AC5148' : 'transparent',
                            color: abaAtiva === aba.id ? 'white' : '#6B6B6B',
                            transition: 'all 0.2s ease'
                        }}>
                        {aba.label}
                    </button>
                ))}
            </div>

            {abaAtiva === 'aprovacao_arte' ? (
                /* Conteúdo da Aba Aprovação de Arte */
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }} className="flex-col sm:flex-row gap-4">
                        <p style={{ color: '#6B6B6B', fontSize: '14px', margin: 0, maxWidth: '600px' }}>
                            Anexe o arquivo do risco/arte e envie para aprovação do cliente.
                            O link expira em 7 dias após aprovação.
                        </p>
                        <button onClick={() => setShowNovaArte(true)}
                            style={{ background: '#AC5148', color: 'white', padding: '10px 20px',
                                borderRadius: '12px', border: 'none', fontWeight: 700,
                                fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            + Nova Arte
                        </button>
                    </div>

                    {showNovaArte && createPortal(
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 9999, padding: '24px' }} className="animate-in fade-in">
                            <div style={{ background: 'white', borderRadius: '20px', padding: '32px',
                                maxWidth: '480px', width: '100%' }} className="animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                <h3 style={{ margin: '0 0 24px', fontFamily: 'Playfair Display',
                                    fontSize: '22px', color: '#1C1410' }}>
                                    Nova Aprovação de Arte
                                </h3>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                                        Orçamento aprovado *
                                    </label>
                                    <select
                                        value={orcamentoSelecionado?.id || ''}
                                        onChange={e => {
                                            const orc = orcamentosAprovados.find(o => o.id === e.target.value);
                                            setOrcamentoSelecionado(orc || null);
                                        }}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px',
                                            border: '1px solid #E5D9CC', fontFamily: 'Nunito', fontSize: '14px',
                                            cursor: 'pointer', outline: 'none' }}
                                    >
                                        <option value="">Selecionar orçamento...</option>
                                        {orcamentosAprovados.map(orc => (
                                            <option key={orc.id} value={orc.id}>
                                                #{String(orc.numero).padStart(3,'0')} — {orc.cliente_nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                                        Arquivo da arte *
                                    </label>
                                    <label style={{ display: 'block', cursor: 'pointer' }}>
                                        <div style={{ border: '2px dashed #E5D9CC', borderRadius: '12px',
                                            padding: '24px', textAlign: 'center',
                                            background: arquivo ? '#F0FDF4' : '#FAFAFA' }}>
                                            {arquivo ? (
                                                <div>
                                                    <p style={{ color: '#16A34A', fontWeight: 700, margin: '0 0 4px' }}>
                                                        ✅ {arquivo.name}
                                                    </p>
                                                    <p style={{ color: '#6B6B6B', fontSize: '12px', margin: 0 }}>
                                                        {(arquivo.size / 1024).toFixed(0)} KB
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p style={{ color: '#6B6B6B', margin: '0 0 4px' }}>
                                                        📁 Clique para selecionar o arquivo
                                                    </p>
                                                    <p style={{ color: '#AAAAAA', fontSize: '12px', margin: 0 }}>
                                                        PDF, PNG, JPG, DOCX — máx. 10MB
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx"
                                            style={{ display: 'none' }}
                                            onChange={e => setArquivo(e.target.files?.[0] || null)} />
                                    </label>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => { setShowNovaArte(false); setArquivo(null); setOrcamentoSelecionado(null); }}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px',
                                            border: '1px solid #E5D9CC', background: 'white',
                                            cursor: 'pointer', fontWeight: 600, color: '#6B6B6B' }}>
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleEnviarArte}
                                        disabled={!arquivo || !orcamentoSelecionado || uploadingArte}
                                        style={{ flex: 2, padding: '12px', borderRadius: '12px',
                                            background: arquivo && orcamentoSelecionado ? '#AC5148' : '#E5D9CC',
                                            color: arquivo && orcamentoSelecionado ? 'white' : '#AAAAAA',
                                            border: 'none', fontWeight: 700, fontSize: '14px',
                                            cursor: arquivo && orcamentoSelecionado ? 'pointer' : 'not-allowed' }}>
                                        {uploadingArte ? '⏳ Enviando...' : '🎨 Enviar para aprovação'}
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {artes.length === 0 ? (
                        <div className="bg-surface rounded-3xl p-12 text-center border border-border/50 shadow-sm mt-4">
                            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎨</span>
                            <h3 className="font-display text-xl text-text mb-2">Nenhuma arte enviada</h3>
                            <p className="font-ui text-text-light max-w-md mx-auto">Após o cliente aprovar o orçamento, envie a arte/risco por aqui para que ele possa aprovar antes do bordado final.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {artes.map(arte => (
                                <div key={arte.id} style={{ background: 'white', borderRadius: '16px',
                                    padding: '18px 20px', border: '1px solid #E5D9CC',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    className="flex-col sm:flex-row gap-4">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                        <div style={{ fontSize: '24px', background: '#F2E9DB', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {arte.arquivo_tipo === 'pdf' ? '📄' : '🖼️'}
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 700, color: '#1A1A1A', fontSize: '15px' }}>
                                                {arte.arquivo_nome}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6B6B6B' }}>
                                                Orç. #{String(arte.orcamentos?.numero).padStart(3,'0')} · {arte.orcamentos?.cliente_nome}
                                                {' · '}
                                                {arte.status === 'aprovado' ? (
                                                    <span style={{ color: '#16A34A', fontWeight: 700 }}>✅ Aprovado</span>
                                                ) : arte.status === 'recusado' ? (
                                                    <span style={{ color: '#DC2626', fontWeight: 700 }}>❌ Recusado</span>
                                                ) : (
                                                    <span style={{ color: '#C29A51', fontWeight: 700 }}>⏳ Aguardando</span>
                                                )}
                                            </p>
                                            {arte.status === 'pendente' && (
                                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#AAAAAA' }}>
                                                    Expira em {new Date(arte.expires_at).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-start' }} className="sm:w-auto sm:justify-end">
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    `${import.meta.env.VITE_APP_URL}/aprovar-arte/${arte.token_publico}`
                                                );
                                                showAlert('Sucesso', 'Link copiado para a área de transferência!');
                                            }}
                                            style={{ background: '#F2E9DB', border: 'none', borderRadius: '10px',
                                                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                                                fontWeight: 600, color: '#AC5148', flex: 1 }}>
                                            📋 Copiar link
                                        </button>
                                        <button
                                            onClick={() => handleEnviarArteWhatsApp(arte)}
                                            style={{ background: '#F0FDF4', border: '1px solid #16A34A',
                                                borderRadius: '10px', padding: '8px 12px', cursor: 'pointer',
                                                fontSize: '13px', fontWeight: 600, color: '#16A34A', flex: 1 }}>
                                            💬 WhatsApp
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : !showForm ? (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 sm:p-8 rounded-3xl border border-border flex-wrap shadow-sm">
                        <div>
                            <h1 className="font-display text-3xl text-text">Orçamentos em PDF</h1>
                            <p className="font-ui text-text-light mt-1 text-sm max-w-xl">Crie orçamentos profissionais com a sua logo e envie diretamente para o WhatsApp dos seus clientes.</p>
                        </div>
                        <Button onClick={() => setShowForm(true)} className="rounded-full bg-primary hover:bg-primary-dark shadow-sm px-6">
                            <Plus className="w-5 h-5 mr-2" /> Novo Orçamento
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {orcamentos.length === 0 ? (
                            <div className="bg-surface rounded-3xl p-12 text-center border border-border/50 shadow-sm">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Download className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="font-display text-xl text-text mb-2">Nenhum orçamento emitido</h3>
                                <p className="font-ui text-text-light max-w-md mx-auto">Emita seu primeiro orçamento profissional clicando no botão acima. Não se esqueça de preencher os dados do seu Ateliê na página de Perfil.</p>
                            </div>
                        ) : (
                            orcamentos.map((orc) => (
                                <div key={orc.id} className="bg-surface rounded-2xl p-6 border border-border-light shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span 
                                                className="font-bold text-primary font-mono bg-primary/5 px-2 py-0.5 rounded cursor-pointer hover:underline"
                                                onClick={() => setVisualizandoOrc(orc)}
                                                title="Visualizar Orçamento"
                                            >
                                                #{String(orc.numero).padStart(3, '0')}
                                            </span>
                                            <span 
                                                className="font-semibold text-text text-lg cursor-pointer hover:text-primary"
                                                onClick={() => setVisualizandoOrc(orc)}
                                                title="Visualizar Orçamento"
                                            >
                                                {orc.cliente_nome}
                                            </span>
                                            {orc.arquivos_count > 0 && (
                                                <span style={{ background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                                                    📎 {orc.arquivos_count} arquivo(s)
                                                </span>
                                            )}
                                            <select value={orc.status} onChange={(e) => handleEditarStatus(orc, e.target.value)} className={`h-7 px-3 text-xs w-28 rounded-full cursor-pointer focus:ring-0 font-bold border-none appearance-none text-center ${orc.status === 'aceito' ? 'bg-[#F0FDF4] text-[#16A34A]' : orc.status === 'recusado' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FDF8F0] text-[#C29A51]'}`}>
                                                <option value="pendente">⏳ Pendente</option>
                                                <option value="aceito">✓ Aceito</option>
                                                <option value="recusado">✕ Recusado</option>
                                            </select>
                                        </div>
                                        <p className="font-ui text-text-light text-sm mt-1">
                                            Emitido em {format(new Date(orc.created_at), 'dd/MM/yyyy')} · Total: <span className="font-semibold text-text">R$ {orc.total?.toFixed(2).replace('.', ',')}</span>
                                        </p>
                                        {/* Observações do cliente na aprovação */}
                                        {orc.cliente_observacoes && (
                                            <div className="mt-2 p-3 rounded-xl bg-[#FDF8F0] border border-[#E5D9CC]">
                                                <p className="text-xs font-semibold text-[#C29A51] mb-1">💬 Observações do cliente:</p>
                                                <p className="text-sm text-text leading-relaxed">{orc.cliente_observacoes}</p>
                                            </div>
                                        )}
                                        {/* Arquivos de referência enviados pelo cliente */}
                                        {orc.orcamento_arquivos?.filter((a: any) => a.enviado_por === 'cliente').length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {orc.orcamento_arquivos.filter((a: any) => a.enviado_por === 'cliente').map((arq: any, idx: number) => (
                                                    <a key={idx} href={arq.url} target="_blank" rel="noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#16A34A]/20 text-xs font-semibold text-[#16A34A] hover:bg-[#DCFCE7] transition-colors">
                                                        📎 {arq.nome}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <Button variant="outline" onClick={() => setVisualizandoOrc(orc)} className="flex-1 md:flex-none h-10 rounded-xl bg-surface text-text-light hover:bg-[#F2E9DB] border border-[#E5D9CC] shadow-none font-semibold px-3" title="Visualizar Detalhes">
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        {orc.status !== 'aceito' && (
                                            <Button variant="outline" onClick={() => handleEditarOrcamento(orc)} className="flex-1 md:flex-none h-10 rounded-xl bg-surface text-text-light hover:bg-[#F2E9DB] border border-[#E5D9CC] shadow-none font-semibold px-3" title="Editar Orçamento">
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        )}
                                        {orc.status === 'aceito' && (
                                            <Button variant="outline" onClick={() => navigate('/dashboard/agenda', {
                                                state: { novoAgendamento: { orcamento_id: orc.id, description: orc.orcamento_itens?.[0]?.descricao, value: orc.total, notes: orc.observacoes, prazoDias: orc.prazo_entrega, cliente_nome: orc.cliente_nome } }
                                            })} className="flex-1 md:flex-none h-10 rounded-xl bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7] border-none shadow-none font-semibold" title="Agendar Encomenda">
                                                <Calendar className="w-4 h-4 mr-0 sm:mr-2" /> <span className="hidden sm:inline">Agendar</span>
                                            </Button>
                                        )}
                                        <Button variant="outline" onClick={() => handleEnviarWhatsApp(orc)} className="flex-1 md:flex-none h-10 rounded-xl bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7] border-none shadow-none font-semibold" title="Enviar WhatsApp">
                                            <MessageSquare className="w-4 h-4 mr-0 sm:mr-2" /> <span className="hidden sm:inline">WhatsApp</span>
                                        </Button>
                                        <Button variant="outline" onClick={() => handleDeleteOrcamento(orc.id)} className="flex-1 md:flex-none h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border-none shadow-none font-semibold px-3" title="Excluir Orçamento">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-md">
                    <h2 className="font-display text-2xl text-text mb-6">Emissão de Orçamento</h2>

                    <div className="space-y-8">
                        {/* Vinculação opcional */}
                        <div className="bg-[#FAF0EF] rounded-2xl p-5 border border-primary/20">
                            <Label className="flex items-center gap-3 cursor-pointer text-primary font-semibold">
                                <input type="checkbox" className="w-4 h-4 rounded text-primary border-primary focus:ring-primary accent-primary" checked={vincularEncomenda} onChange={e => setVincularEncomenda(e.target.checked)} />
                                Vincular detalhes de uma encomenda existente
                            </Label>
                            {vincularEncomenda && (
                                <div className="mt-4">
                                    <select value={encomendaId} onChange={(e) => preencherDeEncomenda(e.target.value)} className="w-full h-12 rounded-xl bg-white border border-primary/30 text-text px-4 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                                        <option value="" disabled>Selecione a encomenda...</option>
                                        {encomendas.map(enc => (
                                            <option key={enc.id} value={enc.id}>{enc.titulo} — {enc.cliente_nome}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Cliente */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 relative">
                                <Label>Nome do Cliente *</Label>
                                <Input 
                                    value={clienteNome} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setClienteNome(val);
                                        if (val.length > 0) {
                                            const filtrados = clientesDb.filter(c => c.name.toLowerCase().includes(val.toLowerCase()));
                                            setFilteredClientes(filtrados);
                                            setShowClienteDropdown(filtrados.length > 0);
                                        } else {
                                            setShowClienteDropdown(false);
                                        }
                                    }} 
                                    onFocus={() => {
                                        if (clienteNome.length > 0 && filteredClientes.length > 0) setShowClienteDropdown(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                                    placeholder="Ex: Maria Joaquina" 
                                    className="h-12 rounded-xl" 
                                />
                                {showClienteDropdown && (
                                    <div className="absolute z-10 w-full bg-white border border-border rounded-xl shadow-lg mt-1 max-h-48 overflow-auto">
                                        {filteredClientes.map(c => (
                                            <div 
                                                key={c.id} 
                                                className="px-4 py-3 hover:bg-[#FAF0EF] cursor-pointer border-b border-border/50 last:border-0"
                                                onClick={() => {
                                                    setClienteNome(c.name);
                                                    setClienteContato(c.whatsapp || '');
                                                    setClienteCpf(c.cpf || '');
                                                    setClienteCep(c.endereco_cep || '');
                                                    setClienteRua(c.endereco_rua || '');
                                                    setClienteNumero(c.endereco_numero || '');
                                                    setClienteBairro(c.endereco_bairro || '');
                                                    setClienteCidade(c.endereco_cidade || '');
                                                    setClienteEstado(c.endereco_estado || '');
                                                    setShowClienteDropdown(false);
                                                }}
                                            >
                                                <p className="font-semibold text-text text-sm">{c.name}</p>
                                                {c.whatsapp && <p className="text-xs text-text-light">{c.whatsapp}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Contato (WhatsApp do cliente)</Label>
                                <Input value={clienteContato} onChange={e => setClienteContato(e.target.value)} placeholder="(00) 00000-0000" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label>Validade (Dias)</Label>
                                <select value={validadeDias} onChange={e => setValidadeDias(Number(e.target.value))} className="w-full h-12 rounded-xl bg-surface border border-input text-text px-4 outline-none cursor-pointer">
                                    <option value="3">3 dias</option>
                                    <option value="5">5 dias</option>
                                    <option value="7">7 dias</option>
                                    <option value="10">10 dias</option>
                                    <option value="15">15 dias</option>
                                    <option value="30">30 dias</option>
                                </select>
                            </div>
                        </div>

                        {/* Detalhes do Cliente */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <Label>CPF do Cliente (Opcional)</Label>
                                <Input value={clienteCpf} onChange={e => setClienteCpf(e.target.value)} placeholder="000.000.000-00" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>CEP</Label>
                                <Input value={clienteCep} onChange={e => setClienteCep(e.target.value)} placeholder="00000-000" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Rua</Label>
                                <Input value={clienteRua} onChange={e => setClienteRua(e.target.value)} placeholder="Ex: Rua das Flores, 123" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label>Número</Label>
                                <Input value={clienteNumero} onChange={e => setClienteNumero(e.target.value)} placeholder="Ex: 123" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label>Bairro</Label>
                                <Input value={clienteBairro} onChange={e => setClienteBairro(e.target.value)} placeholder="Ex: Centro" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Cidade</Label>
                                <Input value={clienteCidade} onChange={e => setClienteCidade(e.target.value)} placeholder="Ex: São Paulo" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Estado</Label>
                                <Input value={clienteEstado} onChange={e => setClienteEstado(e.target.value)} placeholder="Ex: SP" className="h-12 rounded-xl" />
                            </div>
                        </div>

                        {/* Itens */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <Label className="font-display text-lg text-text">Itens do Orçamento</Label>
                            </div>

                            <div className="space-y-3">
                                {itens.map((item, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 rounded-2xl bg-surface-warm/50 border border-border-light">
                                        <div className="w-full sm:w-[50%]">
                                            <Label className="text-xs text-text-muted mb-1 block">Descrição do Item</Label>
                                            <Input value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} placeholder="Ex: Bastidor Maternidade 20cm" className="h-11 rounded-xl bg-white" />
                                        </div>
                                        <div className="w-full sm:w-[20%]">
                                            <Label className="text-xs text-text-muted mb-1 block">Quantidade</Label>
                                            <Input type="number" min="1" value={item.quantidade} onChange={e => updateItem(i, 'quantidade', e.target.value)} className="h-11 rounded-xl bg-white text-center" />
                                        </div>
                                        <div className="w-full sm:w-[25%]">
                                            <Label className="text-xs text-text-muted mb-1 block">Valor Unit.(R$)</Label>
                                            <Input value={item.valor_unitario} onChange={e => updateItem(i, 'valor_unitario', e.target.value)} placeholder="0,00" className="h-11 rounded-xl bg-white" />
                                        </div>
                                        <div className="w-full sm:w-[5%] flex justify-end pt-5">
                                            <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl h-11 w-11 shrink-0 -mt-[1px]">✕</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button variant="outline" onClick={addItem} className="mt-4 rounded-xl border-dashed border-primary/50 text-primary hover:bg-[#FAF0EF] w-full py-6 font-semibold">
                                + Adicionar novo item
                            </Button>

                            <div className="text-right mt-6 p-6 bg-[#FAF0EF] rounded-2xl border border-primary/10">
                                <span className="font-display text-2xl text-primary font-bold">
                                    Total Geral: R$ {(totalGeral + (valorFrete ? Number(valorFrete.replace(',', '.')) : 0)).toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                        </div>

                        {/* Condições e prazos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Condições de Pagamento</Label>
                                <select value={condicoes} onChange={e => setCondicoes(e.target.value)} className="w-full h-12 rounded-xl bg-white border border-input text-text px-4 outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                                    <option value="" disabled>Selecione uma regra...</option>
                                    <option value="50% de entrada, 50% na entrega">50% de entrada, 50% na entrega</option>
                                    <option value="100% antecipado via PIX">100% antecipado via PIX</option>
                                    <option value="Pagamento à vista na entrega">Pagamento à vista na entrega</option>
                                    <option value="30% de sinal, 70% na finalização">30% de sinal, 70% na finalização</option>
                                    <option value="Parcelado no Cartão de Crédito">Parcelado no Cartão de Crédito</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Prazo de Produção/Entrega</Label>
                                <Input value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="Ex: 15 dias úteis" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Valor do Frete (Opcional - R$)</Label>
                                <Input value={valorFrete} onChange={e => setValorFrete(e.target.value)} placeholder="Ex: 25,00" className="h-12 rounded-xl text-primary font-semibold" />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label>Observações Adicionais (opcional)</Label>
                                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex: Valores não incluem frete. As cores podem variar..." className="rounded-xl min-h-[100px]" />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-border mt-8">
                            <Button variant="outline" onClick={resetForm} className="h-12 rounded-xl px-6 font-semibold">Cancelar Cadastro</Button>
                            <Button onClick={handleSalvar} disabled={saving} className="h-12 rounded-xl px-8 bg-primary hover:bg-primary-dark font-semibold shadow-md">
                                {saving ? 'Salvando...' : '💾 Salvar Orçamento'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de WhatsApp */}
            {showWhatsAppModal && createPortal(
                <div
                    className="fixed inset-0 z-40 bg-transparent backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
                    onClick={() => { setShowWhatsAppModal(false); setOrcamentoParaEnviar(null) }}
                >
                    <div
                        className="bg-white rounded-[24px] p-8 max-w-[420px] w-full text-center shadow-xl animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Ícone */}
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>

                        {/* Título */}
                        <h3 style={{ color: '#1A1A1A', fontSize: '20px', fontWeight: 700, margin: '0 0 12px' }}>
                            Enviar link de aprovação
                        </h3>

                        {/* Instruções */}
                        <p style={{ color: '#6B6B6B', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
                            O cliente receberá um link para visualizar e aprovar o orçamento
                            diretamente pelo celular — sem precisar baixar nenhum arquivo.
                        </p>

                        <div style={{ background: '#F2E9DB', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
                            <p style={{ fontWeight: 600, fontSize: '13px', color: '#AC5148', margin: '0 0 8px' }}>
                                O que o cliente verá:
                            </p>
                            {[
                                'Orçamento completo com sua logo e dados',
                                'Lista de itens e valor total',
                                'Botão para Aprovar ou Recusar',
                                'Campo para enviar arquivos de referência',
                                'Campo para deixar observações',
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                                    <span style={{ color: '#16A34A', fontWeight: 700 }}>✓</span>
                                    <span style={{ fontSize: '13px', color: '#1A1A1A' }}>{item}</span>
                                </div>
                            ))}
                        </div>

                        {/* Botão copiar link também */}
                        <button
                            onClick={() => {
                                const baseUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
                                navigator.clipboard.writeText(`${baseUrl}/orcamento/${orcamentoParaEnviar?.token_publico}`);
                                showAlert('Sucesso', 'Link copiado para a área de transferência!');
                            }}
                            style={{ width: '100%', marginBottom: '8px', padding: '10px', borderRadius: '10px', border: '1px solid #E5D9CC', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6B6B6B' }}
                        >
                            📋 Ou copiar o link para enviar manualmente
                        </button>

                        {/* Botões */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setShowWhatsAppModal(false); setOrcamentoParaEnviar(null) }}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px',
                                    border: '1px solid #E5D9CC', background: 'white',
                                    cursor: 'pointer', fontWeight: 600, color: '#6B6B6B'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmarWhatsApp}
                                style={{
                                    flex: 2, padding: '12px', borderRadius: '12px',
                                    background: '#25D366', color: 'white',
                                    border: 'none', cursor: 'pointer',
                                    fontWeight: 700, fontSize: '15px'
                                }}
                            >
                                Abrir WhatsApp →
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* Modal de Arquivos de Arte */}
            {/* Modal de Visualização do Orçamento */}
            {visualizandoOrc && (
                <Dialog open={!!visualizandoOrc} onOpenChange={(open) => !open && setVisualizandoOrc(null)}>
                    <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-[24px] p-0 border-0 bg-transparent shadow-none">
                        <div style={{ background: '#F2E9DB', borderRadius: '24px', overflow: 'hidden', padding: '16px' }}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-display text-2xl text-primary font-bold px-2">Detalhes do Orçamento</h3>
                            </div>
                            
                            <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #E5D9CC', overflow: 'hidden', marginBottom: '16px' }}>
                                {/* Header do orçamento */}
                                <div style={{ background: '#2D2D2D', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ color: '#F7E1D7', fontSize: '12px', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Orçamento</p>
                                        <h3 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: 0 }}>Nº {String(visualizandoOrc.numero).padStart(3, '0')}</h3>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 2px' }}>Emitido em {format(new Date(visualizandoOrc.created_at), 'dd/MM/yyyy')}</p>
                                        <p style={{ color: '#F7E1D7', fontSize: '12px', margin: 0, fontWeight: 600 }}>Válido até {format(addDays(new Date(visualizandoOrc.created_at), visualizandoOrc.validade_dias || 7), 'dd/MM/yyyy')}</p>
                                    </div>
                                </div>

                                {/* Dados do cliente */}
                                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F2E9DB', background: '#FAFAFA' }}>
                                    <p style={{ color: '#6B6B6B', fontSize: '12px', margin: '0 0 2px', textTransform: 'uppercase' }}>Para</p>
                                    <p style={{ color: '#1A1A1A', fontWeight: 700, fontSize: '16px', margin: 0, paddingBottom: '4px' }}>{visualizandoOrc.cliente_nome}</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '8px' }}>
                                        {visualizandoOrc.cliente_contato && <p style={{ margin: 0, fontSize: '13px', color: '#4A4A4A' }}>📱 {visualizandoOrc.cliente_contato}</p>}
                                        {visualizandoOrc.cliente_cpf && <p style={{ margin: 0, fontSize: '13px', color: '#4A4A4A' }}>🆔 CPF: {visualizandoOrc.cliente_cpf}</p>}
                                        {visualizandoOrc.cliente_email && <p style={{ margin: 0, fontSize: '13px', color: '#4A4A4A' }}>✉️ {visualizandoOrc.cliente_email}</p>}
                                        {(visualizandoOrc.cliente_endereco_rua || visualizandoOrc.cliente_endereco_cidade) && (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#4A4A4A', gridColumn: '1 / -1' }}>
                                                📍 {visualizandoOrc.cliente_endereco_rua}{visualizandoOrc.cliente_endereco_numero ? `, ${visualizandoOrc.cliente_endereco_numero}` : ''}
                                                {visualizandoOrc.cliente_endereco_bairro ? ` - ${visualizandoOrc.cliente_endereco_bairro}` : ''}
                                                {visualizandoOrc.cliente_endereco_cidade ? ` - ${visualizandoOrc.cliente_endereco_cidade}/${visualizandoOrc.cliente_endereco_estado}` : ''}
                                                {visualizandoOrc.cliente_endereco_cep ? ` (${visualizandoOrc.cliente_endereco_cep})` : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Itens */}
                                <div style={{ padding: '20px 24px' }}>
                                    {visualizandoOrc.orcamento_itens?.map((item: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: i < visualizandoOrc.orcamento_itens.length - 1 ? '1px solid #F2E9DB' : 'none' }}>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#1A1A1A', fontSize: '15px' }}>{item.descricao}</p>
                                                <p style={{ margin: '2px 0 0', color: '#6B6B6B', fontSize: '13px' }}>{item.quantidade}x · R${Number(item.valor_unitario).toFixed(2)} cada</p>
                                            </div>
                                            <span style={{ fontWeight: 700, color: '#1A1A1A', fontSize: '15px', marginLeft: '16px' }}>R${(item.quantidade * item.valor_unitario).toFixed(2)}</span>
                                        </div>
                                    ))}

                                    {visualizandoOrc.valor_frete && Number(visualizandoOrc.valor_frete) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F2E9DB' }}>
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#6B6B6B' }}>Frete</span>
                                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1A1A1A' }}>R${Number(visualizandoOrc.valor_frete).toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* Total */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: visualizandoOrc.valor_frete ? '8px' : '16px', paddingTop: visualizandoOrc.valor_frete ? '8px' : '16px', borderTop: visualizandoOrc.valor_frete ? 'none' : '2px solid #AC5148' }}>
                                        <span style={{ fontWeight: 700, fontSize: '16px', color: '#1A1A1A' }}>Total Final</span>
                                        <span style={{ fontWeight: 800, fontSize: '24px', color: '#AC5148' }}>R${Number(visualizandoOrc.total).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Condições */}
                                {(visualizandoOrc.condicoes_pagamento || visualizandoOrc.prazo_entrega) && (
                                    <div style={{ padding: '16px 24px', background: '#FAFAFA', borderTop: '1px solid #F2E9DB' }}>
                                        {visualizandoOrc.condicoes_pagamento && (
                                            <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#1A1A1A' }}><strong>Pagamento:</strong> {visualizandoOrc.condicoes_pagamento}</p>
                                        )}
                                        {visualizandoOrc.prazo_entrega && (
                                            <p style={{ margin: 0, fontSize: '14px', color: '#1A1A1A' }}><strong>Prazo:</strong> {visualizandoOrc.prazo_entrega}</p>
                                        )}
                                    </div>
                                )}
                                
                                {/* Observações */}
                                {visualizandoOrc.observacoes && (
                                    <div style={{ padding: '16px 24px', background: 'white', borderTop: '1px solid #F2E9DB' }}>
                                        <p style={{ margin: '0 0 8px', fontSize: '12px', textTransform: 'uppercase', color: '#6B6B6B', fontWeight: 600 }}>Observações Adicionais</p>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#4A4A4A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{visualizandoOrc.observacoes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
