import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Scene } from './gemini';

export class VideoRenderer {
    private ffmpeg: FFmpeg;
    private loaded: boolean = false;
    private logCallback: (message: string) => void;

    constructor(logCallback?: (message: string) => void) {
        this.ffmpeg = new FFmpeg();
        this.logCallback = logCallback || console.log;
    }

    async load() {
        if (this.loaded) return;

        this.logCallback('Carregando motor de vídeo (ffmpeg.wasm)...');

        // Load ffmpeg.wasm from UNPKG CDN to avoid local file serving issues in Vite
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

        try {
            await this.ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            this.loaded = true;
            this.logCallback('Motor de vídeo carregado!');
        } catch (error: any) {
            console.error('Falha ao carregar FFmpeg:', error);
            throw new Error(`Falha ao carregar sistema de vídeo. Verifique sua conexão. (${error.message})`);
        }

        this.ffmpeg.on('log', ({ message }) => {
            // Filter some noisy logs if needed
            console.log('[FFmpeg]', message);
        });
    }

    async renderStory(scenes: Scene[], storyAudioUrl?: string): Promise<Blob> {
        if (!this.loaded) await this.load();

        this.logCallback('Iniciando renderização...');

        try {
            // 1. Write files to FS
            const imageList: string[] = [];
            const audioList: string[] = [];

            // Process each scene
            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const sceneNum = String(i).padStart(3, '0');

                if (scene.imageUrl) {
                    this.logCallback(`Baixando imagem da cena ${i + 1}...`);
                    const imageFileName = `image_${sceneNum}.png`;
                    await this.ffmpeg.writeFile(imageFileName, await fetchFile(scene.imageUrl) as any);
                    imageList.push(imageFileName);
                } else {
                    // Create black placeholder if missing? Or skip.
                    // For now, assume valid images or validation catches it.
                    throw new Error(`Cena ${i + 1} não tem imagem. Gere todas as imagens antes de exportar.`);
                }
            }

            // 2. Create video command
            // We will create a simple slideshow first.
            // Complex Ken Burns requires complex filter graphs. 
            // Let's start with static images matched to duration.

            // Generate list.txt for concat demuxer? 
            // No, concat demuxer is for same codec. Images are not video.
            // We need to loop each image for its duration.

            // Strategy: Create a video clip for each scene, then concat.
            const sceneVideoFiles: string[] = [];

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const sceneNum = String(i).padStart(3, '0');
                const duration = scene.duration_estimate || 5;
                const imageFile = `image_${sceneNum}.png`;
                const videoFile = `scene_${sceneNum}.mp4`;

                this.logCallback(`Renderizando cena ${i + 1}/${scenes.length} (${duration}s)...`);

                // Create video from image with scaling and simple zoom centered
                // zoompan filter: zoom in 10% over duration
                // scale to 1280x720 (720p) for speed, or 1920x1080
                // fps=30

                // Simple command first: Static image
                // await this.ffmpeg.exec([
                //     '-loop', '1',
                //     '-i', imageFile,
                //     '-c:v', 'libx264',
                //     '-t', duration.toString(),
                //     '-pix_fmt', 'yuv420p',
                //     '-vf', 'scale=1280:720',
                //     videoFile
                // ]);

                // Better command: Ken Burns (Zoom In)
                // zoompan=z='min(zoom+0.0015,1.5)':d=duration*30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'
                // Note: duration in frames (30fps)

                // Simplified Zoom:
                // z='1.0+0.1*on/duration' -> zooms 10% over usage
                await this.ffmpeg.exec([
                    '-loop', '1',
                    '-i', imageFile,
                    '-vf', `zoompan=z='min(zoom+0.001,1.5)':d=${duration * 30}:s=1280x720`,
                    '-c:v', 'libx264',
                    '-t', duration.toString(),
                    '-pix_fmt', 'yuv420p',
                    '-r', '30',
                    videoFile
                ]);

                sceneVideoFiles.push(videoFile);
            }

            // 3. Concat all scenes
            this.logCallback('Unindo cenas...');
            const concatList = sceneVideoFiles.map(f => `file '${f}'`).join('\n');
            await this.ffmpeg.writeFile('concat_list.txt', concatList);

            await this.ffmpeg.exec([
                '-f', 'concat',
                '-safe', '0',
                '-i', 'concat_list.txt',
                '-c', 'copy',
                'combined_video.mp4'
            ]);

            // 4. Mix with Audio
            // If we have full story audio (storyAudioUrl), usage that.
            // If we have individual scene audios, we should have concated them or mixed them per scene.
            // Complex approach: Mix scene audio with video clip.
            // Simpler approach (MVP): Use full story audio if available, else silent.

            let finalOutput = 'combined_video.mp4';

            if (storyAudioUrl) {
                this.logCallback('Adicionando áudio da narração...');
                await this.ffmpeg.writeFile('narration.mp3', await fetchFile(storyAudioUrl) as any);

                // Mux audio and video
                // -shortest ensures video ends if audio is longer, or vice versa?
                // Usually we want video length to drive, but audio might be longer/shorter.
                // Let's assume video duration is roughly correct.

                await this.ffmpeg.exec([
                    '-i', 'combined_video.mp4',
                    '-i', 'narration.mp3',
                    '-c:v', 'copy', // copy video stream
                    '-c:a', 'aac',  // encode audio to aac
                    '-map', '0:v:0',
                    '-map', '1:a:0',
                    '-shortest', // Stop when shortest stream ends
                    'output_with_audio.mp4'
                ]);

                finalOutput = 'output_with_audio.mp4';
            }

            // 5. Read result
            this.logCallback('Ajustes finais...');
            const data = await this.ffmpeg.readFile(finalOutput);

            this.logCallback('Vídeo pronto!');
            return new Blob([data], { type: 'video/mp4' });

        } catch (error: any) {
            console.error('Erro na renderização:', error);
            throw new Error(`Erro ao renderizar vídeo: ${error.message}`);
        }
    }
}
