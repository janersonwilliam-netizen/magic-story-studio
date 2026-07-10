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
 * Gera áudio via Vertex AI em STREAMING (SSE → NDJSON para o cliente).
 *
 * Por que streaming: o proxy do Cloudflare corta requisições que não RESPONDEM
 * em ~100s (erro 524). Gerar a história INTEIRA numa única chamada (necessário
 * para a voz não mudar — cada geração separada sai com timbre/tom diferente)
 * leva bem mais que 100s. Com streaming, os headers saem imediatamente e o
 * áudio flui conforme é gerado — o limite de 100s deixa de existir.
 *
 * Protocolo para o cliente: NDJSON, uma linha JSON por evento:
 *   {"a": "<base64 de PCM16>"}  → pedaço de áudio
 *   {"error": "mensagem"}       → falha no meio do fluxo
 *   {"done": true}              → fim do áudio
 */
async function streamViaVertexAI(
  payload: object,
  env: Env,
  models: readonly string[]
): Promise<Response | null> {
  const token = await getVertexToken(env as any);
  const projectId = env.GCP_PROJECT_ID;
  const region = env.GCP_REGION_TTS || 'us-central1';

  for (const model of models) {
    const host = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:streamGenerateContent?alt=sse`;
    console.log(`[generate-narration] Vertex AI STREAM — tentando modelo: ${model}`);

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      console.warn(`[generate-narration] STREAM ${model} falhou (${upstream.status}):`, errText.slice(0, 300));
      continue; // tenta o próximo modelo — ainda não enviamos nada ao cliente
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const upstreamBody = upstream.body;

    // Bombeia o SSE do Vertex → NDJSON para o cliente, sem esperar terminar.
    (async () => {
      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sentChunks = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx;
          while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const evt = JSON.parse(jsonStr) as any;
              const parts = evt.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  sentChunks++;
                  await writer.write(encoder.encode(JSON.stringify({ a: part.inlineData.data }) + '\n'));
                }
              }
            } catch { /* linha SSE parcial/não-JSON — ignora */ }
          }
        }
        if (sentChunks === 0) {
          await writer.write(encoder.encode(JSON.stringify({ error: 'Modelo não retornou áudio no stream' }) + '\n'));
        } else {
          console.log(`[generate-narration] STREAM ${model} — concluído com ${sentChunks} pedaços de áudio`);
          await writer.write(encoder.encode(JSON.stringify({ done: true }) + '\n'));
        }
      } catch (e: any) {
        try {
          await writer.write(encoder.encode(JSON.stringify({ error: `Stream interrompido: ${e?.message || e}` }) + '\n'));
        } catch { /* cliente já desconectou */ }
      } finally {
        try { await writer.close(); } catch { /* já fechado */ }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-store',
      },
    });
  }

  return null;
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
    const { text, voice, styleInstruction, temperature, model, stream } = (await request.json()) as any;

    if (!text) {
      return Response.json({ error: 'O campo "text" é obrigatório' }, { status: 400 });
    }

    const selectedVoice = typeof voice === 'string' && voice.trim() ? voice.trim() : 'Kore';

    const prompt = styleInstruction ? styleInstruction + '\n\n' + text : text;

    // Temperatura baixa por padrão: o TTS é generativo e com temperatura alta
    // pode falar um texto diferente do transcript (parafrasear/improvisar).
    // 0.25 mantém a leitura colada ao roteiro; o frontend já envia esse valor,
    // este default só cobre chamadas diretas à API.
    const safeTemperature = typeof temperature === 'number' && temperature >= 0 && temperature <= 2
      ? temperature
      : 0.25;

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
    console.log(`[generate-narration] Usando Vertex AI, preferência: ${model === 'pro' ? 'pro' : 'flash'}${stream ? ' (streaming)' : ''}`);

    // Streaming: headers saem já, o áudio flui conforme gerado — o corte de ~100s
    // do proxy do Cloudflare (524) deixa de se aplicar, permitindo gerar a
    // história INTEIRA numa única chamada (uma geração = uma voz).
    if (stream === true) {
      const streamResponse = await streamViaVertexAI(payload, env, models);
      if (streamResponse) return streamResponse;
      return Response.json({ error: 'Todos os modelos TTS falharam no Vertex AI (streaming). Verifique cotas e permissões no GCP.' }, { status: 500 });
    }

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
