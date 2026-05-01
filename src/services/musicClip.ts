/**
 * musicClip.ts — AI services for the Music Clip Generator
 * Uses Vertex AI (via /api/generate-text and /api/generate-image) for all generation
 */

import { MusicScene, MusicCharacter } from '../types/music';
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

    return JSON.parse(cleaned.slice(start, end + 1));
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

    const prompt = `You are a professional music video director. Analyze the song lyrics below and divide them into distinct parts (Verse 1, Pre-Chorus, Chorus, Verse 2, Bridge, Outro, etc.).

Song Title: "${title}"
Visual Style: ${styleHint}

RULES:
1. Identify each UNIQUE lyrical section separately
2. If a section REPEATS (e.g., Chorus appears 3 times), set isChorus:true for ALL of them and set chorusRefIndex to the index of the FIRST occurrence for repeated ones (null for the first one)
3. Generate a cinematic visualDescription ONLY for unique sections (sections where chorusRefIndex is null)
4. For repeated sections (chorusRefIndex is not null), leave visualDescription as an empty string ""
5. The visualDescription must describe a vivid, single static image for image generation — no text overlays, no collages
6. Use style: ${styleHint}

LYRICS:
${lyrics}

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "scenes": [
    {
      "index": 0,
      "part": "Verse 1",
      "lyrics": "exact lyrics of this section",
      "isChorus": false,
      "chorusRefIndex": null,
      "visualDescription": "cinematic description of the scene..."
    },
    {
      "index": 1,
      "part": "Chorus",
      "lyrics": "exact lyrics of the chorus",
      "isChorus": true,
      "chorusRefIndex": null,
      "visualDescription": "cinematic description..."
    },
    {
      "index": 2,
      "part": "Verse 2",
      "lyrics": "...",
      "isChorus": false,
      "chorusRefIndex": null,
      "visualDescription": "cinematic description..."
    },
    {
      "index": 3,
      "part": "Chorus",
      "lyrics": "same chorus lyrics",
      "isChorus": true,
      "chorusRefIndex": 1,
      "visualDescription": ""
    }
  ]
}`;

    const rawText = await callVertexText(prompt, { temperature: 0.6, maxOutputTokens: 8192 });
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

    const styleHint = visualStyle === 'Estilo 2D Cartoon'
        ? '2D Cartoon, flat colors, expressive'
        : '3D Animated Movie Pixar style';

    const prompt = `You are a character designer for music videos. Analyze the song lyrics below and identify the main characters, entities, or subjects that appear or are described.

Song Title: "${title}"
Visual Style: ${styleHint}

For each character, create a detailed visual description suitable for AI image generation. Be very specific about: appearance, clothing, colors, age/type, distinctive features.

LYRICS:
${lyrics}

Return ONLY valid JSON (no markdown, no explanation):
{
  "characters": [
    {
      "name": "Character Name",
      "description": "Very detailed visual description for image generation. Include species/type, clothing colors, hair/fur color, accessories, distinctive features. Style: ${styleHint}."
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
    characters: MusicCharacter[],
    visualStyle: VisualStyle
): Promise<string> {
    const styleHint = visualStyle === 'Estilo 2D Cartoon'
        ? 'Premium 2D Cartoon style, vibrant flat colors, bold typography'
        : 'Premium 3D Animated Movie style, cinematic lighting, glossy 3D letters';

    const charDescriptions = characters.slice(0, 2).map(c => c.description).join(' and ');

    const titleWords = title.split(' ');
    const spelledWords = titleWords.map(w => `"${w}" (${w.toUpperCase().split('').join('-')})`).join(', ');

    return `SONG TITLE: ${title}
SCENE: Professional Music Video Album Cover. ${styleHint}.
TITLE TEXT: The song title spelled exactly as ${spelledWords} displayed prominently.
CHARACTERS: ${charDescriptions || 'Artistic representation fitting the song mood'}.
STYLE: Vibrant colors, dynamic composition, 16:9 landscape format, professional album art quality.
IMPORTANT: Only text on the image must be the exact song title. No subtitles, no artist name, no extra text.`;
}
