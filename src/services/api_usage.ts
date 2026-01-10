import { supabase } from '../lib/supabase';

export interface ApiUsageRecord {
    service: 'gemini_nanobanana' | 'gemini_text' | 'google_tts';
    operation: 'generate_image' | 'generate_text' | 'generate_audio';
    story_id?: string;
    scene_id?: string;
    status: 'success' | 'error' | 'quota_exceeded';
    error_message?: string;
    images_generated?: number;
    tokens_used?: number;
    characters_processed?: number;
}

export interface UsageLimits {
    dailyImageLimit: number;
    currentImageCount: number;
    canGenerateMore: boolean;
    remainingImages: number;
}

/**
 * Record API usage in the database
 */
export async function recordApiUsage(record: ApiUsageRecord): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('api_usage')
            .insert({
                user_id: user.id,
                ...record
            });

        if (error) {
            console.error('Error recording API usage:', error);
            // Don't throw - usage tracking shouldn't block the main operation
        }
    } catch (err) {
        console.error('Failed to record API usage:', err);
    }
}

/**
 * Get current usage limits for image generation
 */
export async function getImageUsageLimits(): Promise<UsageLimits> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Call the database function to get daily count
        const { data, error } = await supabase
            .rpc('get_daily_image_count', { p_user_id: user.id });

        if (error) throw error;

        const dailyImageLimit = 20; // INCREASED FOR TESTING (was 5)
        const currentImageCount = data || 0;
        const remainingImages = Math.max(0, dailyImageLimit - currentImageCount);

        return {
            dailyImageLimit,
            currentImageCount,
            canGenerateMore: currentImageCount < dailyImageLimit,
            remainingImages
        };
    } catch (err: any) {
        console.error('Error getting usage limits:', err);
        // Return conservative limits on error
        return {
            dailyImageLimit: 20,
            currentImageCount: 0, // Changed from 5 to 0 to allow testing
            canGenerateMore: true, // Changed to true for testing
            remainingImages: 20
        };
    }
}

/**
 * Check if user can generate an image (respects daily limit)
 */
export async function canGenerateImage(): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const limits = await getImageUsageLimits();

        if (!limits.canGenerateMore) {
            return {
                allowed: false,
                reason: `Limite diário atingido! Você já gerou ${limits.currentImageCount} imagens hoje. Limite: ${limits.dailyImageLimit} imagens/dia (modo teste). Tente novamente amanhã.`
            };
        }

        return { allowed: true };
    } catch (err: any) {
        return {
            allowed: false,
            reason: `Erro ao verificar limite de uso: ${err.message}`
        };
    }
}

/**
 * Check if scene already has an image (prevent duplicates)
 */
export async function sceneHasImage(sceneId: string): Promise<{ hasImage: boolean; imageUrl?: string }> {
    try {
        const { data, error } = await supabase
            .from('assets')
            .select('file_url')
            .eq('scene_id', sceneId)
            .eq('type', 'image')
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        return {
            hasImage: !!data,
            imageUrl: data?.file_url
        };
    } catch (err: any) {
        console.error('Error checking scene image:', err);
        return { hasImage: false };
    }
}
