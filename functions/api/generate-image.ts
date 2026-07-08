/**
 * generate-image.ts — Cloudflare Function para geração de imagens via Vertex AI
 * Rota: POST /api/generate-image
 *
 * Body: { prompt, aspectRatio?, referenceImages?: string[] }
 * Ambos os caminhos usam Gemini 3.1 Flash Image via Vertex AI.
 */

import { getVertexToken } from '../_shared/vertexAuth';
import { resolveReferenceImages } from '../_shared/referenceImages';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
  IMAGES_BUCKET?: R2Bucket;
}

async function uploadToR2(bucket: R2Bucket, base64: string, mimeType: string): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const key = `scenes/${crypto.randomUUID()}.${ext}`;
  const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  await bucket.put(key, imageBytes, { httpMetadata: { contentType: mimeType } });
  return `/api/image/${key}`;
}

function imageResponse(base64: string, mimeType: string, url?: string): Response {
  if (url) return Response.json({ url, mimeType });
  return Response.json({ base64, mimeType });
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

    // Usaremos o Gemini 3.1 Flash Image para os dois cenários
    const model = 'gemini-3.1-flash-image-preview';
    const region = 'global';
    const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    if (hasRefs) {
      console.log(`[generate-image] Gerando com ${referenceImages.length} referências via Gemini (${model})`);

      // Montar parts: prompt + imagens de referência. As referências podem chegar
      // como data URL, URL do R2 (/api/image/...) ou URL do Supabase — todas são
      // resolvidas para base64 aqui; antes, URLs eram perdidas e o personagem
      // saía sem consistência.
      const origin = new URL(request.url).origin;
      const { parts: refParts, dropped } = await resolveReferenceImages(
        referenceImages, env.IMAGES_BUCKET, origin
      );
      console.log(`[generate-image] Referências resolvidas: ${refParts.length}/${referenceImages.length}`);

      if (refParts.length === 0) {
        return Response.json(
          { error: `Nenhuma das ${referenceImages.length} imagens de referência pôde ser resolvida (formato inválido ou imagem inacessível)` },
          { status: 400 }
        );
      }
      if (dropped > 0) {
        console.warn(`[generate-image] ${dropped} referência(s) descartada(s) por formato inválido/imagem inacessível`);
      }

      const parts: any[] = [{ text: prompt }, ...refParts];

      const payload = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio || '16:9',
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
          const r2Url = env.IMAGES_BUCKET ? await uploadToR2(env.IMAGES_BUCKET, part.inlineData.data, part.inlineData.mimeType) : undefined;
          return imageResponse(part.inlineData.data, part.inlineData.mimeType, r2Url);
        }
      }

      console.error('[generate-image] Nenhuma imagem retornada (com refs):', JSON.stringify(data).substring(0, 500));

      // Check if it's a safety/copyright block — retry WITHOUT reference images
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'IMAGE_PROHIBITED_CONTENT' || finishReason === 'SAFETY') {
        console.warn('[generate-image] Safety block with refs detected, retrying WITHOUT references...');
        const safePayload = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: aspectRatio || '16:9' },
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
            const r2Url = env.IMAGES_BUCKET ? await uploadToR2(env.IMAGES_BUCKET, part.inlineData.data, part.inlineData.mimeType) : undefined;
          return imageResponse(part.inlineData.data, part.inlineData.mimeType, r2Url);
          }
        }
      }

      return Response.json({ error: 'Nenhuma imagem gerada pelo modelo (Gemini Safety Filter). Detalhes: ' + JSON.stringify(data).substring(0, 500) }, { status: 500 });

    } else {
      console.log(`[generate-image] Gerando sem referências via Gemini (${model}), promptLen: ${prompt.length}, aspectRatio: ${aspectRatio}`);

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio || '16:9',
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
          const r2Url = env.IMAGES_BUCKET ? await uploadToR2(env.IMAGES_BUCKET, part.inlineData.data, part.inlineData.mimeType) : undefined;
          return imageResponse(part.inlineData.data, part.inlineData.mimeType, r2Url);
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
