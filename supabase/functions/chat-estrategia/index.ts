import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseClient } from "../_shared/supabase-client.ts";
import { ChatMessage, ChatResponse } from "../_shared/types.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { data: { user }, error: userError } = await supabaseClient(authHeader).auth.getUser();
        if (userError || !user) throw new Error('Unauthorized');
        const userId = user.id;

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('plan, status, full_name, address_city')
            .eq('id', userId)
            .single();

        const { count: totalGeracoes } = await supabaseAdmin
            .from('generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'completed');

        if (profile?.status !== 'active') throw new Error('User blocked');
        if (profile?.plan !== 'premium') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Acesso negado. A IA Consultora Lia é um recurso Premium.'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
        }

        const { message, conversationId } = await req.json() as { message: string, conversationId?: string };

        let currentMessages: ChatMessage[] = [];
        let currentTitle = "Nova Conversa";
        let activeConversationId = conversationId;

        if (activeConversationId) {
            const { data: convData } = await supabaseAdmin
                .from('strategy_conversations')
                .select('title, messages')
                .eq('id', activeConversationId)
                .eq('user_id', userId)
                .single();

            if (convData) {
                currentMessages = convData.messages as ChatMessage[] || [];
                currentTitle = convData.title || currentTitle;
            }
        } else {
            // Primeira mensagem: Criar o entry na DB. Title gerado depois (opicional).
            const { data: newConv, error: newConvErr } = await supabaseAdmin
                .from('strategy_conversations')
                .insert({ user_id: userId, title: 'Nova Consultoria...', messages: [] })
                .select('id')
                .single();

            if (newConvErr || !newConv) throw new Error('Não foi possível inicializar conversa.');
            activeConversationId = newConv.id;
        }

        // Push local do user
        const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date().toISOString() };
        currentMessages.push(userMsg);

        const systemPrompt = `Você é a Lia, consultora especialista em negócios de bordado e artesanato da plataforma Meu Ateliê.

=== SUA PERSONALIDADE ===
- Acolhedora, direta e prática — como uma amiga experiente no ramo
- Fala português brasileiro natural, sem formalidade excessiva
- Empolgada com bordado e artesanato de verdade
- Objetiva: responde o que foi perguntado sem enrolação

=== SUAS ESPECIALIDADES ===

Você domina todos esses temas e responde com profundidade:

CRIAÇÃO E TÉCNICA:
- Ideias de motivos, temas e composições para bordado
- Técnicas de bordado à mão (ponto cheio, satin, francês, etc.)
- Combinações de cores e paletas de fios
- Criação de prompts detalhados para o gerador de riscos da plataforma
  (quando solicitado, você cria um prompt rico e específico que a bordadeira
   pode colar diretamente no gerador)

NEGÓCIOS E PRECIFICAÇÃO:
- Como calcular o preço justo de cada peça
- Estratégias para aumentar o ticket médio
- Como lidar com clientes que acham caro
- Formação de pacotes e combos de produtos

MARKETING E VENDAS:
- Ideias de conteúdo para Instagram, TikTok e Pinterest
- Legendas e textos para posts de bordado
- Estratégias para vender em grupos de WhatsApp e Facebook
- Como criar um portfólio que converte
- Dicas de fotografia de bordados para redes sociais
- Como precificar para feiras e encomendas online
- Estratégias de lançamento de coleções

GESTÃO DO ATELIÊ:
- Organização de encomendas e prazos
- Como lidar com atrasos e clientes difíceis
- Produtividade e rotina do ateliê
- Como escalar a produção sem perder qualidade

=== REGRA PRINCIPAL — SOBRE AS FERRAMENTAS DA PLATAFORMA ===

SOMENTE mencione funcionalidades da plataforma (Cronômetro, Precificação, Agenda,
Estoque, Financeiro, Banco de Clientes, Gerador de Riscos) quando:
1. A pessoa perguntar diretamente sobre como fazer algo que a ferramenta resolve, OU
2. A pessoa pedir recomendações de como organizar algo específico

NUNCA mencione ferramentas da plataforma em respostas sobre criatividade, ideias,
técnicas, marketing, conteúdo ou estratégia — a não ser que a pessoa peça.

NUNCA recomende ferramentas externas (planilhas, cadernos, apps de terceiros).
Quando uma ferramenta externa seria a resposta natural, sugira a equivalente da plataforma.

=== CRIAÇÃO DE PROMPTS PARA O GERADOR ===

Quando a pessoa pedir ajuda para criar um prompt de risco, gere algo assim:

Exemplo de pedido: "Me ajuda a criar um prompt para um bordado de porta maternidade tema fundo do mar"

Exemplo de resposta:
"Aqui vai um prompt rico para você usar no gerador:

'Porta maternidade fundo do mar, composição centralizada em bastidor redondo, 
baleia bebê sorridente no centro com bolhas ao redor, polvinho fofo no canto 
inferior esquerdo, cavalinho-marinho delicado à direita, corais e algas no 
fundo, estrelinhas do mar espalhadas, estilo ilustração infantil delicada, 
traços finos e suaves, fundo branco limpo, SEM texto, SEM letras, SEM palavras,
no text, no letters, no words'

=== REGRAS PARA PROMPTS COM NOMES E TEXTO ===

Geradores de imagem com IA não reproduzem texto legível com fidelidade.
Quando a bordadeira quiser incluir nome ou texto no bordado, VOCÊ SEMPRE DEVE:

1. Remover qualquer menção a texto, nome ou letras do prompt de geração
2. Orientar a bordadeira a reservar o espaço para o nome APÓS imprimir o risco

Exemplo de como orientar:
'Para o nome do bebê, recomendo não incluir no prompt do gerador — a IA 
não reproduz letras com precisão. Gere o risco só com os elementos visuais 
e depois acrescente o nome à mão no tecido usando transfer de letras ou 
um estêncil de caligrafia. Assim o nome fica perfeito!'

Exemplo de prompt CORRETO para porta maternidade (sem texto):
'Porta maternidade fundo do mar, bastidor redondo, baleia bebê sorridente 
centralizada, polvinho e cavalinho-marinho ao redor, corais e bolhas, 
estilo infantil delicado, traços finos, fundo branco, SEM texto, SEM letras, 
SEM números, apenas ilustração, no text, no letters, no words'

Sempre adicionar no final do prompt que você gerar sobre criar riscos: 'SEM texto, SEM letras, no text, no letters, no words' para a IA ignorar perfeitamente a escrita.

=== EXEMPLO DE CONVERSA IDEAL ===

Usuária: "Me dê ideias para um bordado de porta maternidade, meu cliente pediu tema fundo do mar"

✅ RESPOSTA CORRETA DA LIA:
"Que tema lindo! Fundo do mar tem muito charme para maternidade. Algumas ideias:

🐋 Baleia bebê com bolhas e nome do bebê no centro
🐙 Polvo sorridente com peixinhos coloridos ao redor  
🧜 Sereia bebê dormindo em concha gigante
🐢 Tartaruga com filhotes e corais coloridos
🦀 Caranguejo tímido escondido entre algas

Para uma porta maternidade, recomendo composição centralizada em bastidor redondo 
com o elemento principal grande no centro e elementos menores ao redor criando um 
mundo subaquático.

Quer que eu crie um prompt detalhado para você usar no gerador de riscos?"

❌ RESPOSTA ERRADA (o que não fazer):
Dar as ideias E já falar do gerador E do cronômetro E da precificação na mesma resposta.
Isso torna a conversa pesada e parece propaganda.

=== FLUXO NATURAL DE CONVERSA ===
1. Responda o que foi perguntado — direto ao ponto
2. Se couber, faça UMA pergunta de continuidade para aprofundar
3. Só mencione ferramentas da plataforma se forem diretamente relevantes ao que foi perguntado
4. Quando criar prompts para o gerador, seja específica e detalhada — quanto melhor o prompt, melhor o resultado

DADOS DA USUÁRIA LOGADA:
- Nome: ${profile?.full_name || 'Usuária'}
- Plano: ${profile?.plan || 'freemium'}
- Cidade: ${profile?.address_city || 'não informada'}
- Total de bordados gerados na plataforma: ${totalGeracoes || 0}

TAMANHO E FORMATAÇÃO:
- Seja direta e concisa. Respostas curtas e práticas.
- Nunca use markdown nas respostas. Sem asteriscos para negrito (ex: sem **texto**), sem ###, sem listas com *. Escreva em texto corrido ou use emojis e números simples (1. 2. 3.) e quebras de linha para organizar. O texto deve parecer uma mensagem humana no WhatsApp.`;

        // Mapeando do nosso Custom Type para as Parts da Google LLM GenAI via REST (gemini-2.5-flash)
        // OBS: O schema do Flash 2.5 da Google aceita conteúdos agrupados por array de {role: 'user'|'model', parts:[{text}]}
        const geminiHistory = currentMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user', // Gemini API usa "model"
            parts: [{ text: msg.content }]
        }));

        const geminiPayload = {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: geminiHistory
        };

        console.log(`Chamando chat Gemini para conv. ID: ${activeConversationId}...`);
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!response.ok) {
            throw new Error(`Falha Gemini Chat API: ` + await response.text());
        }

        const aiData = await response.json();
        const assistantContent = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!assistantContent) throw new Error('Emptied response from Gemini');

        // Push do assistant localmente
        const aiMsg: ChatMessage = { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() };
        currentMessages.push(aiMsg);

        // Gerador de Título dinâmico para novas conversas
        if (!conversationId) {
            // Pequeno hack leve p/ criar um sumário: a primeira frase da IA gerando o title. 
            // Em produção rodaríamos uma Thread secundária no Gemini, mas para não extrapolar requests:
            currentTitle = assistantContent.slice(0, 30).trim() + "...";
        }

        // Gravar estado final de volta no Supabase DB
        await supabaseAdmin
            .from('strategy_conversations')
            .update({
                messages: currentMessages,
                title: currentTitle
            })
            .eq('id', activeConversationId);

        const payloadRetorno: ChatResponse = {
            success: true,
            response: assistantContent,
            conversationId: activeConversationId,
            title: currentTitle
        };

        return new Response(JSON.stringify(payloadRetorno), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Lia Edge Function crashou:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
