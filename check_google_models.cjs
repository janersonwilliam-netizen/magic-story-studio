const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access key directly since .env might not load in simple script context without dotenv
const genAI = new GoogleGenerativeAI("AIzaSyAaWip4HKQtZqwj06ykDJPp4NHjzQORPxA");

async function listModels() {
    try {
        // Note: listModels might not be available on the helper, usually it's on the specific API endpoint.
        // However, the SDK might expose it. Let's try to fetch via REST if SDK fails, but SDK is cleaner.
        // Actually, for simple listing, REST using the key is easier with fetch.

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAaWip4HKQtZqwj06ykDJPp4NHjzQORPxA');
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
