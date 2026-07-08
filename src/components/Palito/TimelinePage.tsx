import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { Play, Pause, ArrowLeft, ArrowRight, Film, Download, Loader2, CheckCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { PalitoSceneLine, PalitoTranscriptionLine, PalitoFormat } from '../../types/palito';

interface TimelinePageProps {
    audioUrl: string;
    scenes: PalitoSceneLine[];
    transcription: PalitoTranscriptionLine[];
    format?: PalitoFormat;
    existingVideoUrl?: string;
    onComplete: (videoUrl: string) => void;
    onBack: () => void;
}

const TRACK_HEIGHT = 72;
const WAVEFORM_HEIGHT = 64;
const RULER_HEIGHT = 20;
const MIN_PX_PER_SEC = 8;
const MAX_PX_PER_SEC = 800;
// Extra scroll space after last scene (video editor feel)
const TAIL_SECONDS = 8;

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

export function TimelinePage({ audioUrl, scenes, transcription, format = 'VIDEO', existingVideoUrl, onComplete, onBack }: TimelinePageProps) {
    const isShorts = format === 'SHORTS';
    const waveRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);           // actual audio duration
    const [activeScene, setActiveScene] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [encoding, setEncoding] = useState(false);
    const [encodeProgress, setEncodeProgress] = useState(0);
    const [encodeStep, setEncodeStep] = useState('');
    const [encodeError, setEncodeError] = useState('');
    const [videoUrl, setVideoUrl] = useState(existingVideoUrl || '');

    const [globalOffset, setGlobalOffset] = useState(-1.0);

    const [adjustedStarts, setAdjustedStarts] = useState<number[]>(() =>
        scenes.map(s => tsToSeconds(s.timestamp))
    );

    const [pxPerSec, setPxPerSec] = useState(60);
    const fittedRef = useRef(false);

    const dragRef = useRef<{ index: number; startX: number; origNextStart: number } | null>(null);

    // Effective start times in seconds — clamped to >= 0
    const effectiveStarts = useMemo(() =>
        adjustedStarts.map(s => Math.max(0, s + globalOffset)),
        [adjustedStarts, globalOffset]
    );

    /*
     * LAST SCENE END: fixed anchor for the last scene's right edge.
     * Once audio loads, it ends at audioDuration.
     * Before audio loads, estimate from last adjustedStart + 5s.
     * This must NOT grow when the user drags the last scene's left edge
     * (otherwise the last scene's width stays constant and is unshrinkable).
     */
    const lastSceneEnd = useMemo(() => {
        if (duration > 0) return duration;
        return (adjustedStarts[adjustedStarts.length - 1] ?? 0) + 5;
    }, [duration, adjustedStarts]);

    /*
     * CONTENT DURATION: the furthest point any scene or audio reaches.
     * Grows to accommodate scenes whose start is beyond lastSceneEnd
     * (e.g. transcription timestamps past the audio), so they remain visible.
     */
    const contentDuration = useMemo(() => {
        const lastEffStart = effectiveStarts[effectiveStarts.length - 1] ?? 0;
        return Math.max(lastSceneEnd, lastEffStart);
    }, [lastSceneEnd, effectiveStarts]);

    // Duration of each scene block in seconds
    const sceneDurations = useMemo(() =>
        effectiveStarts.map((start, i) => {
            const isLast = i === effectiveStarts.length - 1;
            if (isLast) {
                // Last scene: ends at lastSceneEnd (audio end). Can be negative if scene is past audio.
                return Math.max(0.2, lastSceneEnd - start);
            }
            return Math.max(0.5, effectiveStarts[i + 1] - start);
        }),
        [effectiveStarts, lastSceneEnd]
    );

    /*
     * PIXEL GEOMETRY — all timeline elements use absolute pixel positions:
     *   position (px) = time (s) × pxPerSec
     *
     * waveformPx   = audio duration only (WaveSurfer canvas width)
     * trackTotalPx = content duration + tail (total scrollable width)
     */
    const waveformPx = useMemo(() => Math.max(100, Math.round(duration * pxPerSec)), [duration, pxPerSec]);
    const trackTotalPx = useMemo(() =>
        Math.max(300, Math.round((contentDuration + TAIL_SECONDS) * pxPerSec)),
        [contentDuration, pxPerSec]
    );

    // Stale-closure guards for mouse event handlers
    const pxPerSecRef = useRef(pxPerSec);
    useEffect(() => { pxPerSecRef.current = pxPerSec; }, [pxPerSec]);
    const durationRef = useRef(duration);
    useEffect(() => { durationRef.current = duration; }, [duration]);
    const adjustedStartsRef = useRef(adjustedStarts);
    useEffect(() => { adjustedStartsRef.current = adjustedStarts; }, [adjustedStarts]);
    const globalOffsetRef = useRef(globalOffset);
    useEffect(() => { globalOffsetRef.current = globalOffset; }, [globalOffset]);
    const effectiveStartsRef = useRef(effectiveStarts);
    useEffect(() => { effectiveStartsRef.current = effectiveStarts; }, [effectiveStarts]);
    const contentDurationRef = useRef(contentDuration);
    useEffect(() => { contentDurationRef.current = contentDuration; }, [contentDuration]);
    const lastSceneEndRef = useRef(lastSceneEnd);
    useEffect(() => { lastSceneEndRef.current = lastSceneEnd; }, [lastSceneEnd]);

    // Fit zoom so all content is visible on first load
    useEffect(() => {
        if (fittedRef.current || contentDuration <= 1 || !scrollRef.current) return;
        const containerW = scrollRef.current.clientWidth;
        if (containerW <= 0) return;
        const fitted = Math.floor(containerW / contentDuration);
        setPxPerSec(Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, fitted)));
        fittedRef.current = true;
    }, [contentDuration]);

    // Explicitly tell WaveSurfer to render at the current zoom — forces canvas redraw
    useEffect(() => {
        if (wavesurfer.current && duration > 0) {
            wavesurfer.current.zoom(pxPerSec);
        }
    }, [pxPerSec, duration]);

    // Auto-scroll to keep needle visible during playback
    useEffect(() => {
        if (!scrollRef.current || !playing || duration <= 0) return;
        const needlePx = currentTime * pxPerSec;
        const { scrollLeft, clientWidth } = scrollRef.current;
        if (needlePx > scrollLeft + clientWidth - 60 || needlePx < scrollLeft + 10) {
            scrollRef.current.scrollLeft = Math.max(0, needlePx - clientWidth * 0.3);
        }
    }, [currentTime, playing, pxPerSec, duration]);

    // WaveSurfer init
    useEffect(() => {
        if (!waveRef.current || !audioUrl) return;
        const ws = WaveSurfer.create({
            container: waveRef.current,
            waveColor: '#3d3d5c',
            progressColor: '#f97316',
            cursorColor: '#f97316',
            cursorWidth: 2,
            height: WAVEFORM_HEIGHT,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
        });
        ws.load(audioUrl);
        ws.on('ready', () => setDuration(ws.getDuration()));
        ws.on('timeupdate', t => {
            setCurrentTime(t);
            const eff = effectiveStartsRef.current;
            let idx = -1;
            for (let k = 0; k < eff.length; k++) {
                if ((eff[k] ?? 0) <= t) idx = k;
            }
            if (idx >= 0) setActiveScene(idx);
        });
        ws.on('play', () => setPlaying(true));
        ws.on('pause', () => setPlaying(false));
        ws.on('finish', () => setPlaying(false));
        wavesurfer.current = ws;
        return () => { ws.destroy(); wavesurfer.current = null; };
    }, [audioUrl]);

    const fitZoom = useCallback(() => {
        if (!scrollRef.current || contentDuration <= 0) return;
        const containerW = scrollRef.current.clientWidth;
        const fitted = Math.floor(containerW / contentDuration);
        setPxPerSec(Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, fitted)));
    }, [contentDuration]);

    /*
     * Convert a click/drag pixel offset within the track to a WaveSurfer seek ratio.
     * Ratio = time / audioDuration. Clamp to [0, 1].
     */
    const pixelOffsetToRatio = (offsetPx: number): number => {
        const dur = durationRef.current;
        if (dur <= 0) return 0;
        const t = offsetPx / pxPerSecRef.current;
        return Math.min(1, Math.max(0, t / dur));
    };

    // Click on track to seek
    const onTrackClick = useCallback((e: React.MouseEvent) => {
        if (!trackRef.current || !wavesurfer.current) return;
        if (dragRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        wavesurfer.current.seekTo(pixelOffsetToRatio(e.clientX - rect.left));
    }, []);

    // Right-edge drag handle: adjusts the START of scene (index+1)
    const onHandleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        e.preventDefault();
        const origNextStart = adjustedStartsRef.current[index + 1] ?? contentDurationRef.current;
        dragRef.current = { index, startX: e.clientX, origNextStart };

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = (ev.clientX - dragRef.current.startX) / pxPerSecRef.current;
            const newTime = dragRef.current.origNextStart + delta;
            const starts = adjustedStartsRef.current;
            const min = starts[index] + 0.5;
            const max = index + 2 < starts.length
                ? starts[index + 2] - 0.5
                : lastSceneEndRef.current - globalOffsetRef.current + 30;
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
    }, []);

    // Left-edge drag handle: adjusts the START of scene (index) itself
    const onLeftHandleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        e.preventDefault();
        const origStart = adjustedStartsRef.current[index];
        dragRef.current = { index, startX: e.clientX, origNextStart: origStart };

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = (ev.clientX - dragRef.current.startX) / pxPerSecRef.current;
            const newTime = dragRef.current.origNextStart + delta;
            const starts = adjustedStartsRef.current;
            // Min: must stay after previous scene's start (or at time 0 for first scene)
            const min = index > 0 ? starts[index - 1] + 0.5 : -globalOffsetRef.current;
            // Max: must stay before next scene's start (or before lastSceneEnd for last scene)
            const max = index + 1 < starts.length
                ? starts[index + 1] - 0.5
                : lastSceneEndRef.current - globalOffsetRef.current - 0.2;
            setAdjustedStarts(prev => {
                const next = [...prev];
                next[index] = Math.min(max, Math.max(min, newTime));
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
    }, []);

    // Needle drag to seek
    const onNeedleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const onMove = (ev: MouseEvent) => {
            if (!trackRef.current || !wavesurfer.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            wavesurfer.current.seekTo(pixelOffsetToRatio(ev.clientX - rect.left));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-idx="${activeScene}"]`) as HTMLElement;
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [activeScene]);

    const seekToScene = (i: number) => {
        const t = effectiveStarts[i] ?? 0;
        wavesurfer.current?.setTime(Math.max(0, Math.min(t, duration)));
        setActiveScene(i);
    };

    const loadFfmpeg = async () => {
        if (ffmpegRef.current) return;
        console.log('[FFmpeg] crossOriginIsolated:', (self as any).crossOriginIsolated);
        console.log('[FFmpeg] SharedArrayBuffer:', typeof SharedArrayBuffer);
        const ff = new FFmpeg();
        ff.on('log', ({ message }) => console.log('[FFmpeg log]', message));
        ff.on('progress', ({ progress }) => setEncodeProgress(Math.round(progress * 100)));
        console.log('[FFmpeg] chamando ff.load()...');
        const timeout = new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('ff.load() travou por mais de 30s. Veja o console para detalhes.')), 30000)
        );
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await Promise.race([
            ff.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            }),
            timeout,
        ]);
        console.log('[FFmpeg] carregado com sucesso!');
        ffmpegRef.current = ff;
    };

    const handleExport = useCallback(async () => {
        setEncoding(true);
        setEncodeProgress(0);
        setEncodeError('');
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
                '-vf', isShorts
                    ? 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black'
                    : 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
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
            setEncodeError(e.message || 'Erro desconhecido ao exportar.');
        } finally {
            setEncoding(false);
            setEncodeStep('');
        }
    }, [scenes, audioUrl, duration, effectiveStarts, isShorts]);

    const scenesWithImagesCount = scenes.filter(s => s.imageUrl).length;

    // Needle position in pixels (matches WaveSurfer's cursor which is also at currentTime × pxPerSec)
    const needlePx = Math.round(currentTime * pxPerSec);

    // Ruler markers — auto-spaced to at least ~50px apart
    const markerCandidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const markerInterval = markerCandidates.find(s => s * pxPerSec >= 50) ?? 600;
    const markers: number[] = [];
    for (let t = 0; t <= contentDuration + TAIL_SECONDS; t += markerInterval) markers.push(t);

    const totalTimelineHeight = WAVEFORM_HEIGHT + RULER_HEIGHT + TRACK_HEIGHT;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Timeline</h2>
                    <p className="text-gray-400 text-sm">
                        {scenes.length} cenas · {scenesWithImagesCount} com imagem · {secondsToTs(duration || contentDuration)}
                    </p>
                </div>
                <div className="flex gap-2">
                    {videoUrl ? (
                        <button
                            onClick={() => { const a = document.createElement('a'); a.href = videoUrl; a.download = 'video_palito.mp4'; a.click(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700"
                        >
                            <Download className="h-4 w-4" /> Baixar MP4
                        </button>
                    ) : (
                        <button
                            onClick={handleExport}
                            disabled={encoding || scenesWithImagesCount === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
                        >
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
            {encodeError && !encoding && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-sm text-red-300">
                    <strong>Erro ao exportar:</strong> {encodeError}
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

            {/* Player + Timeline */}
            <div className="bg-[#1a1a1c] border border-border rounded-xl overflow-hidden">
                {/* Controls bar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap gap-y-2">
                    <button
                        onClick={() => wavesurfer.current?.playPause()}
                        className="p-2 bg-primary rounded-full text-white hover:bg-primary/90 shrink-0"
                    >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <span className="text-sm font-mono text-white">{secondsToTs(currentTime)}</span>
                    <span className="text-gray-600 text-sm">/</span>
                    <span className="text-sm font-mono text-gray-400">{secondsToTs(duration)}</span>

                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-[#111] rounded-lg px-2 py-1.5 border border-border">
                        <button
                            onClick={fitZoom}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Ajustar à tela"
                        >
                            <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-4 bg-border mx-0.5" />
                        <button
                            onClick={() => setPxPerSec(v => Math.max(MIN_PX_PER_SEC, Math.round(v / 1.6)))}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Menos zoom"
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] text-gray-500 font-mono w-14 text-center select-none">
                            {pxPerSec < 10 ? pxPerSec.toFixed(1) : Math.round(pxPerSec)}px/s
                        </span>
                        <button
                            onClick={() => setPxPerSec(v => Math.min(MAX_PX_PER_SEC, Math.round(v * 1.6)))}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Mais zoom"
                        >
                            <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Global offset control */}
                    <div className="flex items-center gap-2 ml-auto bg-[#111] rounded-lg px-3 py-1.5 border border-border">
                        <span className="text-[11px] text-gray-400 shrink-0">Adiantar imagens:</span>
                        <button
                            onClick={() => setGlobalOffset(v => +(v - 0.5).toFixed(1))}
                            className="w-5 h-5 rounded bg-[#333] text-white text-xs hover:bg-[#555] flex items-center justify-center"
                        >−</button>
                        <span className="text-xs font-mono text-primary w-12 text-center">
                            {globalOffset > 0 ? '+' : ''}{globalOffset.toFixed(1)}s
                        </span>
                        <button
                            onClick={() => setGlobalOffset(v => +(v + 0.5).toFixed(1))}
                            className="w-5 h-5 rounded bg-[#333] text-white text-xs hover:bg-[#555] flex items-center justify-center"
                        >+</button>
                        <span className="text-[10px] text-gray-600 ml-1">
                            {globalOffset < 0 ? `${Math.abs(globalOffset)}s antes` : globalOffset > 0 ? `${globalOffset}s depois` : 'sem offset'}
                        </span>
                    </div>
                </div>

                {/* Scrollable timeline — padding is on a wrapper, NOT on the scroll element */}
                <div className="px-4 pt-3">
                    <div
                        ref={scrollRef}
                        className="overflow-x-auto"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#555 #1a1a1c' }}
                    >
                        {/*
                         * Inner content div — always exactly trackTotalPx wide.
                         * ALL positions below are in absolute pixels: time × pxPerSec.
                         * This matches WaveSurfer's cursor coordinate (currentTime × pxPerSec).
                         */}
                        <div
                            ref={innerRef}
                            style={{ width: trackTotalPx, position: 'relative' }}
                        >
                            {/*
                             * Waveform section: exactly waveformPx wide.
                             * The gray area to the right shows the extra scroll space.
                             * overflow:hidden prevents WaveSurfer's internal scrollbar.
                             */}
                            <div style={{ display: 'flex', height: WAVEFORM_HEIGHT }}>
                                <div
                                    ref={waveRef}
                                    style={{ width: waveformPx, flexShrink: 0, overflow: 'hidden' }}
                                />
                                {/* Gray tail beyond audio end */}
                                <div
                                    style={{
                                        flex: 1,
                                        background: 'repeating-linear-gradient(90deg,#222 0px,#222 1px,#1a1a1c 1px,#1a1a1c 24px)',
                                        borderLeft: '1px solid #444',
                                        opacity: 0.6,
                                    }}
                                />
                            </div>

                            {/* Ruler — spans full trackTotalPx */}
                            <div style={{ position: 'relative', height: RULER_HEIGHT }}>
                                {markers.map(t => (
                                    <div
                                        key={t}
                                        style={{
                                            position: 'absolute',
                                            left: Math.round(t * pxPerSec),
                                            top: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            transform: 'translateX(-50%)',
                                        }}
                                    >
                                        <div style={{ width: 1, height: 10, background: '#444' }} />
                                        <span style={{ fontSize: 9, color: '#666', whiteSpace: 'nowrap', marginTop: 1 }}>
                                            {secondsToTs(t)}
                                        </span>
                                    </div>
                                ))}
                                {/* Audio end marker */}
                                {duration > 0 && (
                                    <div
                                        style={{ position: 'absolute', left: waveformPx, top: 0, bottom: 0, width: 1, background: '#f97316', opacity: 0.5 }}
                                        title="Fim do áudio"
                                    />
                                )}
                            </div>

                            {/*
                             * Scene thumbnail track — overflow:hidden clips thumbnails
                             * Scene blocks use absolute pixel positioning: left = effectiveStart × pxPerSec
                             */}
                            <div
                                ref={trackRef}
                                style={{ position: 'relative', height: TRACK_HEIGHT, overflow: 'hidden', cursor: 'pointer' }}
                                className="rounded-lg select-none"
                                onClick={onTrackClick}
                            >
                                {/* Background for empty areas */}
                                <div className="absolute inset-0 bg-[#111]" />

                                {sceneDurations.map((dur, i) => {
                                    const leftPx = Math.round(effectiveStarts[i] * pxPerSec);
                                    const widthPx = Math.max(2, Math.round(dur * pxPerSec) - (i < scenes.length - 1 ? 1 : 0));
                                    const isActive = i === activeScene;
                                    const isLast = i === scenes.length - 1;
                                    const scene = scenes[i];

                                    return (
                                        <div
                                            key={i}
                                            className="absolute top-0 h-full overflow-hidden"
                                            style={{ left: leftPx, width: widthPx, zIndex: 1 }}
                                        >
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

                                            {isActive && (
                                                <div
                                                    className="absolute inset-0 pointer-events-none"
                                                    style={{ boxShadow: 'inset 0 0 0 2px hsl(var(--primary))' }}
                                                />
                                            )}
                                            {isActive && (
                                                <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
                                            )}

                                            {/* Scene number badge */}
                                            <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded pointer-events-none" style={{ zIndex: 5 }}>
                                                {i + 1}
                                            </div>

                                            {/* Left-edge drag handle — adjusts this scene's own start time */}
                                            <div
                                                onMouseDown={e => onLeftHandleMouseDown(e, i)}
                                                onClick={e => e.stopPropagation()}
                                                className="absolute top-0 left-0 w-3 h-full cursor-col-resize z-20 flex items-center justify-center group"
                                                title={`← Mover início — ${secondsToTs(effectiveStarts[i])}`}
                                            >
                                                <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-0.5 h-1 bg-white rounded-full" />
                                                    <div className="w-0.5 h-1 bg-white rounded-full" />
                                                    <div className="w-0.5 h-1 bg-white rounded-full" />
                                                </div>
                                            </div>

                                            {!isLast && (
                                                <div className="absolute top-0 right-0 w-px h-full bg-[#111] pointer-events-none" />
                                            )}

                                            {/* Right-edge drag handle — adjusts next scene's start time */}
                                            {!isLast && (
                                                <div
                                                    onMouseDown={e => onHandleMouseDown(e, i)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="absolute top-0 right-0 w-3 h-full cursor-col-resize z-20 flex items-center justify-center group"
                                                    title={`→ Mover próxima — ${secondsToTs(adjustedStarts[i + 1])}`}
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
                            </div>

                            {/*
                             * Playhead needle — absolute inside innerRef, full timeline height.
                             * left = currentTime × pxPerSec, which exactly matches WaveSurfer's
                             * cursor position (WaveSurfer also renders at pxPerSec px/sec after zoom()).
                             */}
                            {duration > 0 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: needlePx,
                                        top: 0,
                                        height: totalTimelineHeight,
                                        width: 12,
                                        transform: 'translateX(-50%)',
                                        zIndex: 30,
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: 'hsl(var(--primary))', transform: 'translateX(-50%)' }} />
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            background: 'hsl(var(--primary))',
                                            cursor: 'grab',
                                            pointerEvents: 'auto',
                                        }}
                                        onMouseDown={onNeedleMouseDown}
                                    />
                                    <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'hsl(var(--primary))' }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-gray-600 px-4 pb-2 mt-1 text-right">
                    Clique para buscar · Arraste a agulha · Scroll horizontal · Use +/− para zoom
                </p>
            </div>

            {/* Scene list + preview */}
            <div className="grid grid-cols-2 gap-4">
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
                                    <img src={scene.imageUrl} className={`object-cover rounded shrink-0 ${isShorts ? 'w-6 h-10' : 'w-12 h-8'}`} alt="" />
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
                    <div className={`border border-border rounded-xl overflow-hidden bg-[#111] flex items-center justify-center ${isShorts ? 'aspect-[9/16] max-w-[200px] mx-auto' : 'aspect-video'}`}>
                        {scenes[activeScene]?.imageUrl ? (
                            <img src={scenes[activeScene].imageUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <p className="text-gray-600 text-sm">Sem imagem</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(videoUrl)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
