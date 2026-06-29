/**
 * transcribe-audio.ts — Cloudflare Function para transcrição de áudio com timestamps
 * Rota: POST /api/transcribe-audio
 *
 * Body: { audioUrl: string }
 * Response: { transcription: Array<{ timestamp: string, text: string }> }
 */

import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
  GCP_CREDENTIALS_JSON: string;
}

const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

function getVertexUrl(region: string, projectId: string, model: string): string {
  const host = `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

function parseTranscription(text: string): Array<{ timestamp: string; text: string }> {
  const lines: Array<{ timestamp: string; text: string }> = [];

  // Try JSON first
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.transcription)) return parsed.transcription;
  } catch {}

  // Parse [MM:SS] or [HH:MM:SS] format line by line
  const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1]; // e.g. "1:23:04" or "01:23"
    const parts = raw.split(':').map(Number);
    let minutes: number, seconds: number;
    if (parts.length === 3) {
      // HH:MM:SS → convert to MM:SS total minutes
      minutes = parts[0] * 60 + parts[1];
      seconds = parts[2];
    } else {
      minutes = parts[0];
      seconds = parts[1];
    }
    const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    lines.push({ timestamp, text: match[2].trim() });
  }

  return lines;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { audioUrl } = (await request.json()) as { audioUrl: string };

    if (!audioUrl) {
      return Response.json({ error: 'audioUrl é obrigatório' }, { status: 400 });
    }

    if (!env.GCP_PROJECT_ID || !env.GCP_CREDENTIALS_JSON) {
      return Response.json({ error: 'Credenciais GCP não configuradas' }, { status: 500 });
    }

    // Fetch the audio file and convert to base64
    let audioBase64: string;
    let mimeType = 'audio/wav';

    try {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        return Response.json({ error: `Não foi possível buscar o áudio: ${audioResponse.status}` }, { status: 400 });
      }
      const contentType = audioResponse.headers.get('content-type') || 'audio/wav';
      mimeType = contentType.split(';')[0].trim();
      if (!mimeType.startsWith('audio/')) mimeType = 'audio/wav';

      const arrayBuffer = await audioResponse.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      audioBase64 = btoa(binary);
    } catch (e: any) {
      return Response.json({ error: `Erro ao buscar áudio: ${e.message}` }, { status: 400 });
    }

    const prompt = `Você é um transcritor profissional. Transcreva o áudio a seguir em PORTUGUÊS BRASILEIRO com timestamps precisos a cada frase ou mudança de pausa.

FORMATO DE SAÍDA OBRIGATÓRIO — retorne APENAS um array JSON válido, sem markdown, sem explicações:
[
  {"timestamp": "00:00", "text": "Texto da frase aqui."},
  {"timestamp": "00:05", "text": "Próxima frase aqui."}
]

REGRAS:
- Um timestamp por frase ou pensamento completo (não por palavra)
- Formato do timestamp: MM:SS (ex: "00:00", "01:23", "10:45")
- Transcreva EXATAMENTE o que foi dito, sem corrigir ou resumir
- Separe em linhas curtas de no máximo 10 a 15 palavras
- Não inclua nada além do array JSON`;

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;
    const region = 'us-central1';

    for (const model of TEXT_MODELS) {
      const url = getVertexUrl(region, projectId, model);

      const payload = {
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              }
            },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-goog-user-project': projectId,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (response.ok && text) {
          const transcription = parseTranscription(text);
          if (transcription.length > 0) {
            return Response.json({ transcription });
          }
          return Response.json({ error: 'Não foi possível extrair timestamps da transcrição.', raw: text }, { status: 422 });
        }

        console.warn(`[transcribe-audio] ${model} falhou (${response.status}):`, JSON.stringify(data).slice(0, 300));
      } catch (e: any) {
        console.warn(`[transcribe-audio] ${model} erro:`, e.message);
      }
    }

    return Response.json({ error: 'Todos os modelos falharam na transcrição.' }, { status: 500 });

  } catch (e: any) {
    return Response.json({ error: e.message || 'Erro interno' }, { status: 500 });
  }
};
