import { GoogleGenerativeAI } from '@google/generative-ai';
import { withModelFallback, PRIMARY_MODELS, SMART_MODELS } from '../lib/gemini-utils';
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

    // Use fallback utility
    return await withModelFallback(async (model) => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const story_text = response.text().trim();

        return {
            story_text,
            narration_text: story_text,
        };
    }, { models: PRIMARY_MODELS });
}

/**
 * Translates a text to a target language using Gemini
 */
export async function translateTitle(title: string, targetLanguage: string): Promise<string> {
    return await withModelFallback(async (model) => {
        const prompt = `Translate the following book title to ${targetLanguage}.
    Title: "${title}"
    
    IMPORTANT: Return ONLY the translated title, nothing else. No explanation, no quotes.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim().replace(/^"|"$/g, '');
    }, { models: PRIMARY_MODELS });
}

export async function extractCharactersFromStory(storyText: string): Promise<Record<string, string>> {
    return await withModelFallback(async (model) => {
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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Remove markdown formatting if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text);
    }, { models: PRIMARY_MODELS });
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
    return await withModelFallback(async (model) => {
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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Remove markdown formatting
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(text);

        return data;
    }, { models: PRIMARY_MODELS });
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
    // Logic for Intro/Outro injection
    const hasIntroOutro = !!params.title && !!params.targetSceneCount;
    const storySceneCount = hasIntroOutro && params.targetSceneCount ? params.targetSceneCount : undefined;

    // Calculate scene count constraints
    let minScenes = 6;
    let maxScenes = 8;

    if (storySceneCount) {
        minScenes = storySceneCount;
        maxScenes = storySceneCount;
    } else if (params.targetSceneCount) {
        minScenes = params.targetSceneCount;
        maxScenes = params.targetSceneCount;
    } else {
        if (params.duration >= 5) {
            minScenes = 8;
            maxScenes = 12;
        }
        if (params.duration >= 10) {
            minScenes = 12;
            maxScenes = 15;
        }
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

    return await withModelFallback(async (model) => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonStart = text.indexOf('{');
        text = text.substring(jsonStart !== -1 ? jsonStart : 0);

        const data = JSON.parse(text);
        const scenes = data.scenes || [];

        // Post-processing for Intro/Outro injection
        let finalScenes: Scene[] = scenes;
        
        if (hasIntroOutro) {
            const introScene: Scene = {
                order: 0,
                narration_text: `Hoje eu vou contar uma historinha super doce e cheia de aventura! É a história "${params.title}"!`,
                visual_description: `TITLE CARD: "${params.title}". Movie Poster Layout.`,
                emotion: 'alegre',
                duration_estimate: 6,
                characters: ['__PROTAGONIST__'],
                image_prompt: `Movie Poster for "${params.title}".`
            };

            const outroScene: Scene = {
                order: 0,
                narration_text: `Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Tchau, tchau!`,
                visual_description: `Vibrant ending card asking to Subscribe and Like.`,
                emotion: 'alegre',
                duration_estimate: 8,
                characters: [],
                image_prompt: 'ENDING_CARD_PLACEHOLDER'
            };

            finalScenes = [introScene, ...finalScenes, outroScene];
            finalScenes = finalScenes.map((scene, idx) => ({ ...scene, order: idx + 1 }));
        }

        return { scenes: finalScenes };
    }, { models: PRIMARY_MODELS });
}

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
    const style = params.visual_style || '3D Pixar/DreamWorks Animation style';
    let characterDetails = '';
    
    if (params.characterDescriptions && params.characters.length > 0) {
        const characterParts: string[] = [];
        params.characters.forEach(charName => {
            const description = params.characterDescriptions![charName] || charName;
            characterParts.push(`${charName}: ${description.substring(0, 500)}`);
        });
        characterDetails = characterParts.join('. ');
    }

    return `${style}. SCENE ACTION: ${params.visual_description}. CHARACTERS: ${characterDetails}. Emotion: ${params.emotion}.`;
}

export async function generateCharacterDescriptions(
    params: GenerateCharacterDescriptionsParams
): Promise<Record<string, string>> {
    const prompt = `Crie descrições DETALHADAS em INGLÊS para gerar imagens consistentes:
Personagens: ${params.characters.join(', ')}
Estilo: ${params.visual_style}
Cena: ${params.visual_description}

Retorne um JSON: {"Nome": "Descrição..."}`;

    return await withModelFallback(async (model) => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        return JSON.parse(text);
    }, { models: PRIMARY_MODELS });
}

export async function generateCharacterSheet(
    params: GenerateCharacterSheetParams
): Promise<string> {
    const prompt = `Crie um Character Sheet Pixar Style para "${params.characterName}" baseado na história.`;

    return await withModelFallback(async (model) => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }, { models: PRIMARY_MODELS });
}

export interface GenerateCharacterSheetParams {
    characterName: string;
    storyText: string;
    characterSheetTemplate?: string;
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
