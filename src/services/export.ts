import JSZip from 'jszip';
import { supabase } from '../lib/supabase';

export interface StoryExportData {
    story: {
        id: string;
        title: string;
        age_group: string;
        tone: string;
        duration: number;
        story_text: string;
    };
    scenes: Array<{
        id: string;
        order: number;
        narration_text: string;
        visual_description: string;
        emotion: string;
        duration_estimate: number;
        imageUrl?: string;
        audioUrl?: string;
    }>;
}

export interface ValidationResult {
    isComplete: boolean;
    missingAssets: {
        scenesWithoutImages: number[];
        scenesWithoutAudio: number[];
    };
    totalScenes: number;
    completedScenes: number;
}

/**
 * Validate if story is complete and ready for export
 */
export async function validateStoryCompleteness(storyId: string): Promise<ValidationResult> {
    try {
        // Fetch scenes with assets
        const { data: scenes, error } = await supabase
            .from('scenes')
            .select('*, assets(*)')
            .eq('story_id', storyId)
            .order('order_number', { ascending: true });

        if (error) throw error;

        if (!scenes || scenes.length === 0) {
            return {
                isComplete: false,
                missingAssets: { scenesWithoutImages: [], scenesWithoutAudio: [] },
                totalScenes: 0,
                completedScenes: 0
            };
        }

        const scenesWithoutImages: number[] = [];
        const scenesWithoutAudio: number[] = [];
        let completedScenes = 0;

        scenes.forEach((scene: any) => {
            const hasImage = scene.assets?.some((a: any) => a.type === 'image');
            const hasAudio = scene.assets?.some((a: any) => a.type === 'audio');

            if (!hasImage) scenesWithoutImages.push(scene.order_number);
            if (!hasAudio) scenesWithoutAudio.push(scene.order_number);

            if (hasImage && hasAudio) completedScenes++;
        });

        return {
            isComplete: scenesWithoutImages.length === 0 && scenesWithoutAudio.length === 0,
            missingAssets: { scenesWithoutImages, scenesWithoutAudio },
            totalScenes: scenes.length,
            completedScenes
        };

    } catch (error: any) {
        console.error('Error validating story:', error);
        throw new Error(`Validation failed: ${error.message}`);
    }
}

/**
 * Fetch story data for export
 */
async function fetchStoryExportData(storyId: string): Promise<StoryExportData> {
    // Fetch story
    const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

    if (storyError) throw storyError;

    // Fetch scenes with assets
    const { data: scenesData, error: scenesError } = await supabase
        .from('scenes')
        .select('*, assets(*)')
        .eq('story_id', storyId)
        .order('order_number', { ascending: true });

    if (scenesError) throw scenesError;

    const scenes = scenesData.map((s: any) => {
        const imageAsset = s.assets?.find((a: any) => a.type === 'image');
        const audioAsset = s.assets?.find((a: any) => a.type === 'audio');

        return {
            id: s.id,
            order: s.order_number,
            narration_text: s.narration_text,
            visual_description: s.visual_description || '',
            emotion: s.emotion || 'calma',
            duration_estimate: s.duration_estimate || 10,
            imageUrl: imageAsset?.file_url,
            audioUrl: audioAsset?.file_url
        };
    });

    return { story, scenes };
}

/**
 * Download file from URL as blob
 */
async function downloadFile(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${url}`);
    return await response.blob();
}

/**
 * Generate roteiro.txt content
 */
function generateRoteiroText(data: StoryExportData): string {
    let content = `ROTEIRO: ${data.story.title}\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `Faixa Etária: ${data.story.age_group}\n`;
    content += `Tom: ${data.story.tone}\n`;
    content += `Duração: ${data.story.duration} minutos\n`;
    content += `Total de Cenas: ${data.scenes.length}\n\n`;
    content += `${'='.repeat(50)}\n\n`;

    data.scenes.forEach((scene, index) => {
        content += `CENA ${String(scene.order).padStart(2, '0')}\n`;
        content += `${'-'.repeat(50)}\n`;
        content += `Emoção: ${scene.emotion}\n`;
        content += `Duração: ${scene.duration_estimate}s\n\n`;
        content += `VISUAL:\n${scene.visual_description}\n\n`;
        content += `NARRAÇÃO:\n${scene.narration_text}\n\n`;
        content += `ARQUIVOS:\n`;
        content += `  Imagem: imagens/cena_${String(scene.order).padStart(2, '0')}.png\n`;
        content += `  Áudio: narracao/cena_${String(scene.order).padStart(2, '0')}.mp3\n\n`;
        content += `${'='.repeat(50)}\n\n`;
    });

    return content;
}

/**
 * Generate instrucoes.txt content
 */
function generateInstrucoesText(data: StoryExportData): string {
    return `INSTRUÇÕES PARA EDIÇÃO NO CAPCUT
${'='.repeat(50)}

Este projeto contém todos os assets necessários para criar o vídeo da história "${data.story.title}".

ESTRUTURA DO PROJETO:
- /imagens/ - Contém as imagens de cada cena (PNG, 16:9)
- /narracao/ - Contém os áudios de narração (MP3)
- roteiro.txt - Roteiro completo com descrições
- instrucoes.txt - Este arquivo

PASSO A PASSO NO CAPCUT:

1. CRIAR NOVO PROJETO
   - Abra o CapCut
   - Crie um novo projeto
   - Configure para 16:9 (1920x1080)

2. IMPORTAR ASSETS
   - Importe todas as imagens da pasta /imagens/
   - Importe todos os áudios da pasta /narracao/

3. MONTAR A TIMELINE
   Para cada cena (na ordem):
   - Adicione a imagem (cena_01.png, cena_02.png, etc.)
   - Adicione o áudio correspondente (cena_01.mp3, cena_02.mp3, etc.)
   - Ajuste a duração da imagem para coincidir com o áudio
   - Adicione transições suaves entre as cenas (fade, dissolve)

4. ADICIONAR EFEITOS (OPCIONAL)
   - Ken Burns (zoom suave nas imagens)
   - Legendas automáticas
   - Música de fundo (volume baixo)
   - Efeitos de partículas

5. EXPORTAR
   - Resolução: 1080p (Full HD)
   - Frame Rate: 30fps
   - Formato: MP4
   - Qualidade: Alta

DICAS:
- Mantenha a ordem das cenas conforme o roteiro
- Use transições de 0.5-1 segundo entre cenas
- Adicione música de fundo em volume baixo (20-30%)
- Revise o áudio para garantir sincronia

Total de Cenas: ${data.scenes.length}
Duração Estimada: ${data.story.duration} minutos

Boa edição! 🎬
`;
}

/**
 * Export story to ZIP file
 */
export async function exportStoryToZip(storyId: string): Promise<Blob> {
    console.log('[Export] Starting export for story:', storyId);

    // 1. Validate story completeness
    const validation = await validateStoryCompleteness(storyId);
    if (!validation.isComplete) {
        const missing = [];
        if (validation.missingAssets.scenesWithoutImages.length > 0) {
            missing.push(`Imagens faltando nas cenas: ${validation.missingAssets.scenesWithoutImages.join(', ')}`);
        }
        if (validation.missingAssets.scenesWithoutAudio.length > 0) {
            missing.push(`Áudios faltando nas cenas: ${validation.missingAssets.scenesWithoutAudio.join(', ')}`);
        }
        throw new Error(`História incompleta!\n\n${missing.join('\n')}\n\nComplete todos os assets antes de exportar.`);
    }

    // 2. Fetch story data
    console.log('[Export] Fetching story data...');
    const data = await fetchStoryExportData(storyId);

    // 3. Create ZIP
    console.log('[Export] Creating ZIP file...');
    const zip = new JSZip();

    // 4. Add images
    console.log('[Export] Downloading images...');
    const imagensFolder = zip.folder('imagens');
    for (const scene of data.scenes) {
        if (scene.imageUrl) {
            const sceneNumber = String(scene.order).padStart(2, '0');
            const imageBlob = await downloadFile(scene.imageUrl);
            imagensFolder?.file(`cena_${sceneNumber}.png`, imageBlob);
        }
    }

    // 5. Add audio
    console.log('[Export] Downloading audio files...');
    const narracaoFolder = zip.folder('narracao');
    for (const scene of data.scenes) {
        if (scene.audioUrl) {
            const sceneNumber = String(scene.order).padStart(2, '0');
            const audioBlob = await downloadFile(scene.audioUrl);
            narracaoFolder?.file(`cena_${sceneNumber}.mp3`, audioBlob);
        }
    }

    // 6. Add text files
    console.log('[Export] Generating text files...');
    zip.file('roteiro.txt', generateRoteiroText(data));
    zip.file('instrucoes.txt', generateInstrucoesText(data));

    // 7. Generate ZIP blob
    console.log('[Export] Generating ZIP blob...');
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    console.log('[Export] Export complete!');
    return zipBlob;
}

/**
 * Trigger download of blob as file
 */
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
