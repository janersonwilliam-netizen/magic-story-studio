/**
 * Gemini Text-to-Speech Service
 * Uses the new Gemini TTS API (gemini-2.5-flash-preview-tts)
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.warn('Gemini API key not configured. TTS will not work.');
}

export interface GenerateAudioParams {
    text: string;
    emotion?: 'cheerfully' | 'sadly' | 'excitedly' | 'calmly' | 'mysteriously' | 'warmly';
    voiceName?: string;
    speakingRate?: number; // Not directly supported, but can be adjusted via prompt
    pitch?: number; // Not directly supported, but can be adjusted via prompt
}

export type TTSProvider = 'gemini' | 'google-cloud';

/**
 * Available Gemini TTS voices
 */
export const GEMINI_VOICES = {
    'Kore': 'Gemini - Feminina (Padrão)',
    'Charon': 'Gemini - Masculina (Padrão)',
    'Aoede': 'Gemini - Feminina (Suave)',
    'Fenrir': 'Gemini - Masculina (Profunda)',
    'Puck': 'Gemini - Infantil/Jovem',
} as const;

/**
 * Available Google Cloud TTS voices (Standard = Free Tier Friendly)
 */
export const GOOGLE_VOICES = {
    'pt-BR-Standard-A': 'Google - Feminina (Padrão)',
    'pt-BR-Standard-B': 'Google - Masculina (Padrão)',
    'pt-BR-Wavenet-A': 'Google - Feminina (WaveNet)',
    'pt-BR-Wavenet-B': 'Google - Masculina (WaveNet)',
    'pt-BR-Neural2-A': 'Google - Feminina (Neural)',
    'pt-BR-Neural2-B': 'Google - Masculina (Neural)',
} as const;

export type GeminiVoiceOption = keyof typeof GEMINI_VOICES;
export type GoogleVoiceOption = keyof typeof GOOGLE_VOICES;


import { generateGoogleCloudAudio } from './google_tts';

/**
 * Generate audio narration using selected provider
 */
export async function generateAudioNarration(params: GenerateAudioParams): Promise<string> {
    const {
        text,
        emotion = 'warmly',
        voiceName = 'pt-BR-Standard-A',
    } = params;

    console.log('[TTS] Generating audio with voice:', voiceName);

    // Determine provider based on voice name
    const isGemini = Object.keys(GEMINI_VOICES).includes(voiceName);

    if (isGemini) {
        return generateGeminiAudio(params);
    } else {
        // Default to Google Cloud for 'pt-BR-*' voices
        return generateGoogleCloudAudio({
            text,
            voiceName
        });
    }
}

async function generateGeminiAudio(params: GenerateAudioParams): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key not configured');

    const {
        text,
        emotion = 'warmly',
        voiceName = 'Kore',
    } = params;

    try {
        const ai = new GoogleGenAI({ apiKey });
        const promptText = `Say ${emotion}: ${text}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: promptText }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voiceName as string
                        }
                    }
                }
            }
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error('No audio content returned from Gemini TTS API');

        return `data:audio/wav;base64,${audioData}`;

    } catch (error: any) {
        console.error('[Gemini TTS] Error generating audio:', error);
        throw new Error(`Failed to generate audio with Gemini TTS: ${error.message}`);
    }
}

/**
 * Split text into chunks that fit within Gemini TTS limits
 * Tries to split on sentence boundaries (. ! ?) to avoid cutting words
 */
function splitTextIntoChunks(text: string, maxChunkSize: number = 4000): string[] {
    if (text.length <= maxChunkSize) return [text];

    const chunks: string[] = [];
    let currentChunk = '';

    // Split by sentence endings first
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
}

/**
 * Generate audio for long text by chunking and concatenating
 * Note: This is a simplified approach. For production, consider using
 * a proper audio concatenation library or backend processing
 */
export async function generateLongAudioNarration(params: GenerateAudioParams): Promise<string> {
    const chunks = splitTextIntoChunks(params.text);
    console.log(`[Gemini TTS] Text too long, split into ${chunks.length} chunks`);

    const audioParts: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
        console.log(`[Gemini TTS] Generating chunk ${i + 1}/${chunks.length}`);

        // Generate audio for each chunk
        const dataUrl = await generateAudioNarration({
            ...params,
            text: chunks[i]
        });

        // Extract base64 data (remove "data:audio/wav;base64," prefix)
        const base64 = dataUrl.split(',')[1];
        audioParts.push(base64);
    }

    // Simple concatenation of WAV base64 chunks
    // Note: This may not work perfectly for WAV format
    // For production, consider using a proper audio processing library
    return `data:audio/wav;base64,${audioParts.join('')}`;
}

/**
 * Map emotion keywords to Gemini TTS emotion prompts
 */
export function getEmotionPrompt(emotion: string): GenerateAudioParams['emotion'] {
    const emotionMap: Record<string, GenerateAudioParams['emotion']> = {
        'alegre': 'cheerfully',
        'feliz': 'cheerfully',
        'triste': 'sadly',
        'tristeza': 'sadly',
        'animado': 'excitedly',
        'aventura': 'excitedly',
        'calma': 'calmly',
        'calmo': 'calmly',
        'misterioso': 'mysteriously',
        'mistério': 'mysteriously',
        'carinhoso': 'warmly',
        'acolhedor': 'warmly',
    };

    return emotionMap[emotion.toLowerCase()] || 'warmly';
}
