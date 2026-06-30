/**
 * Gemini AI functions specific to the Histórias Palito module
 */

async function callVertexText(prompt: string, options: { temperature?: number; maxOutputTokens?: number } = {}): Promise<string> {
    const response = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            temperature: options.temperature ?? 0.8,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
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

// ── Prompts de cena ──────────────────────────────────────────────────────────

const STYLE_ANCHOR = `2D doodle cartoon illustration, very thick bold black outlines, clean crisp lines, NO 3D rendering, high contrast, stick figure proportions, main character: large perfectly circular white head (no shading on head), 4-5 SHORT thin diagonal spiky hair lines on top of head (short, close to head, NOT wild or long), two small black dot eyes, straight thin eyebrows, simple expressive mouth with colored tongue when open, medium gray t-shirt (#9E9E9E) with subtle inner shading, dark gray shorts (#555555) with subtle inner shading, very thin stick arms, small circular white fists, thin stick legs, small white oval feet, flat oval shadow under feet,`;

const STYLE_CLOSE = `no photorealism, no 3D rendering, no anime style, very thick bold outlines, vibrant colors with subtle inner shading for depth on objects, high contrast composition, 16:9 ratio, educational YouTube doodle channel style. Any text written INSIDE the image (signs, boards, labels, numbers, dates, statistics) MUST be in Brazilian Portuguese.`;

const SCENE_BATCH_SIZE = 8;

function repairAndParsePromptsJson(raw: string, expectedCount: number): string[] {
    const clean = raw.replace(/```json|```/g, '').trim();

    // Try full parse first
    try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.prompts)) return parsed.prompts;
    } catch { /* fall through to repair */ }

    // Extract whatever prompts were generated before truncation
    const matches = [...clean.matchAll(/"([^"]{10,})"/g)]
        .map(m => m[1])
        .filter(s => !s.startsWith('{') && s.length > 20);

    if (matches.length > 0) return matches.slice(0, expectedCount);

    // Last resort: return empty strings so the batch doesn't throw
    return Array(expectedCount).fill('doodle illustration, white background, stick figure character, neutral expression');
}

async function generateScenePromptBatch(
    batch: Array<{ timestamp: string; text: string }>,
    title: string,
    batchIndex: number
): Promise<string[]> {
    const transcriptionText = batch
        .map((l, i) => `${batchIndex * SCENE_BATCH_SIZE + i + 1}. [${l.timestamp}] ${l.text}`)
        .join('\n');

    const prompt = `Image prompts for a doodle YouTube video titled: "${title}"

For each scene below, write ONE short English prompt (max 35 words).

SCENES:
${transcriptionText}

Background rules (choose the most fitting):
- WHITE BACKGROUND (default): use when the scene is abstract, conceptual, or focused on a single object/action. Character + objects on plain white.
- DRAWN ENVIRONMENT: use when the scene describes a real place or situation. Describe the setting as a drawn doodle scene: "drawn doodle classroom with chalkboard and desks", "doodle night sky with stars and moon", "cartoon city skyline with buildings", "doodle ancient cave with fire". NOT a flat color — a drawn environment.
- Use white background for at least 50% of scenes.

Character rules:
- MOST scenes include the stick figure character with an expression
- Some scenes (10-20%) can be CHARACTER-FREE: just show the environment or objects when the scene is describing a place, historical event, or wide concept (e.g. "doodle aerial view of ancient city", "cartoon timeline showing 1900 to 2000", "giant globe with continents")

Object rules:
- Objects must have bold vivid fill colors with inner shading for depth
- Expressions: shocked(open mouth O), confused(raised eyebrow), happy(curved mouth/arms up), thinking(chin hand), neutral

Other rules:
- Keep each prompt under 35 words
- If scene mentions dates, numbers, statistics or needs a sign/board: write the actual content in Portuguese (ex: sign reading "1969", board showing "80%", label "R$ 2.000")

Return ONLY valid JSON, no extra text:
{"prompts":["prompt1","prompt2",...]}`;

    const raw = await callVertexText(prompt, { temperature: 0.7, maxOutputTokens: 2048 });
    return repairAndParsePromptsJson(raw, batch.length);
}

export async function generatePalitoScenePrompts(
    transcription: Array<{ timestamp: string; text: string }>,
    title: string,
    onBatchProgress?: (doneBatches: number, totalBatches: number) => void
): Promise<string[]> {
    const allPrompts: string[] = [];
    const totalBatches = Math.ceil(transcription.length / SCENE_BATCH_SIZE);

    for (let i = 0; i < transcription.length; i += SCENE_BATCH_SIZE) {
        const batch = transcription.slice(i, i + SCENE_BATCH_SIZE);
        const batchIndex = Math.floor(i / SCENE_BATCH_SIZE);
        onBatchProgress?.(batchIndex + 1, totalBatches);
        const descriptions = await generateScenePromptBatch(batch, title, batchIndex);
        allPrompts.push(...descriptions);
    }

    return allPrompts.map(desc => `${STYLE_ANCHOR} ${desc}, ${STYLE_CLOSE}`);
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

function hookOverlapsTitle(hook: string, title: string): boolean {
    const stopWords = new Set(['a', 'o', 'e', 'de', 'do', 'da', 'em', 'no', 'na', 'um', 'uma', 'os', 'as', 'dos', 'das', 'nos', 'nas', 'que', 'se', 'por', 'para', 'com', 'ao', 'à']);
    const titleWords = title.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const hookWords = hook.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/);
    const matches = titleWords.filter(w => hookWords.includes(w));
    return matches.length >= 2;
}

export async function generatePalitoThumbnailData(title: string, script?: string): Promise<PalitoThumbnailData> {
    const scriptContext = script
        ? `\nTrecho do roteiro: "${script.substring(0, 400)}..."`
        : '';

    const buildPrompt = (strict: boolean) => `Você é um especialista em capas virais de YouTube educativo (estilo Tudo Explicadim, Zenn, Me Poupe).

Título do vídeo: "${title}"${scriptContext}

⛔ PROIBIDO: A frase da capa NÃO PODE conter nenhuma das palavras-chave do título acima.
⛔ PROIBIDO: Não use prefixos como "SURPRESA:", "INCRÍVEL:", "REVELADO:" seguidos do título.
✅ OBRIGATÓRIO: A frase deve expressar a EMOÇÃO ou REVELAÇÃO que o vídeo entrega — não descreva o tema.

${strict ? '⚠️ ATENÇÃO: Tentativa anterior falhou porque a frase continha palavras do título. Crie algo COMPLETAMENTE diferente.\n\n' : ''}EXEMPLOS — observe que a frase não repete NENHUMA palavra do título:
- Título: "Como era a noite dos humanos antigos?" → Frase: "ELES TINHAM MEDO DO ESCURO"
- Título: "Quanto ganha um astronauta da NASA?" → Frase: "ESSE SALÁRIO VAI TE CHOCAR"
- Título: "Por que choramos ao cortar cebola?" → Frase: "SEU OLHO ESTÁ SE DEFENDENDO"
- Título: "Como funciona o motor de um carro?" → Frase: "POUCAS PESSOAS SABEM DISSO"
- Título: "O que acontece com o corpo sem dormir?" → Frase: "SEU CÉREBRO COMEÇA A ALUCINAR"
- Título: "Quem inventou o avião realmente?" → Frase: "A HISTÓRIA FOI ALTERADA"

A frase deve ter 4 a 6 palavras e ser dividida em 2 partes:
- textRed: 2 a 3 palavras — o trecho mais chocante ou emocional
- textBlack: o restante que completa o sentido

Escolha 2 objetos visuais CONCRETOS e MARCANTES que aparecem ou representam o conteúdo do vídeo. Use elementos específicos do roteiro (personagens históricos, objetos da época, cenários, símbolos) — nunca objetos genéricos como troféu, moeda ou ponto de exclamação. Descreva em inglês de forma detalhada para geração de imagem.

Responda SOMENTE com JSON válido, sem markdown:
{"textRed":"...","textBlack":"...","object1":"...","object2":"...","characterAction":"..."}`;

    for (let attempt = 0; attempt < 4; attempt++) {
        const raw = await callVertexText(buildPrompt(attempt > 0), { temperature: 0.6 + attempt * 0.1, maxOutputTokens: 600 });
        try {
            const clean = raw.replace(/```json|```/g, '').trim();
            const match = clean.match(/\{[\s\S]*\}/);
            if (!match) continue;
            const data = JSON.parse(match[0]) as PalitoThumbnailData;
            const hook = `${data.textRed} ${data.textBlack}`;
            if (hookOverlapsTitle(hook, title)) {
                console.warn(`[Thumbnail] Hook "${hook}" overlaps title on attempt ${attempt + 1}, retrying...`);
                continue;
            }
            return data;
        } catch {
            console.warn(`[Thumbnail] JSON parse failed on attempt ${attempt + 1}, retrying...`);
        }
    }
    // Last resort fallback with generic emotional phrases (never title words)
    const titleLower = title.toLowerCase();
    const object1 = titleLower.includes('noite') ? 'ancient campfire with flames at night under stars'
        : titleLower.includes('dinheiro') || titleLower.includes('milh') ? 'stack of dollar bills'
        : titleLower.includes('cérebro') || titleLower.includes('intelig') ? 'large human brain'
        : titleLower.includes('corpo') || titleLower.includes('saúde') ? 'human body diagram'
        : titleLower.includes('espaço') || titleLower.includes('planet') ? 'planet earth from space'
        : 'large question mark symbol';
    return {
        textRed: 'ISSO VAI',
        textBlack: 'TE SURPREENDER',
        object1,
        object2: 'large bold exclamation mark',
        characterAction: 'pointing at object with one arm extended and jaw dropped open, eyes wide',
    };
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

// ── Metadados ─────────────────────────────────────────────────────────────────

export async function generatePalitoMetadata(title: string, script: string): Promise<{
    viralTitle: string;
    description: string;
    tags: string[];
}> {
    const prompt = `Você é um especialista em SEO e crescimento de canais do YouTube no nicho de curiosidades educativas.

Título do vídeo: "${title}"
Trecho do roteiro (primeiros 300 chars): "${script.substring(0, 300)}..."

Gere os metadados completos prontos para publicação no YouTube.

REGRAS:
- Título viral: menos de 70 caracteres, orientado à curiosidade, sem clickbait que o roteiro não cumpra
- Descrição: gancho de 2-3 frases que espelhe a abertura do roteiro + parágrafo de 3-4 frases resumindo o que o espectador vai descobrir (2ª pessoa calma) + linha convidando curtidas/comentários/inscrições + bloco de 15-25 hashtags relevantes em uma única linha
- Tags: 25 a 40 palavras-chave SEO separadas por vírgula, misturando termos amplos (curiosidades, ciência, história, fatos inacreditáveis) com frases de cauda longa específicas do tema
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
