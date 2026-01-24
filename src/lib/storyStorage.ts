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
        // Prepare data for Supabase
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('Usuario deve estar logado para salvar na nuvem.');

        const dbRecord = {
            id: story.id,
            user_id: user.id,
            title: story.title,
            preview_image: story.previewImage,
            data: story.data,
            is_complete: story.isComplete,
            updated_at: new Date().toISOString(),
            // Only set created_at on insert, but upsert handles specific logic better.
            // For simplicity, we just pass what we have, but we don't want to overwrite created_at if it exists?
            // Supabase upsert will update everything passed.
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

    async getAllStories(): Promise<StoryProject[]> {
        if (await this.isAuthenticated()) {
            try {
                return await supabaseStoryStorage.getAllStories();
            } catch (err) {
                console.warn('[storyStorage] Supabase failed, falling back to local storage:', err);
                // Fallback to local storage if cloud fails
                return localStoryStorage.getAllStories();
            }
        }
        return localStoryStorage.getAllStories();
    },

    async getStory(id: string): Promise<StoryProject | undefined> {
        if (await this.isAuthenticated()) {
            try {
                return await supabaseStoryStorage.getStory(id);
            } catch (err) {
                console.warn('[storyStorage] Supabase failed, falling back to local storage:', err);
                return localStoryStorage.getStory(id);
            }
        }
        return localStoryStorage.getStory(id);
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
