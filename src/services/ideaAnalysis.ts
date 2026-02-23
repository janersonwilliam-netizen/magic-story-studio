import { GoogleGenerativeAI } from "@google/generative-ai";
import { VideoResult } from "./youtube";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface IdeaAnalysis {
    viralReason: string;
    suggestedTitle: string;
    hook: string;
    estimatedEngagement: string;
    scriptOutline: string[];
}

export const analyzeVideoIdea = async (video: VideoResult): Promise<IdeaAnalysis> => {
    if (!API_KEY) {
        throw new Error("Chave da API Gemini não encontrada. Verifique VITE_GEMINI_API_KEY no .env");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
    Analise o seguinte vídeo viral do YouTube e gere um plano para criar um vídeo similar, mas original.
    
    Dados do Vídeo Original:
    - Título: ${video.title}
    - Canal: ${video.channelTitle}
    - Visualizações: ${video.viewCount}
    - Descrição: ${video.description}

    Retorne APENAS um objeto JSON com a seguinte estrutura (sem markdown):
    {
        "viralReason": "Explique em 1 frase curta por que este vídeo viralizou (psicologia, curiosidade, etc).",
        "suggestedTitle": "Um título novo, chamativo e otimizado para SEO/Clique, inspirado no original.",
        "hook": "Uma frase de gancho (hook) poderosa para os primeiros 3 segundos do vídeo.",
        "estimatedEngagement": "Estimativa de potencial (ex: Alto, Muito Alto) baseada no tema.",
        "scriptOutline": ["Tópico 1", "Tópico 2", "Tópico 3", "Conclusão"]
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonString = text.replace(/```json\n?|\n?```/g, "").trim();

        return JSON.parse(jsonString) as IdeaAnalysis;
    } catch (error) {
        console.error("Erro ao analisar ideia com Gemini:", error);
        throw new Error("Falha ao analisar a ideia. Tente novamente.");
    }
};
