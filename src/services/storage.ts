import { supabase } from '../lib/supabase';

export async function uploadImageFromUrl(imageUrl: string, fileName: string): Promise<string> {
    try {
        // 1. Fetch the image from the temporary URL (DALL-E)
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Failed to fetch image from URL');

        const blob = await response.blob();

        // 2. Upload to Supabase Storage
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from('story-images')
            .upload(filePath, blob, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 3. Get Public URL
        const { data } = supabase.storage
            .from('story-images')
            .getPublicUrl(filePath);

        return data.publicUrl;

    } catch (error: any) {
        console.error('Error uploading image:', error);
        throw new Error(`Storage upload failed: ${error.message}`);
    }
}

export async function deleteSceneImage(fileName: string) {
    const { error } = await supabase.storage
        .from('story-images')
        .remove([fileName]);

    if (error) throw error;
}

/**
 * Upload audio file from Data URL (base64) to Supabase Storage
 * Used for TTS-generated audio files
 */
export async function uploadAudioFromDataUrl(dataUrl: string, fileName: string): Promise<string> {
    try {
        // 1. Convert Data URL to Blob
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error('Failed to convert audio data URL');

        const blob = await response.blob();

        // 2. Upload to Supabase Storage
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from('story-audio')
            .upload(filePath, blob, {
                contentType: 'audio/mpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 3. Get Public URL
        const { data } = supabase.storage
            .from('story-audio')
            .getPublicUrl(filePath);

        return data.publicUrl;

    } catch (error: any) {
        console.error('Error uploading audio:', error);
        throw new Error(`Audio upload failed: ${error.message}`);
    }
}
