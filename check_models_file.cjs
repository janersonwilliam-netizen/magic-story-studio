const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function listModels() {
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAaWip4HKQtZqwj06ykDJPp4NHjzQORPxA');
        const data = await response.json();

        if (data.models) {
            fs.writeFileSync('models_full.json', JSON.stringify(data.models, null, 2));
            console.log("Saved to models_full.json");
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
