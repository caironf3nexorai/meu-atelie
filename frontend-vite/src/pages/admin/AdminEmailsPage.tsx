import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';
import { Button } from '@/components/ui/button';

export default function AdminEmailsPage() {
    const supabase = createClient();
    const { showAlert } = useModal();
    const [waitlistCount, setWaitlistCount] = useState(0);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [couponUses, setCouponUses] = useState(0);
    const [sending, setSending] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        // Buscar contagem da waitlist
        const { count: wlCount } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });
        setWaitlistCount(wlCount || 0);

        // Buscar usos do cupom
        const { data: couponData } = await supabase.from('coupons').select('current_uses').eq('code', 'FUNDADORA77').single();
        setCouponUses(couponData?.current_uses || 0);

        // Buscar campanhas disparadas
        const { data: campaignsData } = await supabase.from('email_campaigns').select('*').order('sent_at', { ascending: false });
        setCampaigns(campaignsData || []);
    };

    const handleDisparar = async () => {
        setSending(true);
        setSuccessMessage('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sem sessão');

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/disparar-email-inauguracao`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const data = await res.json();

            if (data.success) {
                setSuccessMessage(`Email de inauguração enviado para ${data.sent_count} leads na lista de espera!`);
                setShowConfirm(false);
                carregarDados();
            } else {
                showAlert('Erro', data.error || 'Falha ao disparar.');
            }
        } catch (error: any) {
            console.error('Erro no disparo:', error);
            showAlert('Erro', 'Erro de comunicação: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    // Card estatístico
    const StatCard = ({ label, value, color }: { label: string, value: string | number, color: string }) => (
        <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center justify-center">
            <span className="text-sm font-semibold text-text-light uppercase tracking-widest">{label}</span>
            <span className="text-4xl font-display font-bold mt-2" style={{ color }}>{value}</span>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h1 className="font-display text-4xl font-bold text-text flex items-center gap-3">
                    <Mail className="w-8 h-8 text-primary" />
                    Emails & Campanhas
                </h1>
                <p className="text-text-light mt-2">Dispare comunicações para sua lista de espera e acompanhe os resgates.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Na lista de espera" value={waitlistCount} color="#AC5148" />
                <StatCard label="Vagas Usadas" value={`${couponUses}/15`} color={couponUses >= 15 ? '#DC2626' : '#16A34A'} />
                <StatCard label="Vagas Restantes" value={15 - couponUses} color="#AC5148" />
            </div>

            <div className="bg-white rounded-2xl p-8 border shadow-sm">
                <h2 className="text-xl font-bold mb-4">Disparo de Correio</h2>

                {successMessage ? (
                    <div className="bg-green-50 border border-green-500/20 text-green-700 p-4 rounded-xl flex items-center gap-3 mb-6">
                        <CheckCircle2 className="w-6 h-6 shrink-0" />
                        <p className="font-medium">{successMessage}</p>
                    </div>
                ) : (
                    <div className="bg-orange-50/50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-start gap-3 mb-6">
                        <Info className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">Atenção antes de disparar</p>
                            <p>Esta ação enviará o email de "Inauguração Meu Ateliê - Vaga de Fundadora" para <strong>todos os {waitlistCount} contatos</strong> que estão cadastrados atualmente em sua Lista de Espera simultaneamente.</p>
                        </div>
                    </div>
                )}

                {!showConfirm ? (
                    <Button onClick={() => setShowConfirm(true)} disabled={sending || waitlistCount === 0} className="w-full md:w-auto h-12 px-8 rounded-xl font-bold bg-primary hover:bg-primary-dark text-white">
                        <Mail className="w-5 h-5 mr-2" />
                        Disparar Email de Inauguração
                    </Button>
                ) : (
                    <div className="bg-red-50 border border-red-200 p-6 rounded-xl">
                        <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" /> Confirmar disparo definitivo?
                        </h3>
                        <p className="text-red-700/80 mb-6 text-sm">Você está prestes a enviar o email para {waitlistCount} pessoas. Esta ação usará os créditos da API do Resend e não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <Button onClick={handleDisparar} disabled={sending} className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6">
                                {sending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Estou Ciente, Enviar Agora'}
                            </Button>
                            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={sending} className="h-11 px-6 border-red-200 text-red-700 hover:bg-red-100">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl p-8 border shadow-sm">
                <h2 className="text-xl font-bold mb-6">Histórico de Disparos</h2>
                {campaigns.length === 0 ? (
                    <p className="text-text-light text-center py-8">Nenhuma campanha enviada ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-text-light uppercase bg-background/50 border-b">
                                <tr>
                                    <th className="px-6 py-4 font-semibold rounded-tl-xl">Selo da Campanha</th>
                                    <th className="px-6 py-4 font-semibold">Envios com Sucesso</th>
                                    <th className="px-6 py-4 font-semibold rounded-tr-xl text-right">Data/Hora (UTC)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((c) => (
                                    <tr key={c.id} className="border-b last:border-0 hover:bg-background/20 transition-colors">
                                        <td className="px-6 py-4 font-medium text-text">{c.title}</td>
                                        <td className="px-6 py-4 text-green-600 font-bold">
                                            {c.sent_count} emails
                                        </td>
                                        <td className="px-6 py-4 text-right text-text-light">
                                            {new Date(c.sent_at).toLocaleString('pt-BR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
