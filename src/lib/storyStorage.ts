/**
 * Story Storage Manager
 * Handles saving, loading, and listing user stories/projects.
 * Automatically switches between IndexedDB (Local) and Supabase (Cloud) based on auth state.
 */

import { StudioState } from '../types/studio';
import { supabase } from './supabase';

// --- Types ---

export interface StoryProject {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    previewImage?: string; // Thumbnail URL (Base64)
    data: StudioState; // Full state of the studio for this story
    isComplete: boolean;
}

// --- IndexedDB Implementation (Local) ---

const DB_NAME = 'MagicStoryStudio_StoriesDB';
const STORE_NAME = 'stories';
const DB_VERSION = 2; // Incremented to force object store creation

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        };
    });
};

const localStoryStorage = {
    async getAllStories(): Promise<StoryProject[]> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('updatedAt');
            const request = index.getAll();

            request.onsuccess = () => {
                const results = request.result as StoryProject[];
                results.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getStory(id: string): Promise<StoryProject | undefined> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async saveStory(story: StoryProject): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(story);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async deleteStory(id: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// --- Supabase Implementation (Cloud) ---

const supabaseStoryStorage = {
    async getAllStories(): Promise<StoryProject[]> {
        const { data, error } = await supabase
            .from('stories')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return data.map(record => ({
            id: record.id,
            title: record.title,
            createdAt: new Date(record.created_at).getTime(),
            updatedAt: new Date(record.updated_at).getTime(),
            previewImage: record.preview_image,
            data: record.data, // JSONB is automatically parsed
            isComplete: record.is_complete
        }));
    },

    async getStory(id: string): Promise<StoryProject | undefined> {
        const { data, error } = await supabase
            .from('stories')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return undefined;
        if (!data) return undefined;

        return {
            id: data.id,
            title: data.title,
            createdAt: new Date(data.created_at).getTime(),
            updatedAt: new Date(data.updated_at).getTime(),
            previewImage: data.preview_image,
            data: data.data,
            isComplete: data.is_complete
        };
    },

    async saveStory(story: StoryProject): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario deve estar logado para salvar na nuvem.');

        let previewImageUrl = story.previewImage;

        // 1. Upload Thumbnail to Storage (if Base64)
        if (previewImageUrl && previewImageUrl.startsWith('data:image')) {
            try {
                const response = await fetch(previewImageUrl);
                const blob = await response.blob();
                const fileName = `${story.id}_thumbnail.png`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('thumbnails')
                    .upload(filePath, blob, { upsert: true });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('thumbnails')
                        .getPublicUrl(filePath);
                    previewImageUrl = publicUrl;
                }
            } catch (err) {
                console.warn('[storyStorage] Thumbnail upload failed:', err);
            }
        }

        // 2. Prepare Metadata
        const { config, story: storyData, storyWithScenes } = story.data;

        // Construct DB Record with new columns
        const dbRecord = {
            id: story.id,
            user_id: user.id,
            title: story.title,
            preview_image: previewImageUrl,
            data: story.data,
            is_complete: story.isComplete,
            updated_at: new Date().toISOString(),
            // Metadata columns
            tone: config?.tone,
            age_group: config?.ageGroup,
            duration: config?.duration,
            story_text: storyData?.storyText,
            narration_text: storyData?.narrationText,
            custom_instructions: config?.storyIdea,
            character_descriptions: storyWithScenes?.characters, // Save characters JSON
            // Note: full_audio_url is not in StudioState, so we don't overwrite it here
        };

        const { error } = await supabase
            .from('stories')
            .upsert(dbRecord, { onConflict: 'id' });

        if (error) throw error;
    },

    async deleteStory(id: string): Promise<void> {
        const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// --- Hybrid Manager ---

export const storyStorage = {
    async isAuthenticated(): Promise<boolean> {
        try {
            const { data } = await supabase.auth.getSession();
            return !!data.session;
        } catch {
            return false;
        }
    },

    async getLocalStories(): Promise<StoryProject[]> {
        return localStoryStorage.getAllStories();
    },

    async getAllStories(): Promise<StoryProject[]> {
        // 1. Always start local fetch immediately (fail-safe)
        const localFetch = localStoryStorage.getAllStories();

        // 2. Check auth
        const isAuth = await this.isAuthenticated();

        if (isAuth) {
            try {
                // 3. Race Cloud vs Timeout (e.g. 5 seconds)
                const cloudFetch = supabaseStoryStorage.getAllStories();

                // Create a timeout promise that rejects
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Cloud fetch timed out')), 5000)
                );

                // Wait for Cloud or Timeout
                return await Promise.race([cloudFetch, timeout]);

            } catch (err) {
                console.warn('[storyStorage] Supabase failed or timed out, falling back to local storage:', err);
                // Fallback to local storage which should be ready or nearly ready
                return await localFetch;
            }
        }

        return await localFetch;
    },

    async getLocalStory(id: string): Promise<StoryProject | undefined> {
        return localStoryStorage.getStory(id);
    },

    async getStory(id: string): Promise<StoryProject | undefined> {
        // 1. Always start local fetch
        const localFetch = localStoryStorage.getStory(id);

        // 2. Check auth
        const isAuth = await this.isAuthenticated();

        if (isAuth) {
            try {
                // 3. Race Cloud vs Timeout
                const cloudFetch = supabaseStoryStorage.getStory(id);

                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Cloud fetch timed out')), 5000)
                );

                return await Promise.race([cloudFetch, timeout]);

            } catch (err) {
                console.warn('[storyStorage] Supabase failed or timed out, falling back to local storage:', err);
                return await localFetch;
            }
        }

        return await localFetch;
    },

    async saveStory(story: StoryProject): Promise<void> {
        // Always save to local first for reliability
        await localStoryStorage.saveStory(story);

        if (await this.isAuthenticated()) {
            try {
                await supabaseStoryStorage.saveStory(story);
            } catch (err) {
                console.warn('[storyStorage] Supabase save failed, data saved locally:', err);
                // Don't throw - local save was successful
            }
        }
    },

    async deleteStory(id: string): Promise<void> {
        // Delete from local
        await localStoryStorage.deleteStory(id);

        if (await this.isAuthenticated()) {
            try {
                await supabaseStoryStorage.deleteStory(id);
            } catch (err) {
                console.warn('[storyStorage] Supabase delete failed:', err);
            }
        }
    }
};
