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
        <div className="space-y-4">
            {/* Canvas - 60% of full width (40% reduction) */}
            <div className="relative bg-black rounded-lg overflow-hidden w-full" style={{ maxWidth: '60%', margin: '0 auto' }}>
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    className="w-full h-auto"
                    style={{ aspectRatio: '16/9' }}
                />

                {/* Hidden audio element */}
                <audio
                    ref={audioRef}
                    muted={muted}
                />
            </div>

            {/* Controls */}
            <div className="space-y-3">
                {/* Progress bar */}
                <div
                    className="h-2 bg-gray-200 rounded-full cursor-pointer hover:h-3 transition-all"
                    onClick={handleSeek}
                >
                    <div
                        className="h-full bg-[#FF0000] rounded-full transition-all"
                        style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                    />
                </div>

                {/* Control buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onPlayPause}
                            className="p-3 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            {isPlaying ? (
                                <Pause className="w-5 h-5" />
                            ) : (
                                <Play className="w-5 h-5" />
                            )}
                        </button>

                        <button
                            onClick={onStop}
                            className="p-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            <Square className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setMuted(!muted)}
                            className="p-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            {muted ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>

                        <span className="text-sm text-gray-600 ml-2">
                            {formatTime(currentTime)} / {formatTime(totalDuration)}
                        </span>
                    </div>

                    <div className="text-sm text-gray-500">
                        {clips.filter(c => c.type === 'video').length} cenas
                    </div>
                </div>
            </div>
        </div>
    );
}
