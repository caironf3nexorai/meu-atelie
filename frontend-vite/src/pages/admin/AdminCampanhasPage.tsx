import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Target, Save, Link2, Copy, Check } from 'lucide-react';

interface CampaignConfig {
    id: string;
    general_trial_limit: number;
    general_trial_used: number;
    partner_trial_limit: number;
    partner_trial_used: number;
}

interface TrialStats {
    total_trials_initiated: number;
    total_conversions: number;
}

export default function AdminCampanhasPage() {
    const supabase = createClient();
    const { toast } = useToast();
    
    const [config, setConfig] = useState<CampaignConfig | null>(null);
    const [stats, setStats] = useState<TrialStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const [form, setForm] = useState({
        general_trial_limit: 50,
        partner_trial_limit: 50,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: configData, error: configError } = await supabase
                .from('campaign_config')
                .select('*')
                .limit(1)
                .single();
                
            if (configData) {
                setConfig(configData);
                setForm({
                    general_trial_limit: configData.general_trial_limit,
                    partner_trial_limit: configData.partner_trial_limit
                });
            }

            const { data: statsData } = await supabase
                .from('trial_stats_view')
                .select('total_trials_initiated, total_conversions')
                .limit(1)
                .single();

            if (statsData) {
                setStats(statsData as TrialStats);
            }
        } catch (error) {
            console.error('Error fetching campaign config', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('campaign_config')
                .update({
                    general_trial_limit: form.general_trial_limit,
                    partner_trial_limit: form.partner_trial_limit
                })
                .eq('id', config.id);

            if (error) throw error;
            
            toast({
                title: 'Sucesso',
                description: 'Configurações de campanha atualizadas.',
            });
            fetchData();
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}/cadastro?trial=true`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
            title: 'Link copiado!',
            description: 'Link de teste grátis copiado para a área de transferência.',
        });
    };

    if (loading) {
        return <div className="p-8 text-center text-[#7A6A5A]">Carregando campanhas...</div>;
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-[#1C1410] flex items-center gap-2">
                    <Target className="w-6 h-6 text-[#AC5148]" /> Campanhas e Benefícios
                </h1>
                <p className="text-[#7A6A5A]">Gerencie os limites da campanha de 15 dias gratuitos e acompanhe métricas de conversão.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-sm">
                    <h3 className="text-sm font-semibold text-[#7A6A5A] uppercase tracking-wider">Vagas Gerais (Uso)</h3>
                    <p className="text-3xl font-bold text-[#1C1410] mt-2">
                        {config?.general_trial_used} <span className="text-lg text-gray-400">/ {config?.general_trial_limit}</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-sm">
                    <h3 className="text-sm font-semibold text-[#7A6A5A] uppercase tracking-wider">Vagas Parceiras (Uso)</h3>
                    <p className="text-3xl font-bold text-[#1C1410] mt-2">
                        {config?.partner_trial_used} <span className="text-lg text-gray-400">/ {config?.partner_trial_limit}</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#AC5148]/30 shadow-sm bg-[#AC5148]/5">
                    <h3 className="text-sm font-semibold text-[#AC5148] uppercase tracking-wider">Total Iniciados</h3>
                    <p className="text-3xl font-bold text-[#AC5148] mt-2">{stats?.total_trials_initiated || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[#22c55e]/30 shadow-sm bg-[#22c55e]/5">
                    <h3 className="text-sm font-semibold text-[#15803d] uppercase tracking-wider">Conversões (Pagos)</h3>
                    <p className="text-3xl font-bold text-[#15803d] mt-2">{stats?.total_conversions || 0}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-black/10">
                    <h2 className="text-lg font-bold text-[#1C1410]">Configuração de Limites</h2>
                    <p className="text-sm text-[#7A6A5A]">Altere o número máximo de vagas gratuitas permitidas. Para liberar mais vagas, basta aumentar o limite.</p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-[#1C1410] mb-2">Limite de Vagas Gerais (Landing Page / Divulgação Própria)</label>
                            <input 
                                type="number" 
                                value={form.general_trial_limit}
                                onChange={e => setForm({...form, general_trial_limit: parseInt(e.target.value) || 0})}
                                className="w-full px-4 py-3 rounded-xl border border-black/20 focus:border-[#AC5148] focus:ring-1 focus:ring-[#AC5148] outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#1C1410] mb-2">Limite de Vagas para Parceiras (Divulgação Afiliadas)</label>
                            <input 
                                type="number" 
                                value={form.partner_trial_limit}
                                onChange={e => setForm({...form, partner_trial_limit: parseInt(e.target.value) || 0})}
                                className="w-full px-4 py-3 rounded-xl border border-black/20 focus:border-[#AC5148] focus:ring-1 focus:ring-[#AC5148] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-[#AC5148] text-white font-bold rounded-xl hover:bg-[#8A413A] transition-colors disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-black/10">
                    <h2 className="text-lg font-bold text-[#1C1410]">Link de Divulgação Geral</h2>
                    <p className="text-sm text-[#7A6A5A]">Use este link nas suas redes sociais. Ele consumirá as "Vagas Gerais".</p>
                </div>
                <div className="p-6 flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full bg-[#FAFAFA] border border-black/10 rounded-xl px-4 py-3 text-sm font-mono text-[#7A6A5A] truncate">
                        {window.location.origin}/cadastro?trial=true
                    </div>
                    <button 
                        onClick={handleCopyLink}
                        className="flex-shrink-0 flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[#F2E9DB] text-[#AC5148] font-bold rounded-xl hover:bg-[#E5D9CC] transition-colors"
                    >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        {copied ? 'Copiado!' : 'Copiar Link'}
                    </button>
                </div>
            </div>
        </div>
    );
}
