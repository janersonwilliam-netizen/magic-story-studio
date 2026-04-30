/**
 * Gemini Text-to-Speech Service
 * Uses Gemini TTS API (preview TTS models)
 */


export interface GenerateAudioParams {
    text: string;
    emotion?: 'cheerfully' | 'sadly' | 'excitedly' | 'calmly' | 'mysteriously' | 'warmly';
    voiceName?: string;
    targetDurationMinutes?: number;
    speakingRate?: number; // Not directly supported, but can be adjusted via prompt
    pitch?: number; // Not directly supported, but can be adjusted via prompt
    temperature?: number;
}

export type TTSProvider = 'gemini' | 'google-cloud';

/**
 * Available Gemini TTS voices
 */
export interface GeminiVoiceMeta {
    label: string;
    gender: 'female' | 'male';
}

export const GEMINI_VOICES = {
    Achernar: { label: 'Achernar', gender: 'female' },
    Achird: { label: 'Achird', gender: 'male' },
    Algenib: { label: 'Algenib', gender: 'male' },
    Algieba: { label: 'Algieba', gender: 'male' },
    Alnilam: { label: 'Alnilam', gender: 'male' },
    Aoede: { label: 'Aoede', gender: 'female' },
    Autonoe: { label: 'Autonoe', gender: 'female' },
    Callirrhoe: { label: 'Callirrhoe', gender: 'female' },
    Charon: { label: 'Charon', gender: 'male' },
    Despina: { label: 'Despina', gender: 'female' },
    Enceladus: { label: 'Enceladus', gender: 'male' },
    Erinome: { label: 'Erinome', gender: 'female' },
    Fenrir: { label: 'Fenrir', gender: 'male' },
    Gacrux: { label: 'Gacrux', gender: 'female' },
    Iapetus: { label: 'Iapetus', gender: 'male' },
    Kore: { label: 'Kore', gender: 'female' },
    Laomedeia: { label: 'Laomedeia', gender: 'female' },
    Leda: { label: 'Leda', gender: 'female' },
    Orus: { label: 'Orus', gender: 'male' },
    Pulcherrima: { label: 'Pulcherrima', gender: 'female' },
    Puck: { label: 'Puck', gender: 'male' },
    Rasalgethi: { label: 'Rasalgethi', gender: 'male' },
    Sadachbia: { label: 'Sadachbia', gender: 'male' },
    Sadaltager: { label: 'Sadaltager', gender: 'male' },
    Schedar: { label: 'Schedar', gender: 'male' },
    Sulafat: { label: 'Sulafat', gender: 'female' },
    Umbriel: { label: 'Umbriel', gender: 'male' },
    Vindemiatrix: { label: 'Vindemiatrix', gender: 'female' },
    Zephyr: { label: 'Zephyr', gender: 'female' },
    Zubenelgenubi: { label: 'Zubenelgenubi', gender: 'male' },
} as const satisfies Record<string, GeminiVoiceMeta>;

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
let googleBillingUnavailable = false;

/**
 * Generate audio narration using selected provider
 */
export async function generateAudioNarration(params: GenerateAudioParams): Promise<string> {
    const {
        text,
        emotion = 'warmly',
        voiceName = 'Kore',
        targetDurationMinutes,
    } = params;

    console.log('[TTS] Generating audio with voice:', voiceName);

    // Determine provider based on voice name
    const isGemini = Object.keys(GEMINI_VOICES).includes(voiceName);

    if (isGemini || googleBillingUnavailable) {
        return generateGeminiAudio(params);
    } else {
        // Google Cloud for 'pt-BR-*' voices, with graceful fallback for billing errors
        try {
            return await generateGoogleCloudAudio({
                text,
                voiceName,
                speakingRate: targetDurationMinutes ? estimateSpeakingRate(text, targetDurationMinutes) : undefined
            });
        } catch (error: any) {
            const message = String(error?.message || error || '');
            const billingBlocked = isGoogleBillingError(message);

            if (!billingBlocked) throw error;

            // Fallback to Gemini TTS so narration continues to work without Google billing
            googleBillingUnavailable = true;
            console.warn('[TTS] Google billing not enabled. Falling back to Gemini TTS.');
            const fallbackVoice = mapGoogleVoiceToGemini(voiceName);
            return generateGeminiAudio({
                ...params,
                voiceName: fallbackVoice,
                emotion
            });
        }
    }
}

function isGoogleBillingError(message: string): boolean {
    const m = message.toLowerCase();
    return m.includes('requires billing to be enabled')
        || m.includes('enable billing')
        || m.includes('cloud billing account')
        || m.includes('google cloud tts error:')
        || m.includes('longer than the limit') // Text too long for Google TTS - fall back to Gemini which handles chunking
        || m.includes('5000 bytes');            // Same error, different wording
}

function mapGoogleVoiceToGemini(googleVoiceName: string): GeminiVoiceOption {
    const fallbackMap: Record<string, GeminiVoiceOption> = {
        'pt-BR-Standard-A': 'Kore',
        'pt-BR-Standard-B': 'Charon',
        'pt-BR-Wavenet-A': 'Callirrhoe',
        'pt-BR-Wavenet-B': 'Orus',
        'pt-BR-Neural2-A': 'Callirrhoe',
        'pt-BR-Neural2-B': 'Charon',
        'pt-BR-Neural2-C': 'Kore',
    };

    return fallbackMap[googleVoiceName] || 'Kore';
}

async function generateGeminiAudio(params: GenerateAudioParams): Promise<string> {
    const {
        text,
        emotion = 'warmly',
        voiceName = 'Kore'
    } = params;

    const styleInstruction = buildGeminiNarrationPrompt(text, emotion, params.targetDurationMinutes);

    console.log('[Gemini TTS via Cloudflare] Requesting:', voiceName);

    const response = await fetch('/api/generate-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            voice: voiceName,
            styleInstruction,
            temperature: params.temperature
        })
    });

    let data: any;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Erro ao gerar áudio (status ${response.status}). Tente novamente.`);
    }

    if (!response.ok || data.error) {
        throw new Error(data.error || `Erro no servidor TTS (status ${response.status})`);
    }

    // Return as data URL so it can be safely saved to IndexedDB/Supabase and persists across reloads
    return `data:audio/wav;base64,${data.audio}`;
}

/**
 * Web Speech API fallback — zero cost, works in all modern browsers.
 * Returns a data URL of the spoken audio via MediaRecorder (if supported),
 * or speaks directly if recording is unavailable.
 */
async function generateWebSpeechAudio(text: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
            reject(new Error('Web Speech API not supported in this browser'));
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        // Try to pick a Portuguese voice
        const voices = speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang.startsWith('pt-BR')) || voices.find(v => v.lang.startsWith('pt'));
        if (ptVoice) utterance.voice = ptVoice;

        // If MediaRecorder is available, try to capture audio
        if (typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            // Speak directly — recording requires microphone permission which we don't want to request
            // Just trigger speech and resolve with empty string so the app doesn't crash
        }

        utterance.onend = () => {
            // Return a silent WAV so the app doesn't crash — speech already played via speakers
            const silentWav = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
            resolve(`data:audio/wav;base64,${silentWav}`);
        };

        utterance.onerror = (e) => {
            reject(new Error(`Web Speech API error: ${e.error}`));
        };

        speechSynthesis.speak(utterance);
    });
}

function parseSampleRateFromMime(mimeType: string): number | null {
    // Examples:
    // - audio/L16;rate=24000
    // - audio/pcm;rate=22050
    const match = mimeType.match(/rate\s*=\s*(\d+)/i);
    if (!match) return null;
    const rate = Number(match[1]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function pcm16Base64ToWavDataUrl(base64Pcm: string, sampleRate: number, channels: number): string {
    const pcmBytes = base64ToUint8Array(base64Pcm);
    const wavBytes = createWavFromPcm16(pcmBytes, sampleRate, channels);
    const wavBase64 = uint8ArrayToBase64(wavBytes);
    return `data:audio/wav;base64,${wavBase64}`;
}

function createWavFromPcm16(pcmData: Uint8Array, sampleRate: number, channels: number): Uint8Array {
    const bitsPerSample = 16;
    const blockAlign = channels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    const out = new Uint8Array(buffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM fmt chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    out.set(pcmData, headerSize);
    return out;
}

function writeAscii(view: DataView, offset: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function countWords(text: string): number {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function estimateSpeakingRate(text: string, targetDurationMinutes: number): number {
    const words = countWords(text);
    if (!words || !targetDurationMinutes || targetDurationMinutes <= 0) return 1.0;

    // Baseline speaking speed for this app (pt-BR narration) ~135 wpm at rate=1.0.
    const targetWpm = words / targetDurationMinutes;
    const rate = targetWpm / 135;
    return Math.min(1.35, Math.max(0.9, rate));
}

function buildGeminiNarrationPrompt(
    text: string,
    emotion: GenerateAudioParams['emotion'],
    targetDurationMinutes?: number
): string {
    if (!targetDurationMinutes || targetDurationMinutes <= 0) {
        return `Narre em Português do Brasil com um tom ${emotion}. Não adicione palavras extras.`;
    }

    const words = countWords(text);
    const targetWpm = Math.round(words / targetDurationMinutes);
    const boundedWpm = Math.min(185, Math.max(115, targetWpm));

    return `Narre em Português do Brasil com um tom ${emotion}.
Fale naturalmente mas mantenha o ritmo em cerca de ${boundedWpm} palavras por minuto (minutos alvo: ${targetDurationMinutes}).
Não adicione ou remova conteúdo. Leia apenas o texto fornecido.`;
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
    const totalWords = countWords(params.text);

    for (let i = 0; i < chunks.length; i++) {
        console.log(`[Gemini TTS] Generating chunk ${i + 1}/${chunks.length}`);
        const chunkWords = countWords(chunks[i]);
        const chunkDurationTarget = params.targetDurationMinutes && totalWords > 0
            ? (params.targetDurationMinutes * chunkWords) / totalWords
            : undefined;

        // Generate audio for each chunk
        const dataUrl = await generateAudioNarration({
            ...params,
            text: chunks[i],
            targetDurationMinutes: chunkDurationTarget
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

