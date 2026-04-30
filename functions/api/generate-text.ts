/**
 * generate-text.ts — Cloudflare Function para geração de texto via Vertex AI
 * Rota: POST /api/generate-text
 *
 * Body: { prompt: string, temperature?: number, maxOutputTokens?: number, jsonMode?: boolean }
 * Response: { text: string }
 */

import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { prompt, temperature = 0.7, maxOutputTokens = 8192, jsonMode = false } = await request.json<any>();

    if (!prompt) {
      return Response.json({ error: 'Prompt é obrigatório' }, { status: 400 });
    }

    if (!env.GCP_PROJECT_ID || !env.GCP_CREDENTIALS_JSON) {
      return Response.json({ error: 'Credenciais GCP não configuradas' }, { status: 500 });
    }

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;
    const region = 'us-central1';
    const model = 'gemini-2.5-flash';
    const url = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const generationConfig: any = {
      temperature,
      maxOutputTokens,
    };

    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json<any>();

    if (!response.ok) {
      console.error('[generate-text] Vertex AI error:', data);
      return Response.json(
        { error: data?.error?.message || 'Erro no Vertex AI' },
        { status: response.status }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return Response.json({ text });

  } catch (error: any) {
    console.error('[generate-text] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
