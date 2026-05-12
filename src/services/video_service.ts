/**
 * Video Generation Service
 * Connects to the Cloudflare Worker `/api/generate-video` to use Veo on Google Cloud
 */

export interface VideoGenerateParams {
    prompt: string;
    imageFile?: File | null;
    duration?: string;
    resolution?: string;
    aspectRatio?: string;
}

export async function generateVideoVertex(params: VideoGenerateParams): Promise<string> {
    console.log('[Video Service] Iniciando requisição para /api/generate-video (LRO)...', params);

    let base64Image = undefined;

    if (params.imageFile) {
        base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(params.imageFile as File);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    const payload = {
        prompt: params.prompt,
        referenceImage: base64Image,
        duration: params.duration,
        resolution: params.resolution,
        aspectRatio: params.aspectRatio
    };

    // 1. Inicia a operação de geração
    const initResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    let initData: any;
    const textData = await initResponse.text();
    try {
        initData = JSON.parse(textData);
    } catch (e) {
        console.error('[Video Service] Resposta da API não é JSON:', textData);
        throw new Error('A API retornou um formato inválido (erro 500). Verifique o terminal para detalhes.');
    }

    if (!initResponse.ok) {
        console.error('[Video Service] Erro ao iniciar a API:', initData);
        throw new Error(initData.error || 'Erro desconhecido ao iniciar a geração do vídeo');
    }

    const operationName = initData.operationName;
    
    if (!operationName) {
        // Fallback caso a API decida retornar síncrono
        if (initData.base64) {
            const mimeType = initData.mimeType || 'video/mp4';
            return initData.base64.startsWith('data:') ? initData.base64 : `data:${mimeType};base64,${initData.base64}`;
        }
        throw new Error('A API não retornou o ID da operação');
    }

    console.log('[Video Service] Operação iniciada. ID:', operationName);
    console.log('[Video Service] Iniciando verificações de status (Polling)...');

    // 2. Loop de Polling — verifica a cada 10 segundos por até 10 minutos
    const MAX_RETRIES = 60;
    let retries = 0;

    while (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log(`[Video Service] Verificando status (${retries + 1}/${MAX_RETRIES})...`);
        const statusResponse = await fetch(`/api/check-video?operationName=${encodeURIComponent(operationName)}`);
        const statusData = await statusResponse.json() as any;

        if (!statusResponse.ok) {
            console.error('[Video Service] Erro no polling:', statusData);
            throw new Error(statusData.error || 'Erro ao consultar o status do vídeo');
        }

        if (statusData.done) {
            if (statusData.base64) {
                const mimeType = statusData.mimeType || 'video/mp4';
                const videoUrl = statusData.base64.startsWith('data:')
                    ? statusData.base64
                    : `data:${mimeType};base64,${statusData.base64}`;
                console.log('[Video Service] Vídeo gerado com sucesso via Vertex AI (base64)!');
                return videoUrl;
            }
            
            if (statusData.videoUri) {
                console.log('[Video Service] Vídeo gerado com sucesso via Vertex AI (GCS URI)!', statusData.videoUri);
                return statusData.videoUri;
            }

            // Estrutura de resposta desconhecida — mostra o debug
            console.error('[Video Service] Estrutura de resposta inesperada:', statusData);
            throw new Error(
                'A operação foi concluída, mas nenhum vídeo foi encontrado. Debug: ' +
                JSON.stringify(statusData.debugResponse || {}).substring(0, 300)
            );
        }

        retries++;
    }

    throw new Error('A geração do vídeo excedeu o tempo limite (10 minutos). Tente novamente.');
}
