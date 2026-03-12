import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlatform } from '@/contexts/PlatformContext';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
    email: z.string().email({ message: 'E-mail inválido.' }),
    password: z.string().min(6, { message: 'Mínimo de 6 caracteres.' })
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const navigate = useNavigate();
    const supabase = createClient();
    const [errorMsg, setErrorMsg] = useState('');
    const { platformName, platformLogo } = usePlatform();

    const { toast } = useToast();

    const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema)
    });

    const onSubmit = async (data: LoginForm) => {
        setErrorMsg('');
        const { data: authData, error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password
        });

        if (error) {
            setErrorMsg('E-mail ou senha incorretos.');
            return;
        }

        if (authData.user) {
            const { data: profile } = await supabase.from('profiles').select('status').eq('id', authData.user.id).single();
            if (profile?.status === 'blocked') {
                await supabase.auth.signOut();
                setErrorMsg('Conta bloqueada. Entre em contato com o suporte.');
                return;
            }
        }

        navigate('/dashboard');
        // navigate(0) // emulando router.refresh() do next, mas num SPA n é necessário 
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
        >
            <div className="text-center sm:text-left space-y-2">
                <img
                    src={platformLogo || '/logo.png'}
                    alt={`Logo ${platformName}`}
                    onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                    style={{ height: '120px', width: 'auto', objectFit: 'contain', marginBottom: '16px' }}
                    className="block"
                />
                <p className="font-ui text-text-light">Acesse seu ateliê e gerencie seu negócio com elegância.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {errorMsg && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20"
                    >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p>{errorMsg}</p>
                    </motion.div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-text font-medium">E-mail</Label>
                    <Input
                        id="email"
                        placeholder="sua@arte.com.br"
                        {...register('email')}
                        className="rounded-xl border-border-light bg-background focus-visible:ring-primary shadow-sm h-12 px-4"
                    />
                    {errors.email && <p className="text-xs text-warn">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-text font-medium">Senha</Label>
                        <button 
                            type="button" 
                            onClick={async () => {
                                const email = getValues('email');
                                if (!email || !email.trim()) {
                                    toast({ title: 'Atenção', description: 'Digite seu email primeiro', variant: 'destructive' });
                                    return;
                                }

                                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                                    redirectTo: `${import.meta.env.VITE_APP_URL || window.location.origin}/resetar-senha`
                                });

                                if (!error) {
                                    toast({ title: 'Sucesso!', description: 'Email de recuperação enviado! Verifique sua caixa de entrada.' });
                                } else {
                                    toast({ title: 'Erro', description: 'Erro ao enviar email. Tente novamente.', variant: 'destructive' });
                                }
                            }} 
                            className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
                        >
                            Esqueci a senha
                        </button>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        {...register('password')}
                        className="rounded-xl border-border-light bg-background focus-visible:ring-primary shadow-sm h-12 px-4"
                    />
                    {errors.password && <p className="text-xs text-warn">{errors.password.message}</p>}
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-white font-ui text-base shadow-md transition-all mt-4"
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Ateliê'}
                </Button>
            </form>

            <div className="text-center">
                <p className="text-sm text-text-light font-ui">
                    Ainda não tem cadastro?{' '}
                    <Link to="/cadastro" className="font-semibold text-primary hover:underline hover:text-primary-dark transition-colors">
                        Crie sua conta grátis
                    </Link>
                </p>
            </div>
        </motion.div>
    );
}
