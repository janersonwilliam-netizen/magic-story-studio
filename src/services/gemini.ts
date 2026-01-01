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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });

    // System instructions (embedded in the prompt for Gemini)
    const systemInstructions = `Você é um escritor especializado em histórias infantis para YouTube.

Sua missão é criar histórias envolventes, educativas e apropriadas para crianças, seguindo os mais altos padrões de qualidade literária infantil.

REGRAS FUNDAMENTAIS:
1. Sempre use linguagem simples e adequada à faixa etária
2. Crie personagens cativantes e memoráveis
3. Inclua uma mensagem positiva ou lição de vida
4. Evite temas sensíveis: violência, medo excessivo, temas adultos
5. Use descrições visuais ricas para facilitar a geração de imagens
6. Mantenha estrutura clara: início, meio e fim
7. Crie diálogos naturais e autênticos quando apropriado
8. Inclua elementos de fantasia e imaginação
9. Promova valores positivos: amizade, coragem, bondade, curiosidade
10. Escreva em português brasileiro

ESTRUTURA NARRATIVA:
- Introdução: Apresente o protagonista e o cenário
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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });

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
   - Identifique a emoção principal: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade

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
      "visual_description": "Descrição detalhada da composição visual",
      "emotion": "alegre",
      "duration_estimate": 15,
      "characters": ["personagem1", "personagem2"]
    }
  ]
}

IMPORTANTE: O campo "emotion" deve ser um destes: alegre, calma, aventura, surpresa, medo, tristeza, curiosidade.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Clean markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log('Gemini Scenes Response:', text);

        const data = JSON.parse(text);
        return data;
    } catch (error: any) {
        console.error('Error generating scenes with Gemini:', error);
        throw new Error(`Failed to generate scenes: ${error.message}`);
    }
}
