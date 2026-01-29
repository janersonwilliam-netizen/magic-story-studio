import { GoogleVoiceOption } from './tts';

const GOOGLE_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export interface GoogleTTSParams {
    text: string;
    voiceName: string; // e.g., 'pt-BR-Standard-A'
    pitch?: number;
    speakingRate?: number;
}

export async function generateGoogleCloudAudio(params: GoogleTTSParams): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

    if (!apiKey) {
        throw new Error('Google Cloud API Key not configured (VITE_GOOGLE_CLOUD_API_KEY)');
    }

    // Prepare the request body
    const requestBody = {
        input: {
            text: params.text
        },
        voice: {
            languageCode: 'pt-BR',
            name: params.voiceName,
        },
        audioConfig: {
            audioEncoding: 'LINEAR16',
            pitch: params.pitch || 0,
            speakingRate: params.speakingRate || 0.9, // Slightly slower for more natural storytelling
            effectsProfileId: ['headphone-class-device'] // Optimizes for higher quality output
        }
    };

    try {
        const response = await fetch(`${GOOGLE_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Google TTS] API Error:', errorData);
            throw new Error(`Google Cloud TTS Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        if (!data.audioContent) {
            throw new Error('No audio content returned from Google Cloud TTS');
        }

        // Google returns base64 directly
        return `data:audio/wav;base64,${data.audioContent}`;

    } catch (error: any) {
        console.error('[Google TTS] Request failed:', error);
        throw error;
    }
}
