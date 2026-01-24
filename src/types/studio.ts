/**
 * Shared TypeScript types for the Studio workflow
 * These types are used across all Studio pages (CONFIG → NARRATION → SCENES → IMAGES → TIMELINE → EDITOR)
 */

/**
 * Story Configuration (CONFIG page)
 */
export interface StoryConfig {
    title: string;
    duration: number; // minutes (2-10)
    sceneCount: number; // desired number of scenes (15, 20, 25)
    visualStyle: VisualStyle;
    voiceName?: string; // Gemini TTS voice (Kore, Charon, Aoede, Fenrir, Puck)
    emotion?: string; // Narration emotion (cheerfully, sadly, excitedly, calmly, mysteriously, warmly)
    ageGroup?: string; // '3-5', '6-8', '9-12'
    tone?: string; // 'calma', 'aventura', 'educativa'
    storyIdea?: string; // Optional user prompt/idea
}

export type VisualStyle =
    | 'Estilo Pixar 3D'
    | 'Aquarela Delicada'
    | 'Desenho Animado Retrô'
    | 'Anime Japonês'
    | 'Esboço a Lápis'
    | 'Ilustração de Livro Clássico';

/**
 * Story with generated text (NARRATION page)
 */
export interface StoryWithNarration extends StoryConfig {
    storyId: string;
    storyText: string;
    narrationText: string;
}

/**
 * Scene definition (SCENES page)
 */
export interface Scene {
    id: string;
    order: number;
    narrationText: string;
    visualDescription: string;
    emotion: SceneEmotion;
    durationEstimate: number; // seconds
    characters: string[];
    imagePrompt?: string;
    imageUrl?: string;
    audioUrl?: string;
}

export type SceneEmotion =
    | 'alegre'
    | 'calma'
    | 'aventura'
    | 'surpresa'
    | 'medo'
    | 'tristeza'
    | 'curiosidade';

/**
 * Character DNA (SCENES page)
 */
export interface CharacterDNA {
    name: string;
    species: string; // 'Coelho', 'Gato', 'Dragão', etc.
    clothing: string; // 'Camiseta azul com estrelas'
    accessories: string; // 'Chapéu mágico dourado'
    description: string; // Full character sheet
    full_description?: string; // Additional detailed description if available
    status: 'protagonist' | 'supporting' | 'background';
}

/**
 * Story with scenes and characters (IMAGES page)
 */
export interface StoryWithScenes extends StoryWithNarration {
    scenes: Scene[];
    characters: Record<string, CharacterDNA>;
    characterReferenceImage?: string | null; // Backwards compatibility - first character
    characterReferenceImages?: Record<string, string>; // All character reference images by name
    thumbnailUrl?: string; // URL of the generated thumbnail (Title Card)
}

/**
 * Timeline clip (TIMELINE page)
 */
export interface TimelineClip {
    id: string;
    type: 'video' | 'audio' | 'caption' | 'music';
    startTime: number; // seconds
    duration: number; // seconds
    sceneId?: string;
    imageUrl?: string;
    audioUrl?: string;
    text?: string;
    track: number; // Legacy: 0 = caption, 1 = video, 2 = sound, 3 = music
    trackId?: string; // New: Custom track ID for dynamic tracks
}

/**
 * Timeline state (TIMELINE page)
 */
export interface TimelineState {
    clips: TimelineClip[];
    currentTime: number; // seconds
    totalDuration: number; // seconds
    zoom: number; // 1.0 = normal, 2.0 = 2x zoom
    isPlaying: boolean;
    selectedClipId?: string;
}

/**
 * Export settings (EDITOR page)
 */
export interface ExportSettings {
    resolution: '1080p' | '720p' | '480p';
    format: 'mp4' | 'webm';
    quality: 'high' | 'medium' | 'low';
    fps: 24 | 30 | 60;
}

/**
 * Complete Studio state
 */
export interface StudioState {
    currentStep: StudioStep;
    config?: StoryConfig;
    story?: StoryWithNarration;
    storyWithScenes?: StoryWithScenes;
    timeline?: TimelineState;
    exportSettings?: ExportSettings;
}

export type StudioStep =
    | 'CONFIG'
    | 'NARRATION'
    | 'SCENES'
    | 'THUMBNAIL'
    | 'IMAGES'
    | 'TIMELINE'
    | 'EDITOR';

/**
 * Navigation between steps
 */
export interface StudioNavigation {
    currentStep: StudioStep;
    canGoBack: boolean;
    canGoNext: boolean;
    goToStep: (step: StudioStep) => void;
    nextStep: () => void;
    previousStep: () => void;
}
