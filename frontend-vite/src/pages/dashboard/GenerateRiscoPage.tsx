
import React, { useState, useEffect } from 'react';
import { UploadCloud, X, ArrowRight, Wand2, Download, RefreshCw, Scissors, Image as ImageIcon, AlertCircle, Loader2, ChevronDown, Smile, Plus } from 'lucide-react';
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

    // Novos states para o Modo Texto guiado (3 etapas)
    const [textStep, setTextStep] = useState(1);
    const [elementos, setElementos] = useState<{ nome: string; posicao: string }[]>([{ nome: '', posicao: 'Centro' }]);
    const [textoRisco, setTextoRisco] = useState('');
    const [fonteSelecionada, setFonteSelecionada] = useState('Cursiva');
    const [ocasiao, setOcasiao] = useState('');
    const [formatoBastidor, setFormatoBastidor] = useState('Redondo');

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
                modo: modo
            };

            if (modo === 'imagem') {
                const { base64, type } = await resizeImage(file!);
                payloadFormData.imageBase64 = base64;
                payloadFormData.imageMediaType = type;
            } else {
                // Montagem do prompt final para o modo texto
                let styleText = 'linhas simples com poucos detalhes internos';
                if (style === 'detailed') styleText = 'com texturas, dobras e feições';
                if (style === 'outline') styleText = 'apenas silhueta externa sem detalhes internos';

                const elementosDesc = elementos
                    .filter(e => e.nome.trim().length > 0)
                    .map(e => `${e.nome.trim()} posicionado na região ${e.posicao.toLowerCase()}`)
                    .join('; ');

                let prompt = `Gere um risco de bordado em preto e branco, traços finos sobre fundo branco puro, SEM preenchimento, SEM sombreamento, SEM gradientes, SEM fotografias reais, APENAS linhas de contorno no estilo risco de bordado para transferência em tecido.\n\n`;
                prompt += `Estilo: ${styleText}.\n\n`;
                prompt += `Composição: ${elementosDesc}.`;
                
                if (textoRisco.trim()) {
                    prompt += ` texto "${textoRisco.trim()}" escrito em ${fonteSelecionada} integrado à composição.`;
                }
                
                prompt += `\n\nFormato: `;
                if (formatoBastidor === 'Redondo') prompt += 'composição dentro de um círculo simulando um bastidor redondo de bordado.';
                else if (formatoBastidor === 'Quadrado') prompt += 'dentro de um quadrado simulando bastidor quadrado.';
                else if (formatoBastidor === 'Retangular') prompt += 'dentro de um retângulo simulando bastidor retangular.';
                else prompt += 'composição livre sem moldura.';

                if (ocasiao) prompt += `\nTemática de ${ocasiao}.`;
                if (keepText) prompt += `\nPreservar contornos de letras e textos visíveis.`;
                if (isFaceless) prompt += `\nRemover completamente detalhes faciais (olhos, nariz, boca), manter apenas silhueta.`;

                prompt += `\n\nO resultado DEVE ser um risco de bordado vetorial, adequado para transferência em tecido. Nunca gere fotografias, bastidores de madeira reais ou imagens com fundo colorido.`;

                payloadFormData.descricao = prompt;
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
        a.download = `risco-bordado-${generationId || 'suelen'}.png`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <h1 className="font-display text-2xl sm:text-4xl text-text mb-4">Gerador de Risco</h1>
                
                {modo === 'imagem' ? (
                    <div className="flex items-center gap-4">
                        <Progress value={step * 33.33} className="h-2 bg-border-light [&>div]:bg-primary flex-1" />
                        <span className="text-sm font-ui text-text-muted whitespace-nowrap">Passo {step} de 3</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between relative mt-8 mb-4">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border-light -z-10 -translate-y-1/2 rounded-full"></div>
                        
                        {/* Linha de progresso preenchida */}
                        <div 
                            className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 rounded-full transition-all duration-300"
                            style={{ width: `${((step === 2 && modo === 'texto' ? 3 : textStep) - 1) / 2 * 100}%` }}
                        ></div>

                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => {
                                // Se for Step 3, permitimos voltar p texto
                                if (s < (step === 2 ? 3 : textStep)) {
                                    if (step === 2) setStep(1);
                                    setTextStep(s);
                                }
                            }}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors
                                    ${(step === 2 ? 3 : textStep) === s ? 'border-primary bg-primary text-white' : 
                                      s < (step === 2 ? 3 : textStep) ? 'border-primary bg-primary text-white' : 'border-border-light bg-surface text-text-muted'}`}>
                                    {s < (step === 2 ? 3 : textStep) ? '✓' : s}
                                </div>
                                <span className={`text-xs font-semibold ${(step === 2 ? 3 : textStep) >= s ? 'text-primary' : 'text-text-muted'}`}>
                                    {s === 1 ? 'Elementos' : s === 2 ? 'Personalização' : 'Estilo'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
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

                            {modo === 'texto' && textStep === 1 && (
                                <div className="animate-in fade-in text-left">
                                    <h2 className="font-display text-2xl text-text mb-2">O que você quer no risco?</h2>
                                    <p className="font-ui text-text-light mb-6">Adicione os elementos e escolha onde cada um aparece na composição.</p>
                                    
                                    <div className="space-y-4 mb-6">
                                        {elementos.map((el, index) => (
                                            <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                <input
                                                    type="text"
                                                    value={el.nome}
                                                    onChange={e => {
                                                        const newEls = [...elementos];
                                                        newEls[index].nome = e.target.value;
                                                        setElementos(newEls);
                                                        // Fallback do antigo descricao para não quebrar validação do disabled
                                                        setDescricao(newEls.map(x => x.nome).join(' ')); 
                                                    }}
                                                    placeholder="Ex: leão fofo, borboleta, coração..."
                                                    className="flex-1 p-3 rounded-xl border border-border-light bg-surface-warm/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-ui text-[15px]"
                                                />
                                                <div className="flex w-full sm:w-auto gap-2">
                                                    <select
                                                        value={el.posicao}
                                                        onChange={e => {
                                                            const newEls = [...elementos];
                                                            newEls[index].posicao = e.target.value;
                                                            setElementos(newEls);
                                                        }}
                                                        className="flex-1 sm:w-48 p-3 rounded-xl border border-border-light bg-surface-warm/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-ui text-[14px]"
                                                    >
                                                        <option value="Superior esquerdo">Superior esquerdo</option>
                                                        <option value="Superior centro">Superior centro</option>
                                                        <option value="Superior direito">Superior direito</option>
                                                        <option value="Centro esquerdo">Centro esquerdo</option>
                                                        <option value="Centro">Centro</option>
                                                        <option value="Centro direito">Centro direito</option>
                                                        <option value="Inferior esquerdo">Inferior esquerdo</option>
                                                        <option value="Inferior centro">Inferior centro</option>
                                                        <option value="Inferior direito">Inferior direito</option>
                                                    </select>
                                                    {elementos.length > 1 && (
                                                        <button 
                                                            onClick={() => {
                                                                const newEls = elementos.filter((_, i) => i !== index);
                                                                setElementos(newEls);
                                                                setDescricao(newEls.map(x => x.nome).join(' '));
                                                            }}
                                                            className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                                                            title="Remover elemento"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {elementos.length < 6 && (
                                        <button 
                                            onClick={() => setElementos([...elementos, { nome: '', posicao: 'Centro' }])}
                                            className="w-full py-3 border-2 border-dashed border-border text-text-muted hover:border-primary hover:text-primary rounded-xl transition-colors font-semibold flex items-center justify-center gap-2 text-sm mb-6"
                                        >
                                            <Plus className="w-4 h-4" /> Adicionar elemento
                                        </button>
                                    )}

                                    <p style={{ fontSize: '13px', color: '#6B6B6B', marginBottom: '12px', fontWeight: 500 }}>
                                        💡 Sugestões rápidas — clique para usar:
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {[
                                            'Leão fofo sentado', 
                                            'Borboleta com flores', 
                                            'Coelho com laço', 
                                            'Girassol com folhas', 
                                            'Balão de ar quente', 
                                            'Coroa com estrelas', 
                                            'Tenda de circo', 
                                            'Flamingo delicado'
                                        ].map(sugestao => (
                                            <button
                                                key={sugestao}
                                                onClick={() => {
                                                    const newEls = [...elementos];
                                                    const emptyIndex = newEls.findIndex(e => e.nome.trim() === '');
                                                    if (emptyIndex !== -1) {
                                                        newEls[emptyIndex].nome = sugestao;
                                                    } else if (newEls.length < 6) {
                                                        newEls.push({ nome: sugestao, posicao: 'Centro' });
                                                    }
                                                    setElementos(newEls);
                                                    setDescricao(newEls.map(x => x.nome).join(' '));
                                                }}
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
                                    
                                    <div className="flex justify-end mt-8 border-t border-border-light pt-6">
                                        <Button 
                                            disabled={!elementos.some(e => e.nome.trim().length > 0)} 
                                            onClick={() => setTextStep(2)} 
                                            className="rounded-full px-8 bg-primary hover:bg-primary-dark shadow-md text-base h-12"
                                        >
                                            Personalização <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {modo === 'texto' && textStep === 2 && (
                                <div className="animate-in fade-in text-left">
                                    <h2 className="font-display text-2xl text-text mb-2">Personalização</h2>
                                    <p className="font-ui text-text-light mb-6">Textos, temáticas especiais e formato do bastidor.</p>

                                    <div className="mb-8">
                                        <label style={{ fontWeight: 600, fontSize: '15px', color: '#1A1A1A', display: 'block', marginBottom: '8px' }}>
                                            Texto para incluir no risco (opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={textoRisco}
                                            onChange={e => setTextoRisco(e.target.value)}
                                            placeholder="Ex: Feliz Aniversário, Ana 1 Ano..."
                                            className="w-full p-4 rounded-xl border border-border-light bg-surface-warm/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 font-ui text-[15px]"
                                        />
                                        
                                        {textoRisco.trim().length > 0 && (
                                            <div className="mt-4 animate-in fade-in">
                                                <label style={{ fontSize: '14px', color: '#6B6B6B', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                                                    Estilo da Fonte:
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Cursiva', 'Script', 'Bastão', 'Serifada'].map(fonte => (
                                                        <button
                                                            key={fonte}
                                                            onClick={() => setFonteSelecionada(fonte)}
                                                            className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                                                                fonteSelecionada === fonte 
                                                                ? 'border-primary bg-primary/10 text-primary' 
                                                                : 'border-border-light bg-white text-text hover:border-primary-light'
                                                            }`}
                                                        >
                                                            {fonte}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-8">
                                        <label style={{ fontWeight: 600, fontSize: '15px', color: '#1A1A1A', display: 'block', marginBottom: '8px' }}>
                                            Ocasião (opcional)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Dia das Mães', 'Casamento', 'Bebê', 'Aniversário', 'Decoração', 'Presente', 'Religioso', 'Livre / Sem ocasião'].map(oc => (
                                                <button
                                                    key={oc}
                                                    onClick={() => setOcasiao(oc === ocasiao ? '' : oc)}
                                                    className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                                                        ocasiao === oc 
                                                        ? 'border-primary bg-primary/10 text-primary' 
                                                        : 'border-border-light bg-white text-text hover:border-primary-light'
                                                    }`}
                                                >
                                                    {oc}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mb-8">
                                        <label style={{ fontWeight: 600, fontSize: '15px', color: '#1A1A1A', display: 'block', marginBottom: '8px' }}>
                                            Formato do risco / bastidor
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                { id: 'Redondo', label: 'Redondo' },
                                                { id: 'Quadrado', label: 'Quadrado' },
                                                { id: 'Retangular', label: 'Retangular' },
                                                { id: 'Sem bastidor', label: 'Sem bastidor' }
                                            ].map(formato => (
                                                <div
                                                    key={formato.id}
                                                    onClick={() => setFormatoBastidor(formato.id)}
                                                    className={`p-3 rounded-xl border-2 text-center cursor-pointer transition-colors ${
                                                        formatoBastidor === formato.id 
                                                        ? 'border-primary bg-primary/5 text-primary font-semibold' 
                                                        : 'border-border-light bg-surface hover:border-primary-light text-text'
                                                    }`}
                                                >
                                                    <span className="text-sm">{formato.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 border-t border-border-light pt-6">
                                        <button 
                                            onClick={() => setTextStep(1)}
                                            className="text-text-muted hover:text-text font-medium text-sm flex items-center"
                                        >
                                            ← Voltar
                                        </button>
                                        <Button 
                                            onClick={() => setStep(2)} 
                                            className="rounded-full px-8 bg-primary hover:bg-primary-dark shadow-md text-base h-12"
                                        >
                                            Estilo do Risco <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {modo === 'imagem' && (
                                <div className="flex justify-end mt-8 border-t border-border-light pt-6">
                                    <Button disabled={!filePreview} onClick={() => setStep(2)} className="rounded-full px-8 bg-primary hover:bg-primary-dark shadow-md text-base h-12">
                                        Próximo <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            )}
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
                                                <p style={{ color: '#1A1A1A', fontWeight: 600, fontSize: '13px', margin: 0 }}>Evite sombras intensas</p>
                                                <p style={{ color: '#6B6B6B', fontSize: '13px', margin: '2px 0 0', lineHeight: 1.5 }}>A IA tem dificuldade quando a imagem tem luz muito marcada (metade clara e metade escura). Prefira fotos tiradas em luz natural e uniforme.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-8 border-t border-border/50 pt-6 gap-4">
                                <Button variant="ghost" 
                                    onClick={() => {
                                        setStep(1);
                                        if (modo === 'texto') setTextStep(2); // Retorna ao step de formatação
                                    }}
                                    className="text-text-light hover:text-text rounded-full px-6 order-2 sm:order-1"
                                >
                                    Voltar
                                </Button>
                                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 order-1 sm:order-2">
                                    <span className="text-sm font-ui text-text-muted">Custo: <span className="font-semibold text-warn">1 Geração</span></span>
                                    <Button 
                                        disabled={isGenerating}
                                        onClick={handleGenerate}
                                        className="rounded-full px-8 bg-primary hover:bg-primary-dark shadow-md text-base h-12 w-full sm:w-auto relative overflow-hidden group"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                Gerando Arte...
                                            </>
                                        ) : (
                                            <>
                                                {modo === 'texto' ? 'Gerar Risco' : 'Gerar Risco Mágico'} <Wand2 className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform" />
                                            </>
                                        )}
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
