import { GoogleGenerativeAI } from '@google/generative-ai';
import { DEFAULT_INSTRUCTIONS_CLASSICA, DEFAULT_INSTRUCTIONS_BIBLICA } from '../lib/promptDefaults';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn('Gemini API key not configured. Story generation will not work.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

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

export async function generateStoryWithGemini(
    params: GenerateStoryParams
): Promise<GenerateStoryResponse> {
    if (!genAI) {
        throw new Error('Gemini API not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // System instructions (embedded in the prompt for Gemini)
    let systemInstructions = params.customSystemInstructions;

    if (!systemInstructions) {
        if (params.theme === 'biblica') {
            systemInstructions = DEFAULT_INSTRUCTIONS_BIBLICA;
        } else {
            systemInstructions = DEFAULT_INSTRUCTIONS_CLASSICA;
        }
    }

    // Build age-specific requirements
    let ageRequirements = '';
    if (params.age_group === '3-5') {
        ageRequirements = `- Vocabulário muito simples
- Frases curtas (máximo 10 palavras)
- Repetições e padrões
- Personagens animais ou objetos falantes
- Cores vibrantes e elementos visuais simples
- Mensagem muito clara e direta`;
    } else if (params.age_group === '6-8') {
        ageRequirements = `- Vocabulário intermediário
- Frases de 10-15 palavras
- Pequenos diálogos
- Personagens mais complexos
- Pequenos desafios ou mistérios
- Mensagem sobre amizade, coragem ou descoberta`;
    } else if (params.age_group === '9-12') {
        ageRequirements = `- Vocabulário mais rico
- Frases de 15-20 palavras
- Diálogos elaborados
- Personagens com personalidade desenvolvida
- Aventuras mais complexas
- Mensagens sobre valores e crescimento pessoal`;
    }

    // Build tone-specific requirements
    let toneRequirements = '';
    if (params.tone === 'calma') {
        toneRequirements = `- Atmosfera tranquila e reconfortante
- Ritmo suave e pausado
- Cenários acolhedores (floresta, jardim, quarto)
- Ideal para histórias antes de dormir
- Resolução pacífica e harmoniosa`;
    } else if (params.tone === 'aventura') {
        toneRequirements = `- Atmosfera emocionante e dinâmica
- Ritmo acelerado com momentos de tensão
- Cenários variados e estimulantes
- Desafios e descobertas
- Resolução heroica e satisfatória`;
    } else if (params.tone === 'educativa') {
        toneRequirements = `- Atmosfera curiosa e investigativa
- Ritmo equilibrado
- Elementos de aprendizado natural
- Fatos interessantes integrados à narrativa
- Resolução que reforça o aprendizado`;
    }

    const minWords = params.duration * 150;
    const maxWords = params.duration * 200;

    // Add Story Idea if provided
    let ideaPrompt = '';
    if (params.storyIdea && params.storyIdea.trim()) {
        ideaPrompt = `\nIDEIA/ENREDO DO USUÁRIO (Obrigatório seguir): "${params.storyIdea.trim()}"\n`;
    }

    // Force biblical context to avoid tone overrides
    if (params.theme === 'biblica') {
        systemInstructions += `\n\n[DIRETRIZ OBRIGATÓRIA: O usuário exigiu que esta história seja estritamente BÍBLICA. Você DEVE incluir elementos cristãos, valores ensinados por Deus, princípios bíblicos claros e uma moral cristã no final. Não crie uma história secular, mesmo que o tom seja de aventura.]\n`;
    }

    const prompt = `${systemInstructions}

Crie uma história infantil com as seguintes características:

TÍTULO: ${params.title}
FAIXA ETÁRIA: ${params.age_group} anos
TEMA: ${params.theme}
TOM: ${params.tone}
DURAÇÃO DE LEITURA: aproximadamente ${params.duration} minutos
${ideaPrompt}
REQUISITOS ESPECÍFICOS POR FAIXA ETÁRIA:
${ageRequirements}

REQUISITOS ESPECÍFICOS POR TOM:
${toneRequirements}

FORMATO DE SAÍDA:
Escreva a história completa em um único texto corrido, sem divisões ou marcações especiais. A história deve ter entre ${minWords} e ${maxWords} palavras.

Lembre-se: esta história será narrada em vídeo para YouTube, então use descrições visuais ricas e crie momentos que serão visualmente interessantes.

IMPORTANTE: Retorne APENAS o texto da história, sem nenhum texto adicional, explicação ou formatação markdown.`;

    // Retry logic for 503 errors
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const story_text = response.text().trim();

            // For now, narration_text is the same as story_text
            // In the future, we can add a second call to adjust for narration
            const narration_text = story_text;

            return {
                story_text,
                narration_text,
            };
        } catch (error: any) {
            console.error(`[Gemini Story] Error (Attempt ${attempt + 1}/${maxRetries}):`, error);

            // Check for 503/overloaded errors
            const errorStr = JSON.stringify(error) || error.message || '';
            const is503 =
                errorStr.includes('503') ||
                errorStr.includes('overloaded') ||
                errorStr.includes('UNAVAILABLE') ||
                errorStr.includes('try again later') ||
                error.code === 503 ||
                error.status === 'UNAVAILABLE';

            if (is503) {
                attempt++;
                if (attempt < maxRetries) {
                    const delay = 3000 * Math.pow(1.5, attempt); // Exponential backoff
                    console.log(`[Gemini Story] Model overloaded (503). Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }

            // If max retries reached or other error, throw
            throw new Error(`Failed to generate story: ${error.message}`);
        }
    }

    throw new Error('Failed to generate story after multiple attempts.');
}

/**
 * Translates a text to a target language using Gemini
 */
export async function translateTitle(title: string, targetLanguage: string): Promise<string> {
    if (!genAI) throw new Error('Gemini API not configured');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Translate the following book title to ${targetLanguage}.
    Title: "${title}"
    
    IMPORTANT: Return ONLY the translated title, nothing else. No explanation, no quotes.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim().replace(/^"|"$/g, '');
    } catch (error) {
        console.error(`Error translating title to ${targetLanguage}:`, error);
        return title; // Return original if translation fails
    }
}

export async function extractCharactersFromStory(storyText: string): Promise<Record<string, string>> {
    if (!genAI) throw new Error('Gemini API not configured');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analise a seguinte história infantil e identifique os personagens principais.
    Para cada personagem, forneça uma descrição visual DETALHADA baseada no texto ou inferindo características apropriadas para a história (ex: tipo de animal, cor, roupas, acessórios).
    Foque APENAS nas características físicas visuais.

    HISTÓRIA:
    ${storyText}

    FORMATO DE SAÍDA (JSON Puro):
    {
        "Nome do Personagem": "Descrição visual física detalhada...",
        "Outro Personagem": "Descrição visual física detalhada..."
    }

    Retorne APENAS o JSON válido, sem markdown ou explicações.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Remove markdown formatting if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text);
    } catch (error) {
        console.error('Error extracting characters:', error);
        return {};
    }
}

/**
 * Extract structured character data (species, colors, clothing, accessories)
 * Returns detailed character information ready for DNA display and image generation
 */
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
    if (!genAI) throw new Error('Gemini API not configured');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Remove markdown formatting
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(text);

        console.log('[Structured Character Data] Extracted for:', characterName);
        return data;
    } catch (error: any) {
        console.error('Error extracting structured character data:', error);

        // Return default data if extraction fails
        return {
            species: 'Personagem',
            main_colors: ['branco'],
            clothing: 'Roupas simples',
            accessories: 'Nenhum',
            full_description: `Um personagem chamado ${characterName} da história.`
        };
    }
}

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
    if (!genAI) {
        throw new Error('Gemini API not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Logic for Intro/Outro injection
    // If we have a target count (e.g. 10), we want 1 Intro + (10-2) Story + 1 Outro
    const hasIntroOutro = !!params.title && !!params.targetSceneCount;
    const storySceneCount = hasIntroOutro && params.targetSceneCount ? params.targetSceneCount : undefined;

    // Calculate scene count constraints
    let minScenes = 6;
    let maxScenes = 8;

    if (storySceneCount) {
        // Use the adjusted count for the story body
        minScenes = storySceneCount;
        maxScenes = storySceneCount;
        console.log(`[Gemini Scenes] Generating ${storySceneCount} story scenes (Total target: ${params.targetSceneCount})`);
    } else if (params.targetSceneCount) {
        minScenes = params.targetSceneCount;
        maxScenes = params.targetSceneCount;
        console.log(`[Gemini Scenes] Using strict scene count target: ${params.targetSceneCount}`);
    } else {
        // Fallback to duration-based heuristics if no explicit count
        if (params.duration >= 5) {
            minScenes = 8;
            maxScenes = 12;
        }
        if (params.duration >= 10) {
            minScenes = 12;
            maxScenes = 15;
        }
    }

    // Calculate target duration per scene
    const totalSeconds = params.duration * 60;
    // If intro/outro, we reserve ~20s for them (~10s each)
    const storySeconds = hasIntroOutro ? totalSeconds - 20 : totalSeconds;
    const targetAvgDuration = Math.round(storySeconds / ((minScenes + maxScenes) / 2));

    const prompt = `Você é um especialista em roteirização de vídeos infantis para YouTube.

Sua missão é dividir histórias infantis em cenas visuais, criando um roteiro estruturado e pronto para produção de vídeo.

REGRAS CRÍTICAS DE FIDELIDADE (IMPORTANTE):
1. A história DEVE ser contada EXATAMENTE como está no texto.
2. NÃO invente diálogos, eventos ou ações que não existam na narração.
3. Se a narração não diz algo, NÃO coloque na descrição visual.
4. O objetivo é sincronizar perfeitamente o áudio da narração com o vídeo.

REGRAS DE SEPARAÇÃO:
1. QUANTIDADE DE CENAS:
   - Você DEVE gerar EXATAMENTE ${minScenes} cenas (ou muito próximo disso).
   - O tempo total do vídeo é ${params.duration} minutos (${totalSeconds} segundos).
   - Duração média por cena alvo: ~${targetAvgDuration} segundos.

2. CONTINUIDADE VISUAL:
   - Cada cena deve ter uma composição visual clara
   - Mantenha personagens consistentes

3. DESCRIÇÕES VISUAIS:
   - Descreva detalhadamente o que aparece na cena
   - Inclua cenário, personagens, ações, atmosfera
   - Pense em composição de quadro (16:9)

4. MANIPULAÇÃO DO ENCERRAMENTO (CRÍTICO):
   - Se o texto contiver uma "Chamada para Ação" ou despedida (ex: "Se gostou, inscreva-se", "Tchau tchau"), ela DEVE aparecer APENAS na ÚLTIMA CENA.
   - NUNCA inclua esse texto de encerramento na penúltima cena ou misturado com a moral da história.
   - A última cena deve ser EXCLUSIVA para o encerramento.

5. EMOÇÕES:
   - Identifique a emoção principal
   - Use APENAS uma destas opções EXATAS: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade
   - NÃO use variações ou traduções (ex: "happy", "joyful", "feliz" são INVÁLIDOS)

6. VARIEDADE CINEMATOGRÁFICA (OBRIGATÓRIO):
   - Você DEVE variar os ângulos de câmera para evitar monotonia.
   - USE ESTA LISTA DE ENQUADRAMENTOS: Plano Geral, Plano Médio, Close-up, Detalhe (Macro), Vista Aérea (Drone), Contra-Plongée (de baixo para cima), Plongée (de cima para baixo).
   - REGRA DE OURO: NUNCA repita o mesmo enquadramento da cena anterior.

7. DETALHAMENTO VISUAL (CRÍTICO):
   - A "visual_description" DEVE começar com o Enquadramento de Câmera escolhido.
   - DEVE incluir a Iluminação e a AÇÃO específica.
   - TENTE descrever poses dinâmicas (correndo, pulando, agachado, voando) em vez de apenas "parado".
   - Exemplo: "Contra-Plongée. O coelhinho salta alto sobre um tronco, orelhas ao vento. Luz do sol vibrante."

Separe a seguinte história infantil em cenas para produção de vídeo.

TEXTO DA NARRAÇÃO:
${params.narration_text}

DURAÇÃO TOTAL: ${params.duration} minutos

INSTRUÇÕES:
1. Crie EXATAMENTE ${minScenes} cenas.
2. Distribua o texto da narração entre as cenas de forma que faça sentido visualmente.
3. Retorne APENAS um JSON válido
4. IMPORTANTE: Retorne APENAS O JSON, SEM blocos de código markdown (sem \`\`\`json ou \`\`\`). Comece diretamente com { e termine com }.

FORMATO DE SAÍDA:
Retorne um JSON válido com a seguinte estrutura:

{
  "scenes": [
    {
      "order": 1,
      "narration_text": "Trecho exato do texto correspondente a esta cena...",
      "visual_description": "Plano Médio. Luz brilhante. Descrição detalhada da composição...",
      "emotion": "alegre",
      "duration_estimate": ${targetAvgDuration},
      "characters": ["personagem1", "personagem2"]
    }
  ]
}

IMPORTANTE: O campo "emotion" deve ser EXATAMENTE um destes valores: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade.
NÃO use outras palavras ou traduções.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Step 1: Remove markdown code blocks
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        // Step 2: Extract JSON boundaries
        const jsonStart = text.indexOf('{');
        if (jsonStart === -1) {
            throw new Error('No JSON object found in response');
        }

        text = text.substring(jsonStart);

        // Find matching closing brace
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let jsonEnd = text.length;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"' && !escapeNext) { inString = !inString; }
            if (!inString) {
                if (char === '{') depth++;
                if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
            }
        }

        text = text.substring(0, jsonEnd);

        // Parse JSON
        let data: { scenes: any[] };

        try {
            data = JSON.parse(text);
        } catch (e) {
            console.warn('[Gemini] JSON parse failed, attempting regex fixes...');
            const fixedText = text.replace(
                /"([^"]*?)"/g,
                (match, content) => {
                    if (!content.includes('"')) return match;
                    return match.replace(/\\"/g, '___ESCAPED_QUOTE___')
                        .replace(/"/g, '\\"')
                        .replace(/___ESCAPED_QUOTE___/g, '\\"');
                }
            );

            try {
                data = JSON.parse(fixedText);
            } catch (e2) {
                console.error('[Gemini] JSON parse still failed, trying regex extraction...');
                const match = text.match(/"scenes"\s*:\s*(\[[\s\S]*\])/);
                if (match) {
                    data = { scenes: JSON.parse(match[1]) };
                } else {
                    throw new Error('Could not parse scenes JSON');
                }
            }
        }

        const scenes = data.scenes || [];

        // --- POST-PROCESSING: DEDUPLICATE SCENES ---

        // 1. DEDUPLICATE INTRO (Title Card)
        // If we are injecting a Title Card, we don't want the AI to generate text for the intro hook "Hoje eu vou contar..."
        // because that results in two Title Cards.
        if (hasIntroOutro && scenes.length > 0) {
            const firstScene = scenes[0];
            const text = firstScene.narration_text ? firstScene.narration_text.toLowerCase().trim() : '';

            // Check for standard intro hook
            const isIntroHook = text.includes('hoje eu vou contar') || text.includes('hoje vou contar');

            if (isIntroHook) {
                console.log('[Gemini] Detected AI-generated Intro Scene (Hook). Removing it in favor of Injected Title Card.');
                scenes.shift(); // Remove the first element
            }
        }

        // --- POST-PROCESSING: DEDUPLICATE ENDING ---
        // 1. Remove duplicate adjacent scenes (classic double generation)
        if (scenes.length >= 2) {
            const last = scenes[scenes.length - 1];
            const secondLast = scenes[scenes.length - 2];
            const t1 = last.narration_text ? last.narration_text.toLowerCase().trim() : '';
            const t2 = secondLast.narration_text ? secondLast.narration_text.toLowerCase().trim() : '';

            if (t1 === t2 && t1.length > 10) {
                console.log('[Gemini] Duplicate adjacent scenes detected. Removing one.');
                scenes.pop();
            }
        }

        // 2. CRITICAL: Remove AI-generated Outro if we are inserting our own
        // The AI often follows the prompt instruction to include the "Se você gostou..." text.
        // We must remove this AI-generated scene because we inject a standardized one later.
        if (hasIntroOutro && scenes.length > 0) {
            const lastScene = scenes[scenes.length - 1];
            const text = lastScene.narration_text ? lastScene.narration_text.toLowerCase().trim() : '';

            // Check against the standard outro text found in the prompt instructions
            const standardOutroFragment = "se você gostou, já sabe";
            const isOutro = text.includes(standardOutroFragment) ||
                (text.includes('tchau') && text.includes('inscreva'));

            if (isOutro) {
                console.log('[Gemini] Detected AI-generated outro scene. Removing it in favor of Injected Outro.');
                scenes.pop();
            }
        }

        // Re-index orders
        scenes.forEach((s: any, idx: number) => s.order = idx + 1);

        // Ensure data.scenes is updated for the next steps
        data.scenes = scenes;

        if (!data.scenes || !Array.isArray(data.scenes)) {
            throw new Error('Invalid response structure: missing scenes array');
        }

        let finalScenes: Scene[] = data.scenes;

        // INJECT INTRO AND OUTRO IF APPLICABLE
        if (hasIntroOutro) {
            console.log('[Gemini Scenes] Injecting Intro and Outro scenes...');

            // INTRO SCENE
            const introScene: Scene = {
                order: 0, // Will be re-indexed
                narration_text: `Hoje eu vou contar uma historinha super doce e cheia de aventura! É a história "${params.title}"!`,
                visual_description: `TITLE CARD: "${params.title}". Movie Poster Layout. Disney/Pixar 3D style. Big bold 3D typography title. The main character posing dynamically. Cinematic lighting, magical atmosphere.`,
                emotion: 'alegre',
                duration_estimate: 6,
                characters: ['__PROTAGONIST__'], // Special marker to be replaced by actual protagonist in UI
                image_prompt: `Movie Poster for "${params.title}". The Title "${params.title}" in BIG BOLD 3D Typography (Disney style). The main character is posing dynamically next to the text. Magical background, cinematic lighting, sparkles, high quality 8k render, depth of field.`
            };

            // OUTRO SCENE
            const outroScene: Scene = {
                order: 0, // Will be re-indexed
                narration_text: `Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!`,
                visual_description: `Vibrant ending card asking to Subscribe and Like. Pixar style background.`,
                emotion: 'alegre',
                duration_estimate: 8,
                characters: [],
                image_prompt: 'ENDING_CARD_PLACEHOLDER' // Placeholder logic for FilesPage integration
            };

            finalScenes = [introScene, ...finalScenes, outroScene];

            // RE-INDEX ORDERS
            finalScenes = finalScenes.map((scene, idx) => ({
                ...scene,
                order: idx + 1
            }));
        }

        console.log('[Gemini Scenes] Final Generated', finalScenes.length, 'scenes');
        return { scenes: finalScenes };

    } catch (error: any) {
        console.error('Error generating scenes with Gemini:', error);
        throw new Error(`Failed to generate scenes: ${error.message}`);
    }
}

export interface GenerateImagePromptParams {
    visual_description: string;
    emotion: string;
    characters: string[];
    visual_style?: string;
    is_first_scene?: boolean;
    imageTemplate?: string; // Custom template from user preferences
    characterDescriptions?: Record<string, string>; // Detailed character descriptions
}

export async function generateImagePrompt(params: GenerateImagePromptParams): Promise<string> {
    // SIMPLIFIED APPROACH: Build prompt directly without Gemini interpretation

    const style = params.visual_style || '3D Pixar/DreamWorks Animation style';

    // Build character details section
    let characterDetails = '';
    if (params.characterDescriptions && params.characters.length > 0) {
        const characterParts: string[] = [];
        params.characters.forEach(charName => {
            let description = params.characterDescriptions![charName];
            if (description) {
                // Try to extract quick prompt from Character Sheet to optimize length
                const quickPromptMatch = description.match(/PROMPT RÁPIDO:?\s*"([^"]+)"|PROMPT RÁPIDO:?\s*([^"\n]+)/i);
                if (quickPromptMatch) {
                    description = quickPromptMatch[1] || quickPromptMatch[2];
                }
                // If description is still too long (> 500 chars) and no quick prompt, truncate
                else if (description.length > 500) {
                    description = description.substring(0, 500) + "...";
                }

                characterParts.push(`${charName}: ${description}`);
            } else {
                characterParts.push(`${charName} (${style})`);
            }
        });
        characterDetails = characterParts.join('. ');
    } else if (params.characters.length > 0) {
        characterDetails = `Characters: ${params.characters.join(', ')} in ${style}`;
    }

    // Use template if provided, otherwise use default structure
    let finalPrompt = '';

    if (params.imageTemplate) {
        // Replace placeholders in template
        finalPrompt = params.imageTemplate
            // Substituir [PERSONAGEM] e variações
            .replace(/\[PERSONAGEM\]/gi, characterDetails)
            .replace(/\[personagem\]/gi, characterDetails)

            // Substituir [CENA] e variações
            .replace(/\[CENA\]/gi, params.visual_description)
            .replace(/\[cenário\]/gi, params.visual_description)
            .replace(/\[cenário[^\]]*\]/gi, params.visual_description)

            // Substituir [EMOÇÃO] e variações
            .replace(/\[EMOÇÃO\]/gi, params.emotion)
            .replace(/\[emoção\]/gi, params.emotion)
            .replace(/\[emoção desejada[^\]]*\]/gi, params.emotion)

            // Remover outros placeholders com exemplos
            .replace(/\[ex:[^\]]*\]/gi, params.visual_description);

        console.log('[Image Prompt] Template-based prompt generated');
    } else {
        // Default prompt structure - UPDATED: Scene/Action comes BEFORE Character Details to prioritize composition
        finalPrompt = `${style}. SCENE ACTION: ${params.visual_description}. CHARACTERS IN SCENE: ${characterDetails}. Emotion: ${params.emotion}. High quality, detailed, cinematic lighting, 8k resolution, dynamic angle.`;
        console.log('[Image Prompt] Default prompt generated');
    }

    console.log('[Image Prompt] Final length:', finalPrompt.length);

    return finalPrompt;
}

/**
 * Generate detailed character descriptions for consistency across scenes
 */
export interface GenerateCharacterDescriptionsParams {
    characters: string[];
    visual_description: string;
    age_group: string;
    visual_style: string;
}

export async function generateCharacterDescriptions(
    params: GenerateCharacterDescriptionsParams
): Promise<Record<string, string>> {
    if (!genAI) {
        throw new Error('Gemini API not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Você é um especialista em design de personagens para animação infantil.

Sua missão é criar descrições EXTREMAMENTE DETALHADAS de cada personagem para garantir consistência visual em todas as imagens geradas.

CONTEXTO:
- Faixa Etária: ${params.age_group}
- Estilo Visual: ${params.visual_style}
- Cena de Referência: "${params.visual_description}"
- Personagens: ${params.characters.join(', ')}

INSTRUÇÕES:
Para CADA personagem, crie uma descrição completa incluindo:

1. **Espécie/Tipo**: (ex: pato, coelho, criança, dragão)
2. **Tamanho e Proporções**: (ex: grande, pequeno, robusto, esguio)
3. **Cores Principais**: (seja MUITO específico - ex: "amarelo dourado vibrante #FFD700")
4. **Características Faciais**:
   - Formato dos olhos (tamanho, cor, expressão)
   - Nariz/focinho
   - Boca (formato, sorriso característico)
   - Orelhas (formato, posição, tamanho)
5. **Corpo e Textura**:
   - Tipo de pele/pelo/penas
   - Textura (macio, áspero, brilhante)
   - Detalhes únicos (manchas, listras, padrões)
6. **Vestuário** (se aplicável):
   - Roupas, acessórios
   - Cores e estilo
7. **Características Únicas**:
   - Marcas distintivas
   - Expressão típica
   - Postura característica
8. **Estilo de Animação**:
   - Como seria renderizado no estilo ${params.visual_style}

FORMATO DE RESPOSTA:
Retorne um JSON válido no formato:
{
  "NomePersonagem1": "descrição extremamente detalhada em inglês...",
  "NomePersonagem2": "descrição extremamente detalhada em inglês..."
}

IMPORTANTE:
- Descrições em INGLÊS (melhor para modelos de imagem)
- Seja MUITO específico com cores (use códigos hex quando possível)
- Inclua detalhes que garantam consistência visual
- Cada descrição deve ter pelo menos 200 palavras
- Use terminologia técnica de animação 3D

Retorne APENAS o JSON, sem explicações.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Remove markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        const descriptions = JSON.parse(text);

        console.log('[Character Descriptions] Generated:', Object.keys(descriptions));

        return descriptions;
    } catch (error: any) {
        console.error('Error generating character descriptions:', error);
        throw new Error(`Failed to generate character descriptions: ${error.message}`);
    }
}

/**
 * Generate detailed Character Sheet for each character using the official template
 * This creates consistent, Pixar-style character descriptions for visual consistency
 */
export interface GenerateCharacterSheetParams {
    characterName: string;
    storyText: string;
    characterSheetTemplate?: string; // Custom template from user preferences
}

export async function generateCharacterSheet(
    params: GenerateCharacterSheetParams
): Promise<string> {
    if (!genAI) {
        throw new Error('Gemini API not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const defaultTemplate = `Olá, aqui é o Concept Artist Sênior.
Para garantir que o personagem [NOME DO PERSONAGEM] mantenha identidade visual consistente em qualquer ângulo, cena ou variação gerada por IA, este design equilibra apelo emocional no estilo Pixar com especificações técnicas rígidas e reproduzíveis.

1. Espécie e Anatomia Colorimétrica
- Espécie: [tipo] estilizada, com proporções infantis e leitura clara de silhueta
- Formato do Corpo: [formato], priorizando simplicidade e reconhecimento imediato
- Cor Principal: [cor base dominante]
- Textura da Superfície: [textura] com acabamento cartoon ultra-realista
- Regiões Secundárias: [áreas] em tom complementar ou mais claro
- Extremidades: Curtas, arredondadas e levemente estilizadas

2. Olhos (Ponto Focal Emocional)
- Formato: Grandes, estilo Pixar/DreamWorks, ocupando 35-45% do rosto
- Cor da Íris: [cor contrastante]
- Pupilas: Grandes e bem definidas
- Brilho: Especular duplo para efeito vítreo

3. Acessórios Fixos
- Acessório Principal: [item icônico]
- Material: [material]
- Item Afetivo: [objeto simbólico]

4. Detalhes Únicos
- Expressão Característica: [expressão típica]
- Proporção: Cabeça levemente maior (chibi sofisticado)
- Silhueta: Reconhecível mesmo em sombra

5. Diretrizes de Renderização
- Estilo: Animação 3D Pixar/DreamWorks
- Iluminação: Cinematográfica, suave, backlight dourado
- Textura: Ultra-realista cartoon

PROMPT RÁPIDO: "A stylized Pixar-style character named [NOME], a [espécie] with [cor principal], [textura], huge expressive eyes with [cor íris], wearing [acessório] and carrying [item afetivo]. Cute proportions, cinematic lighting, subsurface scattering, ultra-detailed 3D render, 8k."`;

    const template = params.characterSheetTemplate || defaultTemplate;

    const prompt = `Você é um Concept Artist Sênior especializado em design de personagens para animação Pixar/DreamWorks.

Analise a história abaixo e crie um Character Sheet COMPLETO para o personagem "${params.characterName}" seguindo EXATAMENTE o template fornecido.

HISTÓRIA:
${params.storyText}

PERSONAGEM A DESCREVER: ${params.characterName}

TEMPLATE A SEGUIR:
${template}

INSTRUÇÕES:
1. Preencha TODOS os campos [brackets] com informações específicas para este personagem
2. Baseie-se nas pistas do texto da história
3. Infira características visuais apropriadas quando não mencionadas explicitamente
4. Mantenha consistência com o estilo Pixar/DreamWorks
5. Seja MUITO específico com cores (use nomes ou códigos hex)
6. A descrição final deve permitir que qualquer IA gere imagens consistentes do personagem

RETORNE o Character Sheet completo preenchido, seguindo a estrutura do template.
NÃO inclua explicações extras, apenas o Character Sheet preenchido.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const characterSheet = response.text().trim();

        console.log('[Character Sheet] Generated for:', params.characterName);

        return characterSheet;
    } catch (error: any) {
        console.error('Error generating character sheet:', error);
        throw new Error(`Failed to generate character sheet: ${error.message}`);
    }
}

/**
 * Generate Character Sheets for all characters in a story
 */
export async function generateAllCharacterSheets(
    storyText: string,
    characterNames: string[],
    characterSheetTemplate?: string
): Promise<Record<string, string>> {
    const sheets: Record<string, string> = {};

    for (const name of characterNames) {
        try {
            const sheet = await generateCharacterSheet({
                characterName: name,
                storyText,
                characterSheetTemplate
            });
            sheets[name] = sheet;
        } catch (error) {
            console.error(`Failed to generate sheet for ${name}:`, error);
            sheets[name] = `Character sheet generation failed for ${name}`;
        }
    }

    return sheets;
}
