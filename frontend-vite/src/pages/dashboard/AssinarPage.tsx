import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useModal } from '@/contexts/ModalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CreditCard, Loader2, CheckCircle2, Lock } from 'lucide-react';
import { maskCPF, maskPhone, maskCEP, maskCreditCard, maskExpiry, maskCVV, getCardFlag } from '@/lib/utils/masks';
import { useToast } from '@/hooks/use-toast';

const checkoutSchema = z.object({
    fullName: z.string().min(3, 'Nome muito curto.'),
    cpf: z.string().min(14, 'CPF incompleto.'),
    phone: z.string().min(14, 'Telefone incompleto.'),
    zip: z.string().min(9, 'CEP incompleto.'),
    street: z.string().min(1, 'Endereço obrigatório.'),
    number: z.string().min(1, 'Número obrigatório.'),

    cardNumber: z.string().optional(),
    cardName: z.string().optional(),
    expiry: z.string().optional(),
    cvv: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function AssinarPage() {
    const navigate = useNavigate();
    const supabase = createClient();
    const { user, profile } = useAuth();
    const { showAlert } = useModal();
    const { toast } = useToast();

    const [errorMsg, setErrorMsg] = useState('');
    const [loadingCep, setLoadingCep] = useState(false);
    const [cardFlag, setCardFlag] = useState('unknown');
    const [planPrice, setPlanPrice] = useState(97);

    const [formaPagamento, setFormaPagamento] = useState<'cartao' | 'pix' | 'boleto'>('cartao');
    const [resultado, setResultado] = useState<{
        forma_pagamento: string;
        pix?: { encodedImage: string, payload: string, expirationDate: string };
        boleto?: { bankSlipUrl: string, dueDate: string, identificationField: string };
    } | null>(null);

    const [searchParams] = useSearchParams();
    const [codigoCupom, setCodigoCupom] = useState(
        new URLSearchParams(window.location.search).get('cupom') || ''
    );
    const [cupomValido, setCupomValido] = useState<null | { desconto: number; id: string }>(null);
    const [verificandoCupom, setVerificandoCupom] = useState(false);
    
    // Para manter compatibilidade com o resto do código original caso use cupomInfo em outro local
    const [cupomInfo, setCupomInfo] = useState<any>(null);

    const { register, handleSubmit, setValue, trigger, reset, formState: { errors, isSubmitting } } = useForm<CheckoutForm>({
        resolver: zodResolver(checkoutSchema),
        defaultValues: {
            fullName: profile?.full_name || '',
            cpf: profile?.cpf ? maskCPF(profile.cpf) : '',
            phone: profile?.phone ? maskPhone(profile.phone) : '',
            zip: profile?.address_zip ? maskCEP(profile.address_zip) : '',
            street: profile?.address_street || '',
            number: profile?.address_number || '',
            cardNumber: '', cardName: '', expiry: '', cvv: ''
        }
    });

    useEffect(() => {
        if (profile) {
            reset({
                fullName: profile.full_name || '',
                cpf: profile.cpf ? maskCPF(profile.cpf) : '',
                phone: profile.phone ? maskPhone(profile.phone) : '',
                zip: profile.address_zip ? maskCEP(profile.address_zip) : '',
                street: profile.address_street || '',
                number: profile.address_number || '',
                cardNumber: '', cardName: '', expiry: '', cvv: ''
            });
        }
    }, [profile, reset]);

    useEffect(() => {
        const fetchPlanConfig = async () => {
            const { data } = await supabase.from('plan_config').select('premium_price_brl').maybeSingle();
            if (data?.premium_price_brl) setPlanPrice(data.premium_price_brl);
        };
        fetchPlanConfig();
    }, [supabase]);

    const handleVerificarCupom = async () => {
        if (!codigoCupom.trim()) return;
        setVerificandoCupom(true);

        try {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-cupom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codigoCupom.toUpperCase() })
            });
            const data = await res.json();

            if (data.valid) {
                setCupomValido({ desconto: data.discount_value, id: data.id });
                setCupomInfo(data); // atualiza state legado q printa UI do cupomInfo original
                toast({ title: 'Sucesso', description: `Cupom aplicado! R$${data.discount_value}/mês` });
            } else {
                setCupomValido(null);
                setCupomInfo(null);
                toast({ title: 'Aviso', description: 'Cupom inválido ou esgotado', variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'Erro', description: 'Erro ao verificar cupom', variant: 'destructive' });
        }
        setVerificandoCupom(false);
    };

    useEffect(() => {
        const cupomUrlValue = new URLSearchParams(window.location.search).get('cupom');
        if (cupomUrlValue) {
            setCodigoCupom(cupomUrlValue.toUpperCase());
            // Auto verificar após meio segundo
            setTimeout(() => {
                // Como handleVerificarCupom usa o state, e state num useEffect de mount inicial
                // vai ser o inicial, passamos o fetch manual aqui pro load
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-cupom`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: cupomUrlValue.toUpperCase() })
                }).then(res => res.json()).then(data => {
                    if (data.valid) {
                        setCupomValido({ desconto: data.discount_value, id: data.id });
                        setCupomInfo(data);
                        toast({ title: 'Sucesso', description: `Cupom auto-aplicado! R$${data.discount_value}/mês` });
                    }
                }).catch(console.error);
            }, 500);
        }
    }, []);

    const buscarCEP = async (e: React.FocusEvent<HTMLInputElement>) => {
        let cep = e.target.value.replace(/\D/g, '');
        if (cep.length !== 8) return;

        setLoadingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setValue('street', data.logradouro);
                trigger(['street']);
            }
        } catch (error) {
            console.warn('Erro ao buscar CEP', error);
        } finally {
            setLoadingCep(false);
        }
    };

    const handleMask = (e: React.ChangeEvent<HTMLInputElement>, masker: (v: string) => string, field: keyof CheckoutForm) => {
        const val = masker(e.target.value);
        setValue(field, val);
        if (field === 'cardNumber') setCardFlag(getCardFlag(val));
        trigger(field);
    };

    const onSubmit = async (data: CheckoutForm) => {
        setErrorMsg('');
        if (!user) return;

        try {
            if (formaPagamento === 'cartao') {
                if (!data.cardNumber || data.cardNumber.length < 16) { setErrorMsg('Cartão incompleto.'); return; }
                if (!data.cardName || data.cardName.length < 3) { setErrorMsg('Nome no cartão incompleto.'); return; }
                if (!data.expiry || data.expiry.length < 5) { setErrorMsg('Validade incompleta.'); return; }
                if (!data.cvv || data.cvv.length < 3) { setErrorMsg('CVV incompleto.'); return; }
            }

            const [expMonth, expYear] = data.expiry ? data.expiry.split('/') : ['', ''];

            const payload = {
                user_id: user.id,
                forma_pagamento: formaPagamento === 'cartao' ? 'CREDIT_CARD' : formaPagamento === 'pix' ? 'PIX' : 'BOLETO',
                holder: {
                    name: data.fullName,
                    cpf: data.cpf,
                    phone: data.phone,
                    cep: data.zip,
                    addressNumber: data.number
                },
                card: formaPagamento === 'cartao' ? {
                    holderName: data.cardName?.toUpperCase() || '',
                    number: data.cardNumber || '',
                    expiryMonth: expMonth,
                    expiryYear: expYear.length === 2 ? `20${expYear}` : expYear,
                    ccv: data.cvv || ''
                } : null,
                coupon_code: cupomValido ? codigoCupom : null
            };

            // Resgatar a sessão atual para enviar no cabeçalho Authorization
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Sessão inválida ou expirada.');
            }

            // Usando fetch nativo para contornar bug de serialização do invoke
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-assinatura`,
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

            if (formaPagamento === 'cartao') {
                window.location.href = '/dashboard?checkout=success';
            } else {
                setResultado(responseData);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

        } catch (error: any) {
            setErrorMsg(error.message || 'Erro inesperado.');
        } finally {
            // Em tese, desligar load
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">

            <div>
                <h1 className="font-display text-4xl font-bold text-text">Upgrade Premium</h1>
                <p className="text-text-light mt-2">Finalize sua assinatura de forma segura e imediata.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">

                {/* FORMULÁRIO */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 md:p-8 border border-border shadow-sm">
                    {cupomInfo && (
                        <div className="bg-green-50/50 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                            <span className="text-2xl">🎉</span>
                            <div>
                                <p className="text-green-700 font-bold m-0">Cupom de desconto aplicado!</p>
                                <p className="text-text-light text-sm mt-1">Você paga R${Math.floor(cupomInfo.discount_value)}/mês para sempre.</p>
                            </div>
                        </div>
                    )}

                    {resultado && resultado.pix && (
                        <div style={{ textAlign: 'center', padding: '32px', background: 'white', borderRadius: '20px', border: '1px solid #E5D9CC' }}>
                            <h3 style={{ color: '#16A34A', margin: '0 0 8px' }}>⚡ QR Code gerado!</h3>
                            <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 24px' }}>
                                Escaneie com o app do seu banco ou copie o código abaixo.
                            </p>

                            <img
                                src={`data:image/png;base64,${resultado.pix.encodedImage}`}
                                alt="QR Code Pix"
                                style={{ width: '200px', height: '200px', margin: '0 auto 20px', display: 'block', border: '8px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderRadius: '12px' }}
                            />

                            <div style={{ background: '#F2E9DB', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                                <p style={{ fontSize: '11px', color: '#6B6B6B', margin: '0 0 6px' }}>Pix Copia e Cola:</p>
                                <p style={{ fontSize: '11px', color: '#1A1A1A', wordBreak: 'break-all', margin: '0 0 8px', fontFamily: 'monospace' }}>
                                    {resultado.pix.payload}
                                </p>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(resultado.pix!.payload); showAlert('Sucesso', 'Código copiado com sucesso!') }}
                                    style={{ background: '#AC5148', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                >
                                    📋 Copiar código
                                </button>
                            </div>

                            <p style={{ color: '#6B6B6B', fontSize: '12px' }}>
                                Após o pagamento, seu acesso Premium será liberado automaticamente em instantes.
                            </p>
                        </div>
                    )}

                    {resultado && resultado.boleto && (
                        <div style={{ textAlign: 'center', padding: '32px', background: 'white', borderRadius: '20px', border: '1px solid #E5D9CC' }}>
                            <h3 style={{ color: '#C29A51', margin: '0 0 8px' }}>📄 Boleto gerado!</h3>
                            <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 24px' }}>
                                Vencimento: <strong>{new Date(resultado.boleto.dueDate).toLocaleDateString('pt-BR')}</strong>
                            </p>

                            <a
                                href={resultado.boleto.bankSlipUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block', background: '#C29A51', color: 'white', padding: '14px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}
                            >
                                📥 Abrir e imprimir boleto
                            </a>

                            <div style={{ background: '#F2E9DB', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                                <p style={{ fontSize: '11px', color: '#6B6B6B', margin: '0 0 6px' }}>Código de barras:</p>
                                <p style={{ fontSize: '11px', color: '#1A1A1A', wordBreak: 'break-all', margin: '0 0 8px', fontFamily: 'monospace' }}>
                                    {resultado.boleto.identificationField}
                                </p>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(resultado.boleto!.identificationField); showAlert('Sucesso', 'Código copiado com sucesso!') }}
                                    style={{ background: '#AC5148', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                >
                                    📋 Copiar código
                                </button>
                            </div>

                            <p style={{ color: '#6B6B6B', fontSize: '12px' }}>
                                ⚠️ Seu acesso Premium será liberado após a confirmação do pagamento.
                            </p>
                        </div>
                    )}

                    {!resultado && (
                        <form id="checkout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                            {errorMsg && (
                                <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-start gap-3 border border-destructive/20">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>{errorMsg}</p>
                                </div>
                            )}

                            {/* DADOS PESSOAIS */}
                            <div>
                                <h3 className="text-lg font-bold text-text mb-4 border-b border-border pb-2">Dados Pessoais</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label>Nome Completo</Label>
                                        <Input {...register('fullName')} className="h-11 rounded-xl" />
                                        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>CPF</Label>
                                        <Input {...register('cpf')} onChange={(e) => handleMask(e, maskCPF, 'cpf')} placeholder="000.000.000-00" className="h-11 rounded-xl" />
                                        {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Celular</Label>
                                        <Input {...register('phone')} onChange={(e) => handleMask(e, maskPhone, 'phone')} placeholder="(00) 00000-0000" className="h-11 rounded-xl" />
                                        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4 mt-4">
                                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                                        <Label className="flex justify-between items-center">CEP {loadingCep && <Loader2 className="w-3 h-3 animate-spin" />}</Label>
                                        <Input {...register('zip')} onBlur={buscarCEP} onChange={(e) => handleMask(e, maskCEP, 'zip')} placeholder="00000-000" className="h-11 rounded-xl" />
                                        {errors.zip && <p className="text-xs text-destructive">{errors.zip.message}</p>}
                                    </div>

                                    <div className="space-y-1.5 col-span-2 md:col-span-2">
                                        <Label>Endereço</Label>
                                        <Input {...register('street')} className="h-11 rounded-xl bg-background/50" />
                                        {errors.street && <p className="text-xs text-destructive">{errors.street.message}</p>}
                                    </div>

                                    <div className="space-y-1.5 col-span-4 md:col-span-1">
                                        <Label>Número</Label>
                                        <Input {...register('number')} className="h-11 rounded-xl" />
                                        {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* DADOS DE PAGAMENTO */}
                            <div>
                                {/* Seletor de forma de pagamento */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '14px', color: '#1A1A1A', display: 'block', marginBottom: '12px' }}>
                                        Forma de pagamento
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        {[
                                            { id: 'cartao', label: 'Cartão', icon: '💳', desc: 'Débito automático mensal' },
                                            { id: 'pix', label: 'Pix', icon: '⚡', desc: 'Aprovação imediata' },
                                            { id: 'boleto', label: 'Boleto', icon: '📄', desc: 'Vence em 3 dias' },
                                        ].map(forma => (
                                            <button
                                                key={forma.id}
                                                type="button"
                                                onClick={() => setFormaPagamento(forma.id as any)}
                                                style={{
                                                    padding: '14px 10px',
                                                    borderRadius: '14px',
                                                    border: `2px solid ${formaPagamento === forma.id ? '#AC5148' : '#E5D9CC'}`,
                                                    background: formaPagamento === forma.id ? '#FDF0EE' : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <div style={{ fontSize: '24px', marginBottom: '4px' }}>{forma.icon}</div>
                                                <div style={{ fontWeight: 700, fontSize: '14px', color: '#1A1A1A' }}>{forma.label}</div>
                                                <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px' }}>{forma.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Formulário condicional por forma de pagamento */}
                                {formaPagamento === 'cartao' && (
                                    <div>
                                        <h3 className="text-lg font-bold text-text mb-4 border-b border-border pb-2 flex items-center gap-2">
                                            <CreditCard className="w-5 h-5" /> Cartão de Crédito
                                        </h3>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 md:col-span-2 relative">
                                                <Label>Número do Cartão</Label>
                                                <Input
                                                    {...register('cardNumber')}
                                                    onChange={(e) => handleMask(e, maskCreditCard, 'cardNumber')}
                                                    placeholder="0000 0000 0000 0000"
                                                    className="h-11 rounded-xl pl-10 pr-20 relative"
                                                />
                                                <div className="absolute left-3 top-10 -translate-y-1 text-text-muted select-none">
                                                    <CreditCard className="w-5 h-5 pointer-events-none" />
                                                </div>
                                                {cardFlag !== 'unknown' && (
                                                    <div className="absolute right-3 top-10 -translate-y-1 text-primary select-none font-bold text-xs uppercase tracking-wide pointer-events-none">
                                                        {cardFlag}
                                                    </div>
                                                )}
                                                {errors.cardNumber && <p className="text-xs text-destructive mt-1">{errors.cardNumber.message}</p>}
                                            </div>

                                            <div className="space-y-1.5 md:col-span-2">
                                                <Label>Nome Impresso no Cartão</Label>
                                                <Input {...register('cardName')} placeholder="MARIA DA SILVA" className="h-11 rounded-xl uppercase" />
                                                {errors.cardName && <p className="text-xs text-destructive">{errors.cardName.message}</p>}
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label>Validade</Label>
                                                <Input {...register('expiry')} onChange={(e) => handleMask(e, maskExpiry, 'expiry')} placeholder="00/00" className="h-11 rounded-xl" />
                                                {errors.expiry && <p className="text-xs text-destructive">{errors.expiry.message}</p>}
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label>CVV</Label>
                                                <Input type="password" {...register('cvv')} onChange={(e) => handleMask(e, maskCVV, 'cvv')} placeholder="123" className="h-11 rounded-xl" />
                                                {errors.cvv && <p className="text-xs text-destructive">{errors.cvv.message}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {formaPagamento === 'pix' && (
                                    <div style={{ background: '#F0FDF4', border: '1px solid #16A34A', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '40px' }}>⚡</span>
                                        <h3 style={{ color: '#16A34A', margin: '8px 0 4px' }}>Pagamento via Pix</h3>
                                        <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 16px' }}>
                                            Clique em assinar para gerar o QR Code. O pagamento é confirmado em segundos.
                                        </p>
                                        <div style={{ background: 'white', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#6B6B6B', marginBottom: '8px' }}>
                                            💡 A cada mês um novo Pix será gerado automaticamente para renovação.
                                        </div>
                                    </div>
                                )}

                                {formaPagamento === 'boleto' && (
                                    <div style={{ background: '#FDF8F0', border: '1px solid #C29A51', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '40px' }}>📄</span>
                                        <h3 style={{ color: '#C29A51', margin: '8px 0 4px' }}>Pagamento via Boleto</h3>
                                        <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 16px' }}>
                                            Clique em assinar para gerar o boleto. Vencimento em 3 dias úteis.
                                        </p>
                                        <div style={{ background: 'white', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#6B6B6B' }}>
                                            ⚠️ Seu acesso Premium é liberado somente após confirmação do pagamento.
                                        </div>
                                    </div>
                                )}
                            </div>

                        </form>
                    )}
                </div>

                {/* RESUMO DO PEDIDO */}
                <div className="bg-[#2D2D2D] text-white rounded-2xl p-6 shadow-xl sticky top-24">
                    <h3 className="font-display text-2xl font-bold mb-6 text-[#F7E1D7]">Meu Ateliê Premium</h3>

                    {/* Campo de Cupom Manual */}
                    <div style={{ background: '#F2E9DB', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
                        <label style={{ fontWeight: 700, fontSize: '13px', color: '#1A1A1A', display: 'block', marginBottom: '10px' }}>
                            🎁 Tem um cupom de desconto?
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                value={codigoCupom}
                                onChange={e => setCodigoCupom(e.target.value.toUpperCase())}
                                placeholder="Digite o código"
                                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px',
                                border: `1px solid ${cupomValido ? '#16A34A' : '#E5D9CC'}`,
                                fontFamily: 'Nunito', fontSize: '14px', fontWeight: 700, letterSpacing: '1px', color: '#1A1A1A', background: 'white' }}
                            />
                            <button onClick={handleVerificarCupom} disabled={verificandoCupom} type="button"
                                style={{ padding: '10px 16px', borderRadius: '10px', background: '#AC5148',
                                color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px', opacity: verificandoCupom ? 0.7 : 1 }}>
                                {verificandoCupom ? '...' : 'Aplicar'}
                            </button>
                        </div>

                        {/* Feedback do cupom */}
                        {cupomValido && (
                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#16A34A', fontSize: '13px', fontWeight: 700 }}>
                                    ✅ Cupom {codigoCupom || 'aplicado'}!
                                </span>
                                <span style={{ color: '#16A34A', fontWeight: 800 }}>
                                    R${cupomValido.desconto}/mês
                                    <span style={{ textDecoration: 'line-through', color: '#AAAAAA', marginLeft: '8px', fontSize: '12px' }}>
                                        R${Math.floor(planPrice)}
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col mb-8 pb-6 border-b border-white/10">
                        {cupomInfo ? (
                            <div>
                                <div className="flex items-end gap-2 text-white/50 mb-1">
                                    <span className="text-2xl font-semibold tracking-tight line-through">R${Math.floor(planPrice)}</span>
                                    <span className="text-sm pb-1">/mês</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-bold tracking-tight text-[#AC5148]">R${Math.floor(cupomInfo.discount_value)}<span className="text-2xl text-white/60">,00</span></span>
                                    <span className="text-white/60 mb-1 text-sm">/mês</span>
                                </div>
                                <p className="text-[#16A34A] text-xs font-bold uppercase tracking-wider mt-3">🔒 Preço garantido para sempre</p>
                            </div>
                        ) : (
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-bold tracking-tight">R${Math.floor(planPrice)}<span className="text-2xl text-white/60">,{String(planPrice.toFixed(2)).split('.')[1]}</span></span>
                                <span className="text-white/60 mb-1">/mês</span>
                            </div>
                        )}
                    </div>

                    <ul className="space-y-4 mb-8">
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-[#F7E1D7] shrink-0 mt-0.5" />
                            <span className="text-white/80 leading-snug">15 gerações mensais</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-[#F7E1D7] shrink-0 mt-0.5" />
                            <span className="text-white/80 leading-snug">70 conversas com a IA (Lia)</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-[#F7E1D7] shrink-0 mt-0.5" />
                            <span className="text-white/80 leading-snug">Todos os módulos de gestão</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-[#F7E1D7] shrink-0 mt-0.5" />
                            <span className="text-white/80 leading-snug">Cronômetro de Produtividade</span>
                        </li>
                    </ul>

                    <div className="bg-white/5 rounded-xl p-4 mb-6 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs text-white/60 uppercase tracking-widest font-semibold mb-1">
                            <Lock className="w-3.5 h-3.5" /> Pagamento Seguro
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">
                            Cobrança recorrente. Você pode cancelar sua assinatura a qualquer momento gerenciando sua conta.
                        </p>
                    </div>

                    <Button
                        form="checkout-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                            </span>
                        ) : (
                            'Assinar agora'
                        )}
                    </Button>

                </div>
            </div>
        </div>
    );
}
