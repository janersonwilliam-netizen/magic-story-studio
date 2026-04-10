import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Prioritized list of models to try.
 * Using stable names as fallbacks for the experimental/custom ones.
 */
export const PRIMARY_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-001',
    'gemini-3-flash-preview',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest'
];

export const SMART_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
];

export interface FallbackOptions {
    models?: string[];
    maxRetries?: number;
    initialDelay?: number;
    onRetry?: (model: string, attempt: number, error: any) => void;
}

/**
 * Executes a Gemini request with automatic model fallback and retries.
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

    let lastError: any = null;

    // Iterate through models in order of priority
    for (const modelName of models) {
        let attempt = 0;
        
        while (attempt < maxRetries) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                return await operation(model);
            } catch (error: any) {
                lastError = error;
                const errorStr = JSON.stringify(error) || error.message || '';
                
                // Check if error is quota exceeded (429)
                const isQuotaExceeded = 
                    errorStr.includes('429') || 
                    errorStr.includes('quota') || 
                    errorStr.includes('RESOURCE_EXHAUSTED') ||
                    error.status === 'RESOURCE_EXHAUSTED';

                // Check if error is overload (503)
                const isOverloaded = 
                    errorStr.includes('503') || 
                    errorStr.includes('overloaded') || 
                    errorStr.includes('UNAVAILABLE') ||
                    error.status === 'UNAVAILABLE';

                if (isQuotaExceeded) {
                    console.warn(`[Gemini Fallback] Model ${modelName} exhausted quota. Waiting 5s before trying next...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    break; // Exit retry loop and try NEXT model
                }

                if (isOverloaded) {
                    attempt++;
                    if (attempt < maxRetries) {
                        const delay = initialDelay * Math.pow(2, attempt);
                        console.log(`[Gemini Fallback] Model ${modelName} overloaded. Retrying in ${Math.round(delay/1000)}s...`);
                        if (onRetry) onRetry(modelName, attempt, error);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; // Retry same model
                    }
                }

                // If it's a critical error (like safety or invalid prompt), don't bother retrying or falling back
                if (errorStr.includes('SAFETY') || errorStr.includes('invalid')) {
                    throw error;
                }

                // For other errors, try next model as a safety measure
                console.error(`[Gemini Fallback] Constant error with ${modelName}:`, error.message);
                break; // Try next model
            }
        }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}
