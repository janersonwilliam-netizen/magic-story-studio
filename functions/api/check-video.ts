import { getVertexToken } from '../_shared/vertexAuth';

interface Env {
  GCP_PROJECT_ID: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const operationName = url.searchParams.get('operationName');

    if (!operationName) {
      return Response.json({ error: 'operationName é obrigatório' }, { status: 400 });
    }

    const token = await getVertexToken(env as any);
    const projectId = env.GCP_PROJECT_ID;

    if (!projectId) {
      return Response.json({ error: 'GCP_PROJECT_ID não configurado' }, { status: 500 });
    }

    const region = 'us-central1';
    const model = 'veo-2.0-generate-001';
    
    // O Veo usa fetchPredictOperation para checar o status do LRO
    // operationName retornado pelo predictLongRunning tem o formato:
    // projects/{proj}/locations/{region}/publishers/google/models/{model}/operations/{id}
    // Extraímos apenas o ID puro da operação
    const operationId = operationName.split('/operations/').pop();
    if (!operationId) {
        return Response.json({ error: 'operationName inválido, não foi possível extrair o ID' }, { status: 400 });
    }

    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:fetchPredictOperation`;

    const response = await fetch(vertexUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId,
      },
      body: JSON.stringify({ operationName: operationName }),
    });

    const textData = await response.text();
    let data;
    try {
        data = JSON.parse(textData);
    } catch (e) {
        console.error('[check-video] Erro ao fazer parse da resposta da Vertex. Resposta bruta:', textData);
        return Response.json({ error: 'Resposta inválida da Vertex AI (não é JSON).', raw: textData.substring(0, 200) }, { status: 500 });
    }

    if (!response.ok) {
      console.error('[check-video] Erro ao consultar operação:', data);
      return Response.json({ error: data?.error?.message || 'Erro ao consultar status do vídeo' }, { status: response.status });
    }

    if (data.done) {
        if (data.error) {
             return Response.json({ error: data.error.message || 'Erro na geração final do vídeo' }, { status: 500 });
        }

        // O Veo retorna os vídeos em data.response.videos[] (não predictions)
        const videos = data.response?.videos || [];
        let videoBase64: string | undefined;
        let videoMime: string = 'video/mp4';

        for (const vid of videos) {
            if (vid?.bytesBase64Encoded) {
                videoBase64 = vid.bytesBase64Encoded;
                videoMime = vid.mimeType || 'video/mp4';
                break;
            }
        }

        if (videoBase64) {
            console.log('[check-video] Vídeo extraído com sucesso de response.videos[]!');
            return Response.json({ 
                done: true,
                base64: videoBase64, 
                mimeType: videoMime
            });
        }
        
        // Retorna a estrutura completa para debug
        return Response.json({ 
            error: 'A operação concluiu mas nenhum vídeo foi encontrado na resposta.',
            debugResponse: data.response || data
        }, { status: 500 });
    }

    // Operação ainda em andamento
    return Response.json({ done: false });

  } catch (error: any) {
    console.error('[check-video] Exceção:', error);
    return Response.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
};
