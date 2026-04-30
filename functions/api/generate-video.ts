import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { prompt, aspectRatio = '16:9', duration = '4s', resolution = '720p', referenceImage } = await request.json<any>();

    if (!prompt) {
      return Response.json({ error: 'Prompt é obrigatório' }, { status: 400 });
    }

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;

    if (!projectId) {
      return Response.json({ error: 'GCP_PROJECT_ID não configurado' }, { status: 500 });
    }

    const model = 'veo-2.0-generate-001'; 
    const region = 'us-central1';
    
    // O Veo EXIGE o endpoint predictLongRunning
    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predictLongRunning`;

    console.log(`[generate-video] Iniciando LRO com Veo (${model})...`);

    const instances: any = { prompt };
    
    if (referenceImage) {
        const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            instances.image = { 
                mimeType: match[1],
                bytesBase64Encoded: match[2] 
            };
        } else {
            instances.image = { 
                mimeType: "image/jpeg",
                bytesBase64Encoded: referenceImage 
            };
        }
    }

    const payload = {
      instances: [instances],
      parameters: {
        aspectRatio: aspectRatio,
        duration: duration === '8s' ? '8s' : '4s',
        resolution: resolution,
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

    const textData = await response.text();
    let data: any;
    try {
        data = JSON.parse(textData);
    } catch (e) {
        console.error('[generate-video] Resposta da Vertex AI não é JSON:', textData);
        return Response.json({ error: 'Resposta inválida da API (não-JSON)', details: textData.substring(0, 300) }, { status: response.status || 500 });
    }

    if (!response.ok) {
      console.error('[generate-video] Erro da Vertex AI:', data);
      return Response.json({ error: data?.error?.message || 'Erro ao iniciar geração de vídeo no Vertex AI' }, { status: response.status });
    }

    // Retorna o ID da operação para o frontend fazer o polling
    if (data.name) {
      return Response.json({ operationName: data.name });
    }

    return Response.json({ error: 'Nenhum ID de operação retornado pela API' }, { status: 500 });

  } catch (error: any) {
    console.error('[generate-video] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
