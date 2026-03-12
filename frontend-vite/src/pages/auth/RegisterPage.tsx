import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const step1Schema = z.object({
    fullName: z.string().min(3, 'Nome muito curto.'),
    email: z.string().email('E-mail inválido.'),
    password: z.string().min(6, 'Pelo menos 6 caracteres.'),
});

const step2Schema = step1Schema.extend({
    cpf: z.string().min(11, 'CPF incompleto.'), // Em um ambiente real faríamos deep check ou via lib separada com mascara
    phone: z.string().min(10, 'Telefone incompleto.'),
    zip: z.string().min(8, 'CEP incompleto'),
    street: z.string().min(1, 'Logradouro é obrigatório'),
    number: z.string().min(1, 'Número é obrigatório'),
    neighborhood: z.string().min(1, 'Bairro é obrigatório'),
    city: z.string().min(1, 'Cidade é obrigatória'),
    state: z.string().min(2, 'UF é obrigária'),
});

type RegistrationForm = z.infer<typeof step2Schema>;

export default function RegisterPage() {
    const navigate = useNavigate();
    const supabase = createClient();
    const [searchParams] = useSearchParams();
    const conviteCode = searchParams.get('convite');
    const [step, setStep] = useState(1);
    const [errorMsg, setErrorMsg] = useState('');
    const [loadingCep, setLoadingCep] = useState(false);
    const [aceitouTermos, setAceitouTermos] = useState(false);
    const [tentouCadastrar, setTentouCadastrar] = useState(false);

    // --- Sistema de convite ---
    const [conviteValido, setConviteValido] = useState(false);
    const [conviteData, setConviteData] = useState<any>(null);
    const [verificandoConvite, setVerificandoConvite] = useState(true);

    // Default defaultValues pra evitar warning de uncontrolled inputs
    const { register, handleSubmit, trigger, getValues, setValue, formState: { errors, isSubmitting } } = useForm<RegistrationForm>({
        resolver: zodResolver(step2Schema),
        mode: 'onTouched',
        defaultValues: { fullName: '', email: '', password: '', cpf: '', phone: '', zip: '', street: '', number: '', neighborhood: '', city: '', state: '' }
    });

    const nextStep = async () => {
        const valid = await trigger(['fullName', 'email', 'password']);
        if (valid) {
            setStep(2);
            setErrorMsg('');
        }
    };

    // Verificar convite no carregamento
    React.useEffect(() => {
        const verificarConvite = async () => {
            const { data: config } = await supabase
                .from('plan_config')
                .select('prelancamento')
                .single();

            if (!config?.prelancamento) {
                setConviteValido(true);
                setVerificandoConvite(false);
                return;
            }

            if (!conviteCode) {
                setConviteValido(false);
                setVerificandoConvite(false);
                return;
            }

            const { data: convite } = await supabase
                .from('invites')
                .select('*')
                .eq('code', conviteCode.toUpperCase())
                .eq('used', false)
                .single();

            setConviteValido(!!convite);
            if (convite) setConviteData(convite);
            setVerificandoConvite(false);
        };

        verificarConvite();
    }, [conviteCode]);

    const buscarCEP = async (e: React.FocusEvent<HTMLInputElement>) => {
        let cep = e.target.value.replace(/\D/g, '');
        if (cep.length !== 8) return;

        setLoadingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setValue('street', data.logradouro);
                setValue('neighborhood', data.bairro);
                setValue('city', data.localidade);
                setValue('state', data.uf);
                trigger(['street', 'neighborhood', 'city', 'state']);
            }
        } catch (error) {
            console.warn('Erro ao buscar CEP', error);
        } finally {
            setLoadingCep(false);
        }
    };

    const onSubmit = async (data: RegistrationForm) => {
        if (!aceitouTermos) {
            setTentouCadastrar(true);
            return;
        }
        setErrorMsg('');

        // 0. Verifica se CPF já existe
        const { data: existingCpf } = await supabase.from('profiles').select('id').eq('cpf', data.cpf).maybeSingle();
        if (existingCpf) {
            setErrorMsg("Este CPF já possui uma conta cadastrada na plataforma. Caso tenha esquecido sua senha, utilize a opção 'Esqueci minha senha' na tela de login.");
            return;
        }

        // 1. Cadastra no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: { full_name: data.fullName }
            }
        });

        if (authError) {
            setErrorMsg(authError.message);
            return;
        }

        if (authData.user) {
            let planUpdates: any = {};
            if (conviteData && conviteData.plan_type === 'premium') {
                const months = conviteData.premium_duration_months || 12;
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + months);
                
                planUpdates = {
                    plan: 'premium',
                    premium_starts_at: new Date().toISOString(),
                    premium_expires_at: expiresAt.toISOString(),
                };
            }

            // 2. Atualizar o profile criado pelo trigger do banco
            const { error: profileError } = await supabase.from('profiles').update({
                cpf: data.cpf,
                phone: data.phone,
                address_street: data.street,
                address_number: data.number,
                address_neighborhood: data.neighborhood,
                address_city: data.city,
                address_state: data.state,
                address_zip: data.zip,
                aceitou_termos: true,
                termos_aceitos_em: new Date().toISOString(),
                ...planUpdates
            }).eq('id', authData.user.id);

            if (profileError) {
                if (profileError.message.includes('profiles_cpf_key') || profileError.code === '23505') {
                    setErrorMsg("Este CPF já possui uma conta cadastrada na plataforma. Caso tenha esquecido sua senha, utilize a opção 'Esqueci minha senha' na tela de login.");
                } else {
                    setErrorMsg('Erro ao salvar dados completos do perfil: ' + profileError.message);
                }
                return;
            }

            // 3. Marcar convite como usado
            if (conviteCode) {
                await supabase
                    .from('invites')
                    .update({
                        used: true,
                        used_by: authData.user.id,
                        used_at: new Date().toISOString()
                    })
                    .eq('code', conviteCode.toUpperCase());
            }

            // 4. Referral Logic check
            const refCode = searchParams.get('ref');

            if (refCode) {
                const { data: referer } = await supabase
                    .from('profiles')
                    .select('id, extra_credits')
                    .eq('referral_code', refCode)
                    .single();

                if (referer) {
                    await supabase.from('referrals').insert({
                        referrer_id: referer.id,
                        referred_id: authData.user.id,
                        credits_granted: true
                    });

                    await supabase.from('profiles')
                        .update({ extra_credits: (referer.extra_credits || 0) + 2 })
                        .eq('id', referer.id);

                    await supabase.from('notifications').insert({
                        user_id: referer.id,
                        title: 'Nova indicação! 🎉',
                        message: `Sua amiga ${data.fullName.split(' ')[0]} acabou de se cadastrar pelo seu link! Você ganhou 2 créditos.`,
                        type: 'success'
                    });
                }
            }

            navigate('/dashboard');
        }
    };

    if (verificandoConvite) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!conviteValido) {
        return (
            <div className="w-full flex flex-col items-center justify-center text-center py-12 px-6">
                <span style={{ fontSize: '48px' }}>🔒</span>
                <h2 className="font-display text-2xl font-bold text-primary mt-4 mb-2">Acesso restrito</h2>
                <p className="text-text-light max-w-sm mb-6">
                    O cadastro ainda não está aberto ao público.
                    Entre na lista de espera para ser avisada quando abrirmos!
                </p>
                <a
                    href="/"
                    className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition-colors"
                >
                    Entrar na lista de espera
                </a>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-8">
                <h2 className="font-display text-3xl font-semibold text-text mb-2">Criar conta</h2>
                <div className="flex gap-2 items-center">
                    <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-primary-light/30'}`} />
                    <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-primary-light/30'}`} />
                </div>
                <p className="text-xs text-text-muted mt-2 text-right">Passo {step} de 2</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {errorMsg && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20 mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p>{errorMsg}</p>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Nome Completo</Label>
                                <Input id="fullName" {...register('fullName')} className="rounded-xl h-12" />
                                {errors.fullName && <p className="text-xs text-warn">{errors.fullName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input id="email" {...register('email')} className="rounded-xl h-12" />
                                {errors.email && <p className="text-xs text-warn">{errors.email.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Criar Senha</Label>
                                <Input id="password" type="password" {...register('password')} className="rounded-xl h-12" />
                                {errors.password && <p className="text-xs text-warn">{errors.password.message}</p>}
                            </div>

                            <Button type="button" onClick={nextStep} className="w-full h-12 rounded-xl bg-primary text-white mt-6">
                                Continuar
                            </Button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cpf">CPF</Label>
                                    <Input id="cpf" placeholder="000.000.000-00" {...register('cpf')} className="rounded-xl h-12" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Celular/WhatsApp</Label>
                                    <Input id="phone" placeholder="(11) 90000-0000" {...register('phone')} className="rounded-xl h-12" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="zip" className="flex justify-between">CEP {loadingCep && <Loader2 className="w-3 h-3 animate-spin" />}</Label>
                                <Input id="zip" placeholder="00000-000" {...register('zip')} onBlur={buscarCEP} className="rounded-xl h-12" />
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3 space-y-2">
                                    <Label htmlFor="street">Logradouro</Label>
                                    <Input id="street" {...register('street')} className="rounded-xl h-12 bg-background/50" />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <Label htmlFor="number">Nº</Label>
                                    <Input id="number" {...register('number')} className="rounded-xl h-12" />
                                </div>
                            </div>

                            <div className="grid grid-cols-5 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="neighborhood">Bairro</Label>
                                    <Input id="neighborhood" {...register('neighborhood')} className="rounded-xl h-12 bg-background/50" />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="city">Cidade</Label>
                                    <Input id="city" {...register('city')} className="rounded-xl h-12 bg-background/50" />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <Label htmlFor="state">UF</Label>
                                    <Input id="state" {...register('state')} className="rounded-xl h-12 bg-background/50" />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: '12px',
                                padding: '16px', background: '#F2E9DB',
                                borderRadius: '12px', marginBottom: '16px', marginTop: '24px',
                                border: aceitouTermos ? '1px solid rgba(172,81,72,0.3)' : '1px solid #E5D9CC'
                            }}>
                                <input
                                    type="checkbox"
                                    id="aceite-termos"
                                    checked={aceitouTermos}
                                    onChange={e => {
                                        setAceitouTermos(e.target.checked);
                                        if (e.target.checked) setTentouCadastrar(false);
                                    }}
                                    style={{ marginTop: '2px', accentColor: '#AC5148', width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' }}
                                />
                                <label htmlFor="aceite-termos" style={{ fontSize: '14px', color: '#4A3A2A', lineHeight: 1.6, cursor: 'pointer' }}>
                                    Li e concordo com os{' '}
                                    <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: '#AC5148', fontWeight: 700, textDecoration: 'underline' }}>
                                        Termos de Uso
                                    </a>
                                    {' '}e a{' '}
                                    <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: '#AC5148', fontWeight: 700, textDecoration: 'underline' }}>
                                        Política de Privacidade
                                    </a>
                                    {' '}do Meu Ateliê.
                                </label>
                            </div>

                            {!aceitouTermos && tentouCadastrar && (
                                <p style={{ color: '#DC2626', fontSize: '13px', marginTop: '-8px', marginBottom: '8px', textAlign: 'center' }}>
                                    Você precisa aceitar os Termos de Uso para continuar.
                                </p>
                            )}

                            <div className="flex gap-3 mt-6">
                                <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-12 rounded-xl px-6 border-border text-text-light">
                                    Voltar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!aceitouTermos || isSubmitting}
                                    onClick={() => setTentouCadastrar(true)}
                                    className={`flex-1 h-12 rounded-xl text-white transition-all ${!aceitouTermos ? 'bg-gray-300 hover:bg-gray-300 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Cadastro'}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </form>

            {step === 1 && (
                <div className="text-center mt-6">
                    <p className="text-sm text-text-light font-ui">
                        Já tem uma conta?{' '}
                        <Link to="/login" className="font-semibold text-primary hover:underline hover:text-primary-dark">
                            Fazer login
                        </Link>
                    </p>
                </div>
            )}
        </div>
    );
}
