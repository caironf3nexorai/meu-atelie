
import React, { useState, useEffect } from 'react';
import { User, Shield, CreditCard, Clock, MapPin, Store, Image as ImageIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { useModal } from '@/contexts/ModalContext';
import { useAuth } from '@/lib/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';

export default function ProfilePage() {
    const navigate = useNavigate();
    const { showAlert } = useModal();
    const { fetchProfile } = useAuth();
    const supabase = createClient();
    const [isPremium, setIsPremium] = useState(false);
    const [loading, setLoading] = useState(true);
    const [canceling, setCanceling] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const [profile, setProfile] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    const [atelieNome, setAtelieNome] = useState('');
    const [atelieWhatsapp, setAtelieWhatsapp] = useState('');
    const [atelieEmail, setAtelieEmail] = useState('');
    const [atelieInstagram, setAtelieInstagram] = useState('');
    const [atelieCidade, setAtelieCidade] = useState('');
    const [atelieEstado, setAtelieEstado] = useState('');
    const [atelieLogoUrl, setAtelieLogoUrl] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // Estados Pessoais
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [cpf, setCpf] = useState('');
    const [celular, setCelular] = useState('');
    const [salvandoPessoal, setSalvandoPessoal] = useState(false);

    // Estados Endereço
    const [cep, setCep] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [estadoUF, setEstadoUF] = useState('');
    const [salvandoEndereco, setSalvandoEndereco] = useState(false);

    useEffect(() => {
        async function fetchData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setProfile(prof);
                if (prof && prof.plan !== 'free') setIsPremium(true);

                if (prof) {
                    setAtelieNome(prof.atelie_nome || '');
                    setAtelieWhatsapp(prof.atelie_whatsapp || '');
                    setAtelieEmail(prof.atelie_email || '');
                    setAtelieInstagram(prof.atelie_instagram || '');
                    setAtelieCidade(prof.atelie_cidade || '');
                    setAtelieEstado(prof.atelie_estado || '');
                    setAtelieLogoUrl(prof.atelie_logo_url || '');

                    setNome(prof.full_name || '');
                    setCpf(prof.cpf || '');
                    setCelular(prof.phone || '');

                    setCep(prof.address_zip || '');
                    setRua(prof.address_street || '');
                    setNumero(prof.address_number || '');
                    setBairro(prof.address_neighborhood || '');
                    setCidade(prof.address_city || '');
                    setEstadoUF(prof.address_state || '');
                }
                if (user) setEmail(user.email || '');

                const { data: pays } = await supabase.from('invoices').select('*').eq('user_id', user.id).order('paid_at', { ascending: false });
                setHistory(pays || []);
            }
            setLoading(false);
        }
        fetchData();
    }, [supabase]);

    const handleCancel = async () => {
        setCanceling(true);
        const { data: { user } } = await supabase.auth.getUser();

        try {
            const { data, error } = await supabase.functions.invoke('cancelar-assinatura', {
                body: { user_id: user?.id }
            });

            if (error || !data.success) {
                showAlert('Erro no Cancelamento', 'Ocorreu um erro ao cancelar. Tente novamente mais tarde.');
                console.error(error);
            } else {
                setShowCancelModal(false);
                setTimeout(() => {
                    showAlert('Assinatura Cancelada', 'A sua assinatura foi cancelada com sucesso.');
                    setTimeout(() => window.location.reload(), 2000);
                }, 100);
            }
        } catch (err) {
            showAlert('Falha Interna', 'Falha ao tentar cancelar.');
            console.error(err);
        } finally {
            setCanceling(false);
        }
    };

    const handleLogoUpload = async (file: File) => {
        setUploadingLogo(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const ext = file.name.split('.').pop()
        const path = `logos/${user.id}/logo.${ext}`

        const { error } = await supabase.storage
            .from('atelie-assets')
            .upload(path, file, { upsert: true })

        if (!error) {
            const { data } = supabase.storage
                .from('atelie-assets')
                .getPublicUrl(path)
            setAtelieLogoUrl(data.publicUrl)
        } else {
            showAlert('Erro', 'Não foi possível enviar a imagem.')
        }
        setUploadingLogo(false)
    }

    const handleSaveAtelie = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const updates = {
            atelie_nome: atelieNome,
            atelie_whatsapp: atelieWhatsapp,
            atelie_email: atelieEmail,
            atelie_instagram: atelieInstagram,
            atelie_cidade: atelieCidade,
            atelie_estado: atelieEstado,
            atelie_logo_url: atelieLogoUrl,
        }

        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
        if (error) {
            showAlert('Erro', 'Ocorreu um erro ao salvar as configurações.');
        } else {
            showAlert('Salvo', 'Os dados do ateliê foram salvos.');
        }
    }

    const handleSavePersonal = async () => {
        setSalvandoPessoal(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let errorMsg: string | null = null;

        // Tentar atualizar email no auth (se mudou)
        if (email !== user.email) {
            const { error: mailErr } = await supabase.auth.updateUser({ email });
            if (mailErr) errorMsg = 'Erro ao atualizar email: ' + mailErr.message;
            else showAlert('Aviso', 'Um email de confirmação foi enviado para validar a troca do e-mail.');
        }

        // Atualizar Nome e Telefone
        const { error: profErr } = await supabase.from('profiles').update({
            full_name: nome,
            phone: celular
        }).eq('id', user.id);

        if (profErr) errorMsg = 'Erro ao atualizar perfil.';

        if (errorMsg) showAlert('Erro', errorMsg);
        else if (email === user.email) {
            showAlert('Salvo', 'Informações pessoais atualizadas!');
            await fetchProfile(user.id);
        }
        
        setSalvandoPessoal(false);
    };

    const handleSaveAddress = async () => {
        setSalvandoEndereco(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('profiles').update({
            address_zip: cep,
            address_street: rua,
            address_number: numero,
            address_neighborhood: bairro,
            address_city: cidade,
            address_state: estadoUF
        }).eq('id', user.id);

        if (error) showAlert('Erro', 'Erro ao atualizar endereço.');
        else showAlert('Salvo', 'Endereço atualizado com sucesso!');

        setSalvandoEndereco(false);
    };

    if (loading) {
        return <div className="p-12 text-center text-text-light font-ui animate-pulse">Carregando perfil...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Profile Header */}
            <section className="flex flex-col md:flex-row items-center gap-6 bg-surface p-8 rounded-3xl border border-border-light shadow-sm">
                <div className="w-24 h-24 rounded-full bg-primary-light/20 flex flex-col items-center justify-center text-primary relative shadow-inner">
                    <User className="w-10 h-10" />
                </div>
                <div className="text-center md:text-left flex-1">
                    <h1 className="font-display text-3xl text-text">{profile?.full_name || 'Usuário'}</h1>
                    <p className="font-ui text-text-light">{profile?.email || ''}</p>
                </div>
                <div className="text-center md:text-right">
                    <p className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">Plano Atual</p>
                    <Badge variant="outline" className={isPremium ? "text-accent border-accent/30 bg-accent/10 text-base" : "text-text-muted border-text-muted/30 text-base px-4 py-1"}>
                        {isPremium ? 'Premium' : 'Grátis'}
                    </Badge>
                </div>
            </section>

            {/* Profile Sections */}
            <Tabs defaultValue="personal" className="w-full">
                <TabsList className="bg-surface-warm p-1 h-auto flex flex-wrap gap-1 rounded-2xl border border-border-light/50 w-full sm:w-fit mb-8">
                    <TabsTrigger value="personal" className="rounded-xl px-6 py-2.5 font-ui text-text-light data-[state=active]:bg-[#FAF0EF] data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"><User className="w-4 h-4 mr-2" />Dados</TabsTrigger>
                    <TabsTrigger value="atelie" className="rounded-xl px-6 py-2.5 font-ui text-text-light data-[state=active]:bg-[#FAF0EF] data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"><Store className="w-4 h-4 mr-2" />Meu Ateliê</TabsTrigger>
                    <TabsTrigger value="address" className="rounded-xl px-6 py-2.5 font-ui text-text-light data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"><MapPin className="w-4 h-4 mr-2" />Endereço</TabsTrigger>
                    <TabsTrigger value="security" className="rounded-xl px-6 py-2.5 font-ui text-text-light data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"><Shield className="w-4 h-4 mr-2" />Segurança</TabsTrigger>
                    <TabsTrigger value="subscription" className="rounded-xl px-6 py-2.5 font-ui text-text-light data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"><CreditCard className="w-4 h-4 mr-2" />Assinatura</TabsTrigger>
                </TabsList>

                <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border-light shadow-sm min-h-[300px]">
                    <TabsContent value="personal" className="space-y-6 animate-in fade-in">
                        <h3 className="font-display text-2xl text-text mb-4">Informações Pessoais</h3>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2"><Label>Nome Completo</Label><Input value={nome} onChange={e => setNome(e.target.value)} className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>E-mail</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>CPF</Label><Input value={cpf} disabled className="rounded-xl h-11 bg-background opacity-70" /></div>
                            <div className="space-y-2"><Label>Celular / WhatsApp</Label><Input value={celular} onChange={e => setCelular(e.target.value)} className="rounded-xl h-11" /></div>
                        </div>
                        <Button onClick={handleSavePersonal} disabled={salvandoPessoal} className="mt-6 rounded-full px-8 bg-primary hover:bg-primary-dark">
                            {salvandoPessoal ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </TabsContent>

                    <TabsContent value="address" className="space-y-6 animate-in fade-in">
                        <h3 className="font-display text-2xl text-text mb-4">Localização do Ateliê</h3>
                        <div className="grid sm:grid-cols-3 gap-6">
                            <div className="space-y-2"><Label>CEP</Label><Input value={cep} onChange={e => setCep(e.target.value)} className="rounded-xl h-11" /></div>
                            <div className="col-span-2 space-y-2"><Label>Rua / Logradouro</Label><Input value={rua} onChange={e => setRua(e.target.value)} className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>Número</Label><Input value={numero} onChange={e => setNumero(e.target.value)} className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>Bairro</Label><Input value={bairro} onChange={e => setBairro(e.target.value)} className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>Cidade/UF</Label><Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Belo Horizonte/MG" className="rounded-xl h-11" /></div>
                        </div>
                        <Button onClick={handleSaveAddress} disabled={salvandoEndereco} className="mt-6 rounded-full px-8 bg-primary hover:bg-primary-dark">
                            {salvandoEndereco ? 'Atualizando...' : 'Atualizar Endereço'}
                        </Button>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-6 animate-in fade-in max-w-md">
                        <h3 className="font-display text-2xl text-text mb-4">Trocar Senha</h3>
                        <div className="space-y-4">
                            <div className="space-y-2"><Label>Senha Atual</Label><Input type="password" placeholder="••••••••" className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>Nova Senha</Label><Input type="password" placeholder="••••••••" className="rounded-xl h-11" /></div>
                            <div className="space-y-2"><Label>Confirme Nova Senha</Label><Input type="password" placeholder="••••••••" className="rounded-xl h-11" /></div>
                        </div>
                        <Button className="mt-6 rounded-full px-8 text-text-light hover:text-text bg-border-light hover:bg-border-light/80">Atualizar Senha</Button>
                    </TabsContent>

                    <TabsContent value="atelie" className="space-y-6 animate-in fade-in max-w-2xl">
                        <div className="flex flex-col gap-6">

                            <div className="bg-surface rounded-2xl p-6 border border-border border-dashed relative">
                                <h3 className="font-display text-xl text-text mb-1">Logo do Ateliê</h3>
                                <p className="text-[#6B6B6B] text-sm font-ui mb-4">
                                    Essa logo aparecerá no cabeçalho de todos os orçamentos (PDF) gerados por você.
                                </p>

                                {atelieLogoUrl ? (
                                    <div className="relative inline-block mt-2">
                                        <img src={atelieLogoUrl} alt="Logo" className="h-20 object-contain rounded border border-border bg-white" />
                                        <button
                                            onClick={() => setAtelieLogoUrl('')}
                                            className="absolute -top-2 -right-2 bg-destructive text-white border-none rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-xs"
                                        >✕</button>
                                    </div>
                                ) : (
                                    <label className="block mt-4 cursor-pointer">
                                        <div className="border-2 border-dashed border-border-light hover:border-border rounded-xl p-8 text-center bg-surface-warm/50 hover:bg-surface-warm transition-all group">
                                            <ImageIcon className="w-8 h-8 text-text-muted mx-auto mb-2 group-hover:text-text-light transition-colors" />
                                            <p className="text-[#6B6B6B] m-0 font-ui text-sm font-medium">
                                                {uploadingLogo ? 'Enviando imagem...' : 'Clique ou solte sua logo aqui'}
                                            </p>
                                            <p className="text-[#AAAAAA] text-xs m-1">Recomendamos PNG transparente. Máx 2MB.</p>
                                        </div>
                                        <input type="file" accept="image/*" className="hidden"
                                            onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                                    </label>
                                )}
                            </div>

                            <div className="bg-surface rounded-2xl p-0 border-none">
                                <h3 className="font-display text-xl text-text mb-1">Dados Públicos do Ateliê</h3>
                                <p className="text-[#6B6B6B] text-sm font-ui mb-4">Usados em contatos e recibos dos orçamentos.</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div className="sm:col-span-2 space-y-2">
                                        <Label>Nome do Ateliê</Label>
                                        <Input value={atelieNome} onChange={e => setAtelieNome(e.target.value)}
                                            placeholder="Ex: Arte & Linhas" className="rounded-xl h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp</Label>
                                        <Input value={atelieWhatsapp} onChange={e => setAtelieWhatsapp(e.target.value)}
                                            placeholder="(00) 00000-0000" className="rounded-xl h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>E-mail (Público)</Label>
                                        <Input value={atelieEmail} onChange={e => setAtelieEmail(e.target.value)}
                                            placeholder="contato@atelie.com" className="rounded-xl h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Instagram / Redes</Label>
                                        <Input value={atelieInstagram} onChange={e => setAtelieInstagram(e.target.value)}
                                            placeholder="@atelielinhas" className="rounded-xl h-11" />
                                    </div>
                                    <div className="space-y-2 mt-4 sm:mt-0 opacity-0 hidden sm:block"></div>
                                    <div className="space-y-2">
                                        <Label>Cidade</Label>
                                        <Input value={atelieCidade} onChange={e => setAtelieCidade(e.target.value)}
                                            placeholder="Belo Horizonte" className="rounded-xl h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado (UF)</Label>
                                        <Input value={atelieEstado} onChange={e => setAtelieEstado(e.target.value)}
                                            placeholder="Minas Gerais" className="rounded-xl h-11" />
                                    </div>
                                </div>

                                <Button onClick={handleSaveAtelie} className="mt-8 rounded-full px-8 bg-primary hover:bg-primary-dark">
                                    Salvar Configurações
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="subscription" className="space-y-8 animate-in fade-in">
                        <div className="bg-gradient-to-br from-surface-warm to-background rounded-2xl p-6 sm:p-8 border border-border flex flex-col items-center justify-between gap-6">
                            {profile?.plan === 'premium' && profile?.asaas_subscription_id && (
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 w-full">
                                    <div>
                                        <h3 className="font-display text-2xl text-text mb-2">Plano Atual: Premium</h3>
                                        <p className="font-ui text-text-light">
                                            Assinatura ativa. Próximo ciclo / vencimento: <strong>{profile?.premium_expires_at ? new Date(profile.premium_expires_at).toLocaleDateString('pt-BR') : 'Data não disponível'}</strong>.
                                        </p>
                                    </div>
                                    <div>
                                        <Button onClick={() => setShowCancelModal(true)} variant="outline" className="rounded-full text-warn border-warn/30 hover:bg-warn/10 hover:text-warn">
                                            Cancelar Assinatura
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {profile?.plan === 'premium' && !profile?.asaas_subscription_id && (
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 w-full border-2 border-amber-500/50 bg-amber-500/5 rounded-2xl p-6">
                                    <div className="flex-1">
                                        <h3 className="font-display text-2xl text-text mb-2 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" /> Plano Premium — Cancelado
                                        </h3>
                                        <p className="font-ui text-text-light">
                                            Sua assinatura foi cancelada. Você tem acesso ao Premium até <strong>{profile?.premium_expires_at ? new Date(profile.premium_expires_at).toLocaleDateString('pt-BR') : 'Data não disponível'}</strong>. Após essa data seu plano voltará para o gratuito automaticamente.
                                        </p>
                                        <p className="text-[#6B6B6B] text-sm mt-1">Nenhuma cobrança futura será realizada.</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <Button onClick={() => navigate('/dashboard/assinar')} className="rounded-full bg-accent hover:bg-accent-light text-white shadow-sm px-8 h-12 text-base">
                                            Reativar Assinatura
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {profile?.plan !== 'premium' && (
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 w-full">
                                    <div>
                                        <h3 className="font-display text-2xl text-text mb-2">Plano Atual: Gratuito</h3>
                                        <p className="font-ui text-text-light">Faça upgrade para desbloquear todas as funcionalidades.</p>
                                    </div>
                                    <div>
                                        <Button onClick={() => navigate('/dashboard/assinar')} className="rounded-full bg-accent hover:bg-accent-light text-white shadow-sm px-8 h-12 text-base">
                                            Fazer Upgrade
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="font-display text-xl text-text mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-text-muted" /> Histórico de Faturas
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border/50 text-text-muted font-ui text-sm">
                                            <th className="pb-3 font-medium">Data</th>
                                            <th className="pb-3 font-medium">Plano</th>
                                            <th className="pb-3 font-medium">Valor</th>
                                            <th className="pb-3 font-medium text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm font-ui">
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-text-light">
                                                    Nenhuma fatura encontrada ainda.
                                                </td>
                                            </tr>
                                        ) : (
                                            history.map((item, i) => (
                                                <tr key={item.id ?? i} className="border-b border-border/30 hover:bg-surface-warm transition-colors">
                                                    <td className="py-4 text-text">{item.paid_at ? new Date(item.paid_at).toLocaleDateString('pt-BR') : '-'}</td>
                                                    <td className="py-4 text-text-light">Premium</td>
                                                    <td className="py-4 text-text font-medium">R$ {Number(item.value).toFixed(2).replace('.', ',')}</td>
                                                    <td className="py-4 text-right">
                                                        <Badge variant="outline" className={item.status === 'confirmed' ? 'text-[#16A34A] border-[#16A34A] bg-[#16A34A]/5' : 'text-[#DC2626] border-[#DC2626] bg-[#DC2626]/5'}>
                                                            {item.status === 'confirmed' ? 'Pago' : item.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>

            <UpgradeModal open={false} onOpenChange={() => { }} />

            <Dialog open={showCancelModal} onOpenChange={!canceling ? setShowCancelModal : undefined}>
                <DialogContent className="sm:max-w-md bg-surface-warm border border-border-light shadow-xl rounded-3xl">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-center font-display text-2xl text-text">Deseja realmente cancelar?</DialogTitle>
                        <DialogDescription className="text-center font-ui text-text-light pt-2">
                            Ao cancelar sua assinatura Premium, você <strong>perderá o acesso imediato</strong> aos recursos avançados, como o Gerador de Bordados Coloridos, CRM e Precificação automatizada.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 sm:justify-center border-t border-border mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCancelModal(false)}
                            disabled={canceling}
                            className="w-full sm:w-auto rounded-full font-ui text-text-light border-border-light hover:bg-surface hover:text-text h-11"
                        >
                            Manter Assinatura Ativa
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={canceling}
                            className="w-full sm:w-auto rounded-full font-ui h-11"
                        >
                            {canceling ? 'Cancelando...' : 'Sim, quero Cancelar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
