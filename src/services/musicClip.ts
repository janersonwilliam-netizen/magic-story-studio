/**
 * musicClip.ts — AI services for the Music Clip Generator
 * Uses Vertex AI (via /api/generate-text and /api/generate-image) for all generation
 */

import { MusicScene, MusicCharacter, MusicGenre, MusicDurationTarget } from '../types/music';
import { VisualStyle } from '../types/studio';

// ── Helper: call Vertex Text API ──────────────────────────────────────────────

async function callVertexText(
    prompt: string,
    options: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
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
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(data.error || `Erro HTTP ${response.status}`);
    return data.text as string;
}

// ── Helper: parse JSON safely from Gemini response ────────────────────────────

function parseJsonFromResponse(text: string): any {
    // Remove markdown code blocks if present
    const cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // Find the first { or [
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start === -1 || end === -1) throw new Error('Nenhum JSON encontrado na resposta');

    const jsonString = cleaned.slice(start, end + 1);
    
    try {
        return JSON.parse(jsonString);
    } catch (e: any) {
        console.error("Falha ao analisar JSON:", e.message);
        console.error("String JSON problemática (primeiros/últimos 500 chars):", jsonString.slice(0, 500), "...", jsonString.slice(-500));
        console.error("Texto bruto completo do Gemini:", text);
        throw new Error(`Erro na formatação JSON do Gemini: ${e.message}`);
    }
}

// ── 0. Generate Song Lyrics from Title + Genre + Duration ────────────────────

const DURATION_HINTS: Record<MusicDurationTarget, string> = {
    curta: 'CURTA (~1 minuto): 1 verso + refrão, repita o refrão 1 vez no final.',
    media: 'MÉDIA (~2 minutos): 2 versos + refrão, repita o refrão entre e depois dos versos.',
    longa: 'LONGA (~3 minutos): 3 a 4 versos + refrão + uma ponte (bridge), repetindo o refrão várias vezes.',
};

const GENRE_HINTS: Record<MusicGenre, string> = {
    'Música Infantil': 'Tema lúdico e alegre para crianças (brincadeiras, natureza, amizade, imaginação). Vocabulário simples, refrão repetitivo e fácil de cantar junto.',
    'Música Infantil Bíblica': 'Tema e moral bíblicos apropriados para crianças (histórias, valores, louvor), linguagem simples e reverente, refrão memorável e fácil de cantar junto.',
};

export async function generateSongLyrics(
    title: string,
    genre: MusicGenre,
    durationTarget: MusicDurationTarget
): Promise<string> {
    console.log('[MusicClip] Generating song lyrics...');

    const prompt = `Você é um compositor profissional de músicas para um canal infantil no YouTube. Escreva a letra completa de uma música em PORTUGUÊS a partir do título abaixo.

TÍTULO: "${title}"
ESTILO/GÊNERO: ${genre} — ${GENRE_HINTS[genre]}
DURAÇÃO ALVO: ${DURATION_HINTS[durationTarget]}

REGRAS:
1. Escreva a letra estruturada em seções claramente marcadas, cada uma em sua própria linha, exatamente no formato: [Verso 1], [Refrão], [Verso 2], [Ponte] etc.
2. O refrão deve se repetir com o texto EXATAMENTE igual toda vez que aparecer.
3. Frases curtas, rimas simples, cadência fácil de cantar.
4. Não inclua nenhuma explicação, apenas a letra.

Retorne SOMENTE a letra da música, já formatada com os marcadores de seção.`;

    const lyrics = await callVertexText(prompt, { temperature: 0.85, maxOutputTokens: 2048 });
    return lyrics.trim();
}

// ── 1. Generate Music Scenes from Lyrics ─────────────────────────────────────

export interface GenerateMusicScenesResult {
    scenes: Omit<MusicScene, 'id' | 'imageStatus' | 'videoStatus' | 'videoDuration' | 'videoAspectRatio'>[];
}

export async function generateMusicScenes(
    lyrics: string,
    title: string,
    visualStyle: VisualStyle
): Promise<MusicScene[]> {
    console.log('[MusicClip] Generating scenes from lyrics...');

    const styleHint = visualStyle === 'Estilo 2D Cartoon'
        ? 'Premium 2D Cartoon style, vibrant flat colors, expressive characters'
        : 'Premium 3D Animated Movie style, cinematic lighting, depth of field';

    const prompt = `You are a professional music video director for a children's channel. Analyze the song lyrics below and divide them into short, distinct scenes.

Song Title: "${title}"
Visual Style: ${styleHint}

RULES:
1. Break down the lyrics into VERY SHORT segments. Each segment should represent at most ~4 to 5 seconds of singing (usually just 1 or 2 lines of lyrics).
2. If a section like a Verse or Chorus is long, split it into smaller parts (e.g., "Verse 1A", "Verse 1B", "Chorus A", "Chorus B").
3. Identify each UNIQUE lyrical section separately.
4. If a section REPEATS exactly (e.g., the exact same lines of the Chorus), set isChorus:true for ALL of them and set chorusRefIndex to the index of the FIRST occurrence for the repeated ones (null for the first one).
5. Generate a cinematic visualDescription ONLY for unique sections (where chorusRefIndex is null).
6. For repeated sections (chorusRefIndex is not null), leave visualDescription as an empty string "".
7. The visualDescription must describe a vivid, single static image for image generation — no text overlays, no collages. Make it appealing for children.
8. Use style: ${styleHint}
9. IMPORTANT: Make sure your JSON is valid. Escape any quotes inside strings. Do NOT output unescaped line breaks.

LYRICS:
${lyrics}

Return ONLY a valid JSON object matching exactly this structure (no markdown, no explanation):
{
  "scenes": [
    {
      "index": number,
      "part": "string",
      "lyrics": "string",
      "isChorus": boolean,
      "chorusRefIndex": number | null,
      "visualDescription": "string"
    }
  ]
}`;

    const rawText = await callVertexText(prompt, { temperature: 0.6, maxOutputTokens: 8192, jsonMode: true });
    const parsed = parseJsonFromResponse(rawText);

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        throw new Error('Formato de cenas inválido retornado pelo Gemini');
    }

    // Map to MusicScene with defaults
    return parsed.scenes.map((s: any) => ({
        id: crypto.randomUUID(),
        index: s.index,
        part: s.part || 'Parte',
        lyrics: s.lyrics || '',
        isChorus: s.isChorus ?? false,
        chorusRefIndex: s.chorusRefIndex ?? undefined,
        visualDescription: s.visualDescription || '',
        imageStatus: 'idle' as const,
        videoStatus: 'idle' as const,
        videoDuration: '4s' as const,
        videoAspectRatio: '16:9' as const,
    }));
}

// ── 2. Generate Music Characters ──────────────────────────────────────────────

export async function generateMusicCharacters(
    lyrics: string,
    title: string,
    visualStyle: VisualStyle
): Promise<MusicCharacter[]> {
    console.log('[MusicClip] Generating characters from lyrics...');

    const is3D = visualStyle === 'Estilo Pixar 3D';
    
    const styleHint = is3D
        ? '3D Animated Movie Pixar style'
        : '2D Cartoon, flat colors, expressive';

    const formatInstructions = is3D 
        ? "Format the description exactly like this: 'a [species/gender/age] with [natural skin tone], [clothing description], huge expressive eyes with [iris color], wearing [fixed accessory] and carrying [affective item].'"
        : "Format the description exactly like this: 'a [species/gender/age] with [natural skin tone], [clothing description], clean lines, expressive [eye color] eyes, wearing [key accessory].'";

    const prompt = `You are a character designer for a children's music video channel. Analyze the song lyrics below and identify the main characters, entities, or subjects that appear or are described.

Song Title: "${title}"
Visual Style: ${styleHint}

CRITICAL RULES FOR CHARACTER DESIGN:
1. All characters MUST be designed in a high-quality, friendly, modern 3D animated movie style (like Pixar/Disney).
2. HUMANS MUST HAVE NATURAL HUMAN SKIN TONES (e.g., light skin, olive skin, brown skin, dark skin). DO NOT give humans blue, green, or unnatural skin colors.
3. Characters can be adults, but they must be stylized, appealing, and friendly. DO NOT make them look like literal babies or toddlers unless the song specifies a baby.
4. DO NOT use words like "wrinkled", "rough", "weather-beaten", "scary", or "ugly". Keep their features smooth, expressive, and appealing.
5. Animals or creatures (like a Big Fish) should be cute, expressive, and friendly.

For each character, create a visual description specifically tailored for the image generation model. 
${formatInstructions}
Do not use generic descriptions. Be very specific about clothing and items.

LYRICS:
${lyrics}

Return ONLY valid JSON (no markdown, no explanation):
{
  "characters": [
    {
      "name": "Character Name",
      "description": "The exact formatted description as requested."
    }
  ]
}

If no specific characters are mentioned, create 1-2 archetypal characters that fit the song's mood and theme.`;

    const rawText = await callVertexText(prompt, { temperature: 0.7, maxOutputTokens: 4096 });
    const parsed = parseJsonFromResponse(rawText);

    if (!parsed.characters || !Array.isArray(parsed.characters)) {
        return [];
    }

    return parsed.characters.map((c: any) => ({
        name: c.name || 'Personagem',
        description: c.description || '',
    }));
}

// ── 3. Generate Animation Prompt for a Scene ─────────────────────────────────

export async function generateAnimationPrompt(
    imageUrl: string,
    lyrics: string,
    part: string,
    visualStyle: VisualStyle
): Promise<string> {
    console.log('[MusicClip] Generating animation prompt for:', part);

    const styleHint = visualStyle === 'Estilo 2D Cartoon'
        ? '2D animated, smooth motion, cartoon style'
        : '3D cinematic, realistic motion, movie quality';

    // We use the text API with image description (the image URL is already a base64 or data URL)
    // We'll describe the image via the generate-text endpoint with the image context
    const prompt = `You are a music video director. Create a Veo 3 animation prompt for this scene.

Song Part: "${part}"
Lyrics of this part:
"${lyrics}"

Visual Style: ${styleHint}

Create a professional animation prompt that:
1. Describes specific camera movements (dolly in/out, pan left/right, zoom, crane shot, etc.)
2. Describes how subjects/elements in the scene should move
3. Captures the emotional mood of the lyrics
4. Matches the visual style: ${styleHint}
5. Is written for the Veo 3 AI video model
6. Is 2-4 sentences in English, highly specific and cinematic

Return ONLY the animation prompt text, nothing else, no quotes, no explanation.`;

    const animPrompt = await callVertexText(prompt, { temperature: 0.8, maxOutputTokens: 512 });
    return animPrompt.trim();
}

// ── 4. Generate Music Cover Image ────────────────────────────────────────────

export async function generateMusicCoverPrompt(
    title: string,
    artist: string,
    lyrics: string,
    characters: MusicCharacter[],
    visualStyle: VisualStyle
): Promise<string> {
    const titleWords = title.split(' ');
    const spelledWords = titleWords.map(w => `"${w}" (${w.toUpperCase().split('').join('-')})`).join(', ');

    const charDescriptions = characters.slice(0, 2).map(c => `${c.name} (${c.description})`).join(' AND ');

    // Use Gemini to deduce a cinematic background based on the title and lyrics
    const backgroundPrompt = `Based on the song title "${title}" and lyrics, describe the primary setting or environment in exactly ONE short sentence in English. Make it highly cinematic and descriptive (e.g., 'A stormy ocean with giant waves', 'A bright magical forest', 'A futuristic cyberpunk city at night').\n\nLyrics: ${lyrics.slice(0, 500)}`;
    
    let environmentStr = 'Magical cinematic environment';
    try {
        environmentStr = await callVertexText(backgroundPrompt, { temperature: 0.7, maxOutputTokens: 60 });
        environmentStr = environmentStr.replace(/"/g, '').trim();
    } catch (e) {
        console.error("Failed to deduce background:", e);
    }

    const styleModOrig = visualStyle === 'Estilo 2D Cartoon'
        ? `Premium 2D Cartoon style. The title text spelling exactly ${spelledWords} is displayed in bold, colorful 2D typography. Vibrant colors, magical atmosphere, crisp lines, 16:9 wide shot, NO 3D rendering.`
        : `Premium 3D Animated Movie style. The title text spelling exactly ${spelledWords} is displayed in BIG, THICK, CHUNKY 3D EXTRUDED LETTERS. Each word a different vibrant color with glossy shine and drop shadows. Cinematic lighting, depth of field, 8k resolution, 16:9 wide shot.`;

    return `TITULO: ${title}
CENA: Magical Children's Animated Movie Title Card. Background setting: ${environmentStr}. ${styleModOrig}
INSTRUÇÃO DE TEXTO: DO NOT add any extra text, translations, subtitles, or credits. The ONLY text on the image MUST be the exact spelling requested.
PERSONAGEM: ${charDescriptions || 'Artistic representation fitting the song mood'}. Posing dynamically interacting with the title text.
EMOÇÃO: Happy, Excited, Adventurous.`;
}
