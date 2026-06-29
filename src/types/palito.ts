/**
 * Types for the Histórias Palito module
 * Pipeline: IDEAS → SCRIPT → NARRATION → TRANSCRIPTION → CHARACTER → THUMBNAIL → SCENES → TIMELINE → METADATA
 */

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

export interface PalitoMetadata {
    viralTitle: string;
    description: string;
    tags: string[];
}

export interface PalitoState {
    projectId?: string;
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
    thumbnailUrl?: string;
    scenes?: PalitoSceneLine[];
    videoUrl?: string;
    metadata?: PalitoMetadata;
}
