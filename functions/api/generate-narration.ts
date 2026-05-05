/**
 * generate-narration.ts — Cloudflare Function para geração de narração TTS
 * Rota: POST /api/generate-narration
 *
 * Usa estritamente o Vertex AI (créditos GCP) para geração de áudio.
 */

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
  GCP_REGION_TTS: string;
}

// Modelos TTS disponíveis (em ordem de preferência)
const TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'] as const;

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
  env: Env
): Promise<string | null> {
  const { getVertexToken } = await import('../_shared/vertexAuth');
  const token = await getVertexToken(env as any);
  const projectId = env.GCP_PROJECT_ID;
  const region = env.GCP_REGION_TTS || 'us-central1';

  for (const model of TTS_MODELS) {
    const url = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
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

    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const audioBase64 = data.candidates[0].content.parts[0].inlineData.data;
      const wavBytes = addWavHeaders(audioBase64, 24000);
      console.log(`[generate-narration] Vertex AI — sucesso com modelo: ${model}`);
      return wavToBase64(wavBytes);
    }

    console.warn(`[generate-narration] Vertex AI — ${model} falhou:`, JSON.stringify(data).slice(0, 300));
  }

  return null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { text, voice, styleInstruction, temperature } = (await request.json()) as any;

    if (!text) {
      return Response.json({ error: 'O campo "text" é obrigatório' }, { status: 400 });
    }

    const prompt = styleInstruction ? styleInstruction + '\n\n' + text : text;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature ?? 1.0,
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode: 'pt-BR',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
          },
        },
      },
    };

    const hasVertex = hasVertexCredentials(env.GCP_CREDENTIALS_JSON) && !!env.GCP_PROJECT_ID;

    if (!hasVertex) {
      return Response.json({ error: 'GCP_CREDENTIALS_JSON ou GCP_PROJECT_ID não configurados corretamente.' }, { status: 500 });
    }

    console.log('[generate-narration] Usando Vertex AI (sem fallback para AI Studio)');
    const audioBase64 = await generateViaVertexAI(payload, env);

    if (!audioBase64) {
      return Response.json({ error: 'Todos os modelos TTS falharam no Vertex AI. Verifique as cotas e permissões no GCP.' }, { status: 500 });
    }

    return Response.json({ audio: audioBase64, mimeType: 'audio/wav' });

  } catch (error: any) {
    console.error('[generate-narration] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
