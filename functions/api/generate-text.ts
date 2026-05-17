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

const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
] as const;

function getVertexUrl(region: string, projectId: string, model: string): string {
  const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

function parseRetryAfterSeconds(response: Response, data: any): number | null {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }

  const details = data?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = detail?.retryDelay;
      if (typeof retryDelay === 'string') {
        const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
        if (match) return Math.ceil(Number(match[1]));
      }
    }
  }

  return null;
}

function isRetryableVertexStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status === 504;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { prompt, temperature = 0.7, maxOutputTokens = 8192, jsonMode = false } = (await request.json()) as any;

    if (!prompt) {
      return Response.json({ error: 'Prompt é obrigatório' }, { status: 400 });
    }

    if (!env.GCP_PROJECT_ID || !env.GCP_CREDENTIALS_JSON) {
      return Response.json({ error: 'Credenciais GCP não configuradas' }, { status: 500 });
    }

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;
    const region = 'us-central1';
    let lastError: any = null;
    let lastStatus = 500;
    let retryAfterSeconds: number | null = null;

    for (const model of TEXT_MODELS) {
      const generationConfig: any = {
        temperature,
        maxOutputTokens: Math.min(Number(maxOutputTokens) || 8192, model.startsWith('gemini-2.0') ? 8192 : 16384),
      };

      if (jsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      };

      const response = await fetch(getVertexUrl(region, projectId, model), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-goog-user-project': projectId,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
        return Response.json({ text, model });
      }

      lastError = data;
      lastStatus = response.status;
      retryAfterSeconds = parseRetryAfterSeconds(response, data) ?? retryAfterSeconds;

      console.warn('[generate-text] Vertex AI model failed:', {
        model,
        status: response.status,
        message: data?.error?.message,
      });

      if (!isRetryableVertexStatus(response.status)) {
        break;
      }
    }

    const isQuota = lastStatus === 429 || /quota|resource exhausted/i.test(lastError?.error?.message || '');
    const friendlyQuotaMessage = retryAfterSeconds
      ? `Limite temporário do Vertex AI atingido. Tente novamente em cerca de ${retryAfterSeconds} segundos.`
      : 'Limite temporário do Vertex AI atingido. Aguarde alguns instantes e tente novamente.';

    return Response.json(
      {
        error: isQuota ? friendlyQuotaMessage : (lastError?.error?.message || 'Erro no Vertex AI'),
        details: lastError?.error?.message,
        quotaExhausted: isQuota,
        retryAfterSeconds,
      },
      { status: isQuota ? 429 : lastStatus }
    );

  } catch (error: any) {
    console.error('[generate-text] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
