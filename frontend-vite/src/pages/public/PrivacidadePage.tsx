export default function PrivacidadePage() {
    return (
        <div style={{ minHeight: '100vh', background: '#F2E9DB', fontFamily: 'Nunito, sans-serif' }}>
            {/* Mesmo header da página de termos */}
            <div style={{ background: 'white', borderBottom: '1px solid #E5D9CC', padding: '20px 24px' }}>
                <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: '#AC5148' }}>
                            Meu Ateliê
                        </span>
                    </a>
                </div>
            </div>

            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px' }}>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '40px', color: '#1C1410', marginBottom: '8px' }}>
                    Política de Privacidade
                </h1>
                <p style={{ color: '#7A6A5A', fontSize: '14px', marginBottom: '48px' }}>
                    Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>

                {[
                    {
                        titulo: '1. Quem somos',
                        texto: `O Meu Ateliê (meuateliegestao.com) é uma plataforma digital para gestão de ateliês de bordado. Esta política explica como coletamos, usamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).`
                    },
                    {
                        titulo: '2. Dados que coletamos',
                        texto: `2.1. Dados fornecidos por você:\n• Nome completo e e-mail (no cadastro)\n• Dados do ateliê (nome, WhatsApp, Instagram, cidade — opcionais)\n• Informações de pagamento (processadas pelo Asaas — não armazenamos dados de cartão)\n• Conteúdo gerado na plataforma (encomendas, orçamentos, riscos)\n\n2.2. Dados coletados automaticamente:\n• Endereço IP e informações do navegador\n• Páginas acessadas e tempo de uso\n• Logs de erros para manutenção`
                    },
                    {
                        titulo: '3. Como usamos seus dados',
                        texto: `Utilizamos seus dados para:\n• Fornecer e melhorar os serviços da plataforma\n• Processar pagamentos e gerenciar assinaturas\n• Enviar comunicações sobre sua conta e novidades (com opção de cancelamento)\n• Gerar estatísticas agregadas e anônimas sobre o uso da plataforma\n• Cumprir obrigações legais\n\nNão vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins comerciais.`
                    },
                    {
                        titulo: '4. Compartilhamento de dados',
                        texto: `Seus dados podem ser compartilhados apenas com:\n• Asaas (processamento de pagamentos) — sujeito à própria política de privacidade do Asaas\n• Supabase (infraestrutura de banco de dados) — servidores com criptografia em repouso\n• Resend (envio de e-mails transacionais)\n• Google (API Gemini para geração de riscos — apenas o prompt enviado, sem dados pessoais)\n\nTodos os fornecedores são contratualmente obrigados a proteger seus dados.`
                    },
                    {
                        titulo: '5. Armazenamento e segurança',
                        texto: `Seus dados são armazenados em servidores seguros com:\n• Criptografia em repouso e em trânsito (HTTPS/TLS)\n• Backups diários automáticos\n• Autenticação segura via Supabase Auth\n• Acesso restrito apenas a pessoal autorizado\n\nEmbora adotemos medidas rigorosas, nenhum sistema é 100% inviolável. Em caso de incidente de segurança, você será notificada conforme exigido pela LGPD.`
                    },
                    {
                        titulo: '6. Seus direitos (LGPD)',
                        texto: `Como titular dos dados, você tem direito a:\n• Confirmar a existência de tratamento dos seus dados\n• Acessar seus dados armazenados\n• Corrigir dados incompletos ou desatualizados\n• Solicitar a anonimização ou exclusão de dados desnecessários\n• Revogar o consentimento a qualquer momento\n• Solicitar a portabilidade dos seus dados\n\nPara exercer qualquer direito, entre em contato pelo e-mail ola@meuateliegestao.com. Responderemos em até 15 dias úteis.`
                    },
                    {
                        titulo: '7. Cookies',
                        texto: `Utilizamos cookies essenciais para manter sua sessão ativa e cookies de análise anônima para entender como a plataforma é usada. Não utilizamos cookies de rastreamento para publicidade. Você pode desativar cookies no seu navegador, mas algumas funcionalidades podem ser afetadas.`
                    },
                    {
                        titulo: '8. Retenção de dados',
                        texto: `Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento da conta, seus dados são mantidos por 90 dias para fins de auditoria e depois excluídos permanentemente, exceto quando a retenção for exigida por lei.`
                    },
                    {
                        titulo: '9. Menores de idade',
                        texto: `A plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos um cadastro de menor, a conta será encerrada imediatamente.`
                    },
                    {
                        titulo: '10. Contato com o Encarregado (DPO)',
                        texto: `Para qualquer questão relacionada à privacidade e proteção de dados, entre em contato pelo e-mail ola@meuateliegestao.com com o assunto "LGPD — [sua solicitação]".`
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
                    <a href="/termos" style={{ color: '#AC5148', fontWeight: 700, fontSize: '16px' }}>
                        ← Voltar para os Termos de Uso
                    </a>
                </div>
            </div>
        </div>
    )
}
