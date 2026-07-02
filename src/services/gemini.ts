/**
 * gemini.ts — Serviço de geração de texto via Vertex AI
 * TODAS as chamadas passam pelo backend /api/generate-text (100% Vertex AI)
 */

import { DEFAULT_INSTRUCTIONS_CLASSICA, DEFAULT_INSTRUCTIONS_BIBLICA } from '../lib/promptDefaults';
import { IMAGE_STYLE_2D, IMAGE_STYLE_3D } from '../lib/imageStyle';

export interface GenerateStoryParams {
    title: string;
    age_group: string;
    tone: string;
    theme: string;
    duration: number;
    sceneCount?: number;
    storyIdea?: string;
    customSystemInstructions?: string;
}

export interface GenerateStoryResponse {
    story_text: string;
    narration_text: string;
    rawScenes?: any[];
}

// ── Helper central: chama o backend Vertex AI ──────────────────────────────
async function callVertexText(
    prompt: string,
    options: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
    let lastMessage = '';

    for (let attempt = 0; attempt < 2; attempt++) {
        let data: any;
        let response: Response;

        try {
            response = await fetch('/api/generate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.maxOutputTokens ?? 8192,
                    jsonMode: options.jsonMode ?? false,
                }),
            });

            data = await response.json() as any;
        } catch (e: any) {
            throw new Error(`Erro ao comunicar com o servidor: ${e.message}`);
        }

        if (response.ok && !data.error) {
            return data.text as string;
        }

        lastMessage = data?.error || `Erro HTTP ${response.status}`;

        if (data?.quotaExhausted && attempt === 0) {
            const waitSeconds = Math.min(Math.max(Number(data.retryAfterSeconds) || 6, 4), 12);
            console.warn(`[Gemini] Vertex quota temporarily exhausted. Retrying in ${waitSeconds}s...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
            continue;
        }

        break;
    }

    throw new Error(lastMessage || 'Erro ao comunicar com o servidor');
}

// ── Geração da História ────────────────────────────────────────────────────
export async function generateStoryWithGemini(
    params: GenerateStoryParams
): Promise<GenerateStoryResponse> {

    let systemInstructions = params.customSystemInstructions;
    if (!systemInstructions) {
        systemInstructions = params.theme === 'biblica'
            ? DEFAULT_INSTRUCTIONS_BIBLICA
            : DEFAULT_INSTRUCTIONS_CLASSICA;
    }

    let ageRequirements = '';
    if (params.age_group === '3-5') {
        ageRequirements = `- Vocabulário muito simples\n- Frases curtas (máximo 10 palavras)\n- Repetições e padrões\n- Personagens animais ou objetos falantes\n- Cores vibrantes e elementos visuais simples\n- Mensagem muito clara e direta`;
    } else if (params.age_group === '6-8') {
        ageRequirements = `- Vocabulário intermediário\n- Frases de 10-15 palavras\n- Pequenos diálogos\n- Personagens mais complexos\n- Pequenos desafios ou mistérios\n- Mensagem sobre amizade, coragem ou descoberta`;
    } else if (params.age_group === '9-12') {
        ageRequirements = `- Vocabulário mais rico\n- Frases de 15-20 palavras\n- Diálogos elaborados\n- Personagens com personalidade desenvolvida\n- Aventuras mais complexas\n- Mensagens sobre valores e crescimento pessoal`;
    }

    let toneRequirements = '';
    if (params.tone === 'calma') {
        toneRequirements = `- Atmosfera tranquila e reconfortante\n- Ritmo suave e pausado\n- Cenários acolhedores (floresta, jardim, quarto)\n- Ideal para histórias antes de dormir\n- Resolução pacífica e harmoniosa`;
    } else if (params.tone === 'aventura') {
        toneRequirements = `- Atmosfera emocionante e dinâmica\n- Ritmo acelerado com momentos de tensão\n- Cenários variados e estimulantes\n- Desafios e descobertas\n- Resolução heroica e satisfatória`;
    } else if (params.tone === 'educativa') {
        toneRequirements = `- Atmosfera curiosa e investigativa\n- Ritmo equilibrado\n- Elementos de aprendizado natural\n- Fatos interessantes integrados à narrativa\n- Resolução que reforça o aprendizado`;
    }

    const minWords = Math.round(params.duration * 130);
    const maxWords = Math.round(params.duration * 150);

    let ideaPrompt = '';
    if (params.storyIdea?.trim()) {
        ideaPrompt = `\nIDEIA/ENREDO DO USUÁRIO (Obrigatório seguir): "${params.storyIdea.trim()}"\n`;
    }

    if (params.theme === 'biblica') {
        systemInstructions += `\n\n[DIRETRIZ OBRIGATÓRIA: O usuário exigiu que esta história seja estritamente BÍBLICA. Você DEVE incluir elementos cristãos, valores ensinados por Deus, princípios bíblicos claros e uma moral cristã no final. Não crie uma história secular, mesmo que o tom seja de aventura.]\n`;
    }

    systemInstructions += `\n\n[REGRA OBRIGATÓRIA DE FORMATO: A primeira cena deve iniciar obrigatoriamente com a frase exata: "Hoje eu vou contar uma historinha [Titulo da Historia]...". A última cena deve conter o encerramento narrativo completo com a moral ou lição da história, finalizando obrigatoriamente com a chamada de encerramento exata: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!". Não inclua capa, título ou tela final separados.]\n`;

    const payload = JSON.stringify({
        title: params.title,
        theme: params.theme,
        duration: params.duration,
        minWords,
        maxWords,
        scenes: params.sceneCount || 8,
        style: 'Cartoon',
        idea: ideaPrompt,
        systemInstructions,
        ageRequirements,
        toneRequirements
    });

    const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
    });

    let data: any;
    try {
        data = await response.json();
    } catch (e) {
        if (!response.ok) {
            throw new Error(`Erro de comunicação com o servidor (${response.status}). Certifique-se de estar rodando 'npm run dev:full' e não apenas 'npm run dev'.`);
        }
        throw new Error('O servidor retornou uma resposta inválida (não-JSON).');
    }

    if (!response.ok || data.error) throw new Error(data.error || 'Erro na API');

    let text = '';
    if (data.titulo && data.cenas) {
        text = data.cenas.map((c: any) => c.texto).join('\\n\\n');
    }

    return {
        story_text: text || JSON.stringify(data),
        narration_text: text || JSON.stringify(data),
        rawScenes: data.cenas
    };
}

// ── Metadados para YouTube (título viral, descrição, tags) ─────────────────
export interface GenerateStoryMetadataParams {
    title: string;
    script: string;
    theme?: string; // 'classica' | 'biblica'
}

export interface StoryMetadataResult {
    viralTitle: string;
    description: string;
    tags: string[];
    pinnedComment: string;
}

export async function generateStoryMetadata(params: GenerateStoryMetadataParams): Promise<StoryMetadataResult> {
    const isBiblica = params.theme === 'biblica';
    const broadTerms = isBiblica
        ? 'histórias bíblicas, historinhas para crianças, Bíblia infantil, desenho biblico'
        : 'histórias infantis, contos para crianças, desenho animado, historinha para dormir';

    const prompt = `Você é um especialista em SEO e crescimento de canais do YouTube, focado em fazer vídeos infantis viralizarem através do algoritmo (CTR do título/thumbnail + retenção + engajamento — os 3 fatores que o YouTube mais usa para recomendar um vídeo).

Título da história: "${params.title}"
Trecho do roteiro (primeiros 300 caracteres): "${params.script.substring(0, 300)}..."

Gere metadados otimizados para MAXIMIZAR o desempenho no algoritmo do YouTube, seguindo exatamente estas regras:

TÍTULO (principal fator de CTR):
- Máximo 60 caracteres (o YouTube corta o resto na busca e no celular)
- Coloque a palavra-chave/tema principal${isBiblica ? ' (ex: o nome do personagem ou episódio bíblico)' : ' (ex: o tipo de história ou personagem central)'} logo no INÍCIO do título — o começo pesa mais para busca e recomendação
- Crie curiosidade genuína (pergunta, gancho emocional, promessa de descoberta) SEM prometer nada que a história não cumpra — título enganoso derruba a retenção e o algoritmo pune o vídeo por isso
- Evite CAIXA ALTA constante e excesso de emojis/pontuação (!!! ???), isso é lido como spam pelo YouTube e pelos pais

DESCRIÇÃO (os primeiros ~125 caracteres aparecem na busca e no feed ANTES do "mostrar mais" — é a parte que decide se a pessoa clica):
- Primeira linha: gancho forte que já contém a palavra-chave principal, pensado para quem só vai ler essa linha
- Depois: parágrafo de 3-4 frases resumindo a história e a lição/moral aprendida ao final
- Uma pergunta simples para o espectador (ou os pais) responderem nos comentários — perguntas geram comentários, e comentários são um dos sinais mais fortes que o YouTube usa pra recomendar o vídeo
- Linha convidando a curtir, comentar, se inscrever e ativar o sininho
- No máximo 6 a 8 hashtags realmente relevantes ao final (o YouTube só mostra as 3 primeiras acima do título; excesso de hashtags é tratado como spam)

TAGS:
- Entre 15 e 20 tags, sem ultrapassar ~450 caracteres somados (o limite técnico do YouTube é 500)
- A primeira tag deve ser a busca mais provável que um pai ou criança digitaria para achar ESSE vídeo específico (ela tem peso extra pro YouTube)
- Misture termos amplos (${broadTerms}) com termos de cauda longa específicos desta história
- Não repita a mesma tag em variações inúteis

COMENTÁRIO FIXADO (engajamento):
- Crie uma pergunta curta e simples para o criador fixar como primeiro comentário do vídeo, convidando pais/crianças a responder — isso gera comentários logo nas primeiras horas, o que ajuda o vídeo a "pegar tração" no algoritmo

- Tudo em PORTUGUÊS BRASILEIRO

Retorne APENAS um JSON válido:
{"viralTitle": "...", "description": "...", "tags": ["tag1", "tag2", ...], "pinnedComment": "..."}`;

    const raw = await callVertexText(prompt, { temperature: 0.7 });
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
        viralTitle: parsed.viralTitle,
        description: parsed.description,
        tags: parsed.tags,
        pinnedComment: parsed.pinnedComment,
    };
}

// ── Tradução de Título ─────────────────────────────────────────────────────
export async function translateTitle(title: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate the following book title to ${targetLanguage}.
Title: "${title}"

IMPORTANT: Return ONLY the translated title, nothing else. No explanation, no quotes.`;
    const text = await callVertexText(prompt, { temperature: 0.3 });
    return text.trim().replace(/^"|"$/g, '');
}

// ── Extração de Personagens ────────────────────────────────────────────────
export async function extractCharactersFromStory(storyText: string): Promise<Record<string, string>> {
    const prompt = `Analise a seguinte história infantil e identifique TODOS os personagens relevantes (principais e coadjuvantes importantes).
Para cada personagem, forneça uma descrição visual DETALHADA baseada no texto ou inferindo características apropriadas para a história (ex: tipo de animal, cor, roupas, acessórios).
Foque APENAS nas características físicas visuais. Extraia até 5 personagens distintos se existirem na história.

HISTÓRIA:
${storyText}

FORMATO DE SAÍDA (JSON Puro):
{
    "Nome do Personagem": "Descrição visual física detalhada...",
    "Outro Personagem": "Descrição visual física detalhada..."
}

Retorne APENAS o JSON válido, sem markdown ou explicações.`;

    const text = await callVertexText(prompt, { jsonMode: true });
    const cleaned = text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
}

// ── Dados Estruturados de Personagem ──────────────────────────────────────
export interface StructuredCharacterData {
    species: string;
    main_colors: string[];
    clothing: string;
    accessories: string;
    full_description: string;
}

export async function extractStructuredCharacterData(
    storyText: string,
    characterName: string,
    visualStyle: string = 'Estilo Pixar 3D'
): Promise<StructuredCharacterData> {
    const prompt = `Analise a história abaixo e extraia informações ESTRUTURADAS sobre o personagem "${characterName}".

HISTÓRIA:
${storyText}

PERSONAGEM: ${characterName}

Retorne um JSON com as seguintes informações (infira características apropriadas se não mencionadas):

{
    "species": "tipo/espécie do personagem (ex: 'Coelho', 'Menino', 'Dragão', 'Fada')",
    "main_colors": ["cor1", "cor2", "cor3"],
    "clothing": "descrição das roupas ou aparência",
    "accessories": "acessórios ou itens especiais (ou 'Nenhum')",
    "full_description": "descrição visual completa e detalhada para geração de imagem, incluindo espécie, cores, roupas, acessórios, características físicas, no estilo ${visualStyle}"
}

IMPORTANTE:
- Seja MUITO específico com cores (ex: "branco cremoso", "azul celeste", "dourado brilhante")
- A descrição completa deve ter pelo menos 100 palavras
- Foque em características visuais que podem ser desenhadas
- Adapte a descrição para combinar com o estilo: ${visualStyle}

Retorne APENAS o JSON válido, sem markdown ou explicações.`;

    const text = await callVertexText(prompt, { jsonMode: true });
    const cleaned = text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
}

// ── Geração de Cenas ───────────────────────────────────────────────────────
export interface GenerateScenesParams {
    narration_text: string;
    duration: number;
    targetSceneCount?: number;
    title?: string;
    knownCharacters?: string[];
}

export interface Scene {
    id?: string;
    order: number;
    narration_text: string;
    visual_description: string;
    emotion: string;
    duration_estimate: number;
    characters: string[];
    image_prompt?: string;
    imageUrl?: string;
    audioUrl?: string;
}

export interface GenerateScenesResponse {
    scenes: Scene[];
}

const SCENE_EMOTIONS = ['alegre', 'calma', 'aventura', 'surpresa', 'medo', 'tristeza', 'curiosidade'];
const MIN_SCENE_WORDS = 8;
const NON_STORY_SCENE_PATTERN = /\b(title card|capa|cart[aã]o final|ending card|final card|inscreva|subscribe|sininho|cr[eé]ditos)\b/i;

// Marcadores de moldura (intro/encerramento) que NÃO devem fazer parte das cenas da história.
const STORY_OPENING_MARKER = /era uma vez/i;
const GREETING_PREFIX = /^\s*hoje\s+eu\s+vou\s+contar[^.!?…]*[.!?…]+/i;
const CLOSING_CTA_MARKER = /se\s+voc[eê]\s+gostou/i;

/**
 * Remove a saudação de abertura ("Hoje eu vou contar uma historinha...") do início do texto,
 * fazendo a história começar em "Era uma vez...". Mantém o restante intacto.
 * Se nenhum marcador for encontrado, retorna o texto original.
 */
export function stripGreetingPrefix(text: string): string {
    if (!text) return text;
    const opening = text.match(STORY_OPENING_MARKER);
    // Caso ideal: "Hoje eu vou contar... Era uma vez, ..." -> corta tudo antes de "Era uma vez".
    if (opening && opening.index !== undefined && GREETING_PREFIX.test(text)) {
        return text.slice(opening.index).trimStart();
    }
    // Sem "Era uma vez", mas começa com a saudação: remove apenas a frase de saudação.
    if (GREETING_PREFIX.test(text)) {
        const stripped = text.replace(GREETING_PREFIX, '').trimStart();
        return stripped || text;
    }
    return text;
}

/**
 * Remove a chamada de encerramento ("Se você gostou, já sabe: curta, se inscreva...") do final
 * do texto, mantendo a moral/lição que vem antes dela.
 */
export function stripClosingCTA(text: string): string {
    if (!text) return text;
    const cta = text.match(CLOSING_CTA_MARKER);
    if (cta && cta.index !== undefined) {
        const trimmed = text.slice(0, cta.index).trimEnd();
        return trimmed || text;
    }
    return text;
}

/**
 * Remove a moldura (saudação inicial e CTA final) do texto completo da narração,
 * de modo que a separação de cenas trabalhe apenas com o corpo da história.
 */
export function stripStoryFraming(text: string): string {
    return stripClosingCTA(stripGreetingPrefix(text));
}

function cleanJsonText(rawText: string): string {
    const text = rawText.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonStart = text.indexOf('{');
    return text.substring(jsonStart !== -1 ? jsonStart : 0);
}

function parseScenesPayload(rawText: string): any {
    const text = cleanJsonText(rawText);
    try {
        return JSON.parse(text);
    } catch {
        let repaired = text;
        repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
        repaired = repaired.replace(/,\s*\{[^}]*$/, '');
        const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces; i++) repaired += '}';
        return JSON.parse(repaired);
    }
}

function countWords(text: string): number {
    return text.replace(/\\n/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeScene(scene: any, index: number, targetAvgDuration: number): Scene {
    const narration = String(scene?.narration_text || scene?.narrationText || scene?.texto || '').trim();
    const visual = String(scene?.visual_description || scene?.visualDescription || scene?.descricao_visual || '').trim();
    const imagePrompt = String(scene?.image_prompt || scene?.imagePrompt || scene?.prompt_imagem || '').trim();
    const emotion = String(scene?.emotion || scene?.emocao || 'calma').trim().toLowerCase();
    const characters = Array.isArray(scene?.characters)
        ? scene.characters
        : Array.isArray(scene?.personagens)
            ? scene.personagens
            : [];

    return {
        order: index + 1,
        narration_text: narration,
        visual_description: visual || narration,
        image_prompt: imagePrompt,
        emotion: SCENE_EMOTIONS.includes(emotion) ? emotion : 'calma',
        duration_estimate: Number(scene?.duration_estimate || scene?.durationEstimate) || targetAvgDuration,
        characters: characters.map((character: any) => String(character)).filter(Boolean),
    };
}

function getSceneValidationIssues(scenes: Scene[], expectedCount: number, narrationText: string): string[] {
    const issues: string[] = [];
    if (scenes.length !== expectedCount) {
        issues.push(`retornou ${scenes.length} cenas, mas precisa retornar exatamente ${expectedCount}`);
    }

    scenes.forEach((scene, index) => {
        if (!scene.narration_text || countWords(scene.narration_text) < 3) {
            issues.push(`cena ${index + 1} sem trecho de narração suficiente`);
        }
        if (!scene.visual_description || countWords(scene.visual_description) < 6) {
            issues.push(`cena ${index + 1} sem descrição visual suficiente`);
        }
        if (!scene.image_prompt || countWords(scene.image_prompt) < 8) {
            issues.push(`cena ${index + 1} sem image_prompt detalhado`);
        }
        const visualOnly = `${scene.visual_description} ${scene.image_prompt}`
            .replace(/\b(no|sem)\s+(title card|capa|ending card|final card|subscribe screen|sininho|creditos)\b/gi, '');
        if (NON_STORY_SCENE_PATTERN.test(visualOnly)) {
            issues.push(`cena ${index + 1} parece capa, CTA, créditos ou cartão final`);
        }
    });

    const originalWordCount = countWords(narrationText);
    const sceneWordCount = countWords(scenes.map(scene => scene.narration_text).join(' '));
    if (originalWordCount > 80 && sceneWordCount < originalWordCount * 0.92) {
        issues.push('os trechos de narração das cenas não cobrem a história completa');
    }

    return issues;
}

function splitNarrationIntoChunks(text: string, count: number): string[] {
    const normalized = text.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    if (count <= 1) return [normalized];
    if (words.length === 0) return Array.from({ length: count }, () => '');

    const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(sentence => sentence.trim()).filter(Boolean) || [normalized];
    const chunks = Array.from({ length: count }, () => [] as string[]);
    const targetWordsPerChunk = Math.max(MIN_SCENE_WORDS, Math.ceil(words.length / count));
    let currentChunkIndex = 0;
    let currentChunkWords = 0;

    sentences.forEach((sentence, sentenceIndex) => {
        const sentenceWordCount = countWords(sentence);
        const remainingSentences = sentences.length - sentenceIndex;
        const remainingChunks = count - currentChunkIndex;
        const shouldMoveToNextChunk =
            currentChunkIndex < count - 1 &&
            currentChunkWords >= MIN_SCENE_WORDS &&
            currentChunkWords + sentenceWordCount > targetWordsPerChunk &&
            remainingSentences >= remainingChunks;

        if (shouldMoveToNextChunk) {
            currentChunkIndex += 1;
            currentChunkWords = 0;
        }

        chunks[currentChunkIndex].push(sentence);
        currentChunkWords += sentenceWordCount;
    });

    return chunks.map((chunk, index) => {
        if (chunk.length > 0) return chunk.join(' ');
        const start = Math.floor(index * words.length / count);
        const end = Math.floor((index + 1) * words.length / count);
        return words.slice(start, Math.max(start + 1, end)).join(' ');
    });
}

function applyExactNarrationChunks(scenes: Scene[], chunks: string[], targetAvgDuration: number): Scene[] {
    return chunks.map((chunk, index) => {
        const scene = scenes[index];
        return {
            order: index + 1,
            narration_text: chunk,
            visual_description: scene?.visual_description || `Cena ${index + 1}: momento narrativo real deste trecho, com personagens em acao, cenario completo, composicao clara e continuidade da historia. Trecho: ${chunk.substring(0, 420)}`,
            image_prompt: scene?.image_prompt || `Children story cinematic illustration for scene ${index + 1} of ${chunks.length}. Show the real narrative event from this narration beat with expressive characters, clear action, detailed environment, foreground and background, story-specific props, no title text, no subscribe screen, no ending card. Narration beat: ${chunk.substring(0, 420)}`,
            emotion: scene?.emotion || SCENE_EMOTIONS[index % SCENE_EMOTIONS.length],
            duration_estimate: scene?.duration_estimate || targetAvgDuration,
            characters: scene?.characters || [],
        };
    });
}

function buildFallbackScenes(narrationText: string, expectedCount: number, targetAvgDuration: number): Scene[] {
    const chunks = splitNarrationIntoChunks(narrationText, expectedCount);
    return chunks.map((chunk, index) => ({
        order: index + 1,
        narration_text: chunk,
        visual_description: `Cena ${index + 1}: momento narrativo real deste trecho, com personagens em ação, cenário completo, composição clara e continuidade da história. Trecho: ${chunk.substring(0, 420)}`,
        image_prompt: `Children story cinematic illustration for scene ${index + 1} of ${expectedCount}. Show the real narrative event from this narration beat with expressive characters, clear action, detailed environment, foreground and background, story-specific props, no title text, no subscribe screen, no ending card. Narration beat: ${chunk.substring(0, 420)}`,
        emotion: SCENE_EMOTIONS[index % SCENE_EMOTIONS.length],
        duration_estimate: targetAvgDuration,
        characters: [],
    }));
}

function buildSceneSeparationPrompt(
    params: GenerateScenesParams,
    requiredScenes: number,
    targetAvgDuration: number,
    narrationChunks: string[],
    previousIssues: string[] = []
): string {
    const retryBlock = previousIssues.length
        ? `\nCORRIJA ESTES PROBLEMAS DA TENTATIVA ANTERIOR:\n- ${previousIssues.join('\n- ')}\n`
        : '';
    const characterBlock = params.knownCharacters?.length
        ? `\nPERSONAGENS OFICIAIS DA HISTÓRIA:\n${params.knownCharacters.map(name => `- ${name}`).join('\n')}\n\nREGRAS PARA O CAMPO characters:\n- Use somente os nomes oficiais listados acima, exatamente como escritos.\n- Não use placeholders como "personagem1", "protagonista", "hero", "child" ou descrições genéricas.\n- Se um personagem oficial aparece ou é citado no trecho da cena, inclua esse nome no array characters.\n- Se a cena tiver o protagonista sem citar o nome claramente, use o primeiro personagem oficial como protagonista.\n`
        : '';

    return `Você é um especialista em roteirização de vídeos infantis para YouTube.
Sua missão é dividir a história completa em cenas visuais, sem perder acontecimentos, especialmente o final.

REGRAS OBRIGATÓRIAS:
1. QUANTIDADE DE CENAS: Crie EXATAMENTE ${requiredScenes} cenas. Nem ${requiredScenes - 1}, nem ${requiredScenes + 1}.
2. COBERTURA TOTAL: use a história inteira, do primeiro acontecimento até a resolução final. Não resuma a ponto de remover partes importantes.
3. NARRAÇÃO: narration_text deve conter o trecho correspondente da história, em ordem, preservando o conteúdo narrativo. A soma dos narration_text deve cobrir a história completa.
4. PRIMEIRA CENA: deve começar exatamente no início da HISTÓRIA (a frase "Era uma vez..." ou a primeira ação narrativa). NÃO inclua a saudação de abertura ("Hoje eu vou contar uma historinha...") — ela é uma introdução de canal e NÃO faz parte das cenas. NÃO crie capa, título, vinheta ou "TITLE CARD".
5. ÚLTIMA CENA: deve terminar na lição/moral da história, mostrando a resolução final. NÃO inclua a chamada de encerramento ("Se você gostou, já sabe: curta, se inscreva...") — ela é um encerramento de canal e NÃO faz parte das cenas.
6. EMOÇÕES permitidas: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade.
7. FORMATO: JSON válido sem markdown.
8. DESCRIÇÃO VISUAL: cada cena deve descrever UMA única imagem estática e clara. Evite colagens, múltiplos painéis ou sequências.
9. AUTENTICIDADE E CONSISTÊNCIA VISUAL: cada cena precisa parecer um novo momento do filme, não uma variação do mesmo fundo. Mantenha os personagens ESTRITAMENTE CONSISTENTES, copiando e colando a mesma descrição física exata em todas as cenas, mas varie cenário, hora do dia, clima, paleta, profundidade, objetos de cena e composição.
10. NÃO repita automaticamente floresta ensolarada, caminho de terra, árvores arredondadas, jardim mágico ou backlight dourado. Use esses elementos apenas quando a narrativa pedir.
11. VARIE O PLANO E A CÂMERA por cena: establishing wide shot, low angle, high angle, over-the-shoulder, close-up emocional, top-down, side view, foreground framing, silhouette, point-of-view.
12. visual_description deve conter: local específico, ação principal, posição dos personagens, ângulo de câmera, iluminação/hora do dia, detalhes de primeiro plano e fundo.
13. image_prompt deve estar em inglês, pronto para geração de imagem, incluindo detalhes únicos daquela cena. Não use nomes próprios; descreva personagens visualmente COM AS MESMAS ROUPAS, CORES E CARACTERÍSTICAS FÍSICAS EM TODAS AS CENAS.
14. Use os BLOCOS NARRATIVOS OBRIGATORIOS como fonte principal. Para a cena N, o campo narration_text deve ser exatamente o bloco N, e visual_description/image_prompt devem representar o acontecimento principal desse mesmo bloco.
${retryBlock}
TÍTULO: ${params.title || 'História'}
${characterBlock}

TEXTO COMPLETO DA NARRAÇÃO:
${params.narration_text}

BLOCOS NARRATIVOS OBRIGATORIOS (uma cena para cada bloco, copiando o texto integral em narration_text):
${narrationChunks.map((chunk, index) => `CENA ${index + 1}/${requiredScenes}:\n"""${chunk}"""`).join('\n\n')}

FORMATO DE SAÍDA:
{
  "scenes": [
    {
      "order": 1,
      "narration_text": "trecho real da história para esta cena",
      "visual_description": "descrição visual completa da cena",
      "image_prompt": "English image prompt with specific action, camera, setting, lighting, foreground and background",
      "emotion": "alegre",
      "duration_estimate": ${targetAvgDuration},
      "characters": ["personagem1"]
    }
  ]
}`;
}

export async function generateScenesWithGemini(
    params: GenerateScenesParams
): Promise<GenerateScenesResponse> {
    let requiredScenes = params.targetSceneCount || 8;
    if (!params.targetSceneCount) {
        if (params.duration >= 5) requiredScenes = 10;
        if (params.duration >= 10) requiredScenes = 15;
    }

    requiredScenes = Math.max(1, Math.round(requiredScenes));
    const totalSeconds = params.duration * 60;
    const targetAvgDuration = Math.max(1, Math.round(totalSeconds / requiredScenes));
    // A moldura (saudação inicial e CTA final) é mantida apenas no áudio completo,
    // não nas cenas: separamos somente o corpo real da história.
    const storyBody = stripStoryFraming(params.narration_text);
    const narrationChunks = splitNarrationIntoChunks(storyBody, requiredScenes);
    let previousIssues: string[] = [];

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const prompt = buildSceneSeparationPrompt({ ...params, narration_text: storyBody }, requiredScenes, targetAvgDuration, narrationChunks, previousIssues);
            const rawText = await callVertexText(prompt, {
                jsonMode: true,
                temperature: attempt === 0 ? 0.45 : 0.25,
                maxOutputTokens: 16384,
            });

            const data = parseScenesPayload(rawText);
            const modelScenes = (Array.isArray(data?.scenes) ? data.scenes : [])
                .map((scene: any, index: number) => normalizeScene(scene, index, targetAvgDuration));
            const finalScenes = applyExactNarrationChunks(modelScenes, narrationChunks, targetAvgDuration);
            const issues = getSceneValidationIssues(finalScenes, requiredScenes, storyBody);

            if (issues.length === 0) {
                return { scenes: finalScenes };
            }

            previousIssues = issues;
            console.warn(`[Gemini] Separação de cenas inválida na tentativa ${attempt + 1}:`, issues);
        } catch (error: any) {
            previousIssues = [`resposta JSON inválida ou incompleta: ${error.message}`];
            console.warn(`[Gemini] Falha ao separar cenas na tentativa ${attempt + 1}:`, error);
        }
    }

    console.warn('[Gemini] Usando fallback determinístico para garantir a quantidade exata de cenas.');
    return { scenes: buildFallbackScenes(storyBody, requiredScenes, targetAvgDuration) };
}

// ── Prompt de Imagem ───────────────────────────────────────────────────────
export interface GenerateImagePromptParams {
    visual_description: string;
    emotion: string;
    characters: string[];
    visual_style?: string;
    is_first_scene?: boolean;
    imageTemplate?: string;
    characterDescriptions?: Record<string, string>;
    sceneIndex?: number;
    totalScenes?: number;
}

export async function generateImagePrompt(params: GenerateImagePromptParams): Promise<string> {
    const sceneIndex = params.sceneIndex ?? 0;
    const totalScenes = Math.max(1, params.totalScenes ?? 1);
    const parts: string[] = [];

    // Character descriptions first (most important for consistency)
    if (params.characterDescriptions && params.characters.length > 0) {
        params.characters.forEach(charName => {
            if (charName === '__PROTAGONIST__') return;
            const desc = params.characterDescriptions![charName];
            if (desc) {
                parts.push(`CRITICAL: Character physical description must be EXACTLY: ${desc.substring(0, 300)}`);
            }
        });
    }

    // Scene action and setting (Trust the storyboard!)
    if (params.visual_description) {
        parts.push(`Storyboard moment (scene ${sceneIndex + 1} of ${totalScenes}): ${params.visual_description}`);
    }
    
    // Explicitly tell the generator to follow the setting
    parts.push('CRITICAL: Follow the exact setting and location described in the storyboard moment. Do not change the time of day or location unless the storyboard implies it.');

    // Style
    const is2D = params.visual_style === 'Estilo 2D Cartoon';
    const styleStr = is2D ? IMAGE_STYLE_2D : IMAGE_STYLE_3D;

    // Emotion
    const emotionStr = params.emotion ? `, ${params.emotion} mood` : '';

    return `${parts.join(', ')}, ${styleStr}${emotionStr}, fully detailed environment background matching the story, authentic cinematic storytelling frame, NO white background, NO plain background, children book illustration, widescreen 16:9`;
}

export interface GenerateCharacterDescriptionsParams {
    characters: string[];
    visual_style: string;
    visual_description: string;
}

export async function generateCharacterDescriptions(
    params: GenerateCharacterDescriptionsParams
): Promise<Record<string, string>> {
    const prompt = `Crie descrições DETALHADAS em INGLÊS para gerar imagens consistentes:
Personagens: ${params.characters.join(', ')}
Estilo: ${params.visual_style}
Cena: ${params.visual_description}

Retorne um JSON: {"Nome": "Descrição..."}`;

    const text = await callVertexText(prompt, { jsonMode: true });
    const cleaned = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(cleaned);
}

export interface GenerateCharacterSheetParams {
    characterName: string;
    storyText: string;
    characterSheetTemplate?: string;
}

export async function generateCharacterSheet(params: GenerateCharacterSheetParams): Promise<string> {
    const prompt = `Crie um Character Sheet Pixar Style para "${params.characterName}" baseado na história.`;
    return await callVertexText(prompt, { temperature: 0.6 });
}

export async function generateAllCharacterSheets(
    storyText: string,
    characterNames: string[],
    characterSheetTemplate?: string
): Promise<Record<string, string>> {
    const sheets: Record<string, string> = {};
    for (const name of characterNames) {
        try {
            sheets[name] = await generateCharacterSheet({ characterName: name, storyText, characterSheetTemplate });
        } catch (error) {
            sheets[name] = `Failed: ${name}`;
        }
    }
    return sheets;
}

export async function generateText(prompt: string): Promise<string> {
    return await callVertexText(prompt, { temperature: 0.7 });
}
