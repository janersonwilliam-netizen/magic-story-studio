import { VideoResult } from "./youtube";
import { withModelFallback, PRIMARY_MODELS } from "../lib/gemini-utils";

export interface IdeaAnalysis {
    viralReason: string;
    suggestedTitle: string;
    hook: string;
    estimatedEngagement: string;
    scriptOutline: string[];
}

export const analyzeVideoIdea = async (video: VideoResult): Promise<IdeaAnalysis> => {
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

    return await withModelFallback(async (model) => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonString = text.replace(/```json\n?|\n?```/g, "").trim();

        return JSON.parse(jsonString) as IdeaAnalysis;
    }, { models: PRIMARY_MODELS });
};
