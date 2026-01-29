/// <reference types="vite/client" />
/**
 * Gemini Image Generation Service (Nano Banana / Imagen 3)
 * Uses the @google/genai SDK with Gemini 2.5 Flash Image model
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn('Google API key not configured. Image generation will not work.');
}

/**
 * Translate and compact prompt from Portuguese to English
 * Nano Banana works better with concise, direct English prompts
 * NOW DYNAMIC - extracts character info from the prompt itself
 */
function translateAndCompactPrompt(prompt: string): string {
    // If the prompt doesn't follow the internal structure (CENA/EMOÇÃO), it means the user edited it manually
    // In this case, we use the prompt exactly as is (just truncating for URL safety)
    if (!prompt.match(/CENA:/i) && !prompt.match(/PERSONAGEM:/i) && !prompt.match(/EMOÇÃO:/i)) {
        console.log('[Translate] Raw prompt detected, using as-is');
        // IMPORTANT: Replace newlines and multiple spaces with single space to avoid URL issues
        return prompt.replace(/\s+/g, ' ').trim().substring(0, 1000);
    }

    // Extract key information using regex
    const sceneMatch = prompt.match(/CENA:([^]*?)(?:EMOÇÃO:|PERSONAGEM:|COMPOSIÇÃO:|IMPORTANTE:|TITULO:|$)/i);
    const emotionMatch = prompt.match(/EMOÇÃO:\s*(\w+)/i);
    const characterMatch = prompt.match(/PERSONAGEM:([^]*?)(?:CENA:|EMOÇÃO:|COMPOSIÇÃO:|TITULO:|$)/i);
    const titleMatch = prompt.match(/TITULO:([^]*?)(?:CENA:|EMOÇÃO:|PERSONAGEM:|COMPOSIÇÃO:|$)/i);

    // Extract character species/type if specified
    const speciesMatch = prompt.match(/ESPÉCIE:\s*([^\n]+)/i) ||
        prompt.match(/é uma?\s+([\w\s]+)\s*\(/i) ||
        prompt.match(/BLOQUEIO DE PERSONAGEM:[^]*?é uma?\s+([\w\s]+)/i);

    const scene = sceneMatch ? sceneMatch[1].trim() : '';
    const emotion = emotionMatch ? emotionMatch[1].trim() : 'calm';
    const character = characterMatch ? characterMatch[1].trim() : '';
    const species = speciesMatch ? speciesMatch[1].trim() : '';
    const titleText = titleMatch ? titleMatch[1].trim() : '';

    // Translate emotion
    const emotionMap: Record<string, string> = {
        'alegre': 'joyful',
        'tristeza': 'sad',
        'surpresa': 'surprised',
        'medo': 'scared',
        'raiva': 'angry',
        'calma': 'calm',
        'curiosidade': 'curious',
        'aventura': 'adventurous'
    };
    const emotionEN = emotionMap[emotion.toLowerCase()] || emotion;

    // Common Portuguese to English translations for characters
    const ptToEnTranslations: Record<string, string> = {
        'vaca': 'cow',
        'vaquinha': 'little cow',
        'peixe': 'fish',
        'peixinho': 'little fish',
        'coelho': 'rabbit',
        'coelhinho': 'bunny',
        'pato': 'duck',
        'patinho': 'duckling',
        'cachorro': 'dog',
        'cachorrinho': 'puppy',
        'gato': 'cat',
        'gatinho': 'kitten',
        'urso': 'bear',
        'ursinho': 'little bear',
        'leão': 'lion',
        'elefante': 'elephant',
        'girafa': 'giraffe',
        'macaco': 'monkey',
        'passaro': 'bird',
        'passarinho': 'little bird',
        'borboleta': 'butterfly',
        'abelha': 'bee',
        'formiga': 'ant',
        'tartaruga': 'turtle',
        'sapo': 'frog',
        'dragão': 'dragon',
        'unicórnio': 'unicorn',
        'fada': 'fairy',
        'sereia': 'mermaid',
        'príncipe': 'prince',
        'princesa': 'princess',
        'menino': 'boy',
        'menina': 'girl',
        'criança': 'child'
    };

    // Translate species
    let speciesEN = species.toLowerCase();
    for (const [pt, en] of Object.entries(ptToEnTranslations)) {
        speciesEN = speciesEN.replace(new RegExp(pt, 'gi'), en);
    }

    // Build simplified English prompt - DYNAMIC, not hardcoded
    let optimized = '';

    // 1. TEXT/TITLE (Highest Priority for visibility)
    if (titleText) {
        optimized += `TEXT RENDER: The text "${titleText}" written in BIG 3D CARTOON MOVIES STYLE LETTERS in the center. Typography must be clearly visible and legible. `;
    }

    // 2. SCENE ACTION (Priority for variety)
    // Put scene BEFORE character details to ensure the specific action isn't lost
    // Scene description (translated and simplified)
    if (scene) {
        let sceneEN = scene;
        // Apply common translations
        for (const [pt, en] of Object.entries(ptToEnTranslations)) {
            sceneEN = sceneEN.replace(new RegExp(pt, 'gi'), en);
        }
        // Scene-specific translations
        sceneEN = sceneEN
            .replace(/Ampla tomada aérea mostrando/gi, 'Wide shot:')
            .replace(/um vale florido/gi, 'flowery valley')
            .replace(/montanhas suaves ao fundo/gi, 'soft mountains')
            .replace(/céu azul brilhante/gi, 'bright blue sky')
            .replace(/Transição para um plano médio/gi, 'Medium shot:')
            .replace(/fazenda vibrante/gi, 'vibrant farm')
            .replace(/celeiro vermelho e cerca branca/gi, 'red barn, white fence')
            .replace(/celeiro/gi, 'barn')
            .replace(/floresta/gi, 'forest')
            .replace(/oceano/gi, 'ocean')
            .replace(/praia/gi, 'beach')
            .replace(/montanha/gi, 'mountain')
            .replace(/jardim/gi, 'garden')
            .replace(/casa/gi, 'house')
            .replace(/escola/gi, 'school')
            .replace(/parque/gi, 'park')
            .replace(/rio/gi, 'river')
            .replace(/lago/gi, 'lake')
            .replace(/céu/gi, 'sky')
            .replace(/sol/gi, 'sun')
            .replace(/lua/gi, 'moon')
            .replace(/estrelas/gi, 'stars')
            .replace(/noite/gi, 'night')
            .replace(/dia/gi, 'day')
            .replace(/manhã/gi, 'morning')
            .replace(/tarde/gi, 'afternoon')
            .replace(/câmera/gi, 'camera');

        optimized += `SCENE ACTION: ${sceneEN.substring(0, 800)}. `;
    }

    // 3. CHARACTER DETAILS (After scene to contextualize)
    // Character description (if available)
    if (character) {
        let charEN = character;
        // Apply translations
        for (const [pt, en] of Object.entries(ptToEnTranslations)) {
            charEN = charEN.replace(new RegExp(pt, 'gi'), en);
        }
        // Additional translations
        charEN = charEN
            .replace(/olhos grandes/gi, 'big eyes')
            .replace(/olhos curiosos/gi, 'curious eyes')
            .replace(/olhos expressivos/gi, 'expressive eyes')
            .replace(/manchas marrons/gi, 'brown spots')
            .replace(/charmosas/gi, 'charming')
            .replace(/pequeno/gi, 'small')
            .replace(/grande/gi, 'large')
            .replace(/fofo/gi, 'cute')
            .replace(/peludo/gi, 'furry')
            .replace(/colorido/gi, 'colorful')
            .replace(/brilhante/gi, 'bright')
            .replace(/dourado/gi, 'golden')
            .replace(/prateado/gi, 'silver')
            .replace(/azul/gi, 'blue')
            .replace(/vermelho/gi, 'red')
            .replace(/verde/gi, 'green')
            .replace(/amarelo/gi, 'yellow')
            .replace(/vermelho/gi, 'red')
            .replace(/verde/gi, 'green')
            .replace(/amarelo/gi, 'yellow');

        optimized += `CHARACTERS: ${charEN.substring(0, 800)}. `;
    }

    // Quality constraints
    optimized += 'NO deformities, NO extra limbs, correct anatomy. ';

    // Emotion
    optimized += `Emotion: ${emotionEN}. `;

    // Style (concise)
    optimized += '3D Pixar style, cinematic lighting, vibrant colors, high quality render, no watermarks, no logos, aspect ratio 16:9 wide shot. ';

    // Final cleanup
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Limit to 400 characters for best results
    if (optimized.length > 400) {
        optimized = optimized.substring(0, 347) + '...';
    }

    console.log('[Translate] Species detected:', speciesEN || 'not specified');

    return optimized;
}

/**
 * Generate an image using Gemini 2.5 Flash Image (Imagen 3)
 * Returns a URL to the generated image
 */
export async function generateImageWithNanoBanana(prompt: string): Promise<string> {

    if (!apiKey) {
        throw new Error('API Key do Google não configurada. Configure VITE_GEMINI_API_KEY no arquivo .env');
    }

    // Translate and compact prompt for better results
    const optimizedPrompt = translateAndCompactPrompt(prompt);

    console.log('[Gemini Image] Original prompt length:', prompt.length);
    console.log('[Gemini Image] Optimized prompt length:', optimizedPrompt.length);
    console.log('[Gemini Image] Optimized prompt:', optimizedPrompt);

    try {
        console.log('[Gemini Image] Generating with Gemini 2.5 Flash Image...');

        const genAI = new GoogleGenAI({ apiKey });

        // Use Gemini 2.5 Flash Image (Imagen 3) for image generation
        const model = 'gemini-2.5-flash-image';

        const result = await genAI.models.generateContent({
            model,
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: '16:9'
                }
            },
            contents: [{
                role: 'user',
                parts: [{
                    text: optimizedPrompt
                }]
            }]
        });

        console.log('[Gemini Image] Generation complete');

        // The @google/genai SDK returns candidates directly in the result
        const response = result;

        // Check for safety issues in candidates
        if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];

            // Check finish reason
            if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION' || candidate.finishReason === 'OTHER') {
                console.error(`[Gemini Image] Generation blocked. Reason: ${candidate.finishReason}`, candidate.safetyRatings);
                throw new Error(`Imagem bloqueada. Motivo: ${candidate.finishReason}. Tente outro prompt.`);
            }

            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    // Check if this part contains inline image data
                    if (part.inlineData && part.inlineData.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        const base64Data = part.inlineData.data;
                        const dataUrl = `data:${mimeType};base64,${base64Data}`;

                        console.log('[Gemini Image] Image generated successfully via inline data');
                        return dataUrl;
                    }

                    // Check if there's a file data reference
                    if (part.fileData && part.fileData.fileUri) {
                        console.log('[Gemini Image] Image generated with file URI:', part.fileData.fileUri);
                        return part.fileData.fileUri;
                    }
                }
            }
        }

        // If we get here, Gemini didn't return an image
        console.error('[Gemini Image] No image data found in response', response);
        const feedback = (response as any).promptFeedback;
        if (feedback) {
            console.error('[Gemini Image] Prompt Feedback:', feedback);
            if (feedback.blockReason) {
                throw new Error(`Geração bloqueada. Motivo: ${feedback.blockReason}`);
            }
        }

        throw new Error('O Gemini não retornou uma imagem. Verifique se sua API Key tem permissão para o modelo e se não há restrições de segurança.');

    } catch (error: any) {
        console.error('[Gemini Image] Error:', error);
        // Don't wrap if it's already an Error object we created
        if (error.message && (error.message.includes('bloqueada') || error.message.includes('API Key'))) {
            throw error;
        }
        throw new Error(`Erro ao gerar imagem com Gemini: ${error.message}`);
    }
}

/**
 * Generate an image with reference images for character consistency
 * Uses Gemini 3 Pro Image (supports up to 14 reference images)
 * @param prompt - Text description of the scene
 * @param referenceImages - Array of base64 data URLs of reference images (up to 5 for characters)
 * @param characterStatuses - Optional array of character statuses ('protagonist' or 'supporting') for conditional duplication
 * @returns Data URL of the generated image
 */
export async function generateImageWithReferences(
    prompt: string,
    referenceImages: string[],
    characterStatuses?: string[]
): Promise<string> {
    if (!apiKey) {
        throw new Error('API Key do Google não configurada. Configure VITE_GEMINI_API_KEY no arquivo .env');
    }

    if (referenceImages.length === 0) {
        console.warn('[Gemini 3 Pro Image] No reference images provided, falling back to standard generation');
        return generateImageWithNanoBanana(prompt);
    }

    if (referenceImages.length > 5) {
        console.warn('[Gemini 3 Pro Image] Too many reference images (max 5 for characters), using first 5');
        referenceImages = referenceImages.slice(0, 5);
    }

    // Translate and compact prompt
    const optimizedPrompt = translateAndCompactPrompt(prompt);

    // Add EXPLICIT consistency AND child-friendly instructions
    const enhancedPrompt = `SCENE ACTION (PRIORITY 1): ${optimizedPrompt}

CRITICAL STYLE REQUIREMENTS (High Priority):
1. CHILD-FRIENDLY: Cute, adorable, BIG expressive eyes (Pixar/DreamWorks style), soft rounded features, friendly appearance
2. EXACT CONSISTENCY: Use IDENTICAL colors, proportions, and features from the provided reference images
3. NO realistic/adult features - must be cartoon-style, appealing to children ages 3-8
4. Maintain playful, innocent, non-threatening character design`;

    console.log('[Gemini 3 Pro Image] Generating with', referenceImages.length, 'reference images');
    console.log('[Gemini 3 Pro Image] Enhanced prompt:', enhancedPrompt);

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const genAI = new GoogleGenAI({ apiKey });
            // ... (rest of the logic)



            // Build contents array: prompt + reference images
            const contents: any[] = [
                { text: enhancedPrompt }
            ];

            // Add reference images with CONDITIONAL duplication
            // Protagonists: 1x (already have good consistency)
            // Supporting: 2x (need extra emphasis)
            for (let i = 0; i < referenceImages.length; i++) {
                const refImage = referenceImages[i];
                const status = characterStatuses?.[i] || 'supporting'; // Default to supporting for safety

                // Extract base64 data from data URL
                const base64Match = refImage.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);

                if (base64Match) {
                    const mimeType = `image/${base64Match[1]}`;
                    const base64Data = base64Match[2];

                    const imageData = {
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    };

                    // Conditional duplication based on character importance
                    if (status === 'protagonist') {
                        // Protagonist: Add once (already consistent)
                        contents.push(imageData);
                        console.log('[Gemini 3 Pro Image] Added PROTAGONIST reference (1x weight)');
                    } else {
                        // Supporting: Add twice (needs more emphasis)
                        contents.push(imageData);
                        contents.push(imageData);
                        console.log('[Gemini 3 Pro Image] Added SUPPORTING reference (2x weight)');
                    }
                } else {
                    console.warn('[Gemini 3 Pro Image] Invalid reference image format, skipping');
                }
            }

            console.log(`[Gemini 3 Pro Image] Attempt ${attempt + 1}/${maxRetries}. Total content items:`, contents.length);

            // Use Gemini 3 Pro Image Preview model
            const model = 'gemini-3-pro-image-preview';

            const result = await genAI.models.generateContent({
                model,
                contents: contents,
                config: {
                    responseModalities: ['IMAGE'],
                    imageConfig: {
                        aspectRatio: '16:9'
                    }
                }
            });

            console.log('[Gemini 3 Pro Image] Generation complete');

            // Extract image from response
            if (result.candidates && result.candidates.length > 0) {
                const candidate = result.candidates[0];

                // Check finish reason
                if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION' || candidate.finishReason === 'OTHER') {
                    console.error(`[Gemini 3 Pro Image] Generation blocked. Reason: ${candidate.finishReason}`, candidate.safetyRatings);
                    throw new Error(`Imagem de referência bloqueada. Motivo: ${candidate.finishReason}. Tente outro prompt.`);
                }

                if (candidate.content && candidate.content.parts) {
                    for (const part of candidate.content.parts) {
                        if (part.inlineData && part.inlineData.data) {
                            const mimeType = part.inlineData.mimeType || 'image/png';
                            const base64Data = part.inlineData.data;
                            const dataUrl = `data:${mimeType};base64,${base64Data}`;

                            console.log('[Gemini 3 Pro Image] Image generated with ENHANCED child-friendly consistency');
                            return dataUrl;
                        }

                        if (part.fileData && part.fileData.fileUri) {
                            console.log('[Gemini 3 Pro Image] Image generated with file URI:', part.fileData.fileUri);
                            return part.fileData.fileUri;
                        }
                    }
                }
            }

            console.error('[Gemini 3 Pro Image] No image data found in response', result);
            const feedback = (result as any).promptFeedback;
            if (feedback) {
                console.error('[Gemini 3 Pro Image] Prompt Feedback:', feedback);
                if (feedback.blockReason) {
                    throw new Error(`Geração bloqueada. Motivo: ${feedback.blockReason}`);
                }
            }

            throw new Error('Gemini 3 Pro Image não retornou uma imagem. Verifique se sua API Key tem permissão para o modelo e se não há restrições de segurança.');

        } catch (error: any) {
            console.error(`[Gemini 3 Pro Image] Error (Attempt ${attempt + 1}):`, error);

            // Don't wrap if it's already an Error object we created
            if (error.message && (error.message.includes('bloqueada') || error.message.includes('API Key'))) {
                throw error;
            }

            // Handle 503 Overloaded error - check multiple patterns
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
                    const delay = 3000 * Math.pow(1.5, attempt); // Exponential backoff: 4.5s, 6.7s, 10s, 15s
                    console.log(`[Gemini 3 Pro Image] Model overloaded (503). Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Retry loop
                }
            }

            // If max retries reached or other error, throw
            throw new Error(`Falha na geração com referências: ${error.message}. Tente novamente.`);
        }
    }

    throw new Error('Falha na geração após múltiplas tentativas.');
}
