import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
    console.warn('OpenAI API key not configured. Image generation will not work.');
}

const openai = apiKey ? new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for client-side usage in MVP
}) : null;

export async function generateImageWithDalle(prompt: string): Promise<string> {
    if (!openai) {
        throw new Error('OpenAI API not configured. Please add VITE_OPENAI_API_KEY to your .env file or provide it.');
    }

    try {
        console.log('Generating image with prompt:', prompt);
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
        });

        const url = response.data[0].url;
        if (!url) throw new Error('No image URL returned from OpenAI');

        return url;
    } catch (error: any) {
        console.error('Error generating image with DALL-E:', error);
        throw new Error(`Failed to generate image: ${error.message}`);
    }
}
