# Meu Ateliê - Contexto para Assistentes Virtuais (IAs)

Este documento centraliza todas as informações fundamentais sobre a plataforma **Meu Ateliê**, servindo como base de conhecimento para qualquer Inteligência Artificial (como Cursor, Windsurf, Copilot, ChatGPT, etc.) que for auxiliar no desenvolvimento e manutenção do projeto.

---

## 🏛️ Visão Estrutural e Arquitetura

O **Meu Ateliê** é um SaaS (Software as a Service) focado na gestão criativa e administrativa para artesãs, especificamente focado no nicho de **Bordado Livre**. A plataforma é *Mobile-First* (desenhada como um PWA, Progressive Web App), mas é completamente responsiva e adaptada para Desktop.

### Stack Tecnológico
- **Frontend**: React 18, Vite, TypeScript.
- **Estilização**: Tailwind CSS (extensivamente customizado com CSS Variables HSL para temas), Radix UI (shadcn-like base), e `lucide-react` para iconografia.
- **Backend & Banco de Dados**: Supabase (PostgreSQL com RLS ativo, Auth via Email/Google, Storage para imagens corporativas/arquivos, e Edge Functions usando Deno para integrações de IA).
- **Integrações Nativas**: Gemini API (Google) para geradores de imagens e roteirização P&B/Coloridos.
- **Hospedagem Frontend**: Vercel.

---

## 🎨 Design System e Branding

A plataforma busca passar um ar premium, acolhedor, artesanal e limpo. Não há "Dark Mode" ativado; a plataforma se baseia fortemente no "Light Mode" com paletas quentes.

### Tipografia
- **Títulos e Marca (Display)**: `Playfair Display`, serif. Transmite elegância e aspecto "revista" ou "butique".
- **Interface e Textos (UI)**: `Nunito`, sans-serif. Alta legibilidade para dashboards e tabelas.
- **Classe Tailwind**: `font-display` e `font-ui`.

### Cores Principais (Hex e Variáveis)
- **Primary (Terracota / Rosa Seco)**: `#AC5148` (variável `--color-primary` / Tailwind `bg-primary`). Cor de ação principal, botões, headers ativos.
- **Secondary / Nude**: `#F7E1D7` (variável `--color-secondary`). Usado no menu lateral, fundos de destaque suave.
- **Background**: `#F2E9DB` (fundo principal do App) e `#FAF8F5` (surface-warm).
- **Surface/Card**: `#FFFFFF` (Fundo dos modais, cartões e elementos que precisam saltar à vista).
- **Accent (Dourado/Mostarda)**: `#C29A51` (botões secundários, avisos premium).
- **Textos**: `#1A1A1A` (Primário) e `#6B6B6B` (Secundário/Light).

---

## 📱 Navegação e Layout

O App possui comportamentos de navegação distintos em dispositivos móveis e desktops, garantindo a conversão exata de funcionalidades entre eles:

- **Desktop (`Sidebar.tsx`)**: Um menu lateral esquerdo fixo contendo todas as funções abertas.
- **Mobile (`BottomNav.tsx` / `TopBar.tsx`)**: 
  - `BottomNav`: Barra inferior com os 5 atalhos principais (`Início`, `Criar`, `Loja`, `Menu Completo / Gestão`, `Perfil`).
  - O botão `Gestão` no celular abre um `Sheet` (Gaveta) contendo um grid idêntico às opções do Desktop.
  - O `TopBar` possui um menu hamburguer (`Sheet` lateral) que réplica todo o menu do Desktop em formato de gaveta.

> **Regra de Ouro (Responsividade)**: Toda funcionalidade que existir no Desktop DEVE estar mapeada e construída no Mobile. Não esconda funcionalidades premium do celular. 

---

## ⚙️ Módulos e Funcionalidades

A plataforma é dividida entre ferramentas **Básicas (Free)** e **Premium (Gestão)**.

### Estúdio Criativo & Loja (Free / Cobrança por Crédito)
1. **Gerador P&B**: Edge function conectada ao Gemini para gerar contornos de bordado (Bastidores redondos, quadrados, etc.) sem fundos vazados.
2. **Gerador Colorido**: Transformação e criação de paletas de cores a partir de descrições.
3. **Loja de Créditos**: Onde o usuário pode assinar o plano premium via Stripe/MercadoPago (em implementação) ou comprar pacotes de imagens avulsas.
4. **Indicações**: Sistema de comissionamento/indicação com ranking de artesãs.

### Gestão do Ateliê (Premium)
1. **Dashboard Inicial**: Métricas, Faturamento do mês mensurados via RLS (Row Level Security no Supabase).
2. **Agenda de Produção**: Calendário Kanban e Listagens das encomendas com cálculos automáticos de prazos de entrega baseados na "Data de Início" mais o "Prazo Extra" importado do orçamento.
3. **Orçamentos**: Criação de PDFs/links interativos. O cliente visualiza o orçamento através de uma URL pública (ex: `/orcamento/:id`), aprova, e os dados viram automaticamente uma Encomenda na Agenda.
4. **Clientes**: CRM básico de cadastro das clientes finais.
5. **Estoque e Envios**: Gestão de insumos, linhas, bastidores, e também controle de logísticas e sedex.
6. **Precificação e Financeiro**: Calculadoras automáticas para calcular valor-hora, lucros sobre material e saídas de caixa.
7. **Cronômetro**: Tracker de tempo que a artesã usa enquanto borda, que se conecta direto com a aba de Precificação para calcular o custo real da hora gasta.

---

## 🛡️ Regras de Desenvolvimento e Boas Práticas (Para IAs)

1. **Responsividade Mobile-First Estrita**:
   - Sempre utilize classes como `w-full sm:w-auto`, ou `grid-cols-1 sm:grid-cols-2`. Modais (`Dialog`) devem ter padding seguro e ocupar a largura máxima no celular sem ficarem achatados. Use `pb-safe` para notch do iPhone.
2. **Uso de Banco de Dados (Supabase)**:
   - Evite injetar queries diretas nos componentes React. Toda lógica do Supabase fica centralizada em `src/lib/api/` (ex: `gestao.ts`, `orcamentos.ts`).
   - Todos os dados sensíveis devem respeitar as RLS policies (O usuário X só pode ler a Row onde `user_id = auth.uid()`).
3. **Limpeza de Storage**:
   - Existe uma rotina no via Edge Functions (`limpar-dados-expirados`) acionada por `pg_cron` no Supabase, que diariamente apaga artes P&B com mais de 7 dias, notificações antigas e arquivos orfãos para evitar sobrecarga de disco. Respeite essa mecânica.
4. **Manipulação de Modais (Dialog/Sheet)**:
   - Ao fechar componentes que carregam estados residuais (como preenchimentos automáticos vindos de outra página via `location.state`), lembre-se de invocar a limpeza dos `states` no clicefecho (`!open` listener de fechamento), para que novos preenchimentos manuais entrem limpos.

---
*Fim do Documento.*
