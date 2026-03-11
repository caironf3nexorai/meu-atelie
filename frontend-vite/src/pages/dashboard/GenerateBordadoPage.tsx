
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Type, Upload, ArrowRight, ArrowLeft, Loader2, Download, AlertCircle, ShoppingBag, Palette, Sparkles, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function BordadoColoridoPage() {
    const supabase = createClient();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);

    // Etapa 1
    const [descricao, setDescricao] = useState('');
    const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
    const [referenceImageMediaType, setReferenceImageMediaType] = useState<string | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Etapa 2
    const [nomeTexto, setNomeTexto] = useState('');
    const [ocasiao, setOcasiao] = useState<string | null>(null);
    const [formato, setFormato] = useState('redondo');

    // Etapa 3
    const [coresSelecionadas, setCoresSelecionadas] = useState<string[]>([]);
    const [coresDescricao, setCoresDescricao] = useState('');

    // Estado Geral e Etapa 4
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImg, setResultImg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [needsCredits, setNeedsCredits] = useState(false);

    // Dicas colapsáveis
    const [dicasAbertas, setDicasAbertas] = useState(() => {
        return localStorage.getItem('dicas-gerador-fechadas') !== 'true';
    });

    const toggleDicas = () => {
        const novoEstado = !dicasAbertas;
        setDicasAbertas(novoEstado);
        if (!novoEstado) {
            localStorage.setItem('dicas-gerador-fechadas', 'true');
        } else {
            localStorage.removeItem('dicas-gerador-fechadas');
        }
    };

    const OCASIOES = [
        { label: 'Dia das Mães', emoji: '🌸' },
        { label: 'Casamento', emoji: '💍' },
        { label: 'Bebê', emoji: '👶' },
        { label: 'Aniversário', emoji: '🎂' },
        { label: 'Decoração', emoji: '🏠' },
        { label: 'Presente', emoji: '🎁' },
        { label: 'Religioso', emoji: '✝️' },
        { label: 'Livre / Sem ocasião', emoji: '✨' },
    ];

    const CORES = [
        { id: 'Rosa', color: '#ffb3ba' },
        { id: 'Azul', color: '#bae1ff' },
        { id: 'Verde', color: '#baffc9' },
        { id: 'Vermelho', color: '#ff7b7b' },
        { id: 'Amarelo', color: '#ffffba' },
        { id: 'Neutros / Creme', color: '#f5f5dc' },
        { id: 'Lilás', color: '#e6b3ff' },
        { id: 'Laranja', color: '#ffd1b3' },
        { id: 'Dourado', color: '#ffd700' },
        { id: 'Preto e Branco', color: '#e0e0e0' },
    ];

    const toggleCor = (id: string) => {
        if (coresSelecionadas.includes(id)) {
            setCoresSelecionadas(coresSelecionadas.filter(c => c !== id));
        } else {
            setCoresSelecionadas([...coresSelecionadas, id]);
        }
    };

    // Função de Imagem Redimensionada via Canvas
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        setImagePreviewUrl(url);
        setReferenceImageMediaType(file.type);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL(file.type, 0.8);
                const base64Data = dataUrl.split(',')[1];
                setReferenceImageBase64(base64Data);
            }
        };
        img.src = url;
    };

    const validateStep1 = () => descricao.length >= 10 && descricao.length <= 500;

    const handleGenerate = async () => {
        setErrorMsg('');
        setIsGenerating(true);
        setNeedsCredits(false);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setErrorMsg('Você precisa estar logado para gerar bordados.');
                setIsGenerating(false);
                return;
            }

            // Verifica as gerações
            const { data: prof } = await supabase.from('profiles').select('free_generations_used, extra_credits, plan, free_cycle_expires_at').eq('id', user.id).single();
            const { data: pConfig } = await supabase.from('plan_config').select('free_generations_limit').single();

            const cycleExpired = prof?.free_cycle_expires_at
                ? new Date(prof.free_cycle_expires_at) < new Date()
                : false;

            let monthlyAvailable = cycleExpired
                ? (pConfig?.free_generations_limit || 0)
                : (pConfig?.free_generations_limit || 0) - (prof?.free_generations_used || 0);

            // Bordado colorido Frontend block pra Free Plan monthly credits
            if (prof?.plan !== 'premium') {
                monthlyAvailable = 0;
            }

            const totalAvailable = prof?.plan === 'premium' ? 99999 : monthlyAvailable + (prof?.extra_credits || 0);

            if (totalAvailable <= 0) {
                setNeedsCredits(true);
                setIsGenerating(false);
                return;
            }

            const payloadBody = {
                tipo: 'bordado_colorido',
                formData: {
                    descricao,
                    nomeTexto: nomeTexto || null,
                    ocasiao: ocasiao || null,
                    formato,
                    coresSelecionadas,
                    coresDescricao: coresDescricao || null,
                    referenceImageBase64,
                    referenceImageMediaType
                }
            };

            const { data: { session } } = await supabase.auth.getSession();
            console.log('Token Bordado:', session?.access_token?.substring(0, 20) || 'NULO/INVÁLIDO');

            const { data, error: funcError } = await supabase.functions.invoke('gerar-bordado', {
                body: payloadBody
            });

            if (funcError || !data?.success) {
                if (data?.requiresUpgrade) {
                    setNeedsCredits(true);
                } else {
                    setErrorMsg(data?.error || 'Erro ao gerar bordado. Tente novamente.');
                }
                setIsGenerating(false);
                return;
            }

            setResultImg(data.imageUrl);
        } catch (err: any) {
            console.error(err);
            setErrorMsg('Falha na comunicação com o servidor. O crédito não foi descontado.');
        } finally {
            setIsGenerating(false);
        }
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    return (
        <div className="max-w-4xl mx-auto pb-12 px-4 sm:px-0">
            <div className="mb-8 relative">
                <Badge className="absolute -top-3 -right-2 bg-primary text-white border-0 z-10 shadow-sm">⚡ 1 Crédito</Badge>
                <h1 className="font-display text-2xl sm:text-4xl text-text mb-2">Gerar Bordado Colorido <span className="text-xl">✨</span></h1>
                <p className="font-ui text-text-light mb-6">Descreva sua ideia e nós criamos o risco perfeito, com pontos texturizados simulados em cores.</p>

                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-2 flex-1 rounded-full transition-all ${step >= i ? 'bg-primary shadow-[0_0_8px_rgba(201,123,132,0.4)]' : 'bg-primary-light/20'}`} />
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border-light shadow-sm">
                            <h2 className="font-display text-2xl text-text mb-6">O que você quer bordar?</h2>

                            <div className="space-y-6">
                                <div>
                                    <Textarea
                                        value={descricao}
                                        onChange={e => setDescricao(e.target.value)}
                                        placeholder="Descreva o bordado que você imagina... Ex: rosas com folhas ao redor de um coração, borboleta delicada com flores silvestres, mandala com pétalas..."
                                        maxLength={500}
                                        className="h-32 rounded-2xl p-4 text-base bg-surface-warm focus-visible:ring-primary shadow-inner resize-none font-ui"
                                    />
                                    <div className="text-right text-xs text-text-muted mt-2 font-ui">{descricao.length}/500</div>
                                </div>

                                <div>
                                    <label className="font-ui font-semibold text-text mb-2 block">Envie uma foto de referência (opcional)</label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-primary-light/50 bg-primary-light/5 hover:bg-primary-light/10 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                        />
                                        {imagePreviewUrl ? (
                                            <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-sm border border-border">
                                                <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-3 shadow-sm border border-border-light text-primary">
                                                    <Upload className="w-5 h-5" />
                                                </div>
                                                <p className="font-ui text-sm text-text-light text-center">
                                                    Toque para escolher uma foto<br />
                                                    <span className="text-xs text-text-muted">JPG ou PNG</span>
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    {imagePreviewUrl && (
                                        <div className="text-center mt-3">
                                            <Button variant="ghost" size="sm" onClick={() => { setImagePreviewUrl(null); setReferenceImageBase64(null); setReferenceImageMediaType(null); }}>Remover imagem</Button>
                                        </div>
                                    )}
                                </div>

                                {/* Card de Dicas */}
                                <div style={{ background: '#FDF8F0', border: '1px solid #C29A51', borderRadius: '16px', padding: '16px 20px', marginTop: '12px', marginBottom: '20px' }}>
                                    <button
                                        onClick={toggleDicas}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>✨</span>
                                            <span style={{ color: '#C29A51', fontWeight: 700, fontSize: '14px' }}>Dicas para o melhor resultado</span>
                                        </div>
                                        <ChevronDown style={{ color: '#C29A51', width: '16px', height: '16px', transform: dicasAbertas ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                                    </button>

                                    {dicasAbertas && (
                                        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '14px', marginTop: '1px' }}>✅</span>
                                                <div>
                                                    <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Seja específica na descrição</p>
                                                    <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Em vez de <em>"flor bonita"</em>, escreva <em>"rosa com pétalas abertas e folhas verdes, estilo delicado"</em>. Quanto mais detalhe, melhor o resultado.</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '14px', marginTop: '1px' }}>✅</span>
                                                <div>
                                                    <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Informe o estilo visual desejado</p>
                                                    <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Adicione palavras como: <em>minimalista, realista, geométrico, aquarela, vintage, infantil, floral.</em> Isso guia a IA para o resultado certo.</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '14px', marginTop: '1px' }}>✅</span>
                                                <div>
                                                    <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Mencione as cores que deseja</p>
                                                    <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Exemplo: <em>"tons de rosa e dourado"</em>, <em>"fundo branco com detalhes azul marinho"</em>, <em>"paleta terrosa"</em>. Cores influenciam muito no resultado final.</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '14px', marginTop: '1px' }}>⚠️</span>
                                                <div>
                                                    <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Evite descrições muito genéricas ou confusas</p>
                                                    <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Pedidos como <em>"algo bonito"</em>, <em>"desenho legal"</em> ou misturar muitos elementos sem contexto tendem a gerar resultados inesperados.</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: '14px', marginTop: '1px' }}>⚠️</span>
                                                <div>
                                                    <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Este gerador cria imagens de referência — não vetores prontos para máquina</p>
                                                    <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>O resultado é uma imagem colorida para inspiração e referência visual. Para bordado em máquina, será necessário digitalizar o design em software específico.</p>
                                                </div>
                                            </div>

                                            <div style={{ background: 'white', borderRadius: '10px', padding: '12px 14px', marginTop: '4px', border: '1px solid #E5D9CC' }}>
                                                <p style={{ color: '#AC5148', fontWeight: 700, fontSize: '12px', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>💡 Exemplos de descrições que funcionam bem</p>
                                                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                                                    <li style={{ color: '#6B6B6B', fontSize: '12px', lineHeight: 1.5 }}>"Borboleta monarca com asas abertas, estilo aquarela, tons laranja e preto"</li>
                                                    <li style={{ color: '#6B6B6B', fontSize: '12px', lineHeight: 1.5 }}>"Ramo de lavanda minimalista, flores roxas, caule fino, fundo branco"</li>
                                                    <li style={{ color: '#6B6B6B', fontSize: '12px', lineHeight: 1.5 }}>"Coelho sentado entre cogumelos, estilo infantil fofo, cores pastéis"</li>
                                                    <li style={{ color: '#6B6B6B', fontSize: '12px', lineHeight: 1.5 }}>"Mandala circular geométrica, linhas finas, azul e dourado, fundo branco"</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button disabled={!validateStep1()} onClick={nextStep} className="h-12 rounded-full px-8 bg-primary hover:bg-primary-dark w-full sm:w-auto">
                                        Próximo Passo <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border-light shadow-sm">
                            <h2 className="font-display text-2xl text-text mb-6">Personalização</h2>

                            <div className="space-y-8">
                                <div>
                                    <label className="flex items-center gap-2 font-ui font-semibold text-text mb-3">
                                        <Type className="w-5 h-5 text-primary" /> Texto para incluir no bordado (opcional)
                                    </label>
                                    <Input
                                        value={nomeTexto}
                                        onChange={e => setNomeTexto(e.target.value)}
                                        placeholder="Ex: Amor de Mãe, Ana & Pedro, 2024..."
                                        maxLength={50}
                                        className="h-12 rounded-xl text-base bg-surface-warm focus-visible:ring-primary shadow-inner font-ui"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 font-ui font-semibold text-text mb-3 block">
                                        <Sparkles className="w-5 h-5 text-accent" /> Para qual ocasião? <span className="text-text-muted text-sm font-normal">(opcional)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {OCASIOES.map(o => (
                                            <button
                                                key={o.label}
                                                onClick={() => setOcasiao(ocasiao === o.label ? null : o.label)}
                                                className={`px-4 py-2 rounded-full font-ui text-sm border transition-colors flex items-center gap-2 ${ocasiao === o.label ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border-light text-text-light hover:border-primary/40'}`}
                                            >
                                                <span>{o.emoji}</span> {o.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border-light">
                                    <label className="flex items-center gap-2 font-ui font-semibold text-text mb-3 block">
                                        <div className="inline-flex w-5 h-5 rounded-full border-2 border-primary items-center justify-center text-primary text-[10px] font-bold align-middle mr-1">O</div> Formato do bastidor <span className="text-primary text-sm ml-1">*</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'redondo', label: '⭕ Redondo' },
                                            { id: 'quadrado', label: '⬜ Quadrado' },
                                            { id: 'retangular', label: '📄 Retangular' },
                                            { id: 'sem_bastidor', label: '🔷 Sem bastidor' }
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setFormato(f.id)}
                                                className={`px-4 py-2 rounded-full font-ui text-sm border transition-colors flex items-center gap-2 ${formato === f.id ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border-light text-text-light hover:border-primary/40'}`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between pt-4 gap-3">
                                    <Button variant="ghost" onClick={prevStep} className="h-12 rounded-full px-6 text-text-light order-2 sm:order-1 w-full sm:w-auto"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
                                    <Button onClick={nextStep} className="h-12 rounded-full px-8 bg-primary hover:bg-primary-dark order-1 sm:order-2 w-full sm:w-auto">
                                        Cores do Bordado <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border-light shadow-sm">
                            <h2 className="font-display text-2xl text-text mb-6">Cores do seu bordado</h2>

                            <div className="space-y-8">
                                <div>
                                    <label className="flex items-center gap-2 font-ui font-semibold text-text mb-3 block">
                                        <Palette className="w-5 h-5 text-primary" /> Sugestões de Cores Base <span className="text-text-muted text-sm font-normal">(Múltipla escolha)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {CORES.map(c => {
                                            const isSelected = coresSelecionadas.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleCor(c.id)}
                                                    className={`px-4 py-2 rounded-full font-ui text-sm border transition-colors flex items-center gap-2 ${isSelected ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border-light text-text-light hover:border-primary/40'}`}
                                                >
                                                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
                                                    {c.id}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="font-ui font-semibold text-text mb-2 block">Quer detalhar as cores? <span className="text-text-muted text-sm font-normal">(opcional)</span></label>
                                    <Textarea
                                        value={coresDescricao}
                                        onChange={e => setCoresDescricao(e.target.value)}
                                        placeholder="Ex: tons pastel e delicados, cores vibrantes e alegres, evitar amarelo, tons vintage desbotados..."
                                        maxLength={200}
                                        className="h-24 rounded-2xl p-4 text-base bg-surface-warm focus-visible:ring-primary shadow-inner resize-none font-ui"
                                    />
                                    <div className="text-right text-xs text-text-muted mt-2 font-ui">{coresDescricao.length}/200</div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between pt-4 gap-3">
                                    <Button variant="ghost" onClick={prevStep} className="h-12 rounded-full px-6 text-text-light order-2 sm:order-1 w-full sm:w-auto"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
                                    <Button onClick={nextStep} className="h-12 rounded-full px-8 bg-primary hover:bg-primary-dark order-1 sm:order-2 w-full sm:w-auto">
                                        Resumo Final <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 4 && (
                    <motion.div key="step4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        {isGenerating ? (
                            <div className="bg-surface rounded-3xl p-10 md:p-16 border border-border-light shadow-sm text-center flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px]">
                                <div className="relative mb-8 text-primary">
                                    <div className="w-24 h-24 border-y-4 border-primary-light rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                </div>
                                <h2 className="font-display text-2xl text-text mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Tecendo sua arte...</h2>
                                <p className="font-ui text-text-light max-w-sm">Processando as instruções na nossa IA. Buscando a cartela de cores e simulando as texturas perfeitas.</p>
                            </div>
                        ) : resultImg ? (
                            <div className="bg-surface rounded-3xl border border-border-light shadow-lg flex flex-col md:flex-row overflow-hidden">
                                <div className="md:w-1/2 bg-surface-warm/50 p-8 flex items-center justify-center border-r border-border-light">
                                    <div className="relative rounded-full border-[10px] border-[#DEB887] shadow-xl w-48 h-48 md:w-64 md:h-64 overflow-hidden bg-white">
                                        <img src={resultImg} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 shadow-inner rounded-full pointer-events-none" />
                                    </div>
                                </div>
                                <div className="md:w-1/2 p-8 flex flex-col justify-center bg-white space-y-6">
                                    <div>
                                        <Badge className="bg-primary/10 text-primary border-0 mb-2">Perfeito!</Badge>
                                        <h2 className="font-display text-3xl text-text">Bordado Gerado</h2>
                                        <p className="font-ui text-text-light text-sm mt-2">Pronto para ir para o bastidor! Baixe agora seu projeto com alta qualidade para transferir pro tecido.</p>
                                    </div>
                                    <div className="space-y-3 pt-4 border-t border-border-light">
                                        <Button onClick={async () => {
                                            if (!resultImg) return;
                                            const response = await fetch(resultImg);
                                            const blob = await response.blob();
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `bordado-colorido-suelen.png`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary-dark shadow-md text-base justify-between px-6 mb-3">
                                            Baixar Imagem (PNG) <Download className="w-5 h-5" />
                                        </Button>
                                        <Button variant="outline" className="w-full h-12 rounded-2xl border-border text-text hover:bg-surface-warm" onClick={() => { setStep(1); setResultImg(null); setDescricao(''); setReferenceImageBase64(null); setImagePreviewUrl(null); }}>
                                            Criar Novo <Wand2 className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border-light shadow-sm">
                                <h2 className="font-display text-2xl text-text mb-6">Pronto para criar?</h2>

                                {errorMsg && (
                                    <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-start gap-3 border border-destructive/20 mb-6">
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <p>{errorMsg}</p>
                                    </div>
                                )}

                                <div className="space-y-6 mb-8 bg-surface-warm p-6 rounded-2xl border border-border-light">
                                    <div>
                                        <p className="font-semibold text-text text-sm">A Ideia</p>
                                        <p className="text-text-light text-sm mt-1">{descricao}</p>
                                    </div>

                                    {nomeTexto && (
                                        <div>
                                            <p className="font-semibold text-text text-sm">Frase / Texto</p>
                                            <p className="text-text-light text-sm mt-1">"{nomeTexto}"</p>
                                        </div>
                                    )}

                                    {ocasiao && (
                                        <div>
                                            <p className="font-semibold text-text text-sm">Ocasião</p>
                                            <p className="text-text-light text-sm mt-1">{ocasiao}</p>
                                        </div>
                                    )}

                                    {(coresSelecionadas.length > 0 || coresDescricao) && (
                                        <div>
                                            <p className="font-semibold text-text text-sm">Cores</p>
                                            {coresSelecionadas.length > 0 && (
                                                <p className="text-text-light text-sm mt-1">Base: {coresSelecionadas.join(', ')}</p>
                                            )}
                                            {coresDescricao && (
                                                <p className="text-text-light text-sm mt-1">{coresDescricao}</p>
                                            )}
                                        </div>
                                    )}

                                    {imagePreviewUrl && (
                                        <div>
                                            <p className="font-semibold text-text text-sm mb-2">Referência</p>
                                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-border opacity-80">
                                                <img src={imagePreviewUrl} className="w-full h-full object-cover" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {needsCredits ? (
                                    <div className="bg-warn/10 border border-warn/30 p-6 rounded-2xl mb-6 text-center">
                                        <h3 className="font-semibold text-warn mb-2 text-lg">Sem créditos suficientes</h3>
                                        <p className="text-sm text-warn-dark/80 mb-4 px-4">Seus créditos mensais acabaram e não há pacotes avulsos sobrando.</p>
                                        <Button onClick={() => navigate('/dashboard/loja')} className="bg-warn hover:bg-warn-dark text-white rounded-full px-8 h-12 shadow-sm">
                                            <ShoppingBag className="w-4 h-4 mr-2" /> Ir para Loja
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row justify-between pt-4 gap-3">
                                        <Button variant="ghost" onClick={prevStep} className="h-12 rounded-full px-6 text-text-light order-2 sm:order-1 w-full sm:w-auto"><ArrowLeft className="w-4 h-4 mr-2" /> Alterar Cores</Button>
                                        <Button onClick={handleGenerate} className="h-12 rounded-full px-8 bg-primary hover:bg-primary-dark order-1 sm:order-2 w-full sm:w-auto shadow-md">
                                            <Wand2 className="w-4 h-4 mr-2" /> Gerar meu bordado ✨
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
