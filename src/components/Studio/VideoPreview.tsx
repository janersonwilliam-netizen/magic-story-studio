import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX } from 'lucide-react';
import type { TimelineClip } from '../../types/studio';

interface VideoPreviewProps {
    clips: TimelineClip[];
    currentTime: number;
    totalDuration: number;
    isPlaying: boolean;
    onTimeUpdate: (time: number) => void;
    onPlayPause: () => void;
    onStop: () => void;
}

export function VideoPreview({
    clips,
    currentTime,
    totalDuration,
    isPlaying,
    onTimeUpdate,
    onPlayPause,
    onStop
}: VideoPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const animationFrameRef = useRef<number>();
    const [muted, setMuted] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

    // Preload all images
    useEffect(() => {
        const videoClips = clips.filter(c => c.type === 'video' && c.imageUrl);
        const imagePromises = videoClips.map(clip => {
            return new Promise<{ id: string; img: HTMLImageElement }>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve({ id: clip.id, img });
                img.onerror = reject;
                img.src = clip.imageUrl!;
            });
        });

        Promise.all(imagePromises)
            .then(results => {
                const images: Record<string, HTMLImageElement> = {};
                results.forEach(({ id, img }) => {
                    images[id] = img;
                });
                setLoadedImages(images);
                console.log('[VideoPreview] Loaded', results.length, 'images');
            })
            .catch(err => {
                console.error('[VideoPreview] Error loading images:', err);
            });
    }, [clips]);

    // Render current frame
    const renderFrame = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Find current video clip
        const currentVideoClip = clips.find(
            c => c.type === 'video' && time >= c.startTime && time < c.startTime + c.duration
        );

        if (currentVideoClip && loadedImages[currentVideoClip.id]) {
            const img = loadedImages[currentVideoClip.id];

            // Draw image centered and scaled to fit
            const scale = Math.min(
                canvas.width / img.width,
                canvas.height / img.height
            );
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;

            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        }

        // Find current caption clip
        const currentCaptionClip = clips.find(
            c => c.type === 'caption' && time >= c.startTime && time < c.startTime + c.duration
        );

        if (currentCaptionClip && currentCaptionClip.text) {
            // Draw caption at bottom
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '20px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Word wrap caption
            const words = currentCaptionClip.text.split(' ');
            const lines: string[] = [];
            let currentLine = '';

            words.forEach(word => {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > canvas.width - 40 && currentLine !== '') {
                    lines.push(currentLine);
                    currentLine = word + ' ';
                } else {
                    currentLine = testLine;
                }
            });
            lines.push(currentLine);

            // Draw lines
            lines.forEach((line, i) => {
                ctx.fillText(line, canvas.width / 2, canvas.height - 80 + i * 25);
            });
        }

        // Draw timecode
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 120, 30);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatTime(time), 20, 30);

    }, [clips, loadedImages]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            renderFrame(currentTime);
            return;
        }

        let lastTime = performance.now();
        const animate = (now: number) => {
            const delta = (now - lastTime) / 1000; // Convert to seconds
            lastTime = now;

            const newTime = Math.min(currentTime + delta, totalDuration);
            onTimeUpdate(newTime);
            renderFrame(newTime);

            if (newTime < totalDuration) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                onStop();
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, currentTime, totalDuration, renderFrame, onTimeUpdate, onStop]);

    // Sync audio - WORKING VERSION
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Find current audio clip
        const currentAudioClip = clips.find(
            c => c.type === 'audio' &&
                currentTime >= c.startTime &&
                currentTime < (c.startTime + c.duration)
        );

        const handleAudioPlay = () => {
            console.log('[VideoPreview] Audio started playing');
        };

        const handleAudioError = (e: Event) => {
            console.error('[VideoPreview] Audio error:', e);
        };

        audio.addEventListener('play', handleAudioPlay);
        audio.addEventListener('error', handleAudioError);

        if (currentAudioClip?.audioUrl) {
            // Load new audio source
            if (audio.src !== currentAudioClip.audioUrl) {
                console.log('[VideoPreview] Loading new audio:', currentAudioClip.audioUrl);
                audio.src = currentAudioClip.audioUrl;
                audio.load();
            }

            const relativeTime = currentTime - currentAudioClip.startTime;

            if (isPlaying) {
                // Set time and play
                audio.currentTime = relativeTime;
                audio.muted = muted;

                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('[VideoPreview] Audio playing successfully');
                        })
                        .catch(err => {
                            console.error('[VideoPreview] Play failed:', err);
                            // Try unmuting if autoplay was blocked
                            if (err.name === 'NotAllowedError') {
                                console.log('[VideoPreview] Autoplay blocked, trying unmuted...');
                                audio.muted = false;
                            }
                        });
                }
            } else {
                audio.pause();
            }
        } else {
            audio.pause();
        }

        return () => {
            audio.removeEventListener('play', handleAudioPlay);
            audio.removeEventListener('error', handleAudioError);
        };
    }, [currentTime, isPlaying, clips, muted]);

    // Handle seek
    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * totalDuration;
        onTimeUpdate(newTime);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col">
            {/* Video Canvas Container - Clean, no overlay */}
            <div className="flex-1 relative bg-black rounded-t-lg overflow-hidden flex items-center justify-center min-h-0">
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    className="max-w-full max-h-full"
                    style={{ aspectRatio: '16/9' }}
                />
                <audio ref={audioRef} muted={muted} />
            </div>

            {/* Control Bar - Professional Editor Style */}
            <div className="flex-shrink-0 bg-gray-900 rounded-b-lg px-4 py-3 space-y-2">
                {/* Progress bar */}
                <div
                    className="h-1 bg-gray-700 rounded-full cursor-pointer hover:h-1.5 transition-all group"
                    onClick={handleSeek}
                >
                    <div
                        className="h-full bg-red-500 rounded-full transition-all relative"
                        style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between">
                    {/* Left - Time */}
                    <div className="text-xs text-gray-400 font-mono w-24">
                        {formatTime(currentTime)} / {formatTime(totalDuration)}
                    </div>

                    {/* Center - Play Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onStop}
                            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                            title="Stop"
                        >
                            <Square className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button
                            onClick={onPlayPause}
                            className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-lg"
                            title={isPlaying ? "Pause" : "Play"}
                        >
                            {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                        </button>
                        <button
                            onClick={() => setMuted(!muted)}
                            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                            title={muted ? "Unmute" : "Mute"}
                        >
                            {muted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                        </button>
                    </div>

                    {/* Right - Scene count */}
                    <div className="text-xs text-gray-500 w-24 text-right">
                        {clips.filter(c => c.type === 'video').length} cenas
                    </div>
                </div>
            </div>
        </div>
    );
}
