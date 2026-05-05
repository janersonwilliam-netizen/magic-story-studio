/**
 * generate-image.ts — Cloudflare Function para geração de imagens via Vertex AI
 * Rota: POST /api/generate-image
 *
 * Body: { prompt, aspectRatio?, referenceImages?: string[] }
 * Ambos os caminhos agora usam Gemini 2.5 Flash Image, conforme solicitado.
 */

import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { prompt, aspectRatio = '16:9', referenceImages } = (await request.json()) as any;

    if (!prompt) {
      return Response.json({ error: 'Prompt é obrigatório' }, { status: 400 });
    }

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;

    if (!projectId) {
      return Response.json({ error: 'GCP_PROJECT_ID não configurado' }, { status: 500 });
    }

    const hasRefs = Array.isArray(referenceImages) && referenceImages.length > 0;

    // Usaremos o Gemini 2.5 Flash Image para os dois cenários
    const model = 'gemini-2.5-flash-image';
    const region = 'us-central1';
    const url = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    if (hasRefs) {
      console.log(`[generate-image] Gerando com ${referenceImages.length} referências via Gemini (${model})`);

      // Montar parts: prompt + imagens de referência
      const parts: any[] = [{ text: prompt }];
      for (const refImage of referenceImages) {
        const match = refImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        } else if (refImage.length > 100) {
          parts.push({ inlineData: { mimeType: 'image/png', data: refImage } });
        }
      }

      const payload = {
        contents: [{ role: 'user', parts }],
        generation_config: {
          response_modalities: ['TEXT', 'IMAGE'],
          image_config: {
            aspect_ratio: aspectRatio || '16:9',
          },
        },
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

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error('[generate-image] Gemini Flash Image error:', data);
        return Response.json({ error: data?.error?.message || 'Erro no Vertex AI' }, { status: response.status });
      }

      const responseParts = data.candidates?.[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return Response.json({ base64: part.inlineData.data, mimeType: part.inlineData.mimeType });
        }
      }

      console.error('[generate-image] Nenhuma imagem retornada (com refs):', JSON.stringify(data).substring(0, 500));

      // Check if it's a safety/copyright block — retry WITHOUT reference images
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'IMAGE_PROHIBITED_CONTENT' || finishReason === 'SAFETY') {
        console.warn('[generate-image] Safety block with refs detected, retrying WITHOUT references...');
        const safePayload = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generation_config: {
            response_modalities: ['TEXT', 'IMAGE'],
            image_config: { aspect_ratio: aspectRatio || '16:9' },
          },
        };
        const safeResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-goog-user-project': projectId,
          },
          body: JSON.stringify(safePayload),
        });
        const safeData = (await safeResponse.json()) as any;
        const safeParts = safeData.candidates?.[0]?.content?.parts || [];
        for (const part of safeParts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            console.log('[generate-image] Safe fallback succeeded!');
            return Response.json({ base64: part.inlineData.data, mimeType: part.inlineData.mimeType });
          }
        }
      }

      return Response.json({ error: 'Nenhuma imagem gerada pelo modelo (Gemini Safety Filter). Detalhes: ' + JSON.stringify(data).substring(0, 500) }, { status: 500 });

    } else {
      console.log(`[generate-image] Gerando sem referências via Gemini (${model}), promptLen: ${prompt.length}, aspectRatio: ${aspectRatio}`);

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generation_config: {
          response_modalities: ['TEXT', 'IMAGE'],
          image_config: {
            aspect_ratio: aspectRatio || '16:9',
          },
        },
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

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error('[generate-image] Gemini Flash Image error:', data);
        return Response.json({ error: data?.error?.message || 'Erro no Vertex AI' }, { status: response.status });
      }

      const responseParts = data.candidates?.[0]?.content?.parts || [];
      for (const part of responseParts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return Response.json({ base64: part.inlineData.data, mimeType: part.inlineData.mimeType });
        }
      }

      console.error('[generate-image] Nenhuma imagem retornada (sem refs). Full response:', JSON.stringify(data).substring(0, 500));
      return Response.json({ error: 'Nenhuma imagem gerada pelo modelo (Gemini). Detalhes: ' + JSON.stringify(data).substring(0, 500) }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[generate-image] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
