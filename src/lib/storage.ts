/**
 * Simple IndexedDB wrapper for storing large files (images/audio) client-side.
 * Replaces localStorage which has a 5MB limit.
 */

const DB_NAME = 'MagicStoryStudioDB';
const STORE_NAME = 'library_files';
const DB_VERSION = 1;

export interface StoredFile {
    id: string;
    name: string;
    url: string; // Base64 data
    type: 'image' | 'audio';
    category: 'ending_card' | 'music' | 'logo';
    isDefault: boolean;
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
    async getAllFiles(): Promise<StoredFile[]> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async saveFile(file: StoredFile): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(file);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async deleteFile(id: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async updateFile(file: StoredFile): Promise<void> {
        return this.saveFile(file); // put() handles update if key exists
    }
};
