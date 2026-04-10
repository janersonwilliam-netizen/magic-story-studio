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

    console.log('[Vertex AI] Generating image via proxy:', url);

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
            console.error('[Vertex AI] Proxy error details:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`Vertex AI Proxy error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

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
        console.error('[Vertex AI] Error:', error);
        throw error;
    }
}

/**
 * Check if Vertex AI is configured and should be prioritized
 */
export function isVertexConfigured(): boolean {
    const { url } = getVertexConfig();
    return !!url;
}
