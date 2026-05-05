/**
 * gemini.ts — Serviço de geração de texto via Vertex AI
 * TODAS as chamadas passam pelo backend /api/generate-text (100% Vertex AI)
 */

import { DEFAULT_INSTRUCTIONS_CLASSICA, DEFAULT_INSTRUCTIONS_BIBLICA } from '../lib/promptDefaults';

export interface GenerateStoryParams {
    title: string;
    age_group: string;
    tone: string;
    theme: string;
    duration: number;
    storyIdea?: string;
    customSystemInstructions?: string;
}

export interface GenerateStoryResponse {
    story_text: string;
    narration_text: string;
}

// ── Helper central: chama o backend Vertex AI ──────────────────────────────
async function callVertexText(
    prompt: string,
    options: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
    let data;
    try {
        const response = await fetch('/api/generate-text', {
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
        if (!response.ok || data.error) {
            throw new Error(data.error || `Erro HTTP ${response.status}`);
        }
    } catch (e: any) {
        throw new Error(`Erro ao comunicar com o servidor: ${e.message}`);
    }
    return data.text as string;
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

    const minWords = Math.round(params.duration * 115);
    const maxWords = Math.round(params.duration * 135);

    let ideaPrompt = '';
    if (params.storyIdea?.trim()) {
        ideaPrompt = `\nIDEIA/ENREDO DO USUÁRIO (Obrigatório seguir): "${params.storyIdea.trim()}"\n`;
    }

    if (params.theme === 'biblica') {
        systemInstructions += `\n\n[DIRETRIZ OBRIGATÓRIA: O usuário exigiu que esta história seja estritamente BÍBLICA. Você DEVE incluir elementos cristãos, valores ensinados por Deus, princípios bíblicos claros e uma moral cristã no final. Não crie uma história secular, mesmo que o tom seja de aventura.]\n`;
    }

    const payload = JSON.stringify({
        title: params.title,
        theme: params.theme,
        duration: params.duration,
        minWords,
        maxWords,
        scenes: 8,
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

export async function generateScenesWithGemini(
    params: GenerateScenesParams
): Promise<GenerateScenesResponse> {
    const hasIntroOutro = !!params.title && !!params.targetSceneCount;
    const storySceneCount = hasIntroOutro && params.targetSceneCount ? params.targetSceneCount : undefined;

    let minScenes = 6;
    let maxScenes = 8;

    if (storySceneCount) {
        minScenes = storySceneCount;
        maxScenes = storySceneCount;
    } else if (params.targetSceneCount) {
        minScenes = params.targetSceneCount;
        maxScenes = params.targetSceneCount;
    } else {
        if (params.duration >= 5) { minScenes = 8; maxScenes = 12; }
        if (params.duration >= 10) { minScenes = 12; maxScenes = 15; }
    }

    const totalSeconds = params.duration * 60;
    const storySeconds = hasIntroOutro ? totalSeconds - 20 : totalSeconds;
    const targetAvgDuration = Math.round(storySeconds / ((minScenes + maxScenes) / 2));

    const prompt = `Você é um especialista em roteirização de vídeos infantis para YouTube.
Sua missão é dividir histórias infantis em cenas visuais, criando um roteiro estruturado e pronto para produção de vídeo.

REGRAS DE SEPARAÇÃO:
1. QUANTIDADE DE CENAS: Crie EXATAMENTE ${minScenes} cenas.
2. EMOÇÕES: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade.
3. FORMATO: JSON válido sem markdown.
4. NÃO crie cenas de introdução (como título do livro) ou encerramento (como 'inscreva-se'). Foque apenas no conteúdo da história.
5. DESCRIÇÃO VISUAL: Cada cena deve descrever UMA única imagem estática e clara. Evite colagens, múltiplos painéis ou sequências.

TEXTO DA NARRAÇÃO:
${params.narration_text}

FORMATO DE SAÍDA:
{
  "scenes": [
    {
      "order": 1,
      "narration_text": "...",
      "visual_description": "...",
      "emotion": "alegre",
      "duration_estimate": ${targetAvgDuration},
      "characters": ["personagem1"]
    }
  ]
}`;

    const rawText = await callVertexText(prompt, { jsonMode: true, temperature: 0.7 });
    let text = rawText.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonStart = text.indexOf('{');
    text = text.substring(jsonStart !== -1 ? jsonStart : 0);

    let data: any;
    try {
        data = JSON.parse(text);
    } catch (parseErr) {
        console.warn('[Gemini] JSON truncado, tentando reparar...');
        // Try to repair truncated JSON by closing open structures
        let repaired = text;
        // Remove trailing incomplete object/string
        repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
        repaired = repaired.replace(/,\s*\{[^}]*$/, '');
        // Count and close open brackets
        const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces; i++) repaired += '}';
        try {
            data = JSON.parse(repaired);
            console.log('[Gemini] JSON reparado com sucesso, cenas recuperadas:', data.scenes?.length || 0);
        } catch (e2) {
            console.error('[Gemini] Reparo falhou, retrying...');
            // Retry with shorter max tokens
            const retryText = await callVertexText(prompt, { jsonMode: true, temperature: 0.5, maxOutputTokens: 16384 });
            let retryClean = retryText.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const retryStart = retryClean.indexOf('{');
            retryClean = retryClean.substring(retryStart !== -1 ? retryStart : 0);
            data = JSON.parse(retryClean);
        }
    }
    let finalScenes: Scene[] = data.scenes || [];

    if (hasIntroOutro) {
        const introScene: Scene = {
            order: 0,
            narration_text: `Hoje eu vou contar uma historinha super doce e cheia de aventura! É a história "${params.title}"!`,
            visual_description: `TITLE CARD: "${params.title}". Movie Poster Layout.`,
            emotion: 'alegre',
            duration_estimate: 6,
            characters: ['__PROTAGONIST__'],
            image_prompt: `Movie Poster for "${params.title}".`,
        };
        const outroScene: Scene = {
            order: 0,
            narration_text: `Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Tchau, tchau!`,
            visual_description: `Vibrant ending card asking to Subscribe and Like.`,
            emotion: 'alegre',
            duration_estimate: 8,
            characters: [],
            image_prompt: 'ENDING_CARD_PLACEHOLDER',
        };
        finalScenes = [introScene, ...finalScenes, outroScene];
        finalScenes = finalScenes.map((scene, idx) => ({ ...scene, order: idx + 1 }));
    }

    return { scenes: finalScenes };
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
}

export async function generateImagePrompt(params: GenerateImagePromptParams): Promise<string> {
    // Build a simple, natural descriptive prompt — the style that works best with Gemini 2.5 Flash Image
    const parts: string[] = [];

    // Character descriptions first (most important for consistency)
    if (params.characterDescriptions && params.characters.length > 0) {
        params.characters.forEach(charName => {
            if (charName === '__PROTAGONIST__') return;
            const desc = params.characterDescriptions![charName];
            if (desc) {
                parts.push(desc.substring(0, 200));
            }
        });
    }

    // Scene action
    if (params.visual_description) {
        parts.push(params.visual_description);
    }

    // Style
    const is2D = params.visual_style === 'Estilo 2D Cartoon';
    const styleStr = is2D
        ? 'Premium 2D cartoon illustration, modern mobile game art style, modern Disney 2D style, rich details, magical lighting, warm golden backlight, soft colorful shading, very vibrant colors, crisp clean outlines, animated children storybook style, NO 3D rendering, NO CGI, well-proportioned anatomy, correct number of limbs'
        : '3D Pixar animation style, big expressive eyes, soft rounded features, warm cinematic lighting, vibrant colors, well-proportioned anatomy, correct number of limbs';

    // Emotion
    const emotionStr = params.emotion ? `, ${params.emotion} mood` : '';

    return `${parts.join(', ')}, ${styleStr}${emotionStr}, fully detailed environment background, NO white background, NO plain background, children book illustration, widescreen 16:9`;
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
