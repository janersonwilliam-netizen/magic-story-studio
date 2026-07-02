/**
 * Gemini AI functions specific to the Histórias Palito module
 */

async function callVertexText(prompt: string, options: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}): Promise<string> {
    const response = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            temperature: options.temperature ?? 0.8,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
            jsonMode: options.jsonMode ?? false,
        }),
    });
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(data.error || `Erro HTTP ${response.status}`);
    return data.text as string;
}

// ── Ideias virais ────────────────────────────────────────────────────────────

export async function generatePalitoIdeas(tema?: string): Promise<string[]> {
    const temaInstructions = tema
        ? `O usuário informou o tema: "${tema}". Gere 10 ângulos DIFERENTES para abordar esse tema, usando os ângulos virais comprovados (pergunta direta, revelação surpreendente, reconfiguração de algo comum, fato histórico, explicação de como funciona, etc.). Todos os títulos devem girar em torno do assunto informado.`
        : `Gere 10 ideias LIVRES dentro do nicho de curiosidades gerais — responde dúvidas do cotidiano, explica como as coisas funcionam, conta histórias de invenções, fatos surpreendentes, curiosidades sobre profissões, objetos, lugares, animais, eventos e fenômenos do dia a dia.`;

    const prompt = `Você é um criador de conteúdo viral especializado em vídeos educativos doodle para YouTube.

${temaInstructions}

REGRAS:
- Cada título deve despertar curiosidade genuína e ser impossível de ignorar no feed
- Use ângulos como: "Como é feito/produzido ___?", "Por que você ___?", "Quanto ganha um ___?", "Quem inventou ___?", "O que acontece quando você ___?", "Você nunca percebeu que ___", "Como funciona ___?", "Fatos sobre ___ que vão te surpreender"
- Nunca use títulos que soem como reportagem, opinião política ou entretenimento puro sem valor educativo
- Todos os títulos em PORTUGUÊS BRASILEIRO
- Menos de 70 caracteres cada

Retorne APENAS um JSON válido neste formato exato, sem markdown, sem explicações:
{"ideas": ["Título 1", "Título 2", "Título 3", "Título 4", "Título 5", "Título 6", "Título 7", "Título 8", "Título 9", "Título 10"]}`;

    const raw = await callVertexText(prompt, { temperature: 0.9 });
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.ideas as string[];
}

// ── Roteiro ──────────────────────────────────────────────────────────────────

export async function generatePalitoScript(title: string): Promise<string> {
    const prompt = `Você é um roteirista profissional de vídeos educativos para YouTube.

TÍTULO DO VÍDEO: "${title}"

Escreva o roteiro COMPLETO de narração com EXATAMENTE os 5 blocos abaixo, na ordem indicada, sem pular nenhum. O texto total deve ter entre 580 e 680 palavras — NÃO ultrapasse 680 palavras.

---
BLOCO 1 — GANCHO
Tamanho: 50 palavras exatas.
Abra com uma pergunta ou situação do cotidiano impossível de ignorar. A última frase deve criar suspense para o que vem a seguir.

---
BLOCO 2 — CONTEXTO
Tamanho: 100 palavras exatas.
Apresente o cenário completo com dados, números e história de fundo. Explique a dimensão real do tema.

---
BLOCO 3 — EXPLICAÇÃO DETALHADA
Tamanho: 320 palavras exatas.
Este é o coração do vídeo. Desenvolva o tema em profundidade:
- Explique os mecanismos e processos passo a passo
- Cite pelo menos 1 pesquisador ou estudo real com nome e instituição, incorporado naturalmente
- Revele detalhes que a maioria desconhece
- Use exemplos concretos e comparações para facilitar a compreensão
NÃO resuma — desenvolva cada ponto completamente.

---
BLOCO 4 — FATO SURPREENDENTE
Tamanho: 80 palavras exatas.
Revele uma informação contra-intuitiva ou chocante que o espectador vai querer contar para alguém agora.

---
BLOCO 5 — CONCLUSÃO
Tamanho: 60 palavras exatas.
Amarre tudo. Ecoe a primeira frase do roteiro de forma reconfigurada. Termine com algo que fique na memória.

---
REGRAS ABSOLUTAS:
- Narração corrida — SEM títulos de bloco, SEM listas com traços, SEM indicações de cena, SEM parênteses no texto final
- 2ª pessoa ("você", "seu cérebro") — nunca "nós" ou "eu"
- Ritmo: Frase curta. Frase curta. Uma frase mais longa. Frase curta. Pergunta a cada 4–6 frases.
- Todo termo técnico explicado imediatamente em linguagem simples
- Português brasileiro
- LIMITE RÍGIDO: o texto final NÃO pode ultrapassar 680 palavras

Retorne APENAS o texto corrido dos 5 blocos unidos, sem nenhum marcador, título ou separador entre eles.`;

    const raw = await callVertexText(prompt, { temperature: 0.7, maxOutputTokens: 6000 });

    const CTA = '\n\nSe você gostou, não esquece de se inscrever no canal e deixar o seu like! E se ficou com alguma dúvida, deixa nos comentários: teremos o maior prazer em transformar a sua pergunta no próximo vídeo do Uma Dúvida!';

    return raw.trim() + CTA;
}

// ── Roteiro Shorts (≤60s, viral) ───────────────────────────────────────────────

export async function generatePalitoShortsScript(title: string): Promise<string> {
    const prompt = `Você é um roteirista especialista em Shorts/Reels virais de curiosidades educativas.

TÍTULO DO SHORT: "${title}"

Escreva o roteiro COMPLETO de narração com EXATAMENTE os 5 blocos abaixo, na ordem indicada, sem pular nenhum. O texto total deve ter entre 140 e 190 palavras — DURAÇÃO MÁXIMA DE 60 SEGUNDOS (base: 140 palavras/min). NÃO ultrapasse 190 palavras de forma alguma.

---
BLOCO 1 — GANCHO (0-3s)
Tamanho: 10 a 15 palavras.
Primeira frase chocante, pergunta direta ou afirmação contraintuitiva. PROIBIDO abrir com "você sabia", "hoje vamos falar", "olá" ou qualquer saudação. Tem que parar o dedo no feed.

---
BLOCO 2 — TENSÃO/PROMESSA (3-8s)
Tamanho: 15 a 20 palavras.
Cria curiosidade do que vem a seguir, sem entregar a resposta ainda.

---
BLOCO 3 — DESENVOLVIMENTO (8-45s)
Tamanho: 80 a 110 palavras.
UMA ÚNICA ideia central, sem desvios. Frases curtas e diretas. Não enrole, não repita.

---
BLOCO 4 — REVELAÇÃO/CLÍMAX (45-55s)
Tamanho: 20 a 30 palavras.
O "pulo do gato" — a informação mais surpreendente da história, entregue de forma direta e impactante.

---
BLOCO 5 — FECHO/LOOP (55-60s)
Tamanho: 10 a 15 palavras.
Frase de impacto final que gera comentário ou vontade de assistir de novo. PROIBIDO usar "se inscreva", "deixa o like" ou pedir ação de plataforma.

---
REGRAS ABSOLUTAS:
- Narração corrida — SEM títulos de bloco, SEM listas, SEM indicações de cena, SEM parênteses
- 2ª pessoa ("você") — nunca "nós" ou "eu"
- Frases curtas. Ritmo acelerado. Zero enrolação, zero introdução, zero despedida de canal
- Português brasileiro
- LIMITE RÍGIDO: o texto final NÃO pode ultrapassar 190 palavras

Retorne APENAS o texto corrido dos 5 blocos unidos, sem nenhum marcador, título ou separador entre eles.`;

    const raw = await callVertexText(prompt, { temperature: 0.8, maxOutputTokens: 4096 });
    return raw.trim();
}

// ── Prompts de cena ──────────────────────────────────────────────────────────

const STYLE_ANCHOR = `2D doodle cartoon illustration, very thick bold black outlines, clean crisp lines, NO 3D rendering, high contrast, stick figure proportions, main character: large perfectly circular white head (no shading on head), 4-5 SHORT thin diagonal spiky hair lines on top of head (short, close to head, NOT wild or long), two small black dot eyes, straight thin eyebrows, simple expressive mouth with colored tongue when open, medium gray t-shirt (#9E9E9E) with subtle inner shading, dark gray shorts (#555555) with subtle inner shading, very thin stick arms, small circular white fists, thin stick legs, small white oval feet, flat oval shadow under feet,`;

const STYLE_CLOSE = `no photorealism, no 3D rendering, no anime style, very thick bold outlines, vibrant colors with subtle inner shading for depth on objects, high contrast composition, 16:9 ratio, educational YouTube doodle channel style. MINIMIZE text in the image — avoid signs, labels, and written words unless the text IS the visual content. When text appears inside the image (signs, boards, numbers, dates) it MUST be in Brazilian Portuguese, never in English.`;

const STYLE_CLOSE_SHORTS = `no photorealism, no 3D rendering, no anime style, very thick bold outlines, vibrant colors with subtle inner shading for depth on objects, high contrast composition, 9:16 vertical ratio, character and key elements centered and large to read well on mobile, educational YouTube Shorts doodle channel style. MINIMIZE text in the image — avoid signs, labels, and written words unless the text IS the visual content. When text appears inside the image it MUST be in Brazilian Portuguese, never in English.`;

const SCENE_BATCH_SIZE = 8;

const FALLBACK_PROMPT = 'doodle illustration, white background, stick figure character, neutral expression, explaining concept with hands';

function repairAndParsePromptsJson(raw: string, expectedCount: number): string[] {
    const clean = raw.replace(/```json|```/g, '').trim();

    // Try full parse first
    try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.prompts)) {
            const result = parsed.prompts as string[];
            // Pad if model returned fewer than expected
            while (result.length < expectedCount) result.push(FALLBACK_PROMPT);
            return result.slice(0, expectedCount);
        }
    } catch { /* fall through to repair */ }

    // Extract whatever prompts were generated before truncation
    const matches = [...clean.matchAll(/"([^"]{10,})"/g)]
        .map(m => m[1])
        .filter(s => !s.startsWith('{') && s.length > 20);

    const result = matches.slice(0, expectedCount);
    // Pad missing entries so callers always get exactly expectedCount items
    while (result.length < expectedCount) result.push(FALLBACK_PROMPT);
    return result;
}

interface SceneBatchEntry { prompt: string; char: string; }

function repairAndParseScenesBatch(raw: string, expectedCount: number): SceneBatchEntry[] {
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.scenes)) {
            const result = parsed.scenes as SceneBatchEntry[];
            while (result.length < expectedCount) result.push({ prompt: FALLBACK_PROMPT, char: 'main' });
            return result.slice(0, expectedCount);
        }
    } catch { /* fall through */ }
    // Fallback: reuse old string parser
    const prompts = repairAndParsePromptsJson(raw, expectedCount);
    return prompts.map(p => ({ prompt: p, char: 'main' }));
}

async function generateScenePromptBatch(
    batch: Array<{ timestamp: string; text: string }>,
    title: string,
    batchIndex: number,
    storyCharNames: string[]
): Promise<SceneBatchEntry[]> {
    const transcriptionText = batch
        .map((l, i) => `${batchIndex * SCENE_BATCH_SIZE + i + 1}. [${l.timestamp}] ${l.text}`)
        .join('\n');

    const charList = storyCharNames.length > 0
        ? `\nStory characters that exist in this video (can appear in scenes): ${storyCharNames.map(n => `"${n}"`).join(', ')}`
        : '';

    const totalScenes = batch.length;
    const mainCount = Math.round(totalScenes * 0.40);
    const storyCount = storyCharNames.length > 0 ? Math.round(totalScenes * 0.20) : 0;
    const noneCount = totalScenes - mainCount - storyCount;

    const prompt = `Image prompts for a doodle YouTube video titled: "${title}"${charList}

For each scene below, write ONE short English prompt (max 30 words) and assign a character type.

SCENES:
${transcriptionText}

CHARACTER TYPE rules — distribute across the ${totalScenes} scenes roughly as:
- "main": ~${mainCount} scenes — include the stick figure narrator. Use for narration, explanation, reaction moments.
- "none": ~${noneCount} scenes — NO character at all. Pure environment or objects. Use for places, events, wide concepts, historical establishing shots.
${storyCharNames.length > 0 ? `- "story:Name": ~${storyCount} scenes — use when the scene describes a specific story character in action (use exact name from list above).` : ''}

Background rules:
- WHITE BACKGROUND: abstract, conceptual, single object/action scenes. Character + objects on plain white.
- DRAWN ENVIRONMENT: real places or situations. "drawn doodle classroom", "doodle night sky with stars", "cartoon ancient cave with fire". NOT flat color — a drawn setting.
- At least 50% of scenes use white background.

Object rules:
- Bold vivid fill colors with inner shading
- Expressions for "main" char: shocked(open mouth O), confused(raised eyebrow), happy(curved mouth/arms up), thinking(chin hand), neutral

Text rules:
- AVOID text — most scenes NO text at all
- Only add text when a number/date IS the central point
- ALL text inside images MUST be in Brazilian Portuguese

Return ONLY valid JSON, one line, no markdown:
{"scenes":[{"prompt":"...","char":"main"},{"prompt":"...","char":"none"},{"prompt":"...","char":"story:Name"},...]}`;

    const raw = await callVertexText(prompt, { temperature: 0.7, maxOutputTokens: 4096 });
    return repairAndParseScenesBatch(raw, batch.length);
}

export async function generatePalitoScenePrompts(
    transcription: Array<{ timestamp: string; text: string }>,
    title: string,
    onBatchProgress?: (doneBatches: number, totalBatches: number) => void,
    format: 'VIDEO' | 'SHORTS' = 'VIDEO',
    storyCharacters?: Array<{ name: string }>
): Promise<string[]> {
    const storyCharNames = (storyCharacters || []).map(c => c.name);
    const allEntries: SceneBatchEntry[] = [];
    const totalBatches = Math.ceil(transcription.length / SCENE_BATCH_SIZE);

    for (let i = 0; i < transcription.length; i += SCENE_BATCH_SIZE) {
        const batch = transcription.slice(i, i + SCENE_BATCH_SIZE);
        const batchIndex = Math.floor(i / SCENE_BATCH_SIZE);
        onBatchProgress?.(batchIndex + 1, totalBatches);
        const entries = await generateScenePromptBatch(batch, title, batchIndex, storyCharNames);
        allEntries.push(...entries);
    }

    const styleClose = format === 'SHORTS' ? STYLE_CLOSE_SHORTS : STYLE_CLOSE;

    return allEntries.map(({ prompt: desc, char }) => {
        if (char === 'none') {
            // No character — character-free scene, no STYLE_ANCHOR
            return `CHARACTER-FREE doodle scene, no stick figure, no narrator character. ${desc}, ${styleClose}`;
        }
        if (char.startsWith('story:')) {
            // Story character — encode name as prefix so ScenesPage can resolve refs
            const name = char.replace('story:', '').trim();
            return `##REFS:${name}## ${desc}, ${styleClose}`;
        }
        // Default: main stick figure narrator
        return `${STYLE_ANCHOR} ${desc}, ${styleClose}`;
    });
}

// ── Personagens da história ───────────────────────────────────────────────────

export async function extractStoryCharacters(
    title: string,
    script: string
): Promise<Array<{ name: string; description: string }>> {
    const prompt = `Você é um diretor de animação doodle para YouTube educativo.

Título: "${title}"
Roteiro (trecho): "${script.substring(0, 1200)}..."

Identifique até 3 personagens REAIS que APARECEM ou SÃO MENCIONADOS na história — não o narrador. Podem ser pessoas históricas, figuras genéricas (ex: "Homo sapiens primitivo", "Faraó egípcio", "Cientista"), animais ou entidades representáveis visualmente.

Para cada personagem, crie uma descrição visual CURTA para gerar imagem doodle 2D (em inglês, máx 40 palavras), especificando: tipo, roupa/aparência, expressão, cor de pele ou pelagem se relevante.

Se o roteiro não tiver personagens visuais claros (ex: é puramente conceitual), retorne array vazio.

Retorne APENAS JSON válido:
{"characters":[{"name":"Nome em português","description":"visual description in English for image generation"}]}`;

    const raw = await callVertexText(prompt, { temperature: 0.5, maxOutputTokens: 800 });
    const clean = raw.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return ((parsed.characters || []) as Array<{ name: string; description: string }>).slice(0, 3);
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

export interface PalitoThumbnailData {
    textRed: string;
    textBlack: string;
    object1: string;
    object2: string;
    characterAction: string;
}

export async function generatePalitoThumbnailData(title: string, script?: string): Promise<PalitoThumbnailData> {
    const scriptContext = script
        ? `\nRoteiro completo (use para extrair os elementos mais marcantes e surpreendentes da história):\n"${script.substring(0, 900)}${script.length > 900 ? '...' : ''}"`
        : '';

    const prompt = `Você é um especialista em capas virais de YouTube educativo (estilo Tudo Explicadim, Zenn, Me Poupe).

Título do vídeo: "${title}"${scriptContext}

✅ OBRIGATÓRIO: A frase deve expressar a EMOÇÃO ou REVELAÇÃO que o vídeo entrega — não repita o título, expresse o impacto emocional.

EXEMPLOS de frases que funcionam bem:
- Título: "Como era a noite dos humanos antigos?" → Frase: "ELES TINHAM MEDO DO ESCURO"
- Título: "Quanto ganha um astronauta da NASA?" → Frase: "ESSE SALÁRIO VAI TE CHOCAR"
- Título: "Por que choramos ao cortar cebola?" → Frase: "SEU OLHO ESTÁ SE DEFENDENDO"
- Título: "Como funciona o motor de um carro?" → Frase: "POUCAS PESSOAS SABEM DISSO"
- Título: "O que acontece com o corpo sem dormir?" → Frase: "SEU CÉREBRO COMEÇA A ALUCINAR"
- Título: "Como humanos sobreviveram ao FRIO EXTREMO da Era do Gelo?" → Frase: "ELES TREMIAM DE MEDO"

A frase deve ter 4 a 6 palavras e ser dividida em 2 partes:
- textRed: 2 a 3 palavras — o trecho mais chocante ou emocional
- textBlack: o restante que completa o sentido

Escolha 2 objetos visuais CONCRETOS que representam o conteúdo do vídeo. Use elementos específicos do roteiro. Descreva em inglês em NO MÁXIMO 6 palavras cada (ex: "woolly mammoth with snow", "primitive stone tools").

Responda SOMENTE com JSON válido, sem markdown, em UMA ÚNICA LINHA:
{"textRed":"...","textBlack":"...","object1":"...","object2":"...","characterAction":"..."}`;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const raw = await callVertexText(prompt, { temperature: 0.7 + attempt * 0.1, maxOutputTokens: 2048, jsonMode: true });
            console.log(`[Thumbnail] attempt ${attempt + 1} raw:`, raw?.substring(0, 300));
            if (!raw) continue;
            const clean = raw.replace(/```json|```/g, '').trim();
            const match = clean.match(/\{[\s\S]*\}/);
            if (!match) { console.warn('[Thumbnail] no JSON found in response'); continue; }
            const data = JSON.parse(match[0]) as PalitoThumbnailData;
            if (data.textRed && data.textBlack && data.object1) return data;
            console.warn('[Thumbnail] missing required fields:', data);
        } catch (err) {
            console.warn(`[Thumbnail] attempt ${attempt + 1} failed:`, err);
        }
    }
    // Fallback — throw so the user sees the error instead of silent generic data
    throw new Error('Não foi possível gerar a composição da capa. Verifique o console e tente novamente.');
}

const THUMBNAIL_STYLE_CLOSE = `no photorealism, no 3D, no anime style, very thick bold outlines, vibrant flat colors on objects and character, PURE WHITE BACKGROUND (no yellow, no colored background, no border, no frame), high contrast composition, 16:9 ratio, educational YouTube doodle channel style.`;

export function buildPalitoThumbnailPrompt(data: PalitoThumbnailData): string {
    const fullText = `${data.textRed} ${data.textBlack}`.trim();
    return [
        'PURE WHITE background, no colored background, no border, no frame, hand-drawn 2D doodle illustration style,',
        'thick black marker outlines, flat colors on objects only, no gradients, no shadows, no textures,',
        `large bold uppercase title text at the VERY TOP of the image reading "${fullText}",`,
        `the words "${data.textRed}" are rendered in bold RED color, the words "${data.textBlack}" are rendered in bold BLACK color,`,
        'title text is very large occupying the top 25% of the image height,',
        'ONE single stick figure character positioned on the LEFT THIRD of the frame below the title,',
        'stick figure: large circular white head with 4 to 5 thin spiky hair lines on top, two black dot eyes, gray t-shirt, dark gray shorts, round white fists,',
        `character is ${data.characterAction},`,
        `${data.object1} drawn in cartoon doodle style placed in the CENTER-RIGHT of the frame,`,
        `${data.object2} near the central object,`,
        'thick bold red curved arrow pointing from the character toward the central object,',
        'only ONE character total, high contrast composition, white space background,',
        THUMBNAIL_STYLE_CLOSE,
    ].join(' ');
}

export function buildPalitoThumbnailPromptB(data: PalitoThumbnailData): string {
    // Format B: hero object large and centered, character small reacting at bottom-left corner,
    // text split: red word(s) top-left, black word(s) bottom-right — dynamic diagonal composition
    return [
        'PURE WHITE background, no colored background, no border, no frame, hand-drawn 2D doodle illustration style,',
        'thick black marker outlines, flat colors on objects only, no gradients, no shadows, no textures,',
        `bold uppercase text "${data.textRed}" in very large RED letters positioned at the TOP-LEFT of the image,`,
        `bold uppercase text "${data.textBlack}" in very large BLACK letters positioned at the BOTTOM-RIGHT of the image,`,
        'both text blocks are large and bold, creating a diagonal visual tension across the frame,',
        `${data.object1} drawn very LARGE in cartoon doodle style, centered and dominant, occupying 50% of the frame height,`,
        `${data.object2} smaller, near the main object,`,
        'ONE single stick figure character drawn SMALL positioned at the BOTTOM-LEFT corner of the frame,',
        'stick figure: large circular white head with 4 to 5 thin spiky hair lines on top, two black dot eyes, gray t-shirt, dark gray shorts, round white fists,',
        `character is ${data.characterAction},`,
        'dramatic thick bold red curved arrow pointing from the character toward the large central object,',
        'the composition is bold and asymmetric — large object dominates the center, tiny character at bottom-left corner,',
        'only ONE character total, high contrast, white space background,',
        THUMBNAIL_STYLE_CLOSE,
    ].join(' ');
}

// ── Metadados ─────────────────────────────────────────────────────────────────

export async function generatePalitoMetadata(title: string, script: string, format: 'VIDEO' | 'SHORTS' = 'VIDEO'): Promise<{
    viralTitle: string;
    description: string;
    tags: string[];
}> {
    const isShorts = format === 'SHORTS';
    const prompt = `Você é um especialista em SEO e crescimento de canais do YouTube no nicho de curiosidades educativas.

Título do ${isShorts ? 'Short' : 'vídeo'}: "${title}"
Trecho do roteiro (primeiros 300 chars): "${script.substring(0, 300)}..."

Gere os metadados completos prontos para publicação no YouTube${isShorts ? ' Shorts' : ''}.

REGRAS:
- Título viral: menos de 70 caracteres, orientado à curiosidade, sem clickbait que o roteiro não cumpra
- Descrição: gancho de 2-3 frases que espelhe a abertura do roteiro + parágrafo de 3-4 frases resumindo o que o espectador vai descobrir (2ª pessoa calma) + linha convidando curtidas/comentários/inscrições + bloco de ${isShorts ? '8-12' : '15-25'} hashtags relevantes em uma única linha${isShorts ? ' (inclua #Shorts como a primeira hashtag)' : ''}
- Tags: 25 a 40 palavras-chave SEO separadas por vírgula, misturando termos amplos (curiosidades, ciência, história, fatos inacreditáveis) com frases de cauda longa específicas do tema${isShorts ? ', incluindo "shorts" e "youtube shorts" entre elas' : ''}
- Tudo em PORTUGUÊS BRASILEIRO

Retorne APENAS um JSON válido:
{"viralTitle": "...", "description": "...", "tags": ["tag1", "tag2", ...]}`;

    const raw = await callVertexText(prompt, { temperature: 0.7 });
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
        viralTitle: parsed.viralTitle,
        description: parsed.description,
        tags: parsed.tags,
    };
}

// ── Transcrição de áudio ──────────────────────────────────────────────────────

export async function transcribeAudioWithGemini(audioUrl: string): Promise<Array<{ timestamp: string; text: string }>> {
    const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
    });
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(data.error || `Erro HTTP ${response.status}`);
    return data.transcription as Array<{ timestamp: string; text: string }>;
}
