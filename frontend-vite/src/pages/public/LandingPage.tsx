import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { usePlatform } from '@/contexts/PlatformContext';
import Lenis from '@studio-freight/lenis';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown } from 'lucide-react';

const primaryColor = '#AC5148';
const secondaryColor = '#F7E1D7';
const accentColor = '#C29A51';
const bgColor = '#F2E9DB';
const darkColor = '#1C1410';
const mutedColor = '#7A6A5A';

const useCountUp = (end: number, duration: number = 2000) => {
    const [count, setCount] = useState(0)
    const [started, setStarted] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started) {
                    setStarted(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.5 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [started])

    useEffect(() => {
        if (!started) return
        let startTime: number
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * end))
            if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }, [started, end, duration])

    return { count, ref }
}

interface BlurImageProps {
    src: string
    alt: string
    style?: React.CSSProperties
    placeholderColor?: string
}

const BlurImage: React.FC<BlurImageProps> = ({
    src, alt, style, placeholderColor = '#E5D9CC'
}) => {
    const [loaded, setLoaded] = useState(false)

    return (
        <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
            <div style={{
                position: 'absolute', inset: 0,
                background: placeholderColor,
                transition: 'opacity 0.6s ease',
                opacity: loaded ? 0 : 1,
                zIndex: 1
            }} />
            <img
                src={src}
                alt={alt}
                onLoad={() => setLoaded(true)}
                style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: loaded ? 'blur(0px)' : 'blur(12px)',
                    transform: loaded ? 'scale(1)' : 'scale(1.05)',
                    transition: 'filter 0.8s ease, transform 0.8s ease',
                    display: 'block'
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = `<div style="padding: 100px; text-align: center; color: #7A6A5A; background: ${placeholderColor};">[ Imagem Aqui ]</div>`; }}
            />
        </div>
    )
}

interface WordRevealProps {
    text: string
    className?: string
    style?: React.CSSProperties
    delay?: number
}

const WordReveal: React.FC<WordRevealProps> = ({ text, style, delay = 0 }) => {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setVisible(true), delay)
                    observer.disconnect()
                }
            },
            { threshold: 0.3 }
        )
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [delay])

    const words = text.split(' ')

    return (
        <div ref={ref} style={{ overflow: 'hidden', ...style }}>
            {words.map((word, i) => (
                <span
                    key={i}
                    style={{
                        display: 'inline-block',
                        marginRight: '0.25em',
                        transform: visible ? 'rotateX(0deg)' : 'rotateX(90deg)',
                        opacity: visible ? 1 : 0,
                        transition: `transform 0.6s ease, opacity 0.6s ease`,
                        transitionDelay: `${delay + i * 80}ms`,
                        transformOrigin: 'bottom center',
                    }}
                >
                    {word}
                </span>
            ))}
        </div>
    )
}

export default function LandingPage() {
    const { platformName, platformLogo } = usePlatform();
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
    const navigate = useNavigate();
    const supabase = createClient();

    const [planPrice, setPlanPrice] = useState(97);
    const [isPrelancamento, setIsPrelancamento] = useState(true);
    const [scrolled, setScrolled] = useState(false);

    const [waitlistName, setWaitlistName] = useState('');
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistLoading, setWaitlistLoading] = useState(false);
    const [waitlistSuccess, setWaitlistSuccess] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const handleWaitlistSubmit = async () => {
        if (!waitlistName || !waitlistEmail) return;
        setWaitlistLoading(true);
        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist-signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: waitlistName, email: waitlistEmail })
            });
            if (res.ok) setWaitlistSuccess(true);
        } catch (error) {
            console.error('Waitlist submit error:', error);
        } finally {
            setWaitlistLoading(false);
        }
    };

    const handleCTA = () => {
        if (isPrelancamento) {
            document.getElementById('lista-espera')?.scrollIntoView({ behavior: 'smooth' });
        } else {
            navigate('/cadastro');
        }
    };

    useEffect(() => {
        const fetchPlanConfig = async () => {
            const { data } = await supabase.from('plan_config').select('premium_price_brl, prelancamento').maybeSingle();
            if (data?.premium_price_brl) setPlanPrice(data.premium_price_brl);
            setIsPrelancamento(data?.prelancamento ?? true);
        };
        fetchPlanConfig();

        const channel = supabase
            .channel('plan_config_landing')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plan_config' }, (payload: any) => {
                if (payload.new.prelancamento !== undefined) setIsPrelancamento(payload.new.prelancamento);
                if (payload.new.premium_price_brl) setPlanPrice(payload.new.premium_price_brl);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase]);

    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.4,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        });
        lenisRef.current = lenis;

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        let resizeTimer: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            lenis.stop();
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                lenis.start();
            }, 200);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            lenis.destroy();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const sectionsRef = useRef<HTMLElement[]>([]);

    const updateSections = useCallback(() => {
        sectionsRef.current.forEach((section) => {
            if (!section) return;
            const rect = section.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            if (rect.top < windowHeight * 0.88) {
                section.style.opacity = '1';
                section.style.transform = 'translateY(0px)';
            }
        });
    }, []);

    useEffect(() => {
        sectionsRef.current.forEach((section) => {
            if (!section) return;
            section.style.opacity = '0';
            section.style.transform = 'translateY(40px)';
            section.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        });

        setTimeout(updateSections, 100);

        window.addEventListener('scroll', updateSections, { passive: true });
        return () => window.removeEventListener('scroll', updateSections);
    }, [updateSections]);

    const registerSection = (el: HTMLElement | null) => {
        if (el && !sectionsRef.current.includes(el)) {
            sectionsRef.current.push(el);
        }
    };

    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    const faqs = [
        { q: 'Preciso saber desenhar para usar?', a: 'Não! Você só descreve o que quer em palavras simples e a IA cria o desenho. Pode também enviar uma foto de referência.' },
        { q: 'Funciona no celular?', a: 'Sim, 100%. A plataforma foi desenvolvida pensando que a bordadeira está sempre com o celular ao lado.' },
        { q: 'Posso vender os bordados feitos com os riscos?', a: 'Sim! Os riscos gerados são seus. Você pode usar, adaptar e vender os bordados à vontade.' },
        { q: 'E se eu não gostar?', a: 'O plano gratuito não tem prazo — use para testar antes. Nenhum cartão necessário para começar.' },
        { q: 'Meus dados ficam seguros?', a: 'Totalmente. Utilizamos Supabase com criptografia de ponta a ponta e backups diários.' },
    ];

    const depoimento = {
        texto: "Antes eu desenhava meus riscos à mão. Hoje eu gero riscos lindos em menos de minuto, e posso focar todo o meu tempo apenas no que amo: bordar! O Meu Ateliê mudou minha forma de trabalhar.",
        nome: "Suelen Castro",
        cidade: "São Paulo, SP"
    };

    const tickerItems = [
        '✦ Riscos exclusivos com IA',
        '✦ Precificação inteligente',
        '✦ Orçamento com aprovação online',
        '✦ Consultora Lia 24h',
        '✦ Agenda de encomendas',
        '✦ Cronômetro de produção',
        '✦ Financeiro completo',
        '✦ 100% em português',
    ];

    const { count: countBordados, ref: refBordados } = useCountUp(500);
    const { count: countTempo, ref: refTempo } = useCountUp(30);
    const { count: countSatisfacao, ref: refSatisfacao } = useCountUp(100);

    return (
        <div style={{ backgroundColor: bgColor, fontFamily: 'Nunito, sans-serif', color: darkColor, overflowX: 'hidden' }}>
            <style>{`
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-12px); }
                }
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.35; }
                }
                @keyframes marquee {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
            `}</style>
            <motion.div className="fixed top-0 left-0 right-0 h-[3px] bg-[#AC5148] z-[9999] origin-left" style={{ scaleX }} />

            {/* SEÇÃO 1 — NAVBAR */}
            <header style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: scrolled ? 'rgba(242,233,219,0.92)' : 'transparent',
                backdropFilter: scrolled ? 'blur(16px)' : 'none',
                borderBottom: scrolled ? '1px solid rgba(229,217,204,0.6)' : 'none',
                transition: 'all 0.4s ease',
                padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <img src={platformLogo || '/logo.png'} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                </div>
                <div className="hidden md:flex gap-8">
                    <a href="#funcionalidades" style={{ color: mutedColor, textDecoration: 'none', fontWeight: 600 }}>Funcionalidades</a>
                    <a href="#como-funciona" style={{ color: mutedColor, textDecoration: 'none', fontWeight: 600 }}>Como Funciona</a>
                    <a href="#planos" style={{ color: mutedColor, textDecoration: 'none', fontWeight: 600 }}>Planos</a>
                    <a href="#perguntas" style={{ color: mutedColor, textDecoration: 'none', fontWeight: 600 }}>Perguntas</a>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    {!isPrelancamento && (
                        <Link to="/login" className="hidden sm:inline-block" style={{ color: primaryColor, fontWeight: 700, textDecoration: 'none', padding: '8px 16px', borderRadius: '12px', border: `2px solid ${primaryColor}` }}>Entrar</Link>
                    )}
                    <button onClick={handleCTA} style={{ background: primaryColor, color: 'white', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {isPrelancamento ? 'Garantir minha vaga' : 'Começar grátis'}
                    </button>
                </div>
            </header>

            {/* SEÇÃO 2 — HERO */}
            <section ref={registerSection} id="hero" style={{ paddingTop: '120px', paddingBottom: '60px', paddingLeft: '16px', paddingRight: '16px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                <div className="flex flex-col lg:flex-row items-center gap-12 w-full">
                    <div style={{ flex: 1 }}>
                        {isPrelancamento && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(172,81,72,0.08)', border: '1px solid rgba(172,81,72,0.25)',
                                borderRadius: '999px', padding: '6px 16px', marginBottom: '24px'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: primaryColor, animation: 'pulse 2s infinite', display: 'block' }} />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: primaryColor, letterSpacing: '0.5px' }}>
                                    PRÉ-LANÇAMENTO · 15 vagas com desconto
                                </span>
                            </div>
                        )}
                        <WordReveal
                            text="Da inspiração ao lucro, tudo em um só ateliê."
                            style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(36px, 5vw, 64px)', color: darkColor, lineHeight: 1.1, marginBottom: '20px' }}
                        />
                        <p style={{ fontSize: 'clamp(15px, 3.5vw, 20px)', color: mutedColor, lineHeight: 1.6, margin: '0 0 24px 0', maxWidth: '540px' }}>
                            Gere riscos exclusivos com IA em segundos, organize suas encomendas,
                            precifique com segurança e feche orçamentos sem sair do celular.
                            A plataforma que as bordadeiras brasileiras estavam esperando.
                        </p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <button onClick={handleCTA} style={{ background: primaryColor, color: 'white', padding: '14px 28px', borderRadius: '14px', fontWeight: 800, fontSize: 'clamp(14px, 3.5vw, 17px)', boxShadow: '0 8px 32px rgba(172,81,72,0.35)', border: 'none', cursor: 'pointer' }}>
                                {isPrelancamento ? 'Garantir minha vaga' : 'Começar grátis'}
                            </button>
                            <a href="#como-funciona" style={{ background: 'transparent', color: primaryColor, padding: '14px 20px', borderRadius: '14px', fontWeight: 700, fontSize: 'clamp(13px, 3.5vw, 16px)', border: `2px solid rgba(172,81,72,0.3)`, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                Ver como funciona →
                            </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '36px' }}>
                            <div style={{ display: 'flex' }}>
                                {['M', 'S', 'A', 'C', 'R'].map((inicial, i) => (
                                    <div key={i} style={{ width: '36px', height: '36px', borderRadius: '50%', background: [primaryColor, accentColor, '#8B6B5A', secondaryColor, primaryColor][i], border: '2px solid white', marginLeft: i > 0 ? '-10px' : '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '13px' }}>
                                        {inicial}
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: '14px', color: mutedColor, margin: 0 }}>
                                <strong style={{ color: darkColor }}>+500 bordadeiras</strong> já geraram riscos com a IA
                            </p>
                        </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative', width: '100%' }}>
                        <div className="hidden md:block" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', paddingTop: '120%', borderRadius: '50%', border: `1px solid ${secondaryColor}`, opacity: 0.5, zIndex: 0 }} />
                        <div style={{ animation: 'float 6s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
                            <BlurImage
                                src="/mockup-gerador.png"
                                alt="Plataforma Meu Ateliê"
                                style={{ width: '100%', objectFit: 'contain' }}
                                placeholderColor="transparent"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 3 — TICKER */}
            <div style={{ background: '#2D2D2D', color: 'white', padding: '20px 0', overflow: 'hidden', display: 'flex' }}>
                <div style={{ display: 'flex', animation: 'marquee 30s linear infinite' }}>
                    {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
                        <span key={i} style={{ whiteSpace: 'nowrap', padding: '0 32px', fontSize: '16px', fontWeight: 600 }}>{item}</span>
                    ))}
                </div>
            </div>

            {/* SEÇÃO 4 — O PROBLEMA */}
            <section ref={registerSection} id="problema" style={{ background: darkColor, padding: '60px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <span style={{ background: 'rgba(222,209,129,0.15)', color: secondaryColor, padding: '6px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Você se identifica?
                    </span>
                    <WordReveal
                        text="Chega de improvisar — seu ateliê merece mais"
                        style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 48px)', color: 'white', marginTop: '16px' }}
                        delay={100}
                    />
                </div>
                <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto relative pl-4 md:pl-0">
                    <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-[#C29A51] to-transparent opacity-40 transform -translate-x-1/2" />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontWeight: 800 }}>✕</div>
                            <span style={{ color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '13px' }}>Antes do Meu Ateliê</span>
                        </div>
                        {[
                            'Horas procurando risco no Pinterest sem encontrar o que quer',
                            'Pedido anotado num papel que some na hora H',
                            'Cobrando no achismo e descobrindo que trabalhou de graça',
                            'Cliente pergunta o prazo e você não sabe responder',
                            'Orçamento feito na calculadora do celular, na pressão',
                            'Fim do mês sem saber se teve lucro ou prejuízo',
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '20px', alignItems: 'flex-start' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginTop: '8px', flexShrink: 0 }} />
                                <p style={{ color: '#9CA3AF', margin: 0, lineHeight: 1.6, fontSize: '16px' }}>{item}</p>
                            </div>
                        ))}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 800 }}>✓</div>
                            <span style={{ color: secondaryColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '13px' }}>Com o Meu Ateliê</span>
                        </div>
                        {[
                            'Risco exclusivo criado por IA em 30 segundos, do seu jeito',
                            'Encomenda registrada com foto, cor, prazo e contato do cliente',
                            'Preço calculado com margem real — você sempre sai no lucro',
                            'Agenda com alertas automáticos — zero prazo esquecido',
                            'Orçamento profissional enviado por link, cliente aprova na hora',
                            'Financeiro completo mostrando exatamente quanto você ganhou',
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '20px', alignItems: 'flex-start' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', marginTop: '8px', flexShrink: 0 }} />
                                <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6, fontSize: '16px' }}>{item}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SEÇÃO 5 — GERADOR DE RISCOS */}
            <section ref={registerSection} id="gerador" style={{ background: bgColor, padding: '60px 16px' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
                    <div style={{ position: 'relative' }}>
                        <div style={{ background: 'white', borderRadius: '24px', boxShadow: '0 20px 60px rgba(28,20,16,0.12)', overflow: 'hidden', border: '1px solid #E5D9CC' }}>
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F2E9DB', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFD0CC' }} />
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFF0CC' }} />
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#D0FFD8' }} />
                                <span style={{ marginLeft: '12px', fontSize: '13px', color: mutedColor, fontWeight: 700 }}>Gerador de Riscos · Meu Ateliê</span>
                            </div>
                            <div style={{ padding: '24px', background: '#FAFAFA' }}>
                                <BlurImage
                                    src="/risco-exemplo.png"
                                    alt="Risco gerado pela IA"
                                    style={{ width: '100%', borderRadius: '12px' }}
                                    placeholderColor="#F2F2F2"
                                />
                            </div>
                            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', color: mutedColor, fontWeight: 700 }}>✨ Gerado em 28 segundos</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={{ background: bgColor, border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer', color: primaryColor, fontWeight: 800 }}>📥 Baixar</button>
                                    <button style={{ background: primaryColor, border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer', color: 'white', fontWeight: 800 }}>Gerar novo ✦</button>
                                </div>
                            </div>
                        </div>
                        <div className="hidden sm:block" style={{ position: 'absolute', top: '-20px', right: '-20px', background: primaryColor, color: 'white', borderRadius: '14px', padding: '12px 18px', boxShadow: '0 8px 24px rgba(172,81,72,0.4)', fontWeight: 800, fontSize: '13px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px' }}>🎨</div>
                            <div>Exclusivo</div>
                            <div style={{ opacity: 0.8, fontSize: '11px' }}>só seu</div>
                        </div>
                    </div>
                    <div>
                        <span style={{ background: 'rgba(172,81,72,0.1)', color: primaryColor, padding: '6px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 800 }}>
                            ✦ O diferencial que ninguém mais tem
                        </span>
                        <WordReveal
                            text="Risco exclusivo gerado por IA em 30 segundos"
                            style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 3.5vw, 44px)', color: darkColor, lineHeight: 1.2, margin: '20px 0 16px' }}
                            delay={150}
                        />
                        <p style={{ color: mutedColor, fontSize: '18px', lineHeight: 1.7, marginBottom: '32px' }}>
                            Descreva com palavras ou envie uma foto de referência. A IA cria um risco único, com traços segmentados no estilo de bordado à mão, pronto para transferir para o tecido.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
                            {[
                                { icon: '✍️', text: 'Descreva com texto: "rosa com folhas delicadas"' },
                                { icon: '📷', text: 'Ou envie uma foto de referência' },
                                { icon: '⚡', text: 'Risco pronto em menos de 30 segundos' },
                                { icon: '🔒', text: 'Cada geração é única — só sua' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                                    <span style={{ color: darkColor, fontSize: '16px', fontWeight: 600 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 6 — FUNCIONALIDADES GRADE */}
            <section ref={registerSection} id="funcionalidades" style={{ background: darkColor, padding: '60px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <span style={{ color: secondaryColor, fontSize: '13px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Tudo em um só lugar
                    </span>
                    <WordReveal
                        text="Uma plataforma que substitui cinco."
                        style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 48px)', color: 'white', marginTop: '16px' }}
                        delay={100}
                    />
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
                    {[
                        { icon: '🎨', titulo: 'Gerador de Riscos', desc: 'Por texto ou foto. Risco exclusivo com traços de bordado manual pronto em 30s.', destaque: true },
                        { icon: '💰', titulo: 'Precificação Inteligente', desc: 'IA calcula o preço exato considerando materiais, horas e margem de lucro.', destaque: false },
                        { icon: '📋', titulo: 'Orçamentos com Aprovação', desc: 'Envie um link. O cliente vê, aprova e você recebe notificação na hora.', destaque: false },
                        { icon: '📅', titulo: 'Agenda de Encomendas', desc: 'Controle de prazos, especificações do cliente e alertas automáticos.', destaque: false },
                        { icon: '⏱️', titulo: 'Cronômetro de Produção', desc: 'Registre o tempo real de cada peça. Saiba exatamente quanto vale sua hora.', destaque: false },
                        { icon: '🤖', titulo: 'Consultora Lia', desc: 'IA especialista em bordado. Estratégias de negócio, precificação e vendas 24h.', destaque: false },
                    ].map((feat, i) => (
                        <div key={i} style={{ background: feat.destaque ? 'rgba(172,81,72,0.15)' : 'rgba(255,255,255,0.04)', border: feat.destaque ? '1px solid rgba(172,81,72,0.4)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '28px', transition: 'all 0.3s ease', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = feat.destaque ? 'rgba(172,81,72,0.25)' : 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = feat.destaque ? 'rgba(172,81,72,0.15)' : 'rgba(255,255,255,0.04)'}>
                            <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px' }}>{feat.icon}</span>
                            <h3 style={{ color: feat.destaque ? '#E8A09A' : 'white', fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>{feat.titulo}</h3>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{feat.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SEÇÃO 7 — COMO FUNCIONA */}
            <section ref={registerSection} id="como-funciona" style={{ background: bgColor, padding: '60px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 4vw, 48px)', color: darkColor }}>Simples como deve ser</h2>
                    <p style={{ color: mutedColor, fontSize: '18px', maxWidth: '500px', margin: '16px auto 0' }}>Em menos de 5 minutos você já tem sua conta configurada e seu primeiro risco gerado.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-10 max-w-[900px] mx-auto relative">
                    <div className="hidden md:block" style={{ position: 'absolute', top: '48px', left: '16%', right: '16%', height: '2px', background: `linear-gradient(to right, ${primaryColor}, ${accentColor})`, zIndex: 0 }} />
                    {[
                        { num: '01', icon: '✨', titulo: 'Crie sua conta', desc: 'Cadastro em 1 minuto. Plano gratuito já inclui gerações de risco.' },
                        { num: '02', icon: '🎨', titulo: 'Gere seu primeiro risco', desc: 'Descreva o que você quer ou envie uma foto. A IA faz o resto.' },
                        { num: '03', icon: '💰', titulo: 'Organize e lucre', desc: 'Precifique, agende, crie orçamentos e acompanhe seu financeiro.' },
                    ].map((passo, i) => (
                        <div key={i} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'white', border: `3px solid ${primaryColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', boxShadow: `0 8px 24px rgba(172,81,72,0.2)`, position: 'relative' }}>
                                {passo.icon}
                                <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '24px', height: '24px', background: primaryColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 800 }}>
                                    {passo.num}
                                </div>
                            </div>
                            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', color: darkColor, margin: '0 0 10px', fontWeight: 700 }}>{passo.titulo}</h3>
                            <p style={{ color: mutedColor, fontSize: '15px', lineHeight: 1.6, margin: 0 }}>{passo.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SEÇÃO 8 — DEPOIMENTOS FIXO */}
            <section ref={registerSection} id="depoimentos" style={{ background: '#EDE0CF', padding: '60px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 4vw, 44px)', color: darkColor }}>
                        Bordadeiras que<br /><em style={{ color: primaryColor }}>já transformaram</em> seu ateliê
                    </h2>
                </div>
                <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #E5D9CC', position: 'relative', boxShadow: '0 4px 24px rgba(28,20,16,0.06)' }}>
                    <div style={{ fontSize: '80px', color: bgColor, fontFamily: 'Georgia, serif', lineHeight: 1, position: 'absolute', top: '16px', left: '24px', userSelect: 'none' }}>"</div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                        {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ color: accentColor, fontSize: '18px' }}>★</span>)}
                    </div>
                    <p style={{ color: darkColor, fontSize: '18px', lineHeight: 1.7, margin: '0 0 32px', position: 'relative', zIndex: 1, fontWeight: 500 }}>
                        {depoimento.texto}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '20px' }}>
                            {depoimento.nome[0]}
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, color: darkColor, fontSize: '17px' }}>{depoimento.nome}</p>
                            <p style={{ margin: 0, fontSize: '14px', color: mutedColor }}>{depoimento.cidade}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 9 — NÚMEROS */}
            <section ref={registerSection} id="numeros" style={{ background: primaryColor, padding: '60px 16px' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-[800px] mx-auto text-center divide-y md:divide-y-0 md:divide-x divide-white/20">
                    <div className="pt-8 md:pt-0">
                        <div ref={refBordados} style={{ fontFamily: 'Playfair Display, serif', fontSize: '56px', color: 'white', fontWeight: 700 }}>
                            {countBordados}+
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '8px 0 0', fontSize: '16px', fontWeight: 600 }}>Bordados gerados</p>
                    </div>
                    <div className="pt-8 md:pt-0">
                        <div ref={refTempo} style={{ fontFamily: 'Playfair Display, serif', fontSize: '56px', color: 'white', fontWeight: 700 }}>
                            {countTempo}s
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '8px 0 0', fontSize: '16px', fontWeight: 600 }}>Tempo médio de geração</p>
                    </div>
                    <div className="pt-8 md:pt-0">
                        <div ref={refSatisfacao} style={{ fontFamily: 'Playfair Display, serif', fontSize: '56px', color: 'white', fontWeight: 700 }}>
                            {countSatisfacao}%
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '8px 0 0', fontSize: '16px', fontWeight: 600 }}>Satisfação garantida</p>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 10 — PLANOS */}
            <section ref={registerSection} id="planos" style={{ background: bgColor, padding: '60px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    {isPrelancamento && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(172,81,72,0.1)', border: '1px solid rgba(172,81,72,0.3)', borderRadius: '999px', padding: '8px 16px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: primaryColor, animation: 'pulse 2s infinite', display: 'block' }} />
                            <span style={{ color: primaryColor, fontWeight: 800, fontSize: 'clamp(11px, 3vw, 13px)', textAlign: 'center' }}>
                                🎁 Oferta de Fundadora · 15 vagas · R$77/mês
                            </span>
                        </div>
                    )}
                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 4vw, 48px)', color: darkColor }}>Invista no seu ateliê</h2>
                    <p style={{ color: mutedColor, fontSize: '18px', marginTop: '12px' }}>Uma assinatura que se paga com uma peça vendida a mais por mês.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-8 max-w-[800px] mx-auto">
                    <div style={{ background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #E5D9CC' }}>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: darkColor, margin: '0 0 8px', fontWeight: 700 }}>Gratuito</h3>
                        <div style={{ marginBottom: '28px' }}>
                            <span style={{ fontSize: '48px', fontWeight: 800, color: darkColor }}>R$0</span>
                        </div>
                        <ul className="space-y-4 mb-10 text-[15px] font-semibold text-[#4B4B4B]">
                            <li>✓ 3 gerações de risco com IA por mês</li>
                            <li>✓ Orçamentos ilimitados</li>
                            <li className="opacity-50">✕ Controle de Encomendas</li>
                            <li className="opacity-50">✕ Consultora Lia e IA</li>
                        </ul>
                        <button onClick={handleCTA} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: `2px solid ${primaryColor}`, background: 'transparent', color: primaryColor, fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}>
                            Criar Conta Grátis
                        </button>
                    </div>
                    <div style={{ background: darkColor, borderRadius: '24px', padding: '24px', border: `2px solid ${primaryColor}`, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '24px', right: '24px', background: primaryColor, color: 'white', padding: '4px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 800 }}>
                            {isPrelancamento ? '🎁 Fundadora' : '⭐ Mais popular'}
                        </div>
                        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: 'white', margin: '0 0 8px', fontWeight: 700 }}>Pro</h3>
                        <div style={{ marginBottom: '28px' }}>
                            {isPrelancamento ? (
                                <>
                                    <span style={{ fontSize: '48px', fontWeight: 800, color: secondaryColor }}>R$77</span>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through', marginLeft: '12px', fontSize: '20px' }}>R$97</span>
                                    <p style={{ color: secondaryColor, fontSize: '13px', margin: '4px 0 0', fontWeight: 800 }}>para sempre — apenas 15 vagas</p>
                                </>
                            ) : (
                                <span style={{ fontSize: '48px', fontWeight: 800, color: 'white' }}>R${Math.floor(planPrice)}</span>
                            )}
                        </div>
                        <ul className="space-y-4 mb-10 text-[15px] font-semibold text-white/90 relative z-10">
                            <li><span style={{ color: secondaryColor }}>✓</span> Gerações de risco inteligentes mensais</li>
                            <li><span style={{ color: secondaryColor }}>✓</span> Controle Financeiro e DRE Automático</li>
                            <li><span style={{ color: secondaryColor }}>✓</span> Agenda de Encomendas Integrada</li>
                            <li><span style={{ color: secondaryColor }}>✓</span> Acesso completo à IA Lia 24h</li>
                        </ul>
                        <button onClick={handleCTA} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: primaryColor, color: 'white', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}>
                            {isPrelancamento ? 'Garantir Vaga de Fundadora' : 'Assinar Pró Agora'}
                        </button>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 11 — FAQ ACCORDION SIMPLIFICADO */}
            <section ref={registerSection} id="perguntas" style={{ background: 'white', padding: '60px 16px' }}>
                <div style={{ maxWidth: '680px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 36px)', color: darkColor, fontWeight: 700 }}>Perguntas Frequentes</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {faqs.map((faq, i) => {
                            const isOpen = openFaqIndex === i;
                            return (
                                <div key={i} onClick={() => setOpenFaqIndex(isOpen ? null : i)} style={{ padding: '24px', borderRadius: '16px', background: isOpen ? '#FFFDF9' : bgColor, border: isOpen ? `1px solid ${primaryColor}` : '1px solid #E5D9CC', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontWeight: 800, color: darkColor, fontSize: '16px' }}>{faq.q}</h3>
                                        <ChevronDown style={{ color: primaryColor, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
                                    </div>
                                    {isOpen && (
                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                            <p style={{ margin: 0, color: mutedColor, lineHeight: 1.6 }}>{faq.a}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* SEÇÃO 12 — CTA FINAL & ESPERA */}
            {isPrelancamento && (
                <section ref={registerSection} id="lista-espera" style={{ background: '#2D2D2D', padding: '60px 16px', textAlign: 'center' }}>
                    <span style={{ background: primaryColor, color: 'white', padding: '6px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 800 }}>
                        ✦ Lançamento em breve
                    </span>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#F2E9DB', fontSize: 'clamp(32px, 5vw, 48px)', marginTop: '24px', lineHeight: 1.2 }}>
                        Entre na lista e garanta<br />sua condição de fundadora
                    </h2>
                    <p style={{ color: '#A0A0A0', fontSize: '17px', marginTop: '16px', marginBottom: '40px' }}>
                        As primeiras 15 assinantes pagam R$77/mês para sempre.<br />Seja uma das primeiras a transformar seu ateliê.
                    </p>
                    {!waitlistSuccess ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '420px', margin: '0 auto' }}>
                            <input type="text" placeholder="Seu nome" value={waitlistName} onChange={e => setWaitlistName(e.target.value)} style={{ padding: '16px 20px', borderRadius: '12px', border: 'none', fontSize: '16px', background: '#3D3D3D', color: 'white', outline: 'none' }} />
                            <input type="email" placeholder="Seu melhor email" value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} style={{ padding: '16px 20px', borderRadius: '12px', border: 'none', fontSize: '16px', background: '#3D3D3D', color: 'white', outline: 'none' }} />
                            <button onClick={handleWaitlistSubmit} disabled={waitlistLoading} style={{ background: primaryColor, color: 'white', padding: '18px', borderRadius: '12px', border: 'none', fontSize: '18px', fontWeight: 800, cursor: waitlistLoading ? 'not-allowed' : 'pointer', opacity: waitlistLoading ? 0.7 : 1, marginTop: '8px' }}>
                                {waitlistLoading ? 'Enviando...' : 'Quero ser fundadora →'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ color: secondaryColor, fontSize: '24px', marginTop: '20px', fontWeight: 800 }}>
                            🎉 Você está na lista, {waitlistName}!<br />
                            <span style={{ fontSize: '16px', color: '#A0A0A0', fontWeight: 400 }}>Verifique seu email para confirmar.</span>
                        </div>
                    )}
                </section>
            )}

            {!isPrelancamento && (
                <section ref={registerSection} id="cta-final" style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #2D1F1A 100%)`, padding: '80px 16px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <span style={{ color: secondaryColor, fontSize: '13px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>É hora de mudar</span>
                        <WordReveal
                            text="Seu ateliê pode ser muito mais do que é hoje"
                            style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 4.5vw, 56px)', color: 'white', margin: '20px 0', lineHeight: 1.2 }}
                            delay={100}
                        />
                        <button onClick={handleCTA} style={{ background: primaryColor, color: 'white', padding: '20px 48px', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '20px', boxShadow: `0 12px 40px rgba(172,81,72,0.5)`, cursor: 'pointer', marginTop: '32px' }}>
                            Criar minha conta grátis ✦
                        </button>
                    </div>
                </section>
            )}

            {/* SEÇÃO 14 — FOOTER */}
            <footer style={{ background: darkColor, padding: '60px 16px 40px', color: 'white' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '32px', marginBottom: '48px' }}>
                    <div>
                        <img src={platformLogo || '/logo.png'} alt="Logo" style={{ height: '50px', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: '16px' }} />
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.6 }}>Feito para artesãs e bordadeiras que querem valorizar seu trabalho e escalar seu negócio com tecnologia.</p>
                    </div>
                    <div>
                        <h4 style={{ fontWeight: 800, marginBottom: '20px' }}>Produto</h4>
                        <ul className="space-y-3 opacity-60 text-sm">
                            <li><a href="#funcionalidades">Funcionalidades</a></li>
                            <li><a href="#planos">Planos e Preços</a></li>
                            <li><a href="#como-funciona">Como funciona</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 style={{ fontWeight: 800, marginBottom: '20px' }}>Suporte</h4>
                        <ul className="space-y-3 opacity-60 text-sm">
                            <li><a href="#perguntas">FAQ</a></li>
                            <li><a href="mailto:suporte@meuatelie.com">Fale Conosco</a></li>
                        </ul>
                    </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '40px', paddingTop: '24px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 8px' }}>
                        © {new Date().getFullYear()} Meu Ateliê · Todos os direitos reservados
                    </p>
                    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
                        <a href="/termos" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>
                            Termos de Uso
                        </a>
                        <a href="/privacidade" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>
                            Política de Privacidade
                        </a>
                        <a href="mailto:ola@meuateliegestao.com" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>
                            Contato
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
