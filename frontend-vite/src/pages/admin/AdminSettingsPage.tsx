import React, { useEffect, useState } from 'react';
import { Settings2, Loader2, Image as ImageIcon, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

export default function AdminSettingsPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configId, setConfigId] = useState<string | null>(null);
    const [isPrelancamento, setIsPrelancamento] = useState(true);
    const [waitlistCount, setWaitlistCount] = useState(0);
    const [config, setConfig] = useState({
        platformName: 'Meu Ateliê',
        logoUrl: '',
        premiumPrice: 97,
        premiumDurationMonths: 1,
        freeLimit: 5,
        premiumLimit: '', // empty = unlimited
        geminiCostUSD: 0.039,
        usdRateBRL: 5.80
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);

    useEffect(() => {
        fetchConfigs();
    }, []);

    async function fetchConfigs() {
        setLoading(true);

        const { data: globalRef, error } = await supabase.from('plan_config').select('*').maybeSingle();

        if (globalRef) {
            setConfigId(globalRef.id);
        }

        setConfig({
            platformName: globalRef?.platform_name || 'Meu Ateliê',
            logoUrl: globalRef?.platform_logo_url || '',
            premiumPrice: globalRef?.premium_price_brl ?? 97,
            premiumDurationMonths: globalRef?.premium_duration_months ?? 1,
            freeLimit: globalRef?.free_generations_limit ?? 3,
            premiumLimit: globalRef?.premium_generations_limit?.toString() ?? '',
            geminiCostUSD: globalRef?.gemini_cost_per_generation_usd ?? 0.039,
            usdRateBRL: globalRef?.usd_to_brl_rate ?? 5.80,
        });

        setIsPrelancamento(globalRef?.prelancamento ?? true);

        // Buscar total da lista de espera
        const { count } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });
        setWaitlistCount(count || 0);

        setLoading(false);
    }

    const togglePrelancamento = async () => {
        if (!configId) return;
        const novoValor = !isPrelancamento;
        await supabase
            .from('plan_config')
            .update({ prelancamento: novoValor })
            .eq('id', configId);

        setIsPrelancamento(novoValor);
        toast({
            title: novoValor ? "Modo pré-lançamento ativado" : "🚀 Plataforma aberta ao público!",
            description: novoValor ? "A página principal agora exibirá a lista de espera." : "Usuários já podem criar contas livremente.",
        });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Converte para base64 (data URL) — permanente, sem depender de bucket
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setLogoFile(file);
            setConfig(prev => ({ ...prev, logoUrl: dataUrl }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            // Usar base64 diretamente — já foi convertido no handleLogoChange
            // Sem necessidade de bucket de storage
            const finalLogoUrl = config.logoUrl;

            const payload = {
                premium_price_brl: Number(config.premiumPrice),
                premium_duration_months: Number(config.premiumDurationMonths),
                free_generations_limit: Number(config.freeLimit),
                premium_generations_limit: config.premiumLimit !== '' ? Number(config.premiumLimit) : null,
                platform_name: config.platformName,
                platform_logo_url: finalLogoUrl,
                gemini_cost_per_generation_usd: Number(config.geminiCostUSD),
                usd_to_brl_rate: Number(config.usdRateBRL),
                // prelancamento é manipulado localmente via toggle, não no save principal
            };

            let saveError: any = null;

            if (configId) {
                // UPDATE por ID
                const { error } = await supabase
                    .from('plan_config')
                    .update(payload)
                    .eq('id', configId);
                saveError = error;
            } else {
                // UPSERT — cria se nao existir
                const { error, data: upserted } = await supabase
                    .from('plan_config')
                    .upsert({ ...payload })
                    .select('id')
                    .single();
                saveError = error;
                if (upserted) setConfigId(upserted.id);
            }

            if (saveError) {
                throw new Error(saveError.message || 'Erro desconhecido do banco de dados.');
            }

            // Sucesso — recarrega do banco e notifica o contexto global
            await fetchConfigs();
            window.dispatchEvent(new Event('platform-config-updated'));

            toast({
                title: "Configurações salvas com sucesso!",
                description: "As alterações já estão ativas na plataforma.",
            });
        } catch (error: any) {
            toast({
                title: "Falha ao Salvar",
                description: error.message || 'Verifique as permissões e tente novamente.',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-16">
            <div>
                <h1 className="font-display text-2xl sm:text-4xl text-text mb-2">Configurações Gerais</h1>
                <p className="font-ui text-text-light text-base">Controle a identidade visual e as regras de limites limitantes dos planos.</p>
            </div>

            <div className="bg-white rounded-[2rem] border border-border-light shadow-sm overflow-hidden divide-y divide-border/50">

                {/* IDENTIDADE */}
                <section className="p-5 sm:p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="font-display text-2xl text-text">Identidade da Plataforma</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label className="text-sm font-bold text-text-muted uppercase tracking-wider">Nome da Plataforma</Label>
                            <Input
                                value={config.platformName}
                                onChange={e => setConfig({ ...config, platformName: e.target.value })}
                                className="h-12 border-border text-lg font-ui"
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-sm font-bold text-text-muted uppercase tracking-wider">Logotipo (URL / Upload)</Label>
                            <div className="flex items-center gap-4">
                                {config.logoUrl ? (
                                    <img src={config.logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                ) : (
                                    <div className="h-12 w-12 bg-surface-warm rounded flex items-center justify-center text-text-light text-xs font-ui">Vazio</div>
                                )}
                                <div className="flex-1">
                                    <Input type="file" accept="image/*" onChange={handleLogoChange} className="border-border text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer h-12 pt-2.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* PRÉ-LANÇAMENTO & WAITLIST */}
                <section className="p-5 sm:p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xl">🚀</span>
                        </div>
                        <h2 className="font-display text-2xl text-text">Lançamento e Recepção</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                        {/* TOGGLE PRÉ-LANÇAMENTO */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5D9CC' }}>
                            <h3 style={{ margin: '0 0 8px', color: '#1A1A1A', fontWeight: 600 }}>Modo Pré-lançamento</h3>
                            <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 16px', lineHeight: 1.5 }}>
                                Quando ativo, todos os botões da landing page direcionam para a lista de espera.
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button
                                    onClick={togglePrelancamento}
                                    style={{
                                        width: '52px', height: '28px', borderRadius: '999px', border: 'none',
                                        background: isPrelancamento ? '#AC5148' : '#E5D9CC',
                                        cursor: 'pointer', position: 'relative', transition: 'background 0.3s'
                                    }}
                                >
                                    <span style={{
                                        position: 'absolute', top: '4px',
                                        left: isPrelancamento ? '28px' : '4px',
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        background: 'white', transition: 'left 0.3s'
                                    }} />
                                </button>
                                <span style={{ color: '#1A1A1A', fontWeight: 500 }}>
                                    {isPrelancamento ? '🔒 Pré-lançamento ativo' : '🚀 Plataforma aberta'}
                                </span>
                            </div>
                        </div>

                        {/* CONTADOR DE WAITLIST */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E5D9CC', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <p style={{ fontSize: '48px', fontWeight: 700, color: '#AC5148', margin: 0, lineHeight: 1 }}>{waitlistCount}</p>
                            <p style={{ color: '#6B6B6B', marginTop: '8px', fontWeight: 500 }}>pessoas na lista de espera</p>
                        </div>
                    </div>
                </section>

                {/* LIMITES E PREÇOS */}
                <section className="p-5 sm:p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                            <Settings2 className="w-5 h-5 text-accent" />
                        </div>
                        <h2 className="font-display text-2xl text-text">Limites e Preços</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-border/50">
                            <Label className="text-xs font-bold text-text-muted uppercase tracking-wider">Preço Plano Premium (R$)</Label>
                            <Input
                                type="number" step="0.01"
                                value={config.premiumPrice}
                                onChange={e => setConfig({ ...config, premiumPrice: Number(e.target.value) })}
                                className="h-12 border-border font-ui font-medium bg-white"
                            />
                        </div>
                        <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-border/50">
                            <Label className="text-xs font-bold text-text-muted uppercase tracking-wider">Duração Premium (Meses)</Label>
                            <Input
                                type="number"
                                value={config.premiumDurationMonths}
                                onChange={e => setConfig({ ...config, premiumDurationMonths: Number(e.target.value) })}
                                className="h-12 border-border font-ui font-medium bg-white"
                            />
                        </div>
                        <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-border/50">
                            <Label className="text-xs font-bold text-text-muted uppercase tracking-wider">Gerações Mensais Mínimas (Free)</Label>
                            <Input
                                type="number"
                                value={config.freeLimit}
                                onChange={e => setConfig({ ...config, freeLimit: Number(e.target.value) })}
                                className="h-12 border-border font-ui font-medium bg-white"
                            />
                        </div>
                        <div className="space-y-3 bg-accent/5 p-4 rounded-2xl border border-accent/10">
                            <Label className="text-xs font-bold text-accent uppercase tracking-wider">Gerações Mensais (Premium)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={config.premiumLimit}
                                    placeholder="Deixe vazio para Ilimitado"
                                    onChange={e => setConfig({ ...config, premiumLimit: e.target.value })}
                                    className="h-12 border-accent/20 font-ui font-medium bg-white/80 backdrop-blur-sm pr-20"
                                />
                                {config.premiumLimit === '' && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary uppercase">Ilimitado</span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* CUSTOS DE IA (GEMINI) */}
                <section className="p-5 sm:p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Settings2 className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="font-display text-2xl text-text">Custos Operacionais e Cotação</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-border/50">
                            <Label className="text-xs font-bold text-text-muted uppercase tracking-wider">Custo Gemini 2.5 (USD por Ger.)</Label>
                            <Input
                                type="number" step="0.001"
                                value={config.geminiCostUSD}
                                onChange={e => setConfig({ ...config, geminiCostUSD: Number(e.target.value) })}
                                className="h-12 border-border font-ui font-medium bg-white"
                            />
                        </div>
                        <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-border/50">
                            <Label className="text-xs font-bold text-text-muted uppercase tracking-wider">Cotação Dólar (USD para BRL)</Label>
                            <Input
                                type="number" step="0.01"
                                value={config.usdRateBRL}
                                onChange={e => setConfig({ ...config, usdRateBRL: Number(e.target.value) })}
                                className="h-12 border-border font-ui font-medium bg-white"
                            />
                        </div>
                    </div>
                </section>

                <div className="p-5 sm:p-8 bg-surface-warm/30 flex justify-end">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button disabled={saving} className="bg-primary hover:bg-primary-dark text-white rounded-xl h-12 sm:h-14 px-6 sm:px-10 shadow-md font-semibold font-ui text-sm sm:text-lg transition-all active:scale-95 w-full sm:w-auto">
                                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><Save className="w-5 h-5 mr-2 sm:mr-3" /> <span className="hidden sm:inline">Salvar Configurações Globais</span><span className="sm:hidden">Salvar</span></>}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl bg-surface border-border-light">
                            <DialogHeader>
                                <DialogTitle className="font-display text-3xl text-text">Confirmar Alterações?</DialogTitle>
                                <DialogDescription className="font-ui text-text-light text-lg pt-4">
                                    Deseja realmente salvar as configurações da plataforma? Isto afetará as operações do sistema.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="pt-6">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="rounded-xl h-12 font-ui px-6">Cancelar</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button onClick={handleSave} className="bg-primary hover:bg-primary-dark text-white rounded-xl h-12 px-8 shadow-md font-semibold">Salvar Configurações</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

            </div>
        </div>
    );
}
