import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
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

const SCENE_PRE_ROLL = 0.0; // offset is now handled by globalOffset slider
const TRACK_HEIGHT = 72; // px — height of scene thumbnail track

function tsToSeconds(ts: string): number {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

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
    const trackRef = useRef<HTMLDivElement>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [activeScene, setActiveScene] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // FFmpeg
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [encoding, setEncoding] = useState(false);
    const [encodeProgress, setEncodeProgress] = useState(0);
    const [encodeStep, setEncodeStep] = useState('');
    const [videoUrl, setVideoUrl] = useState(existingVideoUrl || '');

    // Global offset: shift ALL scene timestamps earlier (negative = images appear sooner)
    const [globalOffset, setGlobalOffset] = useState(-1.0);

    // Editable start times (base, without offset)
    const [adjustedStarts, setAdjustedStarts] = useState<number[]>(() =>
        scenes.map(s => tsToSeconds(s.timestamp))
    );

    // Effective starts = adjustedStarts + globalOffset (clamped to >= 0)
    const effectiveStarts = useMemo(() =>
        adjustedStarts.map(s => Math.max(0, s + globalOffset)),
        [adjustedStarts, globalOffset]
    );

    const dragRef = useRef<{ index: number; startX: number; origNextStart: number } | null>(null);

    const totalDuration = useMemo(() =>
        duration || (adjustedStarts[adjustedStarts.length - 1] ?? 0) + 5,
        [duration, adjustedStarts]
    );

    const sceneDurations = useMemo(() =>
        effectiveStarts.map((start, i) => {
            const end = effectiveStarts[i + 1] ?? totalDuration;
            return Math.max(0.5, end - start);
        }),
        [effectiveStarts, totalDuration]
    );

    // WaveSurfer init
    useEffect(() => {
        if (!waveRef.current || !audioUrl) return;
        const ws = WaveSurfer.create({
            container: waveRef.current,
            waveColor: '#3d3d5c',
            progressColor: '#f97316',
            cursorColor: '#f97316',
            cursorWidth: 2,
            height: 64,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
        });
        ws.load(audioUrl);
        ws.on('ready', () => setDuration(ws.getDuration()));
        ws.on('timeupdate', t => {
            setCurrentTime(t);
            let idx = -1;
            for (let k = 0; k < scenes.length; k++) {
                if ((effectiveStarts[k] ?? 0) <= t) idx = k;
            }
            if (idx >= 0) setActiveScene(idx);
        });
        ws.on('play', () => setPlaying(true));
        ws.on('pause', () => setPlaying(false));
        ws.on('finish', () => setPlaying(false));
        wavesurfer.current = ws;
        return () => { ws.destroy(); wavesurfer.current = null; };
    }, [audioUrl]);

    // Seek by clicking the scene track
    const onTrackClick = useCallback((e: React.MouseEvent) => {
        if (!trackRef.current || !wavesurfer.current || totalDuration === 0) return;
        if (dragRef.current) return; // ignore clicks during drag
        const rect = trackRef.current.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        wavesurfer.current.seekTo(Math.min(1, Math.max(0, pct)));
    }, [totalDuration]);

    // Drag handle
    const onHandleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        e.preventDefault();
        const origNextStart = adjustedStarts[index + 1] ?? totalDuration;
        dragRef.current = { index, startX: e.clientX, origNextStart };

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current || !trackRef.current) return;
            const rulerWidth = trackRef.current.getBoundingClientRect().width;
            const pps = rulerWidth / totalDuration;
            const delta = (ev.clientX - dragRef.current.startX) / pps;
            const newTime = dragRef.current.origNextStart + delta;
            const min = adjustedStarts[index] + 1.0;
            const max = index + 2 < adjustedStarts.length ? adjustedStarts[index + 2] - 1.0 : totalDuration - globalOffset - 0.5;
            setAdjustedStarts(prev => {
                const next = [...prev];
                if (next[index + 1] !== undefined) {
                    next[index + 1] = Math.min(max, Math.max(min, newTime));
                }
                return next;
            });
        };

        const onMouseUp = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [adjustedStarts, totalDuration]);

    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${activeScene}"]`) as HTMLElement;
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [activeScene]);

    const seekToScene = (i: number) => {
        const t = effectiveStarts[i] ?? 0;
        wavesurfer.current?.setTime(Math.max(0, t));
        setActiveScene(i);
    };

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

            setEncodeStep('Carregando áudio...');
            const audioBuf = await fetchAsArrayBuffer(audioUrl);
            await ff.writeFile('audio.mp3', new Uint8Array(audioBuf));

            const allSceneIndices = scenesWithImages.map(s => scenes.indexOf(s));
            const concatLines: string[] = [];
            const audioDuration = duration || 0;

            for (let i = 0; i < scenesWithImages.length; i++) {
                const scene = scenesWithImages[i];
                const sceneIdx = allSceneIndices[i];
                setEncodeStep(`Carregando cenas (${i + 1}/${scenesWithImages.length})...`);
                const imgBuf = await fetchAsArrayBuffer(scene.imageUrl!);
                const fname = `img${String(i).padStart(4, '0')}.jpg`;
                await ff.writeFile(fname, new Uint8Array(imgBuf));

                const start = Math.max(0, effectiveStarts[sceneIdx] ?? 0);
                const nextIdx = allSceneIndices[i + 1];
                const rawEnd = nextIdx !== undefined
                    ? Math.max(0, effectiveStarts[nextIdx] ?? 0)
                    : (audioDuration > 0 ? audioDuration : start + 5);
                const dur = Math.max(0.5, rawEnd - start);

                concatLines.push(`file '${fname}'`);
                concatLines.push(`duration ${dur.toFixed(3)}`);
            }
            const lastFname = `img${String(scenesWithImages.length - 1).padStart(4, '0')}.jpg`;
            concatLines.push(`file '${lastFname}'`);
            await ff.writeFile('concat.txt', concatLines.join('\n'));

            setEncodeStep('Codificando vídeo...');
            setEncodeProgress(0);
            await ff.exec([
                '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
                '-i', 'audio.mp3',
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-pix_fmt', 'yuv420p',
                '-shortest', '-y', 'output.mp4',
            ]);

            setEncodeStep('Finalizando...');
            const data = await ff.readFile('output.mp4');
            const blob = new Blob([data], { type: 'video/mp4' });
            setVideoUrl(URL.createObjectURL(blob));
        } catch (e: any) {
            alert('Erro ao exportar: ' + e.message);
        } finally {
            setEncoding(false);
            setEncodeStep('');
        }
    }, [scenes, audioUrl, duration, adjustedStarts]);

    const scenesWithImagesCount = scenes.filter(s => s.imageUrl).length;
    const playheadPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

    // Time markers for ruler (every ~30s)
    const markerInterval = totalDuration <= 120 ? 15 : totalDuration <= 300 ? 30 : 60;
    const markers: number[] = [];
    for (let t = 0; t <= totalDuration; t += markerInterval) markers.push(t);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Timeline</h2>
                    <p className="text-gray-400 text-sm">
                        {scenes.length} cenas · {scenesWithImagesCount} com imagem · {secondsToTs(totalDuration)}
                    </p>
                </div>
                <div className="flex gap-2">
                    {videoUrl ? (
                        <button onClick={() => { const a = document.createElement('a'); a.href = videoUrl; a.download = 'video_palito.mp4'; a.click(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700">
                            <Download className="h-4 w-4" /> Baixar MP4
                        </button>
                    ) : (
                        <button onClick={handleExport} disabled={encoding || scenesWithImagesCount === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                            {encoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                            {encoding ? `Exportando ${encodeProgress}%` : 'Exportar MP4'}
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
                        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${encodeProgress}%` }} />
                    </div>
                    <p className="text-xs text-gray-500">O encode roda no seu browser. Não feche a aba.</p>
                </div>
            )}

            {videoUrl && !encoding && (
                <div className="bg-[#242426] border border-green-800 rounded-xl overflow-hidden">
                    <video src={videoUrl} controls className="w-full" style={{ maxHeight: 360 }} />
                    <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <p className="text-green-400 text-sm font-medium">Vídeo exportado com sucesso!</p>
                    </div>
                </div>
            )}

            {/* Player + Track */}
            <div className="bg-[#1a1a1c] border border-border rounded-xl overflow-hidden">
                {/* Controls bar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
                    <button onClick={() => wavesurfer.current?.playPause()}
                        className="p-2 bg-primary rounded-full text-white hover:bg-primary/90 shrink-0">
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <span className="text-sm font-mono text-white">{secondsToTs(currentTime)}</span>
                    <span className="text-gray-600 text-sm">/</span>
                    <span className="text-sm font-mono text-gray-400">{secondsToTs(duration)}</span>

                    {/* Global offset control */}
                    <div className="flex items-center gap-2 ml-auto bg-[#111] rounded-lg px-3 py-1.5 border border-border">
                        <span className="text-[11px] text-gray-400 shrink-0">Adiantar imagens:</span>
                        <button onClick={() => setGlobalOffset(v => Math.max(-3, +(v - 0.5).toFixed(1)))}
                            className="w-5 h-5 rounded bg-[#333] text-white text-xs hover:bg-[#555] flex items-center justify-center">−</button>
                        <span className="text-xs font-mono text-primary w-10 text-center">
                            {globalOffset > 0 ? '+' : ''}{globalOffset.toFixed(1)}s
                        </span>
                        <button onClick={() => setGlobalOffset(v => Math.min(3, +(v + 0.5).toFixed(1)))}
                            className="w-5 h-5 rounded bg-[#333] text-white text-xs hover:bg-[#555] flex items-center justify-center">+</button>
                        <span className="text-[10px] text-gray-600 ml-1">
                            {globalOffset < 0 ? `${Math.abs(globalOffset)}s antes` : globalOffset > 0 ? `${globalOffset}s depois` : 'sem offset'}
                        </span>
                    </div>
                </div>

                {/* Waveform */}
                <div className="px-4 pt-3 pb-1">
                    <div ref={waveRef} className="w-full" />
                </div>

                {/* Scene track — aligned with waveform */}
                {duration > 0 && (
                    <div className="px-4 pb-3">
                        {/* Time markers */}
                        <div className="relative w-full mb-1" style={{ height: 14 }}>
                            {markers.map(t => (
                                <span key={t}
                                    className="absolute text-[10px] text-gray-600 -translate-x-1/2"
                                    style={{ left: `${(t / totalDuration) * 100}%` }}>
                                    {secondsToTs(t)}
                                </span>
                            ))}
                        </div>

                        {/* Scene thumbnail track */}
                        <div
                            ref={trackRef}
                            className="relative w-full rounded-lg overflow-hidden select-none cursor-pointer"
                            style={{ height: TRACK_HEIGHT }}
                            onClick={onTrackClick}
                        >
                            {/* Scene blocks */}
                            {sceneDurations.map((dur, i) => {
                                const left = (effectiveStarts[i] / totalDuration) * 100;
                                const width = (dur / totalDuration) * 100;
                                const isActive = i === activeScene;
                                const isLast = i === scenes.length - 1;
                                const scene = scenes[i];

                                return (
                                    <div
                                        key={i}
                                        className={`absolute top-0 h-full border-r-2 ${isActive ? 'border-primary z-10' : 'border-[#111] z-0'}`}
                                        style={{ left: `${left}%`, width: `${width}%` }}
                                    >
                                        {/* Thumbnail or color block */}
                                        {scene.imageUrl ? (
                                            <img
                                                src={scene.imageUrl}
                                                className="w-full h-full object-cover"
                                                draggable={false}
                                                onClick={e => { e.stopPropagation(); seekToScene(i); }}
                                            />
                                        ) : (
                                            <div
                                                className={`w-full h-full ${i % 2 === 0 ? 'bg-[#1e3a5f]' : 'bg-[#2d4a1e]'}`}
                                                onClick={e => { e.stopPropagation(); seekToScene(i); }}
                                            />
                                        )}

                                        {/* Active overlay */}
                                        {isActive && (
                                            <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
                                        )}

                                        {/* Scene number badge */}
                                        <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded pointer-events-none">
                                            {i + 1}
                                        </div>

                                        {/* Drag handle on right edge */}
                                        {!isLast && (
                                            <div
                                                onMouseDown={e => onHandleMouseDown(e, i)}
                                                onClick={e => e.stopPropagation()}
                                                className="absolute top-0 right-0 w-3 h-full cursor-col-resize z-20 flex items-center justify-center group"
                                                title={`Arrastar para ajustar — ${secondsToTs(adjustedStarts[i + 1])}`}
                                            >
                                                <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-0.5 h-1 bg-white rounded-full" />
                                                    <div className="w-0.5 h-1 bg-white rounded-full" />
                                                    <div className="w-0.5 h-1 bg-white rounded-full" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Playhead */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none"
                                style={{ left: `${playheadPct}%` }}
                            >
                                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-600 mt-1.5 text-right">
                            Clique para buscar · Arraste as bordas brancas para ajustar duração
                        </p>
                    </div>
                )}
            </div>

            {/* Scene list + preview */}
            <div className="grid grid-cols-2 gap-4">
                {/* Scene list */}
                <div className="border border-border rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 420 }}>
                    <div className="px-3 py-2 bg-[#1a1a1c] border-b border-border shrink-0">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cenas</p>
                    </div>
                    <div ref={listRef} className="overflow-y-auto flex-1">
                        {scenes.map((scene, i) => (
                            <button
                                key={i}
                                data-idx={i}
                                onClick={() => seekToScene(i)}
                                className={`w-full text-left px-3 py-2 border-b border-border/40 flex items-center gap-2 transition-colors ${
                                    activeScene === i ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-[#242426]'
                                }`}
                            >
                                {scene.imageUrl ? (
                                    <img src={scene.imageUrl} className="w-12 h-8 object-cover rounded shrink-0" alt="" />
                                ) : (
                                    <div className="w-12 h-8 bg-[#333] rounded shrink-0 flex items-center justify-center">
                                        <span className="text-[8px] text-gray-600">sem img</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="text-primary font-mono text-[10px]">
                                        {secondsToTs(effectiveStarts[i] ?? 0)}
                                    </span>
                                    <p className="text-gray-300 text-xs leading-snug line-clamp-1 mt-0.5">{scene.text}</p>
                                </div>
                                <span className="text-[10px] text-gray-600 shrink-0 ml-1">
                                    {sceneDurations[i]?.toFixed(1)}s
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Active scene preview */}
                <div className="flex flex-col gap-3">
                    <div className="bg-[#1a1a1c] border border-border rounded-xl px-4 py-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs text-gray-500">
                                    Cena {activeScene + 1} · {secondsToTs(effectiveStarts[activeScene] ?? 0)}
                                </p>
                                <p className="text-white text-sm mt-1 leading-snug line-clamp-3">
                                    {scenes[activeScene]?.text}
                                </p>
                            </div>
                            <span className="text-xs font-mono text-primary ml-3 shrink-0">
                                {sceneDurations[activeScene]?.toFixed(1)}s
                            </span>
                        </div>
                    </div>
                    <div className="border border-border rounded-xl overflow-hidden aspect-video bg-[#111] flex items-center justify-center">
                        {scenes[activeScene]?.imageUrl ? (
                            <img src={scenes[activeScene].imageUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <p className="text-gray-600 text-sm">Sem imagem</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button onClick={() => onComplete(videoUrl)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90">
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
