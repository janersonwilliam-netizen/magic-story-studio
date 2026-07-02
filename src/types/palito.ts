/**
 * Types for the Histórias Palito module
 * Pipeline (VIDEO): IDEAS → SCRIPT → NARRATION → TRANSCRIPTION → CHARACTER → THUMBNAIL → SCENES → TIMELINE → METADATA
 * Pipeline (SHORTS): IDEAS → SCRIPT → NARRATION → TRANSCRIPTION → CHARACTER → SCENES → TIMELINE → METADATA (sem THUMBNAIL)
 */

export type PalitoFormat = 'VIDEO' | 'SHORTS';

export type PalitoStep =
    | 'IDEAS'
    | 'SCRIPT'
    | 'NARRATION'
    | 'TRANSCRIPTION'
    | 'CHARACTER'
    | 'THUMBNAIL'
    | 'SCENES'
    | 'TIMELINE'
    | 'METADATA';

export const PALITO_STEPS: PalitoStep[] = [
    'IDEAS',
    'SCRIPT',
    'NARRATION',
    'TRANSCRIPTION',
    'CHARACTER',
    'THUMBNAIL',
    'SCENES',
    'TIMELINE',
    'METADATA',
];

export function stepsForFormat(format: PalitoFormat | undefined): PalitoStep[] {
    if (format === 'SHORTS') return PALITO_STEPS.filter(s => s !== 'THUMBNAIL');
    return PALITO_STEPS;
}

export const PALITO_STEP_LABELS: Record<PalitoStep, string> = {
    IDEAS: 'Ideias',
    SCRIPT: 'Roteiro',
    NARRATION: 'Narração',
    TRANSCRIPTION: 'Transcrição',
    CHARACTER: 'Personagem',
    THUMBNAIL: 'Capa',
    SCENES: 'Cenas',
    TIMELINE: 'Timeline',
    METADATA: 'Metadados',
};

export interface PalitoTranscriptionLine {
    timestamp: string; // "00:00"
    text: string;
}

export interface PalitoSceneLine extends PalitoTranscriptionLine {
    imagePrompt: string;
    imageUrl?: string;
}

export interface StoryCharacter {
    name: string;
    description: string;
    imageUrl?: string;
}

export interface PalitoMetadata {
    viralTitle: string;
    description: string;
    tags: string[];
}

export interface PalitoState {
    projectId?: string;
    format?: PalitoFormat;
    currentStep: PalitoStep;
    tema?: string;
    ideas?: string[];
    selectedTitle?: string;
    narrationScript?: string;
    audioUrl?: string;
    voiceName?: string;
    emotion?: string;
    transcription?: PalitoTranscriptionLine[];
    characterImageUrl?: string;
    storyCharacters?: StoryCharacter[];
    thumbnailUrl?: string;
    scenes?: PalitoSceneLine[];
    videoUrl?: string;
    metadata?: PalitoMetadata;
}
