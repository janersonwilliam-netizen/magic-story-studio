import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Cloud key with Vertex/GCP credits — used FIRST (has billing enabled)
const primaryApiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;
// Free-tier key — used as fallback
const fallbackApiKey = import.meta.env.VITE_GEMINI_API_KEY;

const genAI = primaryApiKey ? new GoogleGenerativeAI(primaryApiKey) : null;
const genAIFallback = fallbackApiKey ? new GoogleGenerativeAI(fallbackApiKey) : null;

/**
 * Prioritized list of text-generation models confirmed live in the API.
 * Ordered from most capable/fastest to lightest fallback.
 */
export const PRIMARY_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest'
];

export const SMART_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash'
];

export interface FallbackOptions {
    models?: string[];
    maxRetries?: number;
    initialDelay?: number;
    onRetry?: (model: string, attempt: number, error: any) => void;
}

/**
 * Try all models in the list using the given GoogleGenerativeAI client.
 * Returns the result on success, or null if all models failed with skippable errors.
 * Throws immediately on hard errors (safety, invalid prompt).
 */
async function tryModelsWithClient<T>(
    client: GoogleGenerativeAI,
    operation: (model: GenerativeModel) => Promise<T>,
    models: string[],
    maxRetries: number,
    initialDelay: number,
    onRetry?: (model: string, attempt: number, error: any) => void
): Promise<{ result: T } | { lastError: any }> {
    let lastError: any = null;

    for (const modelName of models) {
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const model = client.getGenerativeModel({ model: modelName });
                const result = await operation(model);
                return { result };
            } catch (error: any) {
                lastError = error;
                const errorStr = error?.message || JSON.stringify(error) || '';

                // 404 — model not found: skip immediately
                if (errorStr.includes('404') || errorStr.includes('not found') || errorStr.includes('is not supported')) {
                    console.warn(`[Gemini] Model ${modelName} not found (404). Trying next...`);
                    break;
                }

                // 403 — project denied: skip this model (whole project is blocked, not just this model)
                if (errorStr.includes('403') || errorStr.includes('denied access') || errorStr.includes('PERMISSION_DENIED')) {
                    console.warn(`[Gemini] Model ${modelName} denied (403). Project may be blocked — trying next key...`);
                    break;
                }

                // 429 — quota exceeded: skip to next model immediately (no point waiting if we're moving on)
                if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED')) {
                    console.warn(`[Gemini] Model ${modelName} quota exhausted. Skipping to next...`);
                    break;
                }

                // 503 — overloaded: retry with backoff
                if (errorStr.includes('503') || errorStr.includes('overloaded') || errorStr.includes('UNAVAILABLE')) {
                    attempt++;
                    if (attempt < maxRetries) {
                        const delay = initialDelay * Math.pow(2, attempt);
                        console.log(`[Gemini] Model ${modelName} overloaded. Retrying in ${Math.round(delay / 1000)}s...`);
                        if (onRetry) onRetry(modelName, attempt, error);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    break;
                }

                // Hard errors — don't retry or fallback
                if (errorStr.includes('SAFETY') || errorStr.includes('invalid')) {
                    throw error;
                }

                // Any other error — log and try next model
                console.error(`[Gemini] Error with ${modelName}:`, errorStr);
                break;
            }
        }
    }

    return { lastError };
}

/**
 * Executes a Gemini request with automatic model fallback and API key fallback.
 * First tries all models with the primary API key, then with the fallback key.
 */
export async function withModelFallback<T>(
    operation: (model: GenerativeModel) => Promise<T>,
    options: FallbackOptions = {}
): Promise<T> {
    if (!genAI) {
        throw new Error('Gemini API key not configured.');
    }

    const {
        models = PRIMARY_MODELS,
        maxRetries = 3,
        initialDelay = 2000,
        onRetry
    } = options;

    // --- Attempt 1: primary API key ---
    const primaryResult = await tryModelsWithClient(genAI, operation, models, maxRetries, initialDelay, onRetry);
    if ('result' in primaryResult) return primaryResult.result;

    // --- Attempt 2: fallback API key (if available and different) ---
    if (genAIFallback && fallbackApiKey !== primaryApiKey) {
        console.warn('[Gemini] Primary key exhausted. Trying fallback API key...');
        const fallbackResult = await tryModelsWithClient(genAIFallback, operation, models, maxRetries, initialDelay, onRetry);
        if ('result' in fallbackResult) return fallbackResult.result;

        throw new Error(`All Gemini models failed. Last error: ${fallbackResult.lastError?.message}`);
    }

    throw new Error(`All Gemini models failed. Last error: ${primaryResult.lastError?.message}`);
}
