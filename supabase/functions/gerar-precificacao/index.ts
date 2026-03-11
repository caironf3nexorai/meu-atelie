import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseClient } from "../_shared/supabase-client.ts";
import { PricingFormData, PricingResponse } from "../_shared/types.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        // 1. Verificar JWT → extrair user_id
        const { data: { user }, error: userError } = await supabaseClient(authHeader).auth.getUser();
        if (userError || !user) throw new Error('Unauthorized');
        const userId = user.id;

        // 2. Verificar profile e plano
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('plan, status')
            .eq('id', userId)
            .single();

        if (profile?.status !== 'active') throw new Error('User blocked');
        if (profile?.plan !== 'premium') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Acesso negado. A Precificação IA é um recurso Premium.'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
        }

        const { formData } = await req.json() as { formData: PricingFormData };

        // 3. Cálculo base
        const laborCost = formData.laborHours * formData.hourlyRate;
        const totalCost = formData.materialsCost + laborCost + formData.overheadCost;
        const finalPrice = totalCost * (1 + formData.profitMargin / 100);

        const calculationResults = {
            laborCost,
            totalCost,
            finalPrice
        };

        // 4. Chamar Gemini para analise e dicas
        const promptUsed = `Você é uma especialista em precificação de artesanato e bordados à mão no Brasil.
Uma bordadeira precisa precificar o seguinte produto: ${formData.productName}
${formData.productDescription ? `Descrição: ${formData.productDescription}` : ''}

Dados financeiros:
- Custo de materiais: R$ ${formData.materialsCost}
- Horas de trabalho: ${formData.laborHours}h a R$ ${formData.hourlyRate}/h
- Custos fixos rateados: R$ ${formData.overheadCost}
- Margem de lucro desejada: ${formData.profitMargin}%
- Preço calculado: R$ ${finalPrice.toFixed(2)}

Forneça em formatação puramente JSON:
{
  "marketAnalysis": "análise breve do preço em relação ao mercado de bordados brasileiro",
  "suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"],
  "priceRange": { "min": número, "max": número },
  "tips": "dica prática para aumentar o valor percebido"
}
Responda APENAS com o JSON, validado corretamente, sem blocos de markdown e tags \`\`\`json em torno.`;

        let geminiAnalysis: any = {};

        try {
            console.log('Consultando API do Gemini para Estratégia de Precificação...');
            const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

            const geminiResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptUsed }] }],
                    // Instruindo o Gemini nativamente em JSON mode melhora a formatação
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!geminiResponse.ok) {
                throw new Error(`Gemini API Error: ${await geminiResponse.text()}`);
            }

            const geminiData = await geminiResponse.json();
            const rawOutput = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (rawOutput) {
                // Safe JSON Parse para não quebrar a Edge em caso da IA "viajar" um pouco
                try {
                    geminiAnalysis = JSON.parse(rawOutput.trim());
                } catch (e) {
                    // Fallback if the parser fails due to stray backticks
                    const fallbackMatches = rawOutput.match(/\{[\s\S]*?\}/);
                    if (fallbackMatches) geminiAnalysis = JSON.parse(fallbackMatches[0]);
                }
            }

        } catch (geminiError) {
            console.error('O Gemini falhou, mas a base do cálculo procede', geminiError);
            // Fica vazio ou preenche fallback
            geminiAnalysis = {
                marketAnalysis: "A análise de inteligência artificial falhou temporariamente.",
                suggestions: ["Reveja os valores lançados para certificar-se de rentabilidade."],
                priceRange: { min: finalPrice * 0.9, max: finalPrice * 1.5 },
                tips: "Revise os atributos da sua arte sempre."
            };
        }

        // 5. Salvar histórico
        const { data: pricingDbResult, error: insertError } = await supabaseAdmin
            .from('pricing_calculations')
            .insert({
                user_id: userId,
                product_name: formData.productName,
                materials_cost: formData.materialsCost,
                labor_hours: formData.laborHours,
                hourly_rate: formData.hourlyRate,
                overhead_cost: formData.overheadCost,
                profit_margin: formData.profitMargin,
                final_price: finalPrice,
                form_data: formData
            })
            .select('id')
            .single();

        if (insertError) console.error('Erro de gravação do histórico da precificação', insertError);

        // 6. Retornar
        const responsePayload: PricingResponse = {
            success: true,
            calculation: calculationResults,
            geminiAnalysis,
            calculationId: pricingDbResult?.id
        };

        return new Response(JSON.stringify(responsePayload), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Erro na função gerar-precificacao:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
