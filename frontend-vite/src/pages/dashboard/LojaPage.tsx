
import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Sparkles, Check, PackageOpen, Loader2, X, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useModal } from '@/contexts/ModalContext';
import { maskCPF, maskPhone, maskCEP } from '@/lib/utils/masks';

export default function StorePage() {
    const supabase = createClient();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { showAlert } = useModal();
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Checkout state
    const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
    const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'BOLETO'>('PIX');
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Form fields
    const [fullName, setFullName] = useState('');
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [cep, setCep] = useState('');
    const [addressNumber, setAddressNumber] = useState('');

    // Resultado
    const [resultado, setResultado] = useState<{
        forma_pagamento: string;
        pix?: { encodedImage: string; payload: string; expirationDate: string };
        boleto?: { bankSlipUrl: string; dueDate: string; identificationField: string };
        package_name?: string;
        credit_amount?: number;
    } | null>(null);

    useEffect(() => {
        async function fetchPackages() {
            const { data } = await supabase.from('credit_packages')
                .select('*')
                .eq('active', true)
                .order('display_order', { ascending: true });
            setPackages(data || []);
            setLoading(false);
        }
        fetchPackages();
    }, [supabase]);

    // Pre-fill form when profile loads
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setCpf(profile.cpf ? maskCPF(profile.cpf) : '');
            setPhone(profile.phone ? maskPhone(profile.phone) : '');
            setCep(profile.address_zip ? maskCEP(profile.address_zip) : '');
            setAddressNumber(profile.address_number || '');
        }
    }, [profile]);

    const openCheckout = (pkg: any) => {
        setSelectedPkg(pkg);
        setResultado(null);
        setErrorMsg('');
    };

    const closeCheckout = () => {
        setSelectedPkg(null);
        setResultado(null);
        setErrorMsg('');
    };

    const handleSubmit = async () => {
        if (!user || !selectedPkg) return;

        // Validações básicas
        if (!fullName || fullName.length < 3) { setErrorMsg('Nome muito curto.'); return; }
        if (!cpf || cpf.replace(/\D/g, '').length < 11) { setErrorMsg('CPF incompleto.'); return; }
        if (!phone || phone.replace(/\D/g, '').length < 10) { setErrorMsg('Telefone incompleto.'); return; }
        if (!cep || cep.replace(/\D/g, '').length < 8) { setErrorMsg('CEP incompleto.'); return; }
        if (!addressNumber) { setErrorMsg('Número do endereço obrigatório.'); return; }

        setErrorMsg('');
        setIsProcessing(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada. Faça login novamente.');

            const payload = {
                user_id: user.id,
                package_id: selectedPkg.id,
                forma_pagamento: formaPagamento,
                holder: {
                    name: fullName,
                    cpf,
                    phone,
                    cep,
                    addressNumber
                }
            };

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comprar-creditos`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify(payload)
                }
            );

            const responseData = await response.json();

            if (!response.ok || !responseData?.success) {
                throw new Error(responseData?.error || 'Falha ao processar o pagamento.');
            }

            setResultado(responseData);

        } catch (error: any) {
            setErrorMsg(error.message || 'Erro inesperado.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-primary">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="font-ui text-text-light">Listando pacotes disponíveis...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-12 space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" asChild className="rounded-full">
                    <Link to="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
                </Button>
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl text-text">Loja de Fios (Créditos)</h1>
                    <p className="font-ui text-text-light">Seus créditos mensais acabaram? Adquira pacotes avulsos que <strong className="text-primary">nunca expiram</strong>.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {packages.map((pkg, i) => (
                    <motion.div
                        key={pkg.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`relative flex flex-col p-5 sm:p-8 rounded-3xl border-2 bg-surface transition-all hover:-translate-y-2 hover:shadow-xl ${pkg.name === 'Pacote Popular' ? 'border-primary shadow-lg ring-4 ring-primary/10 sm:scale-105' : 'border-border-light hover:border-primary/50'}`}
                    >
                        {pkg.credit_amount === 30 && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white border-0 px-3 py-1 shadow-sm uppercase tracking-wider text-xs">
                                Melhor Oferta
                            </Badge>
                        )}
                        {pkg.name === 'Pacote Popular' && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white border-0 px-3 py-1 shadow-sm uppercase tracking-wider text-xs">
                                Mais Escolhido
                            </Badge>
                        )}

                        <div className="mb-6 space-y-2 text-center">
                            <h3 className="font-display text-2xl text-text">{pkg.name}</h3>
                            <div className="flex justify-center items-end gap-1">
                                <span className="text-4xl font-bold text-text mb-1">{pkg.credit_amount}</span>
                                <span className="text-text-light font-ui pb-2">criações</span>
                            </div>
                        </div>

                        <ul className="mb-8 space-y-3 font-ui text-text flex-1">
                            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> Uso nas ferramentas VIP</li>
                            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> Uso no Risco Simples</li>
                            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-primary" /> <strong>Sem data de validade</strong></li>
                        </ul>

                        <div className="pt-6 border-t border-border-light text-center">
                            <div className="text-3xl font-display text-text mb-4">R$ {Number(pkg.price_brl ?? pkg.price ?? 0).toFixed(2).replace('.', ',')}</div>

                            <Button
                                onClick={() => openCheckout(pkg)}
                                className="w-full h-14 rounded-2xl text-base shadow-md bg-primary hover:bg-primary-dark text-white transition-colors"
                            >
                                <ShoppingBag className="w-5 h-5 mr-2" /> Comprar Agora
                            </Button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <section className="mt-16 bg-surface-warm/50 rounded-3xl p-5 sm:p-8 border border-border-light text-center">
                <PackageOpen className="w-12 h-12 text-primary-light mx-auto mb-4" />
                <h3 className="font-display text-2xl text-text mb-2">Já pensou em ser assinante?</h3>
                <p className="font-ui text-text-light mb-6 max-w-xl mx-auto">
                    A Assinatura Premium custa menos que o Pacote Prata e te oferece uma recarga automática todos os meses, além de destravar todas as áreas do painel (como a Aba Financeira e Precificação IA).
                </p>
                <Button onClick={() => navigate('/dashboard/assinar')} className="border border-primary text-primary hover:text-primary bg-transparent hover:bg-[#FDF0F0] rounded-full px-8 transition-colors">Explorar Clube Premium</Button>
            </section>

            {/* ===== MODAL DE CHECKOUT ===== */}
            {selectedPkg && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative">

                        {/* Header */}
                        <div className="sticky top-0 bg-white rounded-t-[2rem] p-5 sm:p-6 border-b border-border-light z-10">
                            <button onClick={closeCheckout} className="absolute top-5 right-5 text-text-muted hover:text-text transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="font-display text-xl sm:text-2xl text-text pr-8">
                                {resultado ? '💳 Pagamento Gerado' : `🧵 ${selectedPkg.name}`}
                            </h3>
                            {!resultado && (
                                <p className="text-text-light font-ui text-sm mt-1">
                                    {selectedPkg.credit_amount} criações por R$ {Number(selectedPkg.price_brl).toFixed(2).replace('.', ',')}
                                </p>
                            )}
                        </div>

                        <div className="p-5 sm:p-6">

                            {/* === RESULTADO PIX === */}
                            {resultado && resultado.pix && (
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                        <span className="text-3xl">⚡</span>
                                    </div>
                                    <h3 className="font-display text-xl text-green-700">QR Code gerado!</h3>
                                    <p className="font-ui text-text-light text-sm">
                                        Escaneie com o app do seu banco ou copie o código abaixo.
                                    </p>

                                    <img
                                        src={`data:image/png;base64,${resultado.pix.encodedImage}`}
                                        alt="QR Code Pix"
                                        className="w-48 h-48 mx-auto rounded-xl border-4 border-white shadow-lg"
                                    />

                                    <div className="bg-surface-warm rounded-xl p-4 text-left">
                                        <p className="text-xs text-text-muted mb-2 font-semibold">Pix Copia e Cola:</p>
                                        <p className="text-xs text-text font-mono break-all mb-3">
                                            {resultado.pix.payload}
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(resultado.pix!.payload);
                                                showAlert('Sucesso', 'Código Pix copiado com sucesso!');
                                            }}
                                            className="bg-primary hover:bg-primary-dark text-white rounded-lg w-full"
                                        >
                                            📋 Copiar código
                                        </Button>
                                    </div>

                                    <p className="text-xs text-text-muted">
                                        Após o pagamento, seus {resultado.credit_amount} créditos serão liberados automaticamente!
                                    </p>

                                    <Button variant="outline" onClick={closeCheckout} className="w-full rounded-xl mt-2">
                                        Fechar
                                    </Button>
                                </div>
                            )}

                            {/* === RESULTADO BOLETO === */}
                            {resultado && resultado.boleto && (
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                                        <span className="text-3xl">📄</span>
                                    </div>
                                    <h3 className="font-display text-xl text-amber-700">Boleto gerado!</h3>
                                    <p className="font-ui text-text-light text-sm">
                                        Vencimento: <strong>{new Date(resultado.boleto.dueDate).toLocaleDateString('pt-BR')}</strong>
                                    </p>

                                    <a
                                        href={resultado.boleto.bankSlipUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block bg-amber-600 text-white py-3.5 rounded-xl font-bold text-base no-underline hover:bg-amber-700 transition-colors"
                                    >
                                        📥 Abrir e imprimir boleto
                                    </a>

                                    <div className="bg-surface-warm rounded-xl p-4 text-left">
                                        <p className="text-xs text-text-muted mb-2 font-semibold">Código de barras:</p>
                                        <p className="text-xs text-text font-mono break-all mb-3">
                                            {resultado.boleto.identificationField}
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(resultado.boleto!.identificationField);
                                                showAlert('Sucesso', 'Código copiado com sucesso!');
                                            }}
                                            className="bg-primary hover:bg-primary-dark text-white rounded-lg w-full"
                                        >
                                            📋 Copiar código
                                        </Button>
                                    </div>

                                    <p className="text-xs text-text-muted">
                                        Seus {resultado.credit_amount} créditos serão liberados após confirmação do pagamento.
                                    </p>

                                    <Button variant="outline" onClick={closeCheckout} className="w-full rounded-xl mt-2">
                                        Fechar
                                    </Button>
                                </div>
                            )}

                            {/* === FORMULÁRIO DE CHECKOUT === */}
                            {!resultado && (
                                <div className="space-y-5">
                                    {errorMsg && (
                                        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
                                            {errorMsg}
                                        </div>
                                    )}

                                    {/* Forma de pagamento */}
                                    <div>
                                        <Label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Forma de Pagamento</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {([
                                                { id: 'PIX' as const, label: 'Pix', icon: '⚡', desc: 'Aprovação imediata' },
                                                { id: 'BOLETO' as const, label: 'Boleto', icon: '📄', desc: 'Vence em 3 dias' },
                                            ]).map(forma => (
                                                <button
                                                    key={forma.id}
                                                    type="button"
                                                    onClick={() => setFormaPagamento(forma.id)}
                                                    className="p-3 rounded-xl border-2 text-center transition-all"
                                                    style={{
                                                        borderColor: formaPagamento === forma.id ? '#AC5148' : '#E5D9CC',
                                                        background: formaPagamento === forma.id ? '#FDF0EE' : 'white',
                                                    }}
                                                >
                                                    <div className="text-2xl mb-1">{forma.icon}</div>
                                                    <div className="font-bold text-sm text-text">{forma.label}</div>
                                                    <div className="text-[11px] text-text-muted mt-0.5">{forma.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dados pessoais */}
                                    <div>
                                        <Label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Dados Pessoais</Label>
                                        <div className="space-y-3">
                                            <div>
                                                <Input
                                                    value={fullName}
                                                    onChange={e => setFullName(e.target.value)}
                                                    placeholder="Nome Completo"
                                                    className="h-11 rounded-xl"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                    value={cpf}
                                                    onChange={e => setCpf(maskCPF(e.target.value))}
                                                    placeholder="CPF"
                                                    className="h-11 rounded-xl"
                                                />
                                                <Input
                                                    value={phone}
                                                    onChange={e => setPhone(maskPhone(e.target.value))}
                                                    placeholder="Celular"
                                                    className="h-11 rounded-xl"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                    value={cep}
                                                    onChange={e => setCep(maskCEP(e.target.value))}
                                                    placeholder="CEP"
                                                    className="h-11 rounded-xl"
                                                />
                                                <Input
                                                    value={addressNumber}
                                                    onChange={e => setAddressNumber(e.target.value)}
                                                    placeholder="Nº"
                                                    className="h-11 rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resumo */}
                                    <div className="bg-surface-warm rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-ui text-sm text-text-light">{selectedPkg.name}</span>
                                            <span className="font-ui text-sm font-bold text-text">{selectedPkg.credit_amount} criações</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-ui text-sm text-text-light">Total</span>
                                            <span className="font-display text-xl text-primary font-bold">
                                                R$ {Number(selectedPkg.price_brl).toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Botão pagar */}
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isProcessing}
                                        className="w-full h-14 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-base shadow-lg"
                                    >
                                        {isProcessing ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                                            </span>
                                        ) : (
                                            formaPagamento === 'PIX' ? '⚡ Gerar QR Code Pix' : '📄 Gerar Boleto'
                                        )}
                                    </Button>

                                    <p className="text-xs text-center text-text-muted">
                                        Pagamento processado de forma segura via Asaas.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
