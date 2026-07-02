/**
 * Palito Storage — Supabase persistence for Histórias Palito projects
 */

import { supabase } from './supabase';
import { PalitoState, PalitoStep, PalitoFormat } from '../types/palito';

export interface PalitoProject {
    id: string;
    format: PalitoFormat;
    selectedTitle: string;
    tema?: string;
    thumbnailUrl?: string;
    characterImageUrl?: string;
    currentStep: PalitoStep;
    createdAt: number;
    updatedAt: number;
    isComplete: boolean;
}

export interface PalitoProjectFull extends PalitoProject {
    state: PalitoState;
}

function rowToProject(row: any): PalitoProject {
    return {
        id: row.id,
        format: (row.format as PalitoFormat) || 'VIDEO',
        selectedTitle: row.selected_title || 'Sem título',
        tema: row.tema || undefined,
        thumbnailUrl: row.thumbnail_url || undefined,
        characterImageUrl: row.character_image_url || undefined,
        currentStep: (row.current_step as PalitoStep) || 'IDEAS',
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        isComplete: row.current_step === 'METADATA' && !!row.metadata,
    };
}

function rowToProjectFull(row: any): PalitoProjectFull {
    const base = rowToProject(row);
    const state: PalitoState = {
        projectId: row.id,
        format: base.format,
        currentStep: base.currentStep,
        tema: row.tema,
        ideas: row.ideas || undefined,
        selectedTitle: row.selected_title || undefined,
        narrationScript: row.narration_script || undefined,
        audioUrl: row.audio_url || undefined,
        voiceName: row.voice_name || undefined,
        emotion: row.emotion || undefined,
        transcription: row.transcription || undefined,
        characterImageUrl: row.character_image_url || undefined,
        thumbnailUrl: row.thumbnail_url || undefined,
        scenes: row.scenes || undefined,
        metadata: row.metadata || undefined,
    };
    return { ...base, state };
}

export const palitoStorage = {
    async listProjects(): Promise<PalitoProject[]> {
        const { data, error } = await supabase
            .from('palito_projects')
            .select('id, format, selected_title, tema, thumbnail_url, character_image_url, current_step, metadata, created_at, updated_at')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(rowToProject);
    },

    async getProject(id: string): Promise<PalitoProjectFull | null> {
        const { data, error } = await supabase
            .from('palito_projects')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        return rowToProjectFull(data);
    },

    async createProject(userId: string, format: PalitoFormat = 'VIDEO'): Promise<string> {
        const { data, error } = await supabase
            .from('palito_projects')
            .insert({ user_id: userId, current_step: 'IDEAS', format })
            .select('id')
            .single();
        if (error) throw error;
        return data.id;
    },

    async saveState(id: string, state: PalitoState): Promise<void> {
        const { error } = await supabase
            .from('palito_projects')
            .update({
                format: state.format || 'VIDEO',
                tema: state.tema || null,
                ideas: state.ideas || null,
                selected_title: state.selectedTitle || null,
                narration_script: state.narrationScript || null,
                audio_url: state.audioUrl || null,
                voice_name: state.voiceName || null,
                emotion: state.emotion || null,
                transcription: state.transcription || null,
                character_image_url: state.characterImageUrl || null,
                thumbnail_url: state.thumbnailUrl || null,
                scenes: state.scenes || null,
                metadata: state.metadata || null,
                current_step: state.currentStep,
            })
            .eq('id', id);
        if (error) throw error;
    },

    async deleteProject(id: string): Promise<void> {
        const { error } = await supabase
            .from('palito_projects')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};
