/**
 * Story Storage Manager
 * Handles saving, loading, and listing user stories/projects.
 * Automatically switches between IndexedDB (Local) and Supabase (Cloud) based on auth state.
 */

import { StudioState } from '../types/studio';
import { supabase } from './supabase';
import { handleSupabaseAuthError } from './supabaseErrors';

export const STORY_LIST_FIELDS = 'id, title, created_at, updated_at, preview_image, is_complete, currentStep:data->>currentStep';

// --- Types ---

export interface StoryProject {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    previewImage?: string; // Thumbnail URL (Base64 or Cloud URL)
    data: StudioState; // Full state of the studio for this story
    isComplete: boolean;
}

// --- Upload Helpers ---

export function isDataUrl(value: string | undefined | null): boolean {
    return !!value && typeof value === 'string' && value.startsWith('data:');
}

export function dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || '';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

export function getDataUrlMimeType(dataUrl: string): string {
    return dataUrl.split(',')[0].match(/:(.*?);/)?.[1] || '';
}

export async function uploadStoryDataUrl(
    userId: string,
    bucket: string,
    path: string,
    dataUrl: string
): Promise<string> {
    if (!isDataUrl(dataUrl)) return dataUrl;

    const blob = dataUrlToBlob(dataUrl);
    const contentType = getDataUrlMimeType(dataUrl);

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(`${userId}/${path}`, blob, { 
            upsert: true,
            contentType,
            cacheControl: '604800'
        });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(`${userId}/${path}`);

    return data.publicUrl;
}

export async function sanitizeStudioStateMedia(storyId: string, userId: string, state: StudioState): Promise<StudioState> {
    // Clone state deeply
    const sanitized = JSON.parse(JSON.stringify(state)) as StudioState;

    // story.audioUrl
    if (isDataUrl(sanitized.story?.audioUrl)) {
        sanitized.story!.audioUrl = await uploadStoryDataUrl(
            userId, 'story-audio', `${storyId}/narration.wav`, sanitized.story!.audioUrl!
        );
    }

    // storyWithScenes.thumbnailUrl
    if (isDataUrl(sanitized.storyWithScenes?.thumbnailUrl)) {
        sanitized.storyWithScenes!.thumbnailUrl = await uploadStoryDataUrl(
            userId, 'thumbnails', `${storyId}/thumbnail.png`, sanitized.storyWithScenes!.thumbnailUrl!
        );
    }

    // storyWithScenes.scenes[].imageUrl
    if (sanitized.storyWithScenes?.scenes) {
        for (let i = 0; i < sanitized.storyWithScenes.scenes.length; i++) {
            const scene = sanitized.storyWithScenes.scenes[i];
            if (isDataUrl(scene.imageUrl)) {
                scene.imageUrl = await uploadStoryDataUrl(
                    userId, 'thumbnails', `${storyId}/scene-${i + 1}.png`, scene.imageUrl!
                );
            }
        }
    }

    // storyWithScenes.characterReferenceImages
    if (sanitized.storyWithScenes?.characterReferenceImages) {
        for (const [charName, imageUrl] of Object.entries(sanitized.storyWithScenes.characterReferenceImages)) {
            if (isDataUrl(imageUrl as string)) {
                // sanitize character name for filename
                const safeName = charName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                sanitized.storyWithScenes!.characterReferenceImages![charName] = await uploadStoryDataUrl(
                    userId, 'thumbnails', `${storyId}/character-${safeName}.png`, imageUrl as string
                );
            }
        }
    }

    // storyWithScenes.audioUrls
    if (sanitized.storyWithScenes?.audioUrls) {
        for (const [indexStr, audioUrl] of Object.entries(sanitized.storyWithScenes.audioUrls)) {
            if (isDataUrl(audioUrl as string)) {
                sanitized.storyWithScenes!.audioUrls![parseInt(indexStr)] = await uploadStoryDataUrl(
                    userId, 'story-audio', `${storyId}/scene-${parseInt(indexStr) + 1}.wav`, audioUrl as string
                );
            }
        }
    }

    // timeline.clips[].imageUrl and audioUrl
    if (sanitized.timeline?.clips) {
        for (const clip of sanitized.timeline.clips) {
            if (isDataUrl(clip.imageUrl)) {
                clip.imageUrl = await uploadStoryDataUrl(
                    userId, 'thumbnails', `${storyId}/clip-${clip.id}.png`, clip.imageUrl!
                );
            }
            if (isDataUrl(clip.audioUrl)) {
                clip.audioUrl = await uploadStoryDataUrl(
                    userId, 'story-audio', `${storyId}/clip-${clip.id}.wav`, clip.audioUrl!
                );
            }
        }
    }

    return sanitized;
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
            .select(STORY_LIST_FIELDS)
            .order('updated_at', { ascending: false });

        if (error) {
            await handleSupabaseAuthError(error);
            throw error;
        }

        return data.map(record => ({
            id: record.id,
            title: record.title,
            createdAt: new Date(record.created_at).getTime(),
            updatedAt: new Date(record.updated_at).getTime(),
            previewImage: record.preview_image,
            data: { currentStep: record.currentStep || 'CONFIG' } as StudioState,
            isComplete: record.is_complete
        }));
    },

    async getStoriesPage(page: number, pageSize: number): Promise<{ stories: StoryProject[], total: number, page: number, pageSize: number, hasMore: boolean }> {
        const { data, error, count } = await supabase
            .from('stories')
            .select(STORY_LIST_FIELDS, { count: 'exact' })
            .order('updated_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            await handleSupabaseAuthError(error);
            throw error;
        }

        const stories = data.map(record => ({
            id: record.id,
            title: record.title,
            createdAt: new Date(record.created_at).getTime(),
            updatedAt: new Date(record.updated_at).getTime(),
            previewImage: record.preview_image,
            data: { currentStep: record.currentStep || 'CONFIG' } as StudioState,
            isComplete: record.is_complete
        }));

        const total = count || 0;
        return {
            stories,
            total,
            page,
            pageSize,
            hasMore: (page + 1) * pageSize < total
        };
    },

    async getStory(id: string): Promise<StoryProject | undefined> {
        const { data, error } = await supabase
            .from('stories')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            await handleSupabaseAuthError(error);
            return undefined;
        }
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

    async saveStory(story: StoryProject): Promise<StoryProject> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario deve estar logado para salvar na nuvem.');

        // 1. Sanitize the entire StudioState and previewImage
        const sanitizedState = await sanitizeStudioStateMedia(story.id, user.id, story.data);
        
        let previewImageUrl = story.previewImage;
        if (isDataUrl(previewImageUrl)) {
            previewImageUrl = await uploadStoryDataUrl(
                user.id, 'thumbnails', `${story.id}/thumbnail.png`, previewImageUrl!
            );
        }

        // 2. Prepare Metadata
        const { config, story: storyData, storyWithScenes } = sanitizedState;

        // Construct DB Record with new columns
        const dbRecord = {
            id: story.id,
            user_id: user.id,
            title: story.title,
            preview_image: previewImageUrl,
            data: sanitizedState,
            is_complete: story.isComplete,
            updated_at: new Date().toISOString(),
            // Metadata columns
            tone: config?.tone,
            age_group: config?.ageGroup,
            duration: config?.duration,
            visual_style: config?.visualStyle,
            status: story.isComplete ? 'completed' : 'draft',
            story_text: storyData?.storyText,
            narration_text: storyData?.narrationText,
            custom_instructions: config?.storyIdea,
            character_descriptions: storyWithScenes?.characters, // Save characters JSON
            // Note: full_audio_url is not in StudioState, so we don't overwrite it here
        };

        const { error } = await supabase
            .from('stories')
            .upsert(dbRecord, { onConflict: 'id' });

        if (error) {
            await handleSupabaseAuthError(error);
            throw error;
        }

        return {
            ...story,
            previewImage: previewImageUrl,
            data: sanitizedState
        };
    },

    async deleteStory(id: string): Promise<void> {
        const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', id);

        if (error) {
            await handleSupabaseAuthError(error);
            throw error;
        }
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
                    setTimeout(() => reject(new Error('Cloud fetch timed out')), 15000)
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

    async getStoriesPage(page: number, pageSize: number = 20): Promise<{ stories: StoryProject[], total: number, page: number, pageSize: number, hasMore: boolean }> {
        const isAuth = await this.isAuthenticated();

        if (isAuth) {
            try {
                const cloudFetch = supabaseStoryStorage.getStoriesPage(page, pageSize);
                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Cloud fetch timed out')), 15000)
                );
                return await Promise.race([cloudFetch, timeout]);
            } catch (err) {
                console.warn('[storyStorage] Supabase paginated fetch failed or timed out:', err);
            }
        }

        // Fallback to local (just return all local stories as page 0, no pagination)
        const localStories = await localStoryStorage.getAllStories();
        return {
            stories: localStories,
            total: localStories.length,
            page: 0,
            pageSize: localStories.length,
            hasMore: false
        };
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
                    setTimeout(() => reject(new Error('Cloud fetch timed out')), 15000)
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
                const sanitizedStory = await supabaseStoryStorage.saveStory(story);
                // Update local storage with the sanitized version (URLs instead of base64)
                await localStoryStorage.saveStory(sanitizedStory);
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
