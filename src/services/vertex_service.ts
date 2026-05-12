/**
 * Vertex AI Proxy Service
 * Connects to the custom Cloud Run proxy to use Imagen 3 on Google Cloud
 * This utilizes the GCP credits (R$ 1.786) from the user's project.
 */

const getVertexConfig = () => {
    // USE LOCAL PROXY BY DEFAULT (Fixed CORS and Credits)
    const url = "/api/vertex";
    const secret = "mss-secret-2024";
    
    return { url, secret };
};

// Global cooldown to avoid hammering Vertex when proxy explicitly asks to wait.
let vertexBlockedUntil = 0;

export interface VertexGenerateParams {
    prompt: string;
    aspectRatio?: '1:1' | '16:9' | '4:3';
    negativePrompt?: string;
    sampleCount?: number;
}

export async function generateImageVertex(params: VertexGenerateParams): Promise<string> {
    const { url, secret } = getVertexConfig();
    if (!url) {
        throw new Error('Vertex AI URL not configured in .env');
    }

    if (Date.now() < vertexBlockedUntil) {
        const waitSeconds = Math.ceil((vertexBlockedUntil - Date.now()) / 1000);
        throw new Error(`Vertex temporariamente indisponível. Aguarde ${waitSeconds}s e tente novamente.`);
    }

    console.log('[Vertex AI] Generating image via proxy:', url);

    const maxRetries = 4; // Increased for Cloud Run cold starts
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Vertex-Secret': secret, // Custom auth header
                    'Authorization': `Bearer ${secret}`  // Alternative auth header
                },
                body: JSON.stringify({
                    prompt: params.prompt,
                    aspect_ratio: params.aspectRatio || '16:9',
                    negative_prompt: params.negativePrompt,
                    sampleCount: params.sampleCount || 1,
                    // Add common fields that proxy might expect
                    userId: 'magic-story-studio-client'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                const err = new Error(`Vertex AI Proxy error (${response.status}): ${errorText}`);
                const retryDelayMs = getVertexRetryDelayMs(response.status, errorText, attempt);

                if (retryDelayMs !== null) {
                    const nextAllowed = Date.now() + retryDelayMs;
                    if (nextAllowed > vertexBlockedUntil) {
                        vertexBlockedUntil = nextAllowed;
                    }
                }

                console.error('[Vertex AI] Proxy error details:', {
                    attempt,
                    status: response.status,
                    statusText: response.statusText,
                    retryDelayMs,
                    body: errorText
                });

                if (retryDelayMs !== null && attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                    continue;
                }

                throw err;
            }

            const data = await response.json() as any;

            // Handle different possible response formats from the proxy
            const imageUrl = data.url || data.imageUrl || data.image_url || data.data?.[0]?.url;
            const base64Data = data.image || data.base64 || data.data?.[0]?.b64_json;

            if (imageUrl) {
                console.log('[Vertex AI] Image generated (URL)');
                return imageUrl;
            }

            if (base64Data) {
                console.log('[Vertex AI] Image generated (Base64)');
                const mimeType = data.mimeType || 'image/png';
                return base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;
            }

            throw new Error('No image data returned from Vertex AI Proxy');

        } catch (error: any) {
            lastError = error;
            const msg = String(error?.message || error || '').toLowerCase();
            const isRetryable = msg.includes('503')
                || msg.includes('unavailable')
                || msg.includes('try again')
                || msg.includes('429')
                || msg.includes('timeout');

            if (isRetryable && attempt < maxRetries) {
                const delay = 4000 * attempt;
                console.warn(`[Vertex AI] Retryable error. Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            break;
        }
    }

    console.error('[Vertex AI] Error:', lastError);
    throw lastError || new Error('Vertex AI failed after retries');
}

function getVertexRetryDelayMs(status: number, errorText: string, attempt: number): number | null {
    const lower = (errorText || '').toLowerCase();
    const retryableStatus = status === 429 || status === 503 || status === 502 || status === 504;
    if (!retryableStatus) return null;

    // Cap at 8s regardless of what the server says — we don't want to block the UI for 30s
    const MAX_DELAY_MS = 8000;

    // Handle messages like "Please try again in 30 seconds."
    const secondsMatch = lower.match(/try again in\s+(\d+)\s+seconds?/i);
    if (secondsMatch) {
        const seconds = Number(secondsMatch[1]);
        if (Number.isFinite(seconds) && seconds > 0) {
            return Math.min(seconds * 1000, MAX_DELAY_MS);
        }
    }

    // Progressive backoff, capped
    return Math.min(4000 * attempt, MAX_DELAY_MS);
}

/**
 * Check if Vertex AI is configured and should be prioritized
 */
export function isVertexConfigured(): boolean {
    const { url } = getVertexConfig();
    return !!url;
}
