/**
 * musicAudio.ts — Geração da música cantada (voz + instrumental) via Vertex AI Lyria
 * Usa /api/generate-music (Cloudflare Function) para chamar o Lyria 3 / Lyria 3 Pro.
 */

import { MusicGenre, MusicDurationTarget } from '../types/music';

const GENRE_VOCAL_HINTS: Record<MusicGenre, string> = {
    'Música Infantil': 'children\'s song, cheerful and playful kids choir vocals, warm acoustic/pop instrumental, upbeat and friendly mood',
    'Música Infantil Bíblica': 'children\'s worship song, warm and gentle kids choir vocals, soft acoustic instrumental with a reverent, uplifting mood',
};

export async function generateSongAudio(
    lyrics: string,
    title: string,
    genre: MusicGenre,
    durationTarget: MusicDurationTarget
): Promise<string> {
    console.log('[MusicAudio] Generating sung audio via Lyria...');

    const prompt = `Song title: "${title}". Style: ${GENRE_VOCAL_HINTS[genre]}, sung in Brazilian Portuguese.
Perform the song using EXACTLY these lyrics, respecting the marked sections ([Verso], [Refrão], [Ponte]):

"""
${lyrics}
"""`;

    const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, durationTarget }),
    });
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(data.error || `Erro HTTP ${response.status}`);

    const mimeType = data.mimeType || 'audio/wav';
    return `data:${mimeType};base64,${data.audio}`;
}
