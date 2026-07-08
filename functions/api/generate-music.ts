/**
 * generate-music.ts — Cloudflare Function para geração de música cantada (Lyria)
 * Rota: POST /api/generate-music
 *
 * Usa Vertex AI (Lyria 3 / Lyria 3 Pro) via generateContent, mesmo padrão de generate-narration.ts.
 */

import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
  GCP_REGION_MUSIC: string;
}

// 'curta' usa o modelo de clipes curtos (~30s); 'media'/'longa' usam o modelo Pro (até 3min)
const CLIP_MODEL = 'lyria-3-clip-preview';
const PRO_MODEL = 'lyria-3-pro-preview';

function hasVertexCredentials(credentialsRaw: string): boolean {
  if (!credentialsRaw) return false;
  try {
    const parsed = JSON.parse(credentialsRaw);
    return parsed.type === 'service_account' || parsed.type === 'authorized_user';
  } catch {
    return false;
  }
}

/**
 * Adiciona headers WAV ao PCM raw, caso o áudio retornado ainda não venha empacotado.
 */
function addWavHeaders(base64Raw: string, sampleRate: number): Uint8Array {
  const binaryString = atob(base64Raw);
  const dataBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    dataBytes[i] = binaryString.charCodeAt(i);
  }

  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + dataBytes.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes.length, true);
  new Uint8Array(buffer, 44).set(dataBytes);

  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { prompt, durationTarget } = (await request.json()) as any;

    if (!prompt) {
      return Response.json({ error: 'O campo "prompt" é obrigatório' }, { status: 400 });
    }

    const hasVertex = hasVertexCredentials(env.GCP_CREDENTIALS_JSON) && !!env.GCP_PROJECT_ID;
    if (!hasVertex) {
      return Response.json({ error: 'GCP_CREDENTIALS_JSON ou GCP_PROJECT_ID não configurados corretamente.' }, { status: 500 });
    }

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;
    const region = env.GCP_REGION_MUSIC || 'us-central1';
    const model = durationTarget === 'curta' ? CLIP_MODEL : PRO_MODEL;

    const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    console.log(`[generate-music] Vertex AI (Lyria) — modelo: ${model}`);

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO', 'TEXT'],
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
      console.error('[generate-music] Erro da Vertex AI:', JSON.stringify(data).slice(0, 500));
      return Response.json({ error: data?.error?.message || 'Erro ao gerar música no Vertex AI' }, { status: response.status });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((part: any) => part.inlineData?.data);

    if (!audioPart) {
      console.error('[generate-music] Nenhum áudio retornado:', JSON.stringify(data).slice(0, 500));
      return Response.json({ error: 'Nenhum áudio foi retornado pelo Lyria.' }, { status: 500 });
    }

    const returnedMime: string = audioPart.inlineData.mimeType || '';
    let audioBase64 = audioPart.inlineData.data as string;
    let mimeType = 'audio/wav';

    if (returnedMime.startsWith('audio/wav') || returnedMime.startsWith('audio/mpeg')) {
      // Já vem empacotado (WAV/MP3 completo) — usa como está
      mimeType = returnedMime;
    } else {
      // PCM cru (ex: "audio/L16;rate=48000") — adiciona cabeçalho WAV
      const rateMatch = returnedMime.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 48000;
      const wavBytes = addWavHeaders(audioBase64, sampleRate);
      audioBase64 = bytesToBase64(wavBytes);
    }

    console.log('[generate-music] Áudio gerado com sucesso.');
    return Response.json({ audio: audioBase64, mimeType });

  } catch (error: any) {
    console.error('[generate-music] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
