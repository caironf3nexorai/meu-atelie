export default function TermosDeUsoPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#F2E9DB', fontFamily: 'Nunito, sans-serif' }}>
            {/* Header simples */}
            <div style={{ background: 'white', borderBottom: '1px solid #E5D9CC', padding: '20px 24px' }}>
                <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: '#AC5148' }}>
                            Meu Ateliê
                        </span>
                    </a>
                </div>
            </div>

            {/* Conteúdo */}
            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px' }}>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '40px', color: '#1C1410', marginBottom: '8px' }}>
                    Termos de Uso
                </h1>
                <p style={{ color: '#7A6A5A', fontSize: '14px', marginBottom: '48px' }}>
                    Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>

                {[
                    {
                        titulo: '1. Aceitação dos Termos',
                        texto: `Ao criar uma conta e utilizar o Meu Ateliê (meuateliegestao.com), você concorda com estes Termos de Uso em sua totalidade. Se não concordar com qualquer parte, não utilize a plataforma. Estes termos constituem um acordo legal entre você ("Usuária") e Meu Ateliê Gestão ("Plataforma").`
                    },
                    {
                        titulo: '2. O Serviço',
                        texto: `O Meu Ateliê é uma plataforma SaaS (Software como Serviço) voltada para bordadeiras e artesãs, oferecendo ferramentas de gestão de ateliê, geração de riscos por inteligência artificial, precificação, controle financeiro, agenda de encomendas e consultoria por IA. A plataforma está em constante evolução e novas funcionalidades podem ser adicionadas ou modificadas sem aviso prévio.`
                    },
                    {
                        titulo: '3. Propriedade dos Riscos Gerados por IA',
                        texto: `3.1. Todos os riscos (desenhos) gerados pela IA dentro da plataforma a partir de suas descrições ou fotos de referência são de sua propriedade após a geração.\n\n3.2. Você tem total liberdade para:\n• Usar os riscos gerados para produzir bordados físicos\n• Vender os bordados físicos produzidos a partir desses riscos\n• Adaptar e modificar os riscos conforme sua criatividade\n\n3.3. Você NÃO está autorizada a:\n• Revender o arquivo digital do risco em si para terceiros\n• Distribuir os riscos gerados como produto digital\n• Alegar autoria exclusiva do risco gerado por IA em contextos legais\n\n3.4. O Meu Ateliê não garante exclusividade absoluta entre gerações de usuárias diferentes. Descrições similares podem gerar riscos com semelhanças.`
                    },
                    {
                        titulo: '4. Responsabilidade sobre Direitos Autorais',
                        texto: `4.1. Ao enviar fotos de referência para geração de riscos, você declara ter o direito de uso desse material.\n\n4.2. O Meu Ateliê não se responsabiliza por eventuais similaridades entre riscos gerados e obras protegidas por direitos autorais de terceiros.\n\n4.3. É sua responsabilidade verificar se o resultado gerado não infringe direitos de imagem ou propriedade intelectual antes de comercializar as peças.`
                    },
                    {
                        titulo: '5. Planos, Pagamentos e Cancelamento',
                        texto: `5.1. O plano gratuito oferece acesso limitado às funcionalidades e pode ser alterado sem aviso prévio.\n\n5.2. O plano Pro é cobrado mensalmente via cartão de crédito, Pix ou boleto bancário processado pelo Asaas.\n\n5.3. Em caso de não pagamento até o vencimento, o acesso ao plano Pro será automaticamente suspenso e a conta retornará ao plano gratuito.\n\n5.4. Cancelamentos podem ser feitos a qualquer momento pelo painel da usuária, sem multa ou fidelidade mínima no plano mensal.\n\n5.5. Não realizamos reembolsos de períodos já pagos e utilizados.`
                    },
                    {
                        titulo: '6. Conduta da Usuária',
                        texto: `Você concorda em não utilizar a plataforma para fins ilegais, não tentar acessar dados de outras usuárias, não realizar engenharia reversa ou tentativas de cópia do sistema, e não compartilhar suas credenciais de acesso com terceiros. Violações podem resultar no encerramento imediato da conta.`
                    },
                    {
                        titulo: '7. Disponibilidade do Serviço',
                        texto: `O Meu Ateliê se esforça para manter disponibilidade contínua, mas não garante 100% de uptime. Manutenções programadas serão comunicadas com antecedência. Não nos responsabilizamos por perdas decorrentes de indisponibilidade temporária.`
                    },
                    {
                        titulo: '8. Limitação de Responsabilidade',
                        texto: `A plataforma é fornecida "como está". O Meu Ateliê não se responsabiliza por lucros cessantes, perda de dados ou quaisquer danos indiretos decorrentes do uso ou impossibilidade de uso da plataforma. Nossa responsabilidade máxima limita-se ao valor pago nos últimos 30 dias.`
                    },
                    {
                        titulo: '9. Alterações nos Termos',
                        texto: `Podemos atualizar estes termos a qualquer momento. Alterações significativas serão comunicadas por e-mail com antecedência mínima de 15 dias. O uso continuado após esse prazo constitui aceitação dos novos termos.`
                    },
                    {
                        titulo: '10. Contato e Foro',
                        texto: `Para dúvidas sobre estes termos, entre em contato pelo e-mail ola@meuateliegestao.com. Fica eleito o foro da comarca de Patos de Minas, MG, para dirimir quaisquer conflitos decorrentes deste instrumento.`
                    },
                ].map((item, i) => (
                    <div key={i} style={{ marginBottom: '36px' }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#AC5148', marginBottom: '12px' }}>
                            {item.titulo}
                        </h2>
                        <p style={{ color: '#4A3A2A', fontSize: '16px', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>
                            {item.texto}
                        </p>
                    </div>
                ))}

                <div style={{ marginTop: '48px', padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #E5D9CC', textAlign: 'center' }}>
                    <p style={{ color: '#7A6A5A', margin: '0 0 12px' }}>
                        Veja também nossa política de como tratamos seus dados:
                    </p>
                    <a href="/privacidade" style={{ color: '#AC5148', fontWeight: 700, fontSize: '16px' }}>
                        Política de Privacidade →
                    </a>
                </div>
            </div>
        </div>
    )
}
