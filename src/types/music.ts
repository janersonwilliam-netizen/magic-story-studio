/**
 * Types for the Music Clip Generator workflow
 */

import { VisualStyle } from './studio';

// ── Status Types ──────────────────────────────────────────────────────────────

export type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

// ── Music Scene ───────────────────────────────────────────────────────────────

export interface MusicScene {
    id: string;
    index: number;
    part: string;              // "Verso 1", "Refrão", "Ponte", etc.
    lyrics: string;            // Letra dessa parte
    isChorus: boolean;         // É refrão/parte repetida?
    chorusRefIndex?: number;   // Índice da cena original (quando repetida)
    visualDescription: string; // Descrição visual gerada pelo Gemini

    // Image
    imageUrl?: string;
    imageStatus: GenerationStatus;

    // Animation prompt for Veo 3
    animationPrompt?: string;
    promptStatus?: GenerationStatus;

    // Video
    videoUrl?: string;
    videoStatus: GenerationStatus;
    videoDuration: '4s' | '8s';
    videoAspectRatio: '16:9' | '9:16' | '1:1';
}

// ── Music Character ───────────────────────────────────────────────────────────

export interface MusicCharacter {
    name: string;
    description: string;        // Visual description for the AI
    referenceImageUrl?: string; // Generated character reference image
}

// ── Music Genre (style of the song, independent from the visual art style) ──

export type MusicGenre = 'Música Infantil' | 'Música Infantil Bíblica';

export type MusicDurationTarget = 'curta' | 'media' | 'longa';

// ── Music Project (persistent) ───────────────────────────────────────────────

export type MusicStep = 'LYRICS' | 'AUDIO' | 'CHARACTERS' | 'COVER' | 'IMAGES' | 'VIDEOS';

export interface MusicProject {
    id: string;
    title: string;             // Song title
    artist?: string;           // Optional artist name
    lyrics: string;            // Full song lyrics
    genre: MusicGenre;         // Musical style/genre used to write the lyrics and sing the song
    durationTarget: MusicDurationTarget; // Target song length
    visualStyle: VisualStyle;

    // Workflow
    currentStep: MusicStep;
    scenes: MusicScene[];
    characters: MusicCharacter[];
    coverUrl?: string;

    // Generated singing audio (Lyria)
    audioUrl?: string;
    audioStatus?: GenerationStatus;

    // Timestamps
    createdAt: number;
    updatedAt: number;
}
