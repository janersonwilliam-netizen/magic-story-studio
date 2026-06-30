import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Play, Pause, ArrowLeft, ArrowRight, Film, Download, Loader2, CheckCircle } from 'lucide-react';
import { PalitoSceneLine, PalitoTranscriptionLine } from '../../types/palito';

interface TimelinePageProps {
    audioUrl: string;
    scenes: PalitoSceneLine[];
    transcription: PalitoTranscriptionLine[];
    existingVideoUrl?: string;
    onComplete: (videoUrl: string) => void;
    onBack: () => void;
}

// How many seconds before a scene's timestamp to switch to it (compensates for render lag)
const SCENE_PRE_ROLL = 0.3;

// "MM:SS" or "HH:MM:SS" → seconds
function tsToSeconds(ts: string): number {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// seconds → "MM:SS"
function secondsToTs(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
    if (url.startsWith('data:')) {
        const base64 = url.split(',')[1];
        const binary = atob(base64);
        const buf = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        return buf;
    }
    const res = await fetch(url);
    return res.arrayBuffer();
}

export function TimelinePage({ audioUrl, scenes, transcription, existingVideoUrl, onComplete, onBack }: TimelinePageProps) {
    const waveRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [activeScene, setActiveScene] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // FFmpeg state
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
    const [encoding, setEncoding] = useState(false);
    const [encodeProgress, setEncodeProgress] = useState(0);
    const [encodeStep, setEncodeStep] = useState('');
    const [videoUrl, setVideoUrl] = useState(existingVideoUrl || '');

    // Scene durations from timestamps
    const sceneDurations: number[] = scenes.map((s, i) => {
        const start = tsToSeconds(s.timestamp);
        const next = scenes[i + 1] ? tsToSeconds(scenes[i + 1].timestamp) : duration || start + 5;
        return Math.max(1, next - start);
    });
    const totalDuration = sceneDurations.reduce((a, b) => a + b, 0) || duration;

    // Init WaveSurfer
    useEffect(() => {
        if (!waveRef.current || !audioUrl) return;

        const ws = WaveSurfer.create({
            container: waveRef.current,
            waveColor: '#4a4a6a',
            progressColor: '#f97316',
            cursorColor: '#f97316',
            height: 72,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
        });

        ws.load(audioUrl.startsWith('data:') ? audioUrl : audioUrl);
        ws.on('ready', () => setDuration(ws.getDuration()));
        ws.on('timeupdate', (t) => {
            setCurrentTime(t);
            // Find active scene with pre-roll: switch slightly before the timestamp
            let idx = -1;
            for (let k = 0; k < scenes.length; k++) {
                if (tsToSeconds(scenes[k].timestamp) - SCENE_PRE_ROLL <= t) idx = k;
            }
            if (idx >= 0) setActiveScene(idx);
        });
        ws.on('play', () => setPlaying(true));
        ws.on('pause', () => setPlaying(false));
        ws.on('finish', () => setPlaying(false));

        wavesurfer.current = ws;
        return () => { ws.destroy(); wavesurfer.current = null; };
    }, [audioUrl]);

    // Auto-scroll list to active scene
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${activeScene}"]`) as HTMLElement;
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [activeScene]);

    const togglePlay = () => wavesurfer.current?.playPause();

    const seekToScene = (i: number) => {
        const t = tsToSeconds(scenes[i].timestamp);
        wavesurfer.current?.setTime(t);
        setActiveScene(i);
    };

    // Load FFmpeg
    const loadFfmpeg = async () => {
        if (ffmpegRef.current) return;
        const ff = new FFmpeg();
        ff.on('progress', ({ progress }) => setEncodeProgress(Math.round(progress * 100)));
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ff.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ff;
        setFfmpegLoaded(true);
    };

    const handleExport = useCallback(async () => {
        setEncoding(true);
        setEncodeProgress(0);

        try {
            setEncodeStep('Carregando FFmpeg...');
            await loadFfmpeg();
            const ff = ffmpegRef.current!;

            const scenesWithImages = scenes.filter(s => s.imageUrl);
            if (scenesWithImages.length === 0) throw new Error('Nenhuma cena com imagem gerada.');

            // Write audio
            setEncodeStep('Carregando áudio...');
            const audioBuf = await fetchAsArrayBuffer(audioUrl);
            await ff.writeFile('audio.mp3', new Uint8Array(audioBuf));

            // Write scene images
            const concatLines: string[] = [];
            const audioDuration = duration || 0;
            for (let i = 0; i < scenesWithImages.length; i++) {
                const scene = scenesWithImages[i];
                setEncodeStep(`Carregando cenas (${i + 1}/${scenesWithImages.length})...`);
                const imgBuf = await fetchAsArrayBuffer(scene.imageUrl!);
                const fname = `img${String(i).padStart(4, '0')}.jpg`;
                await ff.writeFile(fname, new Uint8Array(imgBuf));

                // Apply pre-roll: shift scene start earlier so image appears before the word is spoken
                const rawStart = tsToSeconds(scene.timestamp);
                const start = Math.max(0, rawStart - SCENE_PRE_ROLL);
                const nextScene = scenesWithImages[i + 1];
                const rawEnd = nextScene
                    ? Math.max(0, tsToSeconds(nextScene.timestamp) - SCENE_PRE_ROLL)
                    : (audioDuration > 0 ? audioDuration : rawStart + 5);
                const dur = Math.max(0.5, rawEnd - start);

                concatLines.push(`file '${fname}'`);
                concatLines.push(`duration ${dur.toFixed(3)}`);
            }
            // ffconcat needs a final file entry without duration for the last frame
            const lastFname = `img${String(scenesWithImages.length - 1).padStart(4, '0')}.jpg`;
            concatLines.push(`file '${lastFname}'`);

            await ff.writeFile('concat.txt', concatLines.join('\n'));

            setEncodeStep('Codificando vídeo (isso pode levar alguns minutos)...');
            setEncodeProgress(0);

            await ff.exec([
                '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
                '-i', 'audio.mp3',
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-pix_fmt', 'yuv420p',
                '-shortest',
                '-y', 'output.mp4',
            ]);

            setEncodeStep('Finalizando...');
            const data = await ff.readFile('output.mp4');
            const blob = new Blob([data], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);

        } catch (e: any) {
            alert('Erro ao exportar vídeo: ' + e.message);
        } finally {
            setEncoding(false);
            setEncodeStep('');
        }
    }, [scenes, audioUrl, duration]);

    const handleDownload = () => {
        if (!videoUrl) return;
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = 'video_palito.mp4';
        a.click();
    };

    const scenesWithImages = scenes.filter(s => s.imageUrl).length;

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Timeline</h2>
                    <p className="text-gray-400 text-sm">
                        {scenes.length} cenas · {scenesWithImages} com imagem · duração estimada {secondsToTs(totalDuration)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {videoUrl ? (
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors"
                        >
                            <Download className="h-4 w-4" /> Baixar MP4
                        </button>
                    ) : (
                        <button
                            onClick={handleExport}
                            disabled={encoding || scenesWithImages === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {encoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                            {encoding ? 'Exportando...' : 'Exportar MP4'}
                        </button>
                    )}
                </div>
            </div>

            {/* Encode progress */}
            {encoding && (
                <div className="bg-[#242426] border border-border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{encodeStep}</span>
                        <span className="text-white font-mono">{encodeProgress}%</span>
                    </div>
                    <div className="w-full bg-[#333] rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${encodeProgress}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500">O encode roda no seu browser. Não feche a aba.</p>
                </div>
            )}

            {/* Video player (after export) */}
            {videoUrl && !encoding && (
                <div className="bg-[#242426] border border-green-800 rounded-xl overflow-hidden">
                    <video src={videoUrl} controls className="w-full" style={{ maxHeight: 360 }} />
                    <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <p className="text-green-400 text-sm font-medium">Vídeo exportado com sucesso!</p>
                    </div>
                </div>
            )}

            {/* Waveform + controls */}
            <div className="bg-[#242426] border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePlay}
                        className="p-2 bg-primary rounded-full text-white hover:bg-primary/90 transition-colors shrink-0"
                    >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-mono text-gray-400 shrink-0">
                        {secondsToTs(currentTime)} / {secondsToTs(duration)}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                        Cena {activeScene + 1}/{scenes.length}: [{scenes[activeScene]?.timestamp}]
                    </span>
                </div>
                <div ref={waveRef} className="w-full rounded-lg overflow-hidden" />
            </div>

            {/* Scene ruler */}
            {duration > 0 && (
                <div className="bg-[#242426] border border-border rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Régua de cenas</p>
                    <div className="flex rounded-lg overflow-hidden h-8 w-full" style={{ minWidth: 0 }}>
                        {sceneDurations.map((dur, i) => {
                            const pct = (dur / totalDuration) * 100;
                            const isActive = i === activeScene;
                            return (
                                <button
                                    key={i}
                                    onClick={() => seekToScene(i)}
                                    title={`[${scenes[i].timestamp}] ${scenes[i].text.substring(0, 50)}`}
                                    style={{ width: `${pct}%`, minWidth: 2 }}
                                    className={`h-full border-r border-[#1a1a1c] transition-colors text-[9px] overflow-hidden ${
                                        isActive ? 'bg-primary/70' : i % 2 === 0 ? 'bg-[#1e3a5f] hover:bg-[#2a4a7f]' : 'bg-[#2d4a1e] hover:bg-[#3a5f28]'
                                    }`}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-600">
                        <span>00:00</span>
                        <span>{secondsToTs(totalDuration / 4)}</span>
                        <span>{secondsToTs(totalDuration / 2)}</span>
                        <span>{secondsToTs((totalDuration * 3) / 4)}</span>
                        <span>{secondsToTs(totalDuration)}</span>
                    </div>
                </div>
            )}

            {/* Split: scene list + active preview */}
            <div className="grid grid-cols-2 gap-4" style={{ minHeight: 400 }}>
                {/* Left: scene list */}
                <div className="border border-border rounded-xl overflow-hidden flex flex-col">
                    <div className="px-3 py-2 bg-[#1a1a1c] border-b border-border">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cenas</p>
                    </div>
                    <div ref={listRef} className="overflow-y-auto flex-1" style={{ maxHeight: 420 }}>
                        {scenes.map((scene, i) => (
                            <button
                                key={i}
                                data-idx={i}
                                onClick={() => seekToScene(i)}
                                className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex items-start gap-2 ${
                                    activeScene === i
                                        ? 'bg-primary/10 border-l-2 border-l-primary'
                                        : 'hover:bg-[#242426]'
                                }`}
                            >
                                {scene.imageUrl ? (
                                    <img src={scene.imageUrl} className="w-10 h-7 object-cover rounded shrink-0 mt-0.5" alt="" />
                                ) : (
                                    <div className="w-10 h-7 bg-[#333] rounded shrink-0 mt-0.5 flex items-center justify-center">
                                        <span className="text-[8px] text-gray-600">sem img</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="text-primary font-mono text-[10px]">[{scene.timestamp}]</span>
                                    <p className="text-gray-300 text-xs leading-snug line-clamp-2 mt-0.5">{scene.text}</p>
                                </div>
                                <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">
                                    {sceneDurations[i]?.toFixed(1)}s
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: active scene preview */}
                <div className="flex flex-col gap-3">
                    <div className="bg-[#242426] border border-border rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-500 mb-1">Cena ativa — [{scenes[activeScene]?.timestamp}]</p>
                        <p className="text-white text-sm leading-relaxed">{scenes[activeScene]?.text}</p>
                        <p className="text-gray-600 text-xs mt-1">
                            Duração: {sceneDurations[activeScene]?.toFixed(1)}s
                        </p>
                    </div>
                    <div className="bg-[#242426] border border-border rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                        {scenes[activeScene]?.imageUrl ? (
                            <img
                                src={scenes[activeScene].imageUrl}
                                className="w-full h-full object-cover"
                                alt={`Cena ${activeScene + 1}`}
                            />
                        ) : (
                            <p className="text-gray-600 text-sm">Sem imagem</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(videoUrl)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
