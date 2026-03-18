
import React, { useState, useEffect } from 'react';
import { UploadCloud, X, ArrowRight, Wand2, Download, RefreshCw, Scissors, Image as ImageIcon, AlertCircle, Loader2, ChevronDown, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { useModal } from '@/contexts/ModalContext';

export default function RiscoPage() {
    const { showAlert } = useModal();
    const [step, setStep] = useState(1);
    const [modo, setModo] = useState<'texto' | 'imagem'>('texto');
    const [descricao, setDescricao] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [style, setStyle] = useState('minimal');
    const [keepText, setKeepText] = useState(false);
    const [isFaceless, setIsFaceless] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImg, setResultImg] = useState<string | null>(null);
    const [generationId, setGenerationId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [imageExpiresAt, setImageExpiresAt] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [formato, setFormato] = useState<'redondo' | 'quadrado' | 'retangular' | 'sem_bastidor'>('sem_bastidor');

    // Dicas colapsáveis
    const [dicasRiscoAbertas, setDicasRiscoAbertas] = useState(() => {
        return localStorage.getItem('dicas-risco-fechadas') !== 'true';
    });

    const toggleDicasRisco = () => {
        const novoEstado = !dicasRiscoAbertas;
        setDicasRiscoAbertas(novoEstado);
        if (!novoEstado) {
            localStorage.setItem('dicas-risco-fechadas', 'true');
        } else {
            localStorage.removeItem('dicas-risco-fechadas');
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
        }
    };

    const handleFileSelected = (file: File) => {
        if (!file.type.startsWith('image/')) {
            showAlert('Formato Inválido', 'Por favor selecione uma imagem.');
            return;
        }
        setFile(file);
        const url = URL.createObjectURL(file);
        setFilePreview(url);
    };

    const removeFile = () => {
        setFile(null);
        if (filePreview) URL.revokeObjectURL(filePreview);
        setFilePreview(null);
    };

    const resizeImage = (file: File): Promise<{ base64: string, type: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max = 1024;

                    if (width > height) {
                        if (width > max) {
                            height *= max / width;
                            width = max;
                        }
                    } else {
                        if (height > max) {
                            width *= max / height;
                            height = max;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL(file.type);
                    const base64 = dataUrl.split(',')[1];
                    resolve({ base64, type: file.type });
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleGenerate = async () => {
        if (modo === 'imagem' && !file) return;
        if (modo === 'texto' && !descricao.trim()) return;

        setErrorMsg('');
        setIsGenerating(true);
        setStep(3);

        try {
            // 1. Verificar saldo antes
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setErrorMsg('Você precisa estar logado para gerar riscos.');
                setStep(2);
                setIsGenerating(false);
                return;
            }

            const { data: prof } = await supabase.from('profiles').select('free_generations_used, extra_credits, plan, free_cycle_expires_at').eq('id', user.id).single();
            const { data: pConfig } = await supabase.from('plan_config').select('free_generations_limit').single();

            const cycleExpired = prof?.free_cycle_expires_at
                ? new Date(prof.free_cycle_expires_at) < new Date()
                : false;

            const monthlyAvailable = cycleExpired
                ? (pConfig?.free_generations_limit || 0)
                : (pConfig?.free_generations_limit || 0) - (prof?.free_generations_used || 0);

            const totalAvailable = prof?.plan === 'premium' ? 99999 : monthlyAvailable + (prof?.extra_credits || 0);

            if (totalAvailable <= 0) {
                setShowUpgrade(true);
                setStep(2);
                setIsGenerating(false);
                return;
            }

            let payloadFormData: any = {
                style: style,
                includeText: keepText,
                isFaceless: isFaceless,
                modo: modo,
                formato: formato
            };

            if (modo === 'imagem') {
                const { base64, type } = await resizeImage(file!);
                payloadFormData.imageBase64 = base64;
                payloadFormData.imageMediaType = type;
            } else {
                payloadFormData.descricao = descricao;
            }

            const { data: { session } } = await supabase.auth.getSession();
            console.log('Token Risco:', session?.access_token?.substring(0, 20) || 'NENHUM TOKEN ENCONTRADO');

            // 3. Invocar Edge Function
            const { data, error: funcError } = await supabase.functions.invoke('gerar-bordado', {
                body: {
                    tipo: 'risco',
                    formData: payloadFormData
                }
            });

            if (funcError || !data?.success) {
                if (data?.requiresUpgrade) {
                    setShowUpgrade(true);
                    setStep(2);
                } else {
                    setErrorMsg(data?.error || 'Erro ao gerar risco. Tente novamente.');
                    setStep(2);
                }
                setIsGenerating(false);
                return;
            }

            setResultImg(data.imageUrl);
            setImageExpiresAt(data.imageExpiresAt);
            setGenerationId(data.generationId);
        } catch (err: any) {
            console.error(err);
            setErrorMsg('Falha na comunicação com o servidor. O crédito não foi descontado.');
            setStep(2);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (!imageExpiresAt) return;
        const interval = setInterval(() => {
            const diff = new Date(imageExpiresAt).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft('Expirado');
                clearInterval(interval);
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [imageExpiresAt]);

    const handleDownload = async () => {
        if (!resultImg) return;
        const response = await fetch(resultImg);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `risco-meuatelie.png`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <h1 className="font-display text-2xl sm:text-4xl text-text mb-4">Gerador de Risco</h1>
                <div className="flex items-center gap-4">
                    <Progress value={step * 33.33} className="h-2 bg-border-light [&>div]:bg-primary flex-1" />
                    <span className="text-sm font-ui text-text-muted whitespace-nowrap">Passo {step} de 3</span>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                        <div className="bg-surface rounded-3xl p-5 sm:p-8 border border-border-light shadow-sm text-center">

                            <div style={{ display: 'flex', gap: '8px', background: '#F2E9DB', padding: '6px', borderRadius: '14px', marginBottom: '24px' }}>
                                <button
                                    onClick={() => setModo('texto')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                                        background: modo === 'texto' ? '#AC5148' : 'transparent',
                                        color: modo === 'texto' ? 'white' : '#6B6B6B',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    ✍️ Descrever com texto
                                </button>
                                <button
                                    onClick={() => setModo('imagem')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                                        background: modo === 'imagem' ? '#AC5148' : 'transparent',
                                        color: modo === 'imagem' ? 'white' : '#6B6B6B',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    📷 Usar foto base
                                </button>
                            </div>

                            {modo === 'imagem' && (
                                <div className="animate-in fade-in">
                                    <h2 className="font-display text-2xl text-text mb-2">Envie sua imagem base</h2>
                                    <p style={{ color: '#6B6B6B', fontSize: '14px', marginBottom: '24px' }}>
                                        Envie uma foto de referência — pode ser uma foto que você achou,
                                        um bordado que você quer adaptar ou qualquer imagem de inspiração.
                                        A IA transforma em risco de bordado pronto para transferir.
                                    </p>

                                    {!filePreview ? (
                                        <div
                                            className="border-2 border-dashed border-primary-light/50 rounded-2xl p-12 hover:bg-surface-warm hover:border-primary transition-all cursor-pointer relative group"
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleDrop}
                                        >
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFileChange} />
                                            <div className="w-16 h-16 bg-primary-light/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                                <UploadCloud className="w-8 h-8" />
                                            </div>
                                            <p className="font-ui text-text font-medium text-lg">Clique ou arraste a imagem aqui</p>
                                            <p className="font-ui text-text-light text-sm mt-2">Formatos suportados: JPG, PNG (Max 5MB)</p>
                                        </div>
                                    ) : (
                                        <div className="relative rounded-2xl overflow-hidden border border-border max-w-sm mx-auto shadow-sm">
                                            <img src={filePreview} alt="Preview" className="w-full h-auto max-h-80 object-cover" />
                                            <button onClick={removeFile} className="absolute top-2 right-2 w-8 h-8 bg-surface/80 backdrop-blur-md rounded-full flex items-center justify-center text-text hover:text-warn transition-colors shadow-sm">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {modo === 'texto' && (
                                <div className="animate-in fade-in text-left">
                                    <label style={{ fontWeight: 600, fontSize: '15px', color: '#1A1A1A', display: 'block', marginBottom: '8px' }}>
                                        Descreva o risco que você quer gerar
                                    </label>
                                    <textarea
                                        value={descricao}
                                        onChange={e => setDescricao(e.target.value)}
                                        placeholder="Ex: Rosa com pétalas abertas e folhas, estilo delicado, traços finos..."
                                        rows={4}
                                        className="w-full p-4 rounded-2xl border border-border-light bg-surface-warm/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-ui text-[15px] resize-y mb-6"
                                    />

                                    <p style={{ fontSize: '13px', color: '#6B6B6B', marginBottom: '12px', fontWeight: 500 }}>
                                        💡 Sugestões rápidas — clique para usar:
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {[
                                            'Rosa com pétalas abertas',
                                            'Borboleta delicada',
                                            'Mandala circular flor',
                                            'Flor de girassol',
                                            'Folhas de eucalipto',
                                            'Coelho fofo com laço',
                                            'Coração com flores',
                                            'Porta maternidade fundo do mar',
                                        ].map(sugestao => (
                                            <button
                                                key={sugestao}
                                                onClick={() => setDescricao(sugestao)}
                                                style={{
                                                    background: 'white', border: '1px solid #E5D9CC', borderRadius: '999px',
                                                    padding: '8px 16px', fontSize: '13px', color: '#1A1A1A', cursor: 'pointer',
                                                    transition: 'border-color 0.2s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = '#AC5148'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = '#E5D9CC'}
                                            >
                                                {sugestao}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end mt-8 border-t border-border-light pt-6">
                                <Button disabled={(modo === 'imagem' && !filePreview) || (modo === 'texto' && !descricao.trim())} onClick={() => setStep(2)} className="rounded-full px-8 bg-primary hover:bg-primary-dark shadow-md text-base h-12">
                                    Próximo <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                        <div className="bg-surface rounded-3xl p-5 sm:p-8 border border-border-light shadow-sm">
                            <h2 className="font-display text-2xl text-text mb-2">Como você quer o risco?</h2>
                            <p className="font-ui text-text-light mb-6">Personalize o estilo das linhas para combinar com a sua técnica de bordado.</p>

                            {errorMsg && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20 mb-6">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <p>{errorMsg}</p>
                                </div>
                            )}

                            <div className="grid sm:grid-cols-3 gap-4 mb-8">
                                {[
                                    { id: 'minimal', icon: Scissors, label: 'Minimalista', desc: 'Linhas contínuas e simples. Silhueta com poucos detalhes internos — ideal para bordados rápidos e limpos.' },
                                    { id: 'detailed', icon: Wand2, label: 'Detalhado', desc: 'Linhas contínuas com texturas de cabelo, dobras de roupa e feições — para peças mais elaboradas.' },
                                    { id: 'outline', icon: ImageIcon, label: 'Contorno Limpo', desc: 'Apenas a silhueta externa definida — estilo coloring book limpo, perfeito para transferir ao tecido.' }
                                ].map((s) => (
                                    <div
                                        key={s.id}
                                        onClick={() => setStyle(s.id)}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${style === s.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border-light hover:border-primary-light/50'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${style === s.id ? 'bg-primary text-white' : 'bg-surface-warm text-text-light'}`}>
                                            <s.icon className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-ui font-semibold text-text mb-1">{s.label}</h3>
                                        <p className="font-ui text-sm text-text-light">{s.desc}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between p-4 bg-surface-warm rounded-2xl border border-border-light mb-8">
                                <div className="pr-4">
                                    <h4 className="font-ui font-medium text-text">Manter textos?</h4>
                                    <p className="font-ui text-sm text-text-light">Tenta recriar o contorno de eventuais letras e frases grandes na imagem.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={keepText} onChange={(e) => setKeepText(e.target.checked)} />
                                    <div className="w-11 h-6 bg-border-light peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-surface-warm rounded-2xl border border-border-light mb-8">
                                <div className="pr-4 flex items-start gap-3">
                                    <div className="mt-1 bg-surface rounded-full p-2 border border-border-light shadow-sm text-text-light">
                                        <Smile className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-ui font-medium text-text">Estilo Faceless (Sem Rosto)</h4>
                                        <p className="font-ui text-sm text-text-light">Remove completamente os detalhes faciais (olhos, nariz, boca). Foca apenas na silhueta e no cabelo. Muito usado em bordado moderno.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={isFaceless} onChange={(e) => setIsFaceless(e.target.checked)} />
                                    <div className="w-11 h-6 bg-border-light peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                </label>
                            </div>

                            {/* Seletor de formato */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontWeight: 700, fontSize: '13px', color: '#1A1A1A', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Formato do bastidor
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                    {[
                                        { id: 'redondo', label: 'Redondo', icon: '⭕', desc: 'Círculo guia ao redor' },
                                        { id: 'quadrado', label: 'Quadrado', icon: '⬜', desc: 'Quadrado guia ao redor' },
                                        { id: 'retangular', label: 'Retangular', icon: '▬', desc: 'Retângulo guia ao redor' },
                                        { id: 'sem_bastidor', label: 'Sem moldura', icon: '🖼️', desc: 'Risco limpo' },
                                    ].map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFormato(f.id as any)}
                                            style={{
                                                padding: '12px 8px', borderRadius: '12px',
                                                border: `2px solid ${formato === f.id ? '#AC5148' : '#E5D9CC'}`,
                                                background: formato === f.id ? '#FDF0EE' : 'white',
                                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{f.icon}</div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: formato === f.id ? '#AC5148' : '#6B6B6B' }}>
                                                {f.label}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#AAAAAA', marginTop: '2px' }}>
                                                {f.desc}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Card de Dicas para Risco */}
                            <div style={{ background: '#FDF8F0', border: '1px solid #C29A51', borderRadius: '16px', padding: '16px 20px', marginTop: '20px', marginBottom: '8px' }}>
                                <button
                                    onClick={toggleDicasRisco}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>✨</span>
                                        <span style={{ color: '#C29A51', fontWeight: 700, fontSize: '14px' }}>Dicas para o melhor resultado</span>
                                    </div>
                                    <ChevronDown style={{ color: '#C29A51', width: '16px', height: '16px', transform: dicasRiscoAbertas ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                                </button>

                                {dicasRiscoAbertas && (
                                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '14px', marginTop: '1px' }}>✂️</span>
                                            <div>
                                                <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Minimalista — linhas contínuas, poucos detalhes</p>
                                                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Gera um desenho limpo com linhas suaves e contínuas. Só silhueta e contornos essenciais. Ideal para <em>bordados rápidos</em>, presentes, e quando você quer simplicidade.</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '14px', marginTop: '1px' }}>🪄</span>
                                            <div>
                                                <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Detalhado — linhas contínuas com texturas</p>
                                                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Inclui fios de cabelo, dobras de roupa, feições faciais e detalhes. Linhas contínuas mas com mais estrutura interna. Para quem quer um <em>retrato mais fiel</em> e elaborado.</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '14px', marginTop: '1px' }}>🪡</span>
                                            <div>
                                                <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Contorno Limpo — traços contínuos e bem definidos</p>
                                                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Foca apenas em criar um delineado claro e definido, sem texturas internas confusas. Lembra um livro de colorir limpo, ideal para <em>transferir com facilidade ao pano</em>.</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '14px', marginTop: '1px' }}>👤</span>
                                            <div>
                                                <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Para retratos de pessoas</p>
                                                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>Use fotos com boa iluminação e contraste. O fundo da foto será removido automaticamente. Quanto mais nítida a foto, melhor o resultado.</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '14px', marginTop: '1px' }}>⚠️</span>
                                            <div>
                                                <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Evite fotos escuras, desfocadas ou com fundos poluídos</p>
                                                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>A IA remove o fundo, mas fotos com pouca luz ou muito desfoque podem gerar contornos imprecisos.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-8 border-t border-border/50 pt-6 gap-4">
                                <Button variant="ghost" onClick={() => setStep(1)} className="text-text-light hover:text-text rounded-full px-6 order-2 sm:order-1">
                                    Voltar
                                </Button>
                                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 order-1 sm:order-2">
                                    <span className="text-sm font-ui text-text-muted">Custo: <span className="font-semibold text-warn">1 Geração</span></span>
                                    <Button onClick={handleGenerate} className="rounded-full px-8 bg-primary hover:bg-primary-dark shadow-md text-base h-12 w-full sm:w-auto">
                                        Gerar Magia <Wand2 className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        {isGenerating ? (
                            <div className="bg-surface rounded-3xl p-8 sm:p-16 border border-border-light shadow-sm text-center flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px]">
                                <div className="relative mb-8">
                                    <div className="w-24 h-24 border-4 border-dashed border-primary-light rounded-full animate-[spin_4s_linear_infinite]" />
                                    <div className="absolute inset-0 flex items-center justify-center text-primary">
                                        <Wand2 className="w-8 h-8 animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="font-display text-2xl text-text mb-2 animate-pulse">A IA está desenhando seu risco...</h2>
                                <p className="font-ui text-text-light">Costurando cada detalhe com carinho. Pode levar uns segundinhos.</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-surface rounded-3xl p-4 sm:p-8 border border-border-light shadow-sm flex flex-col items-center text-center">
                                    <h2 className="font-display text-2xl text-text mb-6">Prontinho!</h2>
                                    <div className="relative rounded-2xl overflow-hidden shadow-md mb-6 bg-surface-warm p-2 border border-border w-full">
                                        {resultImg && <img src={resultImg} alt="Risco Gerado" className="w-full h-auto rounded-xl object-contain bg-white" />}
                                    </div>
                                    <div className="bg-warn/10 text-warn border border-warn/20 rounded-lg px-4 py-2 font-ui text-sm flex items-center justify-center w-full mb-6">
                                        <span className="relative flex h-2 w-2 mr-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warn opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-warn"></span>
                                        </span>
                                        Link de download expira em {timeLeft || '...'}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 justify-center">
                                    <Button onClick={handleDownload} className="h-14 rounded-2xl bg-primary hover:bg-primary-dark shadow-md text-lg w-full flex justify-between px-6">
                                        Baixar Risco (PNG) <Download className="w-5 h-5 ml-2" />
                                    </Button>
                                    <Button variant="outline" onClick={() => { setStep(1); setResultImg(null); removeFile(); setDescricao(''); }} className="h-14 rounded-2xl border-border hover:bg-surface-warm text-text text-base w-full flex justify-between px-6">
                                        Gerar Novo Risco <RefreshCw className="w-5 h-5 ml-2" />
                                    </Button>

                                    <div className="mt-8 bg-accent/5 border border-accent/20 rounded-2xl p-6">
                                        <h4 className="font-display text-lg text-text mb-2">✨ Quer ver em cores?</h4>
                                        <p className="font-ui text-text-light text-sm mb-4">Gere um bordado colorido a partir desta mesma ideia!</p>
                                        <Button variant="link" onClick={() => window.location.href = '/gerar/bordado-colorido'} className="text-accent hover:text-accent-light p-0 h-auto font-semibold">
                                            Gerar Bordado Colorido <ArrowRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>
    );
}
