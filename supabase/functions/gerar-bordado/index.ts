import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseClient } from "../_shared/supabase-client.ts";
import { GenerationFormData, GenerationResponse } from "../_shared/types.ts";
import { checkCircuitBreaker, verificarLimiteEdgeFunctions, incrementarUso } from "../_shared/circuit-breaker.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

Deno.serve(async (req) => {
    // CORS Options
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        // 1. Verificar JWT → extrair user_id
        const { data: { user }, error: userError } = await supabaseClient(authHeader).auth.getUser();
        if (userError || !user) {
            throw new Error('Unauthorized');
        }
        const userId = user.id;

        const { tipo, formData } = await req.json() as { tipo: 'risco' | 'bordado_colorido', formData: GenerationFormData };

        // Circuit Breaker — verificar se o serviço está bloqueado
        const chaveBreaker = tipo === 'risco' ? 'gerar_risco' : 'gerar_bordado';
        const cb = await checkCircuitBreaker(supabaseAdmin, chaveBreaker);
        if (cb.bloqueado) {
            return new Response(JSON.stringify({
                error: 'servico_temporariamente_indisponivel',
                mensagem: 'O gerador está temporariamente indisponível. Tente novamente mais tarde.',
                motivo: cb.motivo
            }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Verificar limite de Edge Functions do mês
        await verificarLimiteEdgeFunctions(supabaseAdmin);

        // Incrementar contador de uso
        await incrementarUso(supabaseAdmin);

        // 2. Buscar profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('status, plan, free_generations_used, free_cycle_expires_at, extra_credits, role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) throw new Error('Profile not found');
        if (profile.status !== 'active') throw new Error('User blocked');

        // 3. Resetar ciclo free
        await supabaseAdmin.rpc('reset_free_cycle', { p_user_id: userId });

        // Refresh profile to get updated cycle data
        const { data: refreshedProfile } = await supabaseAdmin
            .from('profiles')
            .select('plan, free_generations_used, extra_credits, role')
            .eq('id', userId)
            .single();

        const currentPlan = refreshedProfile?.plan || profile.plan;
        let freeUsed = refreshedProfile?.free_generations_used || profile.free_generations_used;
        let extraCredits = refreshedProfile?.extra_credits ?? profile.extra_credits;
        const role = refreshedProfile?.role || profile.role;
        const isAdmin = role === 'admin';

        // 4. Verificar permissão e limites
        const { data: planConfig } = await supabaseAdmin
            .from('plan_config')
            .select('free_generations_limit, premium_generations_limit')
            .single();

        if (!planConfig) throw new Error('Plan config missing');

        // Definindo limite mensal com base no plano (fallback 9999 para premium ilimitado)
        let limit = currentPlan === 'premium' ? (planConfig.premium_generations_limit || 999999) : planConfig.free_generations_limit;
        if (isAdmin) limit = 999999;

        let monthlyAvailable = limit - freeUsed;

        // Bordado Colorido não consome créditos mensais gratuitos
        if (tipo === 'bordado_colorido' && currentPlan !== 'premium' && !isAdmin) {
            monthlyAvailable = 0;
        }

        const totalAvailable = monthlyAvailable + extraCredits;

        if (totalAvailable <= 0) {
            return new Response(JSON.stringify({
                success: false,
                requiresUpgrade: true,
                error: 'Sem créditos disponíveis. Faça o upgrade ou compre um pacote de créditos.'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
        }

        // 6. Inserir pending
        const { data: generation, error: genError } = await supabaseAdmin
            .from('generations')
            .insert({
                user_id: userId,
                generation_type: tipo,
                status: 'processing',
                form_data: formData,
                plan_at_generation: currentPlan
            })
            .select('id')
            .single();

        if (genError || !generation) throw new Error('Failed to create generation record');
        const generationId = generation.id;

        // 7. Consumir créditos
        let creditSource = 'monthly';
        if (!isAdmin) {
            if (monthlyAvailable > 0) {
                await supabaseAdmin
                    .from('profiles')
                    .update({ free_generations_used: freeUsed + 1 })
                    .eq('id', userId);
            } else {
                creditSource = 'extra';
                await supabaseAdmin
                    .from('profiles')
                    .update({ extra_credits: extraCredits - 1, welcome_credits_used: true })
                    .eq('id', userId);
            }
        }

        // 8. Construir prompt e chamar Gemini
        let promptUsed = '';
        let apiEndpoint = '';
        if (tipo === 'risco') {
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;
        } else if (tipo === 'bordado_colorido') {
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`;
        }
        let geminiPayload: any = {};

        if (tipo === 'risco') {
            // Style-specific prompt blocks
            const stylePrompts: any = {
                minimal: `STYLE: MINIMALISTA
- Simple, clean CONTINUOUS lines — smooth and flowing
- Focus on the main silhouette and essential features only
- Minimal internal detail — omit small accessories, patterns, tattoos, jewelry
- For bodies: only major body outline and basic clothing shape
- Think: quick sketch with a fine pen — elegant simplicity
- Use thin, uniform line weight throughout
- Maximum simplicity — if in doubt, leave it out
- Result should look like a clean, simple line drawing ready for beginner embroiderers`,

                detailed: `STYLE: DETALHADO
- Clean CONTINUOUS lines with more internal structure and texture
- Include hair strands, fabric folds, clothing details
- Hair: draw individual strand groups with flowing parallel lines
- Clothing: include fold lines, collar details, sleeve edges
- Add texture lines for beards, curly hair, textured fabrics
- Still use thin pen-style lines — no solid fills, no shading patches
- More lines than Minimalista but still clean and readable
- Result should look like a detailed line art illustration suitable for experienced embroiderers`,

                outline: `STYLE: CONTORNO PURO (EMBROIDERY TRACING)
- EXTREMELY IMPORTANT: ALL strokes MUST be NON-CONTINUOUS
- NO solid, unbroken lines allowed anywhere in the drawing
- Every single contour MUST be composed of SHORT INDEPENDENT SEGMENTS (2mm to 8mm equivalent length)
- This is a non-negotiable rule: the drawing MUST consist of discrete segments that form the silhouette
- When viewed from a distance, the segments form the shape, but up-close they are disconnected
- This allows the embroiderer to execute each stitch in a controlled manner

SEGMENTATION RULES:
- Stroke breaks MUST occur at: sharp curves, transitions between body parts, texture areas
- NO line should run continuously for more than 8mm equivalent
- Each segment should have slight thickness variation (thinner at start and end)

TEXTURE WITH SEGMENTS:
- Straight/wavy hair: multiple short curved parallel strokes, varying lengths, following flow direction
- Curly hair: small arc segments grouped in clusters, no continuity between curls
- Beard: very short disconnected strokes in multiple directions (2-5mm)
- Clothing: loose short diagonal strokes suggesting fabric movement, not connected
- Result should look like a professional embroidery transfer pattern (risco de bordado) with strictly segmented strokes`
            };

            const facelessPrompt = formData.isFaceless
                ? `\nFACELESS MODE ACTIVATED (MANDATORY RULE):\n- ABSOLUTELY NO FACIAL FEATURES ALLOWED.\n- Do NOT draw eyes, pupils, eyelashes, eyebrows, nose, nostrils, mouth, or lips.\n- Draw ONLY the blank outer contour of the face, jawline, ears, and hair framing the face.\n- The face area MUST remain completely empty white space.`
                : `\nFACIAL FEATURES RULE:\n- Draw facial features (eyes, nose, mouth) according to the selected style.\n- Keep facial lines clean and essential.`;

            const instrucaoFormatoObj: Record<string, string> = {
                redondo: `
      - Desenhe um círculo perfeito e contínuo ao redor de toda a composição como moldura do bastidor
      - Linha do círculo com espessura de 2-3px, bem definida e fechada
      - TODOS os elementos do bordado devem estar COMPLETAMENTE dentro do círculo — nenhuma linha, traço ou elemento pode tocar ou ultrapassar a borda do círculo
      - Margem de segurança de 10% entre o elemento mais externo e a linha do círculo
    `,
                quadrado: `
      - Desenhe um quadrado com cantos levemente arredondados ao redor de toda a composição como moldura do bastidor
      - Linha do quadrado com espessura de 2-3px, bem definida e fechada
      - TODOS os elementos do bordado devem estar COMPLETAMENTE dentro do quadrado — nenhuma linha, traço ou elemento pode tocar ou ultrapassar a borda
      - Margem de segurança de 10% entre o elemento mais externo e a borda do quadrado
    `,
                retangular: `
      - Desenhe um retângulo com cantos levemente arredondados ao redor de toda a composição como moldura do bastidor
      - Linha do retângulo com espessura de 2-3px, bem definida e fechada
      - TODOS os elementos do bordado devem estar COMPLETAMENTE dentro do retângulo — nenhuma linha, traço ou elemento pode tocar ou ultrapassar a borda
      - Margem de segurança de 10% entre o elemento mais externo e a borda do retângulo
    `,
                sem_bastidor: `
      - SEM moldura, SEM círculo, SEM quadrado, SEM linha de borda, SEM frame de qualquer tipo
      - no frame, no border, no circle, no oval, no hoop, no ring, no outline border
      - Apenas o bordado centralizado no fundo branco
    `
            };

            const instrucaoF = instrucaoFormatoObj[formData.formato as string] || instrucaoFormatoObj['sem_bastidor'];

            const instrucaoContencao = `
  REGRA CRÍTICA DE CONTENÇÃO — VERIFICAÇÃO FINAL (MAIS IMPORTANTE):
  - Todos os elementos do bordado devem estar COMPLETAMENTE contidos dentro da área de bordado
  - Nenhum elemento pode ultrapassar, tocar ou extrapolar os limites da composição
  - Elementos no topo da composição: devem ter margem de pelo menos 10% da borda superior
  - Elementos na base: devem ter margem de pelo menos 10% da borda inferior
  - Elementos nas laterais: devem ter margem de pelo menos 10% das bordas laterais
  - Elementos que se estendem naturalmente (conchas, flores, galhos): cortar elegantemente antes da borda, nunca ultrapassar
  - A composição deve parecer centralizada e equilibrada dentro dos limites
  - all elements must be fully contained within the embroidery area
  - no element should cross or touch the border line
  - maintain 10% safety margin from all edges
`;

            promptUsed = `You are an expert in creating embroidery transfer patterns (riscos de bordado).
${formData.modo === 'texto' ? 'Generate a black and white drawing based on the following description: "' + formData.descricao + '"' : 'Generate a black and white drawing from the reference image provided.'}

${stylePrompts[formData.style || 'minimal']}

RULES FOR ALL STYLES:

${formData.modo === 'texto' ? `1. BACKGROUND: PURE WHITE
- The result must show ONLY the subject on a clean white background
- No background elements or scenery unless explicitly requested` : `1. BACKGROUND: REMOVE ALL BACKGROUND COMPLETELY
- Extract ONLY the main subject(s) from the photo
- Place them on a PURE WHITE background
- Do NOT recreate or trace any background elements (furniture, walls, shelves, nature, objects)
- The result must show ONLY the person/object/animal on clean white`}

2. BLACK LINES ONLY
- Black lines on pure white background
- No color, no gradients, no gray tones, no shading patches
- No solid black fills — only line strokes
- Thin pen or pencil style lines

3. COMPOSITION
- Centered on white background with adequate margins
- Balanced proportions suitable for an embroidery hoop
${formData.modo === 'texto' ? '- Create a harmonious alignment' : '- Keep the natural pose and proportions from the reference'}

4. SIMPLIFICATION
- Focus on shapes and contours that a person could actually stitch with needle and thread
- Avoid extremely dense or impossible microscopic details

5. TEXT AND FACES
${formData.modo === 'texto' ? '- Remove any text from the drawing, no text, no letters, no words, no numbers allowed' : (formData.includeText ? '- Preserve any text visible in the reference image as outlined letterforms' : '- Remove any text from the image, no text, no letters')}
${facelessPrompt}

6. HOOP / FRAME SHAPE
${instrucaoF}

${instrucaoContencao}

${formData.modo === 'texto' ? 'Generate a design following ALL the rules above based on the description.' : 'REFERENCE IMAGE: Convert this image following ALL the rules above. Generate now.'}`;

            let geminiParts: any[] = [{ text: promptUsed }];
            if (formData.modo !== 'texto' && formData.imageBase64) {
                geminiParts.push({
                    inlineData: {
                        mimeType: formData.imageMediaType,
                        data: formData.imageBase64
                    }
                });
            }

            geminiPayload = {
                contents: [{
                    parts: geminiParts
                }],
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"]
                }
            };
        } else {
            // Bordado colorido
            const formatoDesc: any = {
                redondo: 'perfectly circular embroidery hoop frame, round composition',
                quadrado: 'square embroidery frame, square composition with elements filling the corners',
                retangular: 'rectangular embroidery frame, horizontal composition',
                sem_bastidor: 'no frame, open composition, elements arranged freely without a hoop border'
            };

            promptUsed = `Create a flat digital illustration of a Brazilian embroidery design (bordado brasileiro).

${formData.referenceImageBase64 ? `REFERENCE IMAGE USAGE: Use only as visual style inspiration — color mood and illustration style. Do NOT copy the elements or composition. Create an ORIGINAL design based on the description below.` : ''}

DESIGN DESCRIPTION (follow strictly, do not add elements not mentioned):
${formData.descricao}

${formData.nomeTexto ? `CRITICAL TEXT: Include EXACTLY this text: "${formData.nomeTexto}" — spelled ${formData.nomeTexto.split('').join('-')}. Zero changes, zero autocorrect.` : ''}

${formData.ocasiao ? `Occasion context: ${formData.ocasiao}.` : ''}

${formData.coresSelecionadas?.length ? `Colors: ${formData.coresSelecionadas.join(', ')}${formData.coresDescricao ? `. ${formData.coresDescricao}` : ''}` : formData.coresDescricao || ''}

${formData.formato ? `Frame: ${formatoDesc[formData.formato]}` : 'Frame: perfectly circular embroidery hoop, flat illustrated'}

Style:
- Flat vector illustration, like a Canva sticker or Etsy digital download
- NO photorealism, NO fabric texture, NO thread texture
- Clean solid fills, no shadows, no gradients
- White or cream background
- Text in elegant cursive font if requested
- ONLY include elements explicitly mentioned in the design description
- Do NOT add flowers, roses or botanical elements unless the client specifically requested them
- Do NOT add any text caption, label or description outside the design
- FLORAL STYLE RULE: When flowers or botanical elements ARE requested, always use thin, delicate, fine lines and strokes — never thick or heavy outlines. Petals should be drawn with graceful, lightweight curves. Stems should be thin and elongated. Think dainty wildflower illustration style, like hand-drawn botanical sketches with fine pen strokes. Avoid chunky, bold, or cartoonish flower rendering.

IMPORTANT: Generate ONLY what was described. Do not add decorative elements by default.

STRICT RULES - FOLLOW EXACTLY:
- Generate ONLY elements explicitly mentioned by the user
- Do NOT add flowers, wreaths, botanical borders, or decorative frames by default
- Do NOT repeat elements from previous generations
- Do NOT add animals, objects or themes not mentioned
- Do NOT add text if the user did not request text
- The hoop frame must ALWAYS be light-colored wood, circular/square/rectangular depending on the format requested.
- The hoop frame must ALWAYS be perfectly centered and fully visible within the image margins, not cut off.
- Maintain a consistent visual style for the wooden embroidery hoop across all generations.
- The frame/hoop shape should only appear if the user selected a format — if "sem bastidor" selected, no frame at all
- If the user described a minimalist design, keep it minimalist — do not fill empty space with decorative elements
- Treat each generation as completely independent — no memory of previous outputs
- The user's description is the ONLY source of truth for what appears in the image`;

            geminiPayload = {
                contents: [{
                    parts: [
                        { text: promptUsed },
                        ...(formData.referenceImageBase64 ? [{
                            inlineData: {
                                mimeType: formData.referenceImageMediaType || 'image/jpeg',
                                data: formData.referenceImageBase64
                            }
                        }] : [])
                    ]
                }],
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"]
                }
            };
        }

        try {
            console.log('Enviando requisição ao Gemini...');
            const geminiResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiPayload)
            });

            if (!geminiResponse.ok) {
                throw new Error(`Gemini API Error: ${await geminiResponse.text()}`);
            }

            const geminiData = await geminiResponse.json();

            const parts = geminiData?.candidates?.[0]?.content?.parts;
            const imagePart = parts?.find((p: any) => p.inlineData);
            const base64Image = imagePart?.inlineData?.data;

            if (!base64Image) {
                throw new Error('Gemini did not return an image.');
            }

            // 9. Upload da imagem
            const buffer = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
            const storagePath = `${userId}/${generationId}.png`;

            console.log('Fazendo upload para o Storage...');
            const { error: uploadError } = await supabaseAdmin.storage
                .from('generations')
                .upload(storagePath, buffer, {
                    contentType: 'image/png',
                    upsert: false
                });

            if (uploadError) throw new Error('Storage Upload fail: ' + uploadError.message);

            // 10. Assinar URL
            const { data: signedData, error: signedError } = await supabaseAdmin.storage
                .from('generations')
                .createSignedUrl(storagePath, 7200); // 2 hours

            if (signedError || !signedData) throw new Error('Signed URL creation failed');

            const imageExpiresAt = new Date(Date.now() + 7200 * 1000).toISOString();

            // 11. Finalizar Record
            await supabaseAdmin
                .from('generations')
                .update({
                    status: 'completed',
                    image_storage_path: storagePath,
                    image_public_url: signedData.signedUrl,
                    image_expires_at: imageExpiresAt,
                    prompt_used: promptUsed,
                    completed_at: new Date().toISOString()
                })
                .eq('id', generationId);

            // 12. Retornar
            return new Response(JSON.stringify({
                success: true,
                imageUrl: signedData.signedUrl,
                generationId: generationId,
                imageExpiresAt: imageExpiresAt
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (innerError: any) {
            // Rollback se a IA falhar
            console.error('Falha na IA:', innerError);

            if (!isAdmin) {
                if (creditSource === 'monthly') {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ free_generations_used: freeUsed }) // reverter +1
                        .eq('id', userId);
                } else {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ extra_credits: extraCredits }) // reverter -1
                        .eq('id', userId);
                }
            }

            await supabaseAdmin
                .from('generations')
                .update({
                    status: 'failed',
                    error_message: innerError.message
                })
                .eq('id', generationId);

            return new Response(JSON.stringify({
                success: false,
                error: "Não foi possível gerar. Tente novamente."
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
        }

    } catch (err: any) {
        console.error('Erro geral no Edge Function:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
