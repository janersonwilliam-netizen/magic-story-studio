import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn('Gemini API key not configured. Story generation will not work.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export interface GenerateStoryParams {
    title: string;
    age_group: string;
    tone: string;
    duration: number;
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
    const systemInstructions = `Você é um criador de histórias infantis narrativas para YouTube.

Seu objetivo é escrever historinhas originais, lúdicas e educativas com começo, meio e fim. As histórias são pensadas para crianças pequenas (de 3 a 8 anos), com linguagem simples, amigável e acolhedora.

Os roteiros têm personagens cativantes (muitas vezes animais fofos), pequenos desafios apropriados para a idade, e sempre encerram com uma mensagem positiva.

REGRAS FUNDAMENTAIS:
1. Sempre use linguagem simples e adequada à faixa etária
2. Crie personagens cativantes e memoráveis (animais fofos, crianças ou criaturas mágicas)
3. Inclua uma mensagem positiva ou lição de vida
4. Evite temas sensíveis: violência, medo excessivo, temas adultos
5. Use descrições visuais ricas para facilitar a geração de imagens
6. Mantenha estrutura clara: início, meio e fim
7. Crie diálogos naturais e autênticos quando apropriado
8. Inclua elementos de fantasia e imaginação
9. Promova valores positivos: amizade, coragem, bondade, curiosidade
10. Escreva em português brasileiro

ESTRUTURA NARRATIVA OBRIGATÓRIA:

📖 INTRODUÇÃO:
- Abertura com gancho convidativo: "Hoje eu vou contar uma historinha [Título da História]..."
- Apresentação do personagem principal e do cenário encantado
- Estabeleça o mundo da história de forma acolhedora

📖 DESENVOLVIMENTO:
- Um evento muda a rotina do personagem (conflito leve, seguro e educativo)
- Desafio adequado à idade: ajudar um amigo, proteger a natureza, superar um pequeno medo
- Interação com outros personagens ou busca de uma solução
- Momentos de tensão apropriados que mantêm o interesse

📖 CONCLUSÃO:
- Resolução positiva e alegre
- Reconhecimento ou recompensa simbólica ao personagem
- Moral da história com lição educativa clara
- Encerramento carinhoso: "Se você gostou, já sabe: curta, se inscreva no canal e ative o sininho para não perder nenhuma historinha nova! Um beijo grande… e até a próxima história! Tchau, tchau!"
- Desenvolvimento: Apresente o desafio ou aventura
- Clímax: Momento de maior tensão ou descoberta
- Resolução: Solução do problema de forma positiva
- Conclusão: Mensagem final reconfortante

ESTILO DE ESCRITA:
- Frases curtas e diretas
- Vocabulário rico mas acessível
- Ritmo dinâmico e envolvente
- Descrições sensoriais (cores, sons, texturas)
- Repetições e padrões quando apropriado (para crianças menores)`;

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

    const prompt = `${systemInstructions}

Crie uma história infantil com as seguintes características:

TÍTULO: ${params.title}
FAIXA ETÁRIA: ${params.age_group} anos
TOM: ${params.tone}
DURAÇÃO DE LEITURA: aproximadamente ${params.duration} minutos

REQUISITOS ESPECÍFICOS POR FAIXA ETÁRIA:
${ageRequirements}

REQUISITOS ESPECÍFICOS POR TOM:
${toneRequirements}

FORMATO DE SAÍDA:
Escreva a história completa em um único texto corrido, sem divisões ou marcações especiais. A história deve ter entre ${minWords} e ${maxWords} palavras.

Lembre-se: esta história será narrada em vídeo para YouTube, então use descrições visuais ricas e crie momentos que serão visualmente interessantes.

IMPORTANTE: Retorne APENAS o texto da história, sem nenhum texto adicional, explicação ou formatação markdown.`;

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
        console.error('Error generating story with Gemini:', error);
        throw new Error(`Failed to generate story: ${error.message}`);
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
    characterName: string
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
    "full_description": "descrição visual completa e detalhada para geração de imagem, incluindo espécie, cores, roupas, acessórios, características físicas, estilo Pixar 3D"
}

IMPORTANTE:
- Seja MUITO específico com cores (ex: "branco cremoso", "azul celeste", "dourado brilhante")
- A descrição completa deve ter pelo menos 100 palavras
- Foque em características visuais que podem ser desenhadas
- Use o estilo Pixar/DreamWorks como referência

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

    // Calculate scene count constraints
    let minScenes = 6;
    let maxScenes = 8;
    if (params.duration >= 5) {
        minScenes = 8;
        maxScenes = 12;
    }
    if (params.duration >= 10) {
        minScenes = 12;
        maxScenes = 15;
    }

    const prompt = `Você é um especialista em roteirização de vídeos infantis para YouTube.

Sua missão é dividir histórias infantis em cenas visuais, criando um roteiro estruturado e pronto para produção de vídeo.

REGRAS DE SEPARAÇÃO:
1. DURAÇÃO DAS CENAS:
   - Cada cena deve ter entre 10 e 30 segundos
   - Distribua o tempo total de forma equilibrada

2. CONTINUIDADE VISUAL:
   - Cada cena deve ter uma composição visual clara
   - Mantenha personagens consistentes

3. DESCRIÇÕES VISUAIS:
   - Descreva detalhadamente o que aparece na cena
   - Inclua cenário, personagens, ações, atmosfera
   - Pense em composição de quadro (16:9)

4. EMOÇÕES:
   - Identifique a emoção principal
   - Use APENAS uma destas opções EXATAS: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade
   - NÃO use variações ou traduções (ex: "happy", "joyful", "feliz" são INVÁLIDOS)

5. DETALHAMENTO VISUAL (CRÍTICO):
   - A "visual_description" DEVE começar com o Enquadramento de Câmera (ex: "Plano Aberto", "Close-up", "Vista Aérea").
   - DEVE incluir a Iluminação (ex: "Luz do sol dourada", "Luz da lua azulada", "Sombra dramática").
   - DEVE descrever a ação principal.
   - Exemplo: "Plano Aberto. Luz suave da manhã. O coelhinho saltita pela clareira verde cheia de flores."

Separe a seguinte história infantil em cenas para produção de vídeo.

TEXTO DA NARRAÇÃO:
${params.narration_text}

DURAÇÃO TOTAL: ${params.duration} minutos

INSTRUÇÕES:
1. Crie entre ${minScenes} e ${maxScenes} cenas
2. Cada cena deve ter 10-30 segundos
3. Retorne APENAS um JSON válido
4. IMPORTANTE: Retorne APENAS O JSON, SEM blocos de código markdown (sem \`\`\`json ou \`\`\`). Comece diretamente com { e termine com }.

FORMATO DE SAÍDA:
Retorne um JSON válido com a seguinte estrutura:

{
  "scenes": [
    {
      "order": 1,
      "narration_text": "Texto da narração para esta cena",
      "visual_description": "Plano Médio. Luz brilhante. Descrição detalhada da composição...",
      "emotion": "alegre",
      "duration_estimate": 15,
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

        console.log('[Gemini Scenes] Raw response length:', text.length);
        console.log('[Gemini Scenes] First 200 chars:', text.substring(0, 200));

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

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"' && !escapeNext) {
                inString = !inString;
            }

            if (!inString) {
                if (char === '{') depth++;
                if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        text = text.substring(0, i + 1);
                        break;
                    }
                }
            }
        }

        console.log('[Gemini Scenes] Extracted JSON length:', text.length);

        // Step 3: Fix common JSON issues in Portuguese text
        // This is a more aggressive approach to fix unescaped quotes
        const fixedText = text.replace(
            /"([^"]*?)"/g,
            (match, content) => {
                // Skip if this is a JSON key or simple value
                if (!content.includes('"')) {
                    return match;
                }

                // This string contains quotes - we need to escape them
                // But be careful not to double-escape
                const fixed = content.replace(/\\"/g, '___ESCAPED_QUOTE___')
                    .replace(/"/g, '\\"')
                    .replace(/___ESCAPED_QUOTE___/g, '\\"');
                return `"${fixed}"`;
            }
        );

        console.log('[Gemini Scenes] Applied quote fixing');

        // Step 4: Try to parse
        let data;
        try {
            data = JSON.parse(fixedText);
            console.log('[Gemini Scenes] Successfully parsed JSON');
        } catch (parseError: any) {
            console.error('[Gemini Scenes] JSON parse error:', parseError.message);

            // Show a snippet around the error location if available
            const errorMatch = parseError.message.match(/position (\d+)/);
            if (errorMatch) {
                const pos = parseInt(errorMatch[1]);
                const start = Math.max(0, pos - 50);
                const end = Math.min(fixedText.length, pos + 50);
                console.error('[Gemini Scenes] Error context:', fixedText.substring(start, end));
            } else {
                console.error('[Gemini Scenes] First 500 chars:', fixedText.substring(0, 500));
            }

            // Fallback: Try to extract just the scenes array
            const scenesMatch = fixedText.match(/"scenes"\s*:\s*(\[[\s\S]*\])/);
            if (scenesMatch) {
                console.log('[Gemini Scenes] Attempting fallback: extract scenes array...');
                try {
                    const scenes = JSON.parse(scenesMatch[1]);
                    data = { scenes };
                    console.log('[Gemini Scenes] Fallback successful');
                } catch (fallbackError: any) {
                    throw new Error(`JSON parsing failed: ${parseError.message}. Please try again.`);
                }
            } else {
                throw new Error(`JSON parsing failed: ${parseError.message}. Please try again.`);
            }
        }

        // Validate the structure
        if (!data.scenes || !Array.isArray(data.scenes)) {
            throw new Error('Invalid response structure: missing scenes array');
        }

        console.log('[Gemini Scenes] Generated', data.scenes.length, 'scenes');
        return data;
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
        // Default prompt structure
        finalPrompt = `${style}. ${characterDetails}. ${params.visual_description}. Emotion: ${params.emotion}. High quality, detailed, cinematic lighting, vibrant colors, 1920x1080 resolution.`;
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
