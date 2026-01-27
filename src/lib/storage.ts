import { supabase } from './supabase';

const DB_NAME = 'MagicStoryStudioDB';
const STORE_NAME = 'library_files';
const DB_VERSION = 1;
const CLOUD_BUCKET = 'library';
const CLOUD_TABLE = 'library_files';

export interface StoredFile {
    id: string;
    name: string;
    url: string; // Base64 data
    type: 'image' | 'audio';
    category: 'ending_card' | 'music' | 'logo' | 'thumbnail';
    isDefault: boolean;
    language?: 'pt' | 'en'; // Default 'pt'
    createdAt: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const storage = {
    async getLocalFiles(): Promise<StoredFile[]> {
        try {
            const db = await openDB();
            return new Promise<StoredFile[]>((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[storage] Local fetch failed:', err);
            return [];
        }
    },

    async getAllFiles(): Promise<StoredFile[]> {
        const filesMap = new Map<string, StoredFile>();

        // Start both fetches in parallel
        const localPromise = (async () => {
            try {
                const db = await openDB();
                const localFiles = await new Promise<StoredFile[]>((resolve, reject) => {
                    const transaction = db.transaction(STORE_NAME, 'readonly');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                return localFiles;
            } catch (err) {
                console.error('[storage] Local fetch failed:', err);
                return [];
            }
        })();

        const cloudPromise = (async () => {
            try {
                // Short timeout for auth check to avoid blocking
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data, error } = await supabase
                        .from(CLOUD_TABLE)
                        .select('*')
                        .order('created_at', { ascending: false })
                        .abortSignal(AbortSignal.timeout(5000)); // 5s timeout

                    if (error) {
                        console.warn('[storage] Cloud select error:', error);
                        return null;
                    }
                    return data;
                }
            } catch (err) {
                console.warn('[storage] Cloud fetch failed:', err);
            }
            return null;
        })();

        // Wait for both (so we can merge correctly)
        // If speed is paramount, we could render local first, but this function is likely used in a unified view.
        // We'll await both but they run in parallel.
        const [localFiles, cloudFiles] = await Promise.all([localPromise, cloudPromise]);

        // 1. Populate map with Local Files
        localFiles.forEach(f => filesMap.set(f.id, f));

        // 2. Overlay Cloud Files
        if (cloudFiles) {
            cloudFiles.forEach(row => {
                const localFile = filesMap.get(row.id);
                filesMap.set(row.id, {
                    id: row.id,
                    name: row.name,
                    // PREFER LOCAL URL (Base64) IF AVAILABLE
                    url: localFile ? localFile.url : row.url,
                    type: row.type as any,
                    category: row.category as any,
                    isDefault: row.is_default,
                    language: row.language,
                    createdAt: new Date(row.created_at).getTime()
                });
            });
        }

        // Return merged list, sorted by date
        return Array.from(filesMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    },

    async saveFile(file: StoredFile): Promise<void> {
        console.log('[storage] Saving file:', file.name, file.id);

        // 1. Save locally first (latency/offline support)
        try {
            const db = await openDB();
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(file);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            console.log('[storage] Local save success');
        } catch (localErr) {
            console.error('[storage] Local save failed:', localErr);
            throw localErr;
        }

        // 2. Upload to Cloud if authenticated
        try {
            console.log('[storage] Checking auth for cloud upload...');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('[storage] User not logged in, skipping cloud upload');
                return;
            }

            // Upload blob to Storage
            console.log('[storage] Converting Base64 to Blob...');
            const response = await fetch(file.url);
            const blob = await response.blob();
            const fileExt = file.name.split('.').pop();
            const fileName = `${file.id}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            console.log('[storage] Uploading to bucket:', CLOUD_BUCKET, filePath);
            const { error: uploadError } = await supabase.storage
                .from(CLOUD_BUCKET)
                .upload(filePath, blob, { upsert: true });

            if (uploadError) {
                console.error('[storage] Upload error:', uploadError);
                throw uploadError;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(CLOUD_BUCKET)
                .getPublicUrl(filePath);

            console.log('[storage] Got public URL:', publicUrl);

            // Insert Metadata to Table
            const { error: dbError } = await supabase
                .from(CLOUD_TABLE)
                .upsert({
                    id: file.id,
                    user_id: user.id,
                    name: file.name,
                    url: publicUrl,
                    type: file.type,
                    category: file.category,
                    is_default: file.isDefault,
                    language: file.language || 'pt',
                    created_at: new Date(file.createdAt).toISOString()
                });

            if (dbError) {
                console.error('[storage] Database insert error:', dbError);
                throw dbError;
            }

            console.log('[storage] Cloud save complete');

        } catch (err) {
            console.error('[storage] Cloud save failed (non-fatal):', err);
        }
    },

    async deleteFile(id: string): Promise<void> {
        // 1. Delete locally
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // 2. Delete from Cloud
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Delete from Table
            const { error: tableError } = await supabase
                .from(CLOUD_TABLE)
                .delete()
                .eq('id', id);

            if (tableError) throw tableError;

        } catch (err) {
            console.warn('[storage] Cloud delete failed:', err);
        }
    },

    async updateFile(file: StoredFile): Promise<void> {
        // Update local
        await this.saveFile(file);

        // Update cloud metadata (isDefault, language)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error: dbError } = await supabase
                .from(CLOUD_TABLE)
                .update({
                    name: file.name,
                    is_default: file.isDefault,
                    language: file.language
                })
                .eq('id', file.id);

            if (dbError) throw dbError;

        } catch (err) {
            console.error('[storage] Cloud update failed:', err);
        }
    }
};
