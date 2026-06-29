/**
 * WaveformPlayer — player de áudio customizado com visualização em ondas (waveform).
 *
 * - Decodifica o áudio com a Web Audio API para desenhar as barras (sem libs externas).
 * - A parte já tocada fica na cor primária (laranja); o resto translúcido.
 * - Clique nas ondas para avançar/retroceder.
 * - Funciona com data URLs (áudio gerado em base64) e URLs normais.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

interface WaveformPlayerProps {
    src: string;
    /** Altura das ondas em px (padrão 64). */
    height?: number;
    className?: string;
    /** Cor das barras já reproduzidas (padrão: --primary do tema). */
    playedColor?: string;
    /** Cor das barras não reproduzidas (padrão: branco translúcido p/ tema escuro). */
    unplayedColor?: string;
    /** Classes do botão play/pause (padrão: cores do tema). */
    buttonClassName?: string;
    /** Classes do texto de tempo (padrão: muted-foreground). */
    timeClassName?: string;
}

/**
 * AudioContext único e compartilhado para decodificar áudio.
 * Evita estourar o limite de AudioContexts do navegador (~6) quando há vários
 * players na tela (ex.: lista de cenas).
 */
let sharedDecodeCtx: AudioContext | null = null;
function getDecodeContext(): AudioContext {
    if (!sharedDecodeCtx) {
        const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        sharedDecodeCtx = new AC();
    }
    return sharedDecodeCtx;
}

/** Lê uma variável HSL do tema (ex.: "15 95% 60%") e devolve um hsl() válido p/ canvas. */
function cssVarColor(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? `hsl(${v})` : fallback;
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Reduz o áudio decodificado a `buckets` picos normalizados (0..1). */
function computePeaks(buffer: AudioBuffer, buckets: number): number[] {
    const channel = buffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / buckets));
    const peaks = new Array<number>(buckets).fill(0);

    for (let b = 0; b < buckets; b++) {
        const start = b * blockSize;
        const end = Math.min(channel.length, start + blockSize);
        let max = 0;
        for (let i = start; i < end; i++) {
            const a = Math.abs(channel[i]);
            if (a > max) max = a;
        }
        peaks[b] = max;
    }

    // Normaliza pelo pico global e aplica leve compressão p/ partes baixas aparecerem.
    const globalMax = peaks.reduce((m, p) => (p > m ? p : m), 0) || 1;
    return peaks.map(p => Math.pow(p / globalMax, 0.8));
}

export function WaveformPlayer({
    src,
    height = 64,
    className = '',
    playedColor,
    unplayedColor = 'rgba(255, 255, 255, 0.20)',
    buttonClassName = 'bg-primary text-primary-foreground hover:bg-primary/90',
    timeClassName = 'text-muted-foreground',
}: WaveformPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const peaksRef = useRef<number[] | null>(null);
    const rafRef = useRef<number | null>(null);

    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // --- Desenho das ondas no canvas ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const peaks = peaksRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        if (cssW === 0 || cssH === 0) return;

        if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
            canvas.width = cssW * dpr;
            canvas.height = cssH * dpr;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const played = playedColor || cssVarColor('--primary', 'hsl(15 95% 60%)');
        const unplayed = unplayedColor;

        const barW = 3;
        const gap = 2;
        const step = barW + gap;
        const bars = Math.max(1, Math.floor(cssW / step));
        const mid = cssH / 2;

        const audio = audioRef.current;
        const dur = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
        const cur = audio?.currentTime ?? 0;
        const progress = dur > 0 ? cur / dur : 0;

        for (let i = 0; i < bars; i++) {
            // Amostra os picos pré-calculados na posição da barra.
            let amp = 0.04;
            if (peaks && peaks.length > 0) {
                const idx = Math.floor((i / bars) * peaks.length);
                amp = peaks[Math.min(peaks.length - 1, idx)];
            }
            const h = Math.max(2, amp * (cssH - 4));
            const x = i * step;
            const y = mid - h / 2;

            ctx.fillStyle = i / bars <= progress ? played : unplayed;
            const r = Math.min(barW / 2, h / 2);
            // Barra arredondada
            ctx.beginPath();
            ctx.moveTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.arcTo(x + barW, y, x + barW, y + r, r);
            ctx.lineTo(x + barW, y + h - r);
            ctx.arcTo(x + barW, y + h, x + barW - r, y + h, r);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.closePath();
            ctx.fill();
        }
    }, [playedColor, unplayedColor]);

    // --- Decodifica o áudio e calcula os picos quando a src muda ---
    useEffect(() => {
        if (!src) return;
        let cancelled = false;
        setLoading(true);
        peaksRef.current = null;

        (async () => {
            try {
                const res = await fetch(src);
                const arrayBuffer = await res.arrayBuffer();
                const audioBuffer = await getDecodeContext().decodeAudioData(arrayBuffer);
                if (cancelled) return;
                peaksRef.current = computePeaks(audioBuffer, 600);
            } catch (err) {
                console.warn('[WaveformPlayer] Falha ao decodificar áudio p/ waveform:', err);
                peaksRef.current = [];
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    draw();
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [src, draw]);

    // --- Loop de animação durante a reprodução ---
    useEffect(() => {
        const tick = () => {
            const audio = audioRef.current;
            if (audio) setCurrentTime(audio.currentTime);
            draw();
            rafRef.current = requestAnimationFrame(tick);
        };
        if (isPlaying) {
            rafRef.current = requestAnimationFrame(tick);
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying, draw]);

    // --- Redesenha ao redimensionar ---
    useEffect(() => {
        const ro = new ResizeObserver(() => draw());
        if (canvasRef.current) ro.observe(canvasRef.current);
        return () => ro.disconnect();
    }, [draw]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) audio.play();
        else audio.pause();
    };

    const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const audio = audioRef.current;
        const canvas = canvasRef.current;
        if (!audio || !canvas || !audio.duration) return;
        const rect = canvas.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = frac * audio.duration;
        setCurrentTime(audio.currentTime);
        draw();
    };

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={e => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            />

            <button
                type="button"
                onClick={togglePlay}
                disabled={loading}
                className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-md ${buttonClassName}`}
                aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                    <Pause className="w-5 h-5" />
                ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                )}
            </button>

            <div className="flex-1 min-w-0">
                <canvas
                    ref={canvasRef}
                    onClick={seek}
                    className="w-full cursor-pointer"
                    style={{ height }}
                />
            </div>

            <div className={`flex-shrink-0 text-xs font-mono tabular-nums w-[88px] text-right ${timeClassName}`}>
                {formatTime(currentTime)} / {formatTime(duration)}
            </div>
        </div>
    );
}
