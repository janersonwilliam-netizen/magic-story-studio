import React, { useRef, useEffect, useState, useCallback } from 'react';
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
    hideControls?: boolean;
    compact?: boolean;
    showCaptions?: boolean;
    captionStyle?: {
        fontSize: number;
        color: string;
        showBackground: boolean;
        backgroundColor?: string;
    };
    musicVolume?: number;
    transitionType?: string;
    visualEffect?: string;
    effectDuration?: number;
    showSparkles?: boolean;
}

export function VideoPreview({
    clips,
    currentTime,
    totalDuration,
    isPlaying,
    onTimeUpdate,
    onPlayPause,
    onStop,
    hideControls = false,
    compact = false,
    showCaptions = false,
    captionStyle = { fontSize: 24, color: '#ffffff', showBackground: true, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
    musicVolume = 0.2, // Default 20%
    transitionType = 'none',
    visualEffect = 'none',
    effectDuration = 3,
    showSparkles = true
}: VideoPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const narrationRef = useRef<HTMLAudioElement>(null);
    const musicRef = useRef<HTMLAudioElement>(null);
    const sparklesRef = useRef<{ x: number, y: number, vx: number, vy: number, size: number, alpha: number, phase: number }[]>([]);

    // Refs for animation loop state to avoid re-renders impacting logic
    const currentTimeRef = useRef(currentTime);
    const isPlayingRef = useRef(isPlaying);
    const lastTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();

    const [muted, setMuted] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

    // Sync refs with props - Only sync time if not playing or if deviation is large (seek)
    useEffect(() => {
        if (!isPlaying || Math.abs(currentTime - currentTimeRef.current) > 0.5) {
            currentTimeRef.current = currentTime;
        }
    }, [currentTime, isPlaying]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Preload all images
    useEffect(() => {
        const videoClips = clips.filter(c => (c.type === 'video' || c.trackId === 'logo-track') && c.imageUrl);
        const imagePromises = videoClips.map(clip => {
            return new Promise<{ id: string; img: HTMLImageElement }>((resolve, reject) => {
                const img = new Image();
                // img.crossOrigin = 'anonymous'; // Removed to avoid blob/local load errors
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

            ctx.save();

            // Apply Ken Burns Effect
            if (visualEffect === 'ken-burns') {
                const elapsed = time - currentVideoClip.startTime;
                // Progress from 0 to 1 over effectDuration, clamped
                const progress = Math.min(elapsed / effectDuration, 1);
                // Zoom from 1.0 to 1.1 (10% zoom)
                const zoomFactor = 1 + (progress * 0.1);

                // Translate to center, scale, translate back
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }

            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            ctx.restore();

            // Handle Transitions (Render Next Clip if overlapping)
            const TRANSITION_DURATION = 1.0;
            const timeLeft = currentVideoClip.startTime + currentVideoClip.duration - time;

            if (timeLeft < TRANSITION_DURATION && transitionType !== 'none') {
                const nextClip = clips.find(c =>
                    c.type === 'video' &&
                    Math.abs(c.startTime - (currentVideoClip.startTime + currentVideoClip.duration)) < 0.1
                );

                if (nextClip && loadedImages[nextClip.id]) {
                    const nextImg = loadedImages[nextClip.id];
                    const progress = 1 - (timeLeft / TRANSITION_DURATION); // 0 to 1

                    ctx.save();

                    // Setup Next Clip Draw Stats (standard fit)
                    const nextScale = Math.min(canvas.width / nextImg.width, canvas.height / nextImg.height);
                    const nextX = (canvas.width - nextImg.width * nextScale) / 2;
                    const nextY = (canvas.height - nextImg.height * nextScale) / 2;

                    if (transitionType === 'fade') {
                        ctx.globalAlpha = progress;
                        ctx.drawImage(nextImg, nextX, nextY, nextImg.width * nextScale, nextImg.height * nextScale);
                    } else if (transitionType === 'slide-left') {
                        const offsetX = canvas.width * (1 - progress);
                        ctx.drawImage(nextImg, nextX + offsetX, nextY, nextImg.width * nextScale, nextImg.height * nextScale);
                    } else if (transitionType === 'slide-right') {
                        const offsetX = -canvas.width * (1 - progress);
                        ctx.drawImage(nextImg, nextX + offsetX, nextY, nextImg.width * nextScale, nextImg.height * nextScale);

                    } else if (transitionType === 'page-turn') {
                        // "White Page Peel" Effect (Folha virando)
                        const peelX = canvas.width * (1 - progress);

                        // 1. Draw Next Image (Background) full
                        ctx.drawImage(nextImg, nextX, nextY, nextImg.width * nextScale, nextImg.height * nextScale);

                        // 2. Draw Current Image (Top Layer) - Clipped left of peel
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(0, 0, peelX, canvas.height);
                        ctx.clip();
                        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                        ctx.restore();

                        // 3. Draw The "White Back of Page" (The Curl)
                        const curlWidth = canvas.width * 0.15; // Width of the white strip

                        // Shadow falling on the Next Image (Release shadow)
                        const shadowGradient = ctx.createLinearGradient(peelX, 0, peelX + canvas.width * 0.05, 0);
                        shadowGradient.addColorStop(0, 'rgba(0,0,0,0.4)');
                        shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
                        ctx.fillStyle = shadowGradient;
                        ctx.fillRect(peelX, 0, canvas.width * 0.05, canvas.height);

                        // The White Page itself (gradient to look like curved paper)
                        const pageGradient = ctx.createLinearGradient(peelX, 0, peelX + curlWidth, 0);
                        pageGradient.addColorStop(0, '#cccccc'); // Fold/Crease darker
                        pageGradient.addColorStop(0.3, '#ffffff'); // Paper White
                        pageGradient.addColorStop(1, '#e0e0e0'); // Edge

                        ctx.fillStyle = pageGradient;
                        ctx.fillRect(peelX, 0, curlWidth * (1 - progress * 0.5), canvas.height);
                    }


                    ctx.restore();
                }
            }
        }

        // Render Sparkles Overlay
        if (showSparkles) {
            ctx.save();
            ctx.shadowColor = '#FFD700'; // Gold/Bright Yellow Glow
            ctx.shadowBlur = 8;
            ctx.fillStyle = 'rgba(255, 223, 0, 0.9)'; // Bright Yellow Particles

            // Initialize if empty
            if (sparklesRef.current.length === 0) {
                for (let i = 0; i < 40; i++) {
                    sparklesRef.current.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        vx: (Math.random() - 0.5) * 1.5, // Random X velocity
                        vy: (Math.random() - 0.5) * 1.5, // Random Y velocity
                        size: Math.random() * 6 + 3,
                        alpha: Math.random(),
                        phase: Math.random() * Math.PI * 2
                    });
                }
            }

            // Update and Draw
            sparklesRef.current.forEach((p, index) => {
                // Move freely
                p.x += p.vx;
                p.y += p.vy;

                // Add slight wandering (change direction slowly)
                p.vx += (Math.random() - 0.5) * 0.05;
                p.vy += (Math.random() - 0.5) * 0.05;

                // Clamp max speed
                const maxSpeed = 1.0; // Fast fireflies
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > maxSpeed) {
                    p.vx = (p.vx / speed) * maxSpeed;
                    p.vy = (p.vy / speed) * maxSpeed;
                }

                // Wrap around edges
                if (p.x < -20) p.x = canvas.width + 20;
                if (p.x > canvas.width + 20) p.x = -20;
                if (p.y < -20) p.y = canvas.height + 20;
                if (p.y > canvas.height + 20) p.y = -20;

                // Pulse alpha (twinkle) instead of fading out
                p.phase += 0.05;
                p.alpha = 0.5 + Math.sin(p.phase) * 0.4; // 0.1 to 0.9 range


                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.beginPath();
                // Add magical glow
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(255, 215, 0, 0.8)'; // Gold Glow
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });
            ctx.restore();
        }

        // Render Logo Overlay (from logo-track)
        const logoClip = clips.find(
            c => c.trackId === 'logo-track' && time >= c.startTime && time < c.startTime + c.duration
        );

        if (logoClip && loadedImages[logoClip.id]) {
            const img = loadedImages[logoClip.id];

            // Position: Bottom Right (Updated per reference)
            const logoHeight = canvas.height * 0.18; // Larger logo (~18%)
            const logoWidth = (img.width / img.height) * logoHeight;
            const padding = canvas.width * 0.02; // Tighter padding

            const x = canvas.width - logoWidth - padding;
            const y = canvas.height - logoHeight - padding; // Align to bottom right corner

            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 4;
            ctx.drawImage(img, x, y, logoWidth, logoHeight);
            ctx.restore();
        }

        // Find current caption clip
        const currentCaptionClip = clips.find(
            c => c.type === 'caption' && time >= c.startTime && time < c.startTime + c.duration
        );

        if (showCaptions && currentCaptionClip && currentCaptionClip.text) {
            ctx.save();

            // Configure Font
            ctx.font = `bold ${captionStyle.fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Word Wrap
            const words = currentCaptionClip.text.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            // Calculate line height based on font size
            const lineHeight = captionStyle.fontSize * 1.25;

            words.forEach(word => {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > canvas.width * 0.9 && currentLine !== '') {
                    lines.push(currentLine);
                    currentLine = word + ' ';
                } else {
                    currentLine = testLine;
                }
            });
            lines.push(currentLine);

            const totalTextHeight = lines.length * lineHeight;
            const startY = canvas.height - totalTextHeight - 50; // Bottom padding

            // Draw Background Box if enabled
            if (captionStyle.showBackground) {
                ctx.fillStyle = captionStyle.backgroundColor || 'rgba(0, 0, 0, 0.6)';
                // Draw full width bar
                const boxHeight = totalTextHeight + 40;
                ctx.fillRect(0, startY - 20, canvas.width, boxHeight);
            }

            // Draw Text
            ctx.fillStyle = captionStyle.color;
            // Shadow for readability if no background
            if (!captionStyle.showBackground) {
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }

            lines.forEach((line, i) => {
                ctx.fillText(line, canvas.width / 2, startY + i * lineHeight + lineHeight / 2);
            });

            ctx.restore();
        }
    }, [clips, loadedImages, showCaptions, captionStyle, visualEffect, effectDuration, transitionType, showSparkles]);

    // Optimized Animation Loop
    useEffect(() => {
        if (!isPlaying) {
            renderFrame(currentTime);
            return;
        }

        let animationFrameId: number;
        let lastReportTime = 0;
        lastTimeRef.current = performance.now();

        const animate = (now: number) => {
            const delta = (now - lastTimeRef.current) / 1000;
            lastTimeRef.current = now;

            // Only update if playing
            if (isPlayingRef.current) {
                let newTime = currentTimeRef.current + delta;

                // Prevent micro-backtracking if delta is weird, but trust delta mostly
                if (newTime < currentTimeRef.current) newTime = currentTimeRef.current;

                currentTimeRef.current = newTime;

                if (newTime >= totalDuration) {
                    newTime = totalDuration;
                    currentTimeRef.current = newTime;
                    onStop();
                    onTimeUpdate(newTime); // Force final update
                } else {
                    renderFrame(newTime);

                    // Throttle React State Updates to ~10fps (100ms)
                    if (now - lastReportTime > 100) {
                        onTimeUpdate(newTime);
                        lastReportTime = now;
                    }

                    animationFrameId = requestAnimationFrame(animate);
                }
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, totalDuration]); // Minimized dependencies

    // Helper to sync specific audio track
    const syncAudioTrack = (
        audioEl: HTMLAudioElement | null,
        trackId: string,
        volume: number = 1.0,
        typeFilter: string | null = null
    ) => {
        if (!audioEl) return;

        // Find active clip for this track at current time
        const activeClip = clips.find(c => {
            const matchesTrack = c.trackId === trackId;
            // Also match if legacy assignment (track 2 = narration)
            // But now we use string IDs.
            // Fallback: if trackId is null but type matches filters?
            // Assuming tracks are correctly set by TimelinePage
            const matchesType = typeFilter ? c.type === typeFilter : true;

            return matchesTrack && matchesType &&
                currentTime >= c.startTime && currentTime < (c.startTime + c.duration);
        });

        // Set volume
        audioEl.volume = volume;

        if (activeClip && activeClip.audioUrl) {
            // Load if source changed (check src to avoid reload)
            const clipUrl = new URL(activeClip.audioUrl, window.location.href).href;
            if (audioEl.src !== clipUrl) {
                audioEl.src = clipUrl;
                audioEl.load();
            }

            // Sync Time
            const relativeTime = currentTime - activeClip.startTime;
            // Sync only if drifted > 0.2s or if just started
            if (Math.abs(audioEl.currentTime - relativeTime) > 0.2) {
                audioEl.currentTime = relativeTime;
            }

            // Play if needed
            if (isPlaying && audioEl.paused) {
                audioEl.muted = muted;
                audioEl.play().catch(e => {
                    // Ignore auto-play errors, will retry
                });
            } else if (!isPlaying && !audioEl.paused) {
                audioEl.pause();
            }
        } else {
            // No active clip, pause
            if (!audioEl.paused) {
                audioEl.pause();
                // Optional: valid to reset currentTime?
            }
        }
    };

    // Audio Sync Effect - Runs on every time update
    useEffect(() => {
        // Sync Narration (audio-track)
        syncAudioTrack(narrationRef.current, 'audio-track', 1.0, 'audio');

        // Sync Music (music-track) - Use prop volume
        syncAudioTrack(musicRef.current, 'music-track', musicVolume, 'audio');

    }, [currentTime, isPlaying, muted, clips, musicVolume]);

    // Handle seek
    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * totalDuration;
        onTimeUpdate(newTime);
        renderFrame(newTime); // Immediate render
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col">
            {/* Video Canvas Container */}
            <div className={`flex-1 relative bg-black ${hideControls ? 'rounded-lg' : 'rounded-t-lg'} overflow-hidden flex items-center justify-center min-h-0`}>
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    className="max-w-full max-h-full"
                    style={{ aspectRatio: '16/9' }}
                />
                {/* Independent Audio Elements */}
                <audio ref={narrationRef} muted={muted} />
                <audio ref={musicRef} muted={muted} />
            </div>

            {/* Control Bar - Only show if not hidden */}
            {!hideControls && (
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
            )}
        </div>
    );
}
