/// <reference types="vite/client" />
/**
 * Gemini Image Generation Service (Nano Banana / Imagen 3)
 * Uses the @google/genai SDK with Gemini 2.5 Flash Image model
 */

import { GoogleGenAI } from '@google/genai';
import { generateImageVertex } from './vertex_service';

export function isVertexConfigured(): boolean {
    // Check both standard Vite env and the global fallback injection
    const url = import.meta.env.VITE_VERTEX_AI_URL || (window as any).VITE_VERTEX_AI_URL || '';
    return url.length > 5; // Simple check for a valid URL
}

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

console.log('[Debug] Vertex Config:', {
    url: import.meta.env.VITE_VERTEX_AI_URL,
    configured: isVertexConfigured()
});

if (!apiKey) {
    console.warn('Google API key not configured. Image generation will not work.');
}

/**
 * Translate and compact prompt from Portuguese to English
 * Nano Banana works better with concise, direct English prompts
 * NOW DYNAMIC - extracts character info from the prompt itself
 */
async function translateAndCompactPrompt(prompt: string, styleConfig?: string): Promise<string> {
    // Helper: builds the mandatory style suffix based on styleConfig
    function getStyleSuffix(config?: string): string {
        if (config === 'Estilo 2D Cartoon') {
            return '. STYLE: Premium 2D cartoon illustration, modern mobile game art style, modern Disney 2D style, rich details, magical lighting, warm golden backlight, very vibrant colors, soft colorful shading, crisp clean outlines, cute, charming, well-proportioned anatomy, correct number of limbs, fully detailed environment background, NO white background, NO plain background, NO 3D rendering, NO CGI, NO photorealism, widescreen 16:9';
        }
        return '. STYLE: 3D Pixar animation style, big expressive eyes, soft rounded features, warm cinematic lighting, vibrant colors, well-proportioned anatomy, correct number of limbs, fully detailed environment background, NO white background, NO plain background, children book illustration, widescreen 16:9';
    }

    // If the prompt is already in English (our new descriptive prompts), skip translation
    // but STILL append style suffix to guarantee consistency
    const isAlreadyEnglish = prompt.match(/^(A |An |The |Children|3D |2D |Cute |Scene|Title)/i) 
        || prompt.match(/Pixar animation style/i)
        || prompt.match(/children book illustration/i)
        || prompt.match(/widescreen 16:9/i);
    
    if (isAlreadyEnglish) {
        console.log('[Translate] Prompt already in English, skipping translation');
        let result = prompt.replace(/\s+/g, ' ').trim();
        // Truncate the description part to leave room for the style suffix
        const suffix = styleConfig ? getStyleSuffix(styleConfig) : '';
        const maxDescLen = 900 - suffix.length;
        if (result.length > maxDescLen) {
            result = result.substring(0, maxDescLen);
        }
        // Only append style suffix if it's not already present in the prompt
        if (styleConfig && !result.includes('NO 3D rendering') && !result.includes('Pixar animation style')) {
            result += suffix;
        }
        console.log('[Translate] Final prompt length:', result.length);
        return result;
    }

    // If the prompt doesn't follow the standard structure, use LLM to translate quickly to English
    if (!prompt.match(/CENA:/i) && !prompt.match(/PERSONAGEM:/i) && !prompt.match(/EMOÇÃO:/i) && !prompt.match(/CHARACTER DETAILS:/i)) {
        console.log('[Translate] Raw prompt detected, translating via LLM...');
        try {
            const response = await fetch('/api/generate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Translate this image generation prompt from Portuguese to English. IMPORTANT: Keep any text inside quotes exactly as-is (do not translate quoted title text). Make it concise, descriptive, and maximum 400 characters long. Do not include introductory text, just the translation:\n${prompt}`
                })
            });
            const data = await response.json() as any;
            if (data.text) {
                let translated = data.text.trim().substring(0, 600);
                // Always append style suffix after LLM translation
                if (styleConfig) {
                    translated += getStyleSuffix(styleConfig);
                }
                return translated;
            }
        } catch (e) {
            console.error('LLM Translation failed', e);
        }
        // Fallback: truncate and add style
        let fallback = prompt.replace(/\s+/g, ' ').trim().substring(0, 600);
        if (styleConfig) {
            fallback += getStyleSuffix(styleConfig);
        }
        return fallback;
    }

    // Extract key information using regex
    const sceneMatch = prompt.match(/CENA:([^]*?)(?:EMOÇÃO:|PERSONAGEM:|COMPOSIÇÃO:|IMPORTANTE:|TITULO:|$)/i);
    const emotionMatch = prompt.match(/EMOÇÃO:\s*(\w+)/i);
    const characterMatch = prompt.match(/PERSONAGEM:([^]*?)(?:CENA:|EMOÇÃO:|COMPOSIÇÃO:|TITULO:|$)/i) || prompt.match(/CHARACTER DETAILS:([^]*?)(?:TECHNICAL:|$)/i);
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

    // Build simplified English prompt - natural descriptive style (works best with Gemini 2.5 Flash)
    let optimized = '';

    // 1. TEXT/TITLE for thumbnails
    if (titleText) {
        optimized += `Title text "${titleText.substring(0, 50)}" in thick chunky 3D extruded letters at top, each word different vibrant color, thematic textures, drop shadows, glossy shine. `;
    }

    // 2. SCENE ACTION
    if (scene) {
        let sceneEN = scene;
        for (const [pt, en] of Object.entries(ptToEnTranslations)) {
            sceneEN = sceneEN.replace(new RegExp(pt, 'gi'), en);
        }
        optimized += `${sceneEN.substring(0, 150)}, `;
    }

    // 3. CHARACTER DETAILS
    if (character) {
        let charEN = character;
        
        // LLM translation for complex descriptions
        if (charEN.length > 50) {
            try {
                const response = await fetch('/api/generate-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: `Translate this character visual description to English for an image generation prompt. Output ONLY the English translation, maximum 120 characters, no intro text, no quotes:\n${charEN}`
                    })
                });
                const data = await response.json() as any;
                if (data.text && data.text.length > 10) {
                    charEN = data.text.trim()
                        .replace(/^["']|["']$/g, '')
                        .replace(/Pixar/gi, '')
                        .replace(/Disney/gi, '')
                        .replace(/DreamWorks/gi, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    console.log('[Translate] LLM character translation:', charEN);
                }
            } catch (e) {
                console.warn('[Translate] LLM translation failed, using regex fallback');
            }
        }

        // Regex fallback translations
        for (const [pt, en] of Object.entries(ptToEnTranslations)) {
            charEN = charEN.replace(new RegExp(pt, 'gi'), en);
        }
        charEN = charEN
            .replace(/olhos grandes/gi, 'big eyes')
            .replace(/olhos curiosos/gi, 'curious eyes')
            .replace(/olhos expressivos/gi, 'expressive eyes')
            .replace(/olhos castanhos/gi, 'brown eyes')
            .replace(/olhos azuis/gi, 'blue eyes')
            .replace(/olhos verdes/gi, 'green eyes')
            .replace(/olhos/gi, 'eyes')
            .replace(/cabelo loiro/gi, 'blonde hair')
            .replace(/cabelo castanho/gi, 'brown hair')
            .replace(/cabelo preto/gi, 'black hair')
            .replace(/cabelo ruivo/gi, 'red hair')
            .replace(/cabelo/gi, 'hair')
            .replace(/rosto redondo/gi, 'round face')
            .replace(/rosto/gi, 'face')
            .replace(/pele clara/gi, 'light skin')
            .replace(/pele morena/gi, 'tan skin')
            .replace(/pele escura/gi, 'dark skin')
            .replace(/pele/gi, 'skin')
            .replace(/aproximadamente/gi, 'approximately')
            .replace(/anos de idade/gi, 'years old')
            .replace(/alegre/gi, 'cheerful')
            .replace(/enérgico/gi, 'energetic')
            .replace(/amigável/gi, 'friendly')
            .replace(/curioso/gi, 'curious')
            .replace(/corajoso/gi, 'brave')
            .replace(/tímido/gi, 'shy')
            .replace(/fofo/gi, 'cute')
            .replace(/peludo/gi, 'furry')
            .replace(/colorido/gi, 'colorful')
            .replace(/brilhante/gi, 'bright')
            .replace(/grande/gi, 'big')
            .replace(/pequeno/gi, 'small')
            .replace(/com um/gi, 'with a')
            .replace(/com uma/gi, 'with a')
            .replace(/de aproximadamente/gi, 'approximately')
            .replace(/sete a oito/gi, 'seven to eight')
            .replace(/e olhos/gi, 'and eyes')
            .replace(/Um /gi, 'A ')
            .replace(/Uma /gi, 'A ');

        optimized += `${charEN.substring(0, 180)}, `;
    }

    // 4. Emotion
    if (emotionEN) {
        optimized += `${emotionEN} mood, `;
    }

    // 5. Style suffix (simple descriptive, like the successful lion test)
    if (styleConfig === 'Estilo 2D Cartoon') {
        optimized += 'Premium 2D cartoon illustration, modern mobile game art style, modern Disney 2D style, rich details, magical lighting, warm golden backlight. Very vibrant colors, soft colorful shading, crisp clean outlines. Animated children storybook style, cute, charming, well-proportioned anatomy, correct number of limbs, fully detailed environment background, NO white background, NO plain background, NO 3D rendering, NO CGI, widescreen 16:9';
    } else {
        optimized += '3D Pixar animation style, big expressive eyes, soft rounded features, warm cinematic lighting, vibrant colors, well-proportioned anatomy, correct number of limbs, fully detailed environment background, NO white background, NO plain background, children book illustration, widescreen 16:9';
    }

    // Final cleanup
    optimized = optimized.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
    
    // Gemini 2.5 Flash Image supports longer prompts
    if (optimized.length > 800) {
        optimized = optimized.substring(0, 800);
    }

    console.log('[Translate] Species detected:', speciesEN || 'not specified');

    return optimized;
}

/**
 * Generate an image using Gemini Image models
 * Uses VERIFIED model names from ListModels API
 * Returns a data URL of the generated image
 */
export async function generateImageWithNanoBanana(prompt: string, styleConfig?: string): Promise<string> {
    const optimizedPrompt = await translateAndCompactPrompt(prompt, styleConfig);
    console.log('[Vertex Image] Optimized prompt:', optimizedPrompt);

    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: optimizedPrompt, aspectRatio: '16:9' }),
            });

            // Handle rate limiting with retry
            if (response.status === 429 && attempt < maxRetries) {
                const waitTime = (attempt + 1) * 8000 + Math.random() * 5000; // 8-13s, 16-21s, 24-29s...
                console.warn(`[Vertex Image] Rate limited (429), retrying in ${Math.round(waitTime / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            const textResponse = await response.text();
            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (e) {
                console.error('[Vertex Image] Failed to parse JSON. Status:', response.status, 'Body:', textResponse);
                throw new Error(`Invalid JSON response from server (Status ${response.status}): ${textResponse.substring(0, 100)}`);
            }
            if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
            if (data.base64) return `data:${data.mimeType || 'image/png'};base64,${data.base64}`;
            throw new Error('Nenhuma imagem retornada pelo backend');
        } catch (err: any) {
            if (attempt < maxRetries && (err.message?.includes('429') || err.message?.includes('Resource exhausted'))) {
                const waitTime = (attempt + 1) * 5000 + Math.random() * 3000;
                console.warn(`[Vertex Image] Error, retrying in ${Math.round(waitTime / 1000)}s...`, err.message);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            console.error(`[Vertex Image] Falha na geração:`, err);
            throw new Error(`Falha na geração de imagem: ${err.message}`);
        }
    }
    throw new Error('Falha na geração após múltiplas tentativas');
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
    characterStatuses?: string[],
    styleConfig?: string
): Promise<string> {
    if (referenceImages.length === 0) {
        return generateImageWithNanoBanana(prompt, styleConfig);
    }
    
    const optimizedPrompt = await translateAndCompactPrompt(prompt, styleConfig);
    const enhancedPrompt = `${optimizedPrompt}, matching the reference images exactly, same character colors and features`;

    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: enhancedPrompt,
                    aspectRatio: '16:9',
                    referenceImages: referenceImages.slice(0, 5)
                }),
            });

            // Handle rate limiting with retry
            if (response.status === 429 && attempt < maxRetries) {
                const waitTime = (attempt + 1) * 8000 + Math.random() * 5000;
                console.warn(`[Vertex Image] Rate limited (429) with refs, retrying in ${Math.round(waitTime / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            const textResponse = await response.text();
            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (e) {
                console.error('[Vertex Image] Failed to parse JSON with refs. Status:', response.status, 'Body:', textResponse);
                throw new Error(`Invalid JSON response from server (Status ${response.status}): ${textResponse.substring(0, 100)}`);
            }
            if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
            if (data.base64) return `data:${data.mimeType || 'image/png'};base64,${data.base64}`;
            throw new Error('Nenhuma imagem retornada');
        } catch (err: any) {
            if (attempt < maxRetries && (err.message?.includes('429') || err.message?.includes('Resource exhausted'))) {
                const waitTime = (attempt + 1) * 8000 + Math.random() * 5000;
                console.warn(`[Vertex Image] Error with refs, retrying in ${Math.round(waitTime / 1000)}s...`, err.message);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            console.warn(`[Vertex Image] Falha com refs, fallback para padrão:`, err.message);
            return generateImageWithNanoBanana(prompt, styleConfig);
        }
    }
    // Final fallback
    return generateImageWithNanoBanana(prompt, styleConfig);
}
