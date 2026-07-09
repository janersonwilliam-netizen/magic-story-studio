/**
 * generate-narration.ts — Cloudflare Function para geração de narração TTS
 * Rota: POST /api/generate-narration
 *
 * Usa estritamente o Vertex AI (créditos GCP) para geração de áudio.
 */

import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
  GCP_REGION_TTS: string;
}

// Modelos TTS disponíveis. A ordem de tentativa depende do modelo pedido pelo
// frontend ('flash' | 'pro'). Flash é o padrão: ~3x mais barato e bem mais
// rápido — essencial em produção, onde o proxy do Cloudflare corta requisições
// que passam de ~100s (erro 524).
const FLASH_FIRST = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'] as const;
const PRO_FIRST = ['gemini-2.5-pro-preview-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'] as const;

/**
 * Detecta se GCP_CREDENTIALS_JSON tem credenciais válidas (Service Account ou Authorized User)
 */
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
 * Adiciona headers WAV ao PCM raw retornado pelo TTS.
 */
function addWavHeaders(base64Raw: string, sampleRate: number): Uint8Array {
  const binaryString = atob(base64Raw);
  const dataBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    dataBytes[i] = binaryString.charCodeAt(i);
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // Mantém o PCM exatamente como vem do Gemini — SEM normalização.
  // (A antiga normalização por pico era feita em cada bloco separadamente, o que
  // deixava o volume desigual entre blocos: um bloco com um pico isolado alto
  // tinha o corpo inteiro rebaixado e soava "sussurrado" a partir do meio.)
  const pcmBytes = dataBytes;

  const buffer = new ArrayBuffer(44 + pcmBytes.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
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
  view.setUint32(40, pcmBytes.length, true);
  new Uint8Array(buffer, 44).set(pcmBytes);

  return new Uint8Array(buffer);
}

/**
 * Converte Uint8Array WAV para base64 string
 */
function wavToBase64(wavBytes: Uint8Array): string {
  let binary = '';
  const len = wavBytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(wavBytes[i]);
  return btoa(binary);
}

/**
 * Gera áudio via Vertex AI (Service Account JSON ou Authorized User — usa créditos GCP)
 */
async function generateViaVertexAI(
  payload: object,
  env: Env,
  models: readonly string[]
): Promise<string | null> {
  const token = await getVertexToken(env as any);
  const projectId = env.GCP_PROJECT_ID;
  const region = env.GCP_REGION_TTS || 'us-central1';

  for (const model of models) {
    const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
    console.log(`[generate-narration] Vertex AI — tentando modelo: ${model}`);

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
    const audioPart = data.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData?.data);

    if (response.ok && audioPart?.inlineData?.data) {
      const audioBase64 = audioPart.inlineData.data;
      const wavBytes = addWavHeaders(audioBase64, 24000);
      console.log(`[generate-narration] Vertex AI — sucesso com modelo: ${model}`);
      return wavToBase64(wavBytes);
    }

    console.warn(`[generate-narration] Vertex AI — ${model} falhou (${response.status}):`, JSON.stringify(data).slice(0, 500));
  }

  return null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { text, voice, styleInstruction, temperature, model } = (await request.json()) as any;

    if (!text) {
      return Response.json({ error: 'O campo "text" é obrigatório' }, { status: 400 });
    }

    const selectedVoice = typeof voice === 'string' && voice.trim() ? voice.trim() : 'Kore';

    const prompt = styleInstruction ? styleInstruction + '\n\n' + text : text;

    // Temperatura baixa por padrão: o TTS é generativo e com temperatura alta
    // pode falar um texto diferente do transcript (parafrasear/improvisar).
    const safeTemperature = typeof temperature === 'number' && temperature >= 0 && temperature <= 2
      ? temperature
      : 0.7;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        temperature: safeTemperature,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    };

    const hasVertex = hasVertexCredentials(env.GCP_CREDENTIALS_JSON) && !!env.GCP_PROJECT_ID;

    if (!hasVertex) {
      return Response.json({ error: 'GCP_CREDENTIALS_JSON ou GCP_PROJECT_ID não configurados corretamente.' }, { status: 500 });
    }

    const models = model === 'pro' ? PRO_FIRST : FLASH_FIRST;
    console.log(`[generate-narration] Usando Vertex AI, preferência: ${model === 'pro' ? 'pro' : 'flash'}`);
    const audioBase64 = await generateViaVertexAI(payload, env, models);

    if (!audioBase64) {
      return Response.json({ error: 'Todos os modelos TTS falharam no Vertex AI. Verifique as cotas e permissões no GCP.' }, { status: 500 });
    }

    return Response.json({ audio: audioBase64, mimeType: 'audio/wav' });

  } catch (error: any) {
    console.error('[generate-narration] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
