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

export interface VideoPreviewRef {
    exportVideo: () => Promise<void>;
    cancelExport: () => void;
}

export const VideoPreview = React.forwardRef<VideoPreviewRef, VideoPreviewProps>(({
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
}, ref) => {
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
    const [isHighRes, setIsHighRes] = useState(false);

    // Export State
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const isExportingRef = useRef(false);
    const shouldSaveRef = useRef(true);

    // Expose Export Method
    React.useImperativeHandle(ref, () => ({
        cancelExport: () => {
            if (isExportingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                console.log('[VideoPreview] Cancelling Export...');
                shouldSaveRef.current = false;
                mediaRecorderRef.current.stop();
                onStop();
                isExportingRef.current = false;
            }
        },
        exportVideo: async () => {
            if (isExportingRef.current) return;

            return new Promise<void>(async (resolve, reject) => {
                // Switch to 4K Mode
                setIsHighRes(true);
                // Wait for Re-render
                await new Promise(r => setTimeout(r, 500));

                isExportingRef.current = true;
                shouldSaveRef.current = true;
                onStop(); // Reset to start
                onTimeUpdate(0);

                console.log('[VideoPreview] Starting Export...');

                // 1. Setup Audio Mixing
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioContextClass();
                const dest = ctx.createMediaStreamDestination();

                if (narrationRef.current) {
                    narrationRef.current.crossOrigin = "anonymous";
                    try {
                        const source = ctx.createMediaElementSource(narrationRef.current);
                        source.connect(dest);
                        source.connect(ctx.destination);
                    } catch (e) { console.warn("Audio export setup warning:", e); }
                }
                if (musicRef.current) {
                    musicRef.current.crossOrigin = "anonymous";
                    try {
                        const source = ctx.createMediaElementSource(musicRef.current);
                        const gain = ctx.createGain();
                        gain.gain.value = musicVolume;
                        source.connect(gain);
                        gain.connect(dest);
                        gain.connect(ctx.destination);
                    } catch (e) { console.warn("Music export setup warning:", e); }
                }

                // 2. Capture Canvas Stream
                const canvas = canvasRef.current;
                if (!canvas) {
                    isExportingRef.current = false;
                    reject(new Error("No canvas"));
                    return;
                }
                const canvasStream = canvas.captureStream(30); // 30 FPS

                // 3. Combine Streams
                const combinedTracks = [
                    ...canvasStream.getVideoTracks(),
                    ...dest.stream.getAudioTracks()
                ];
                const combinedStream = new MediaStream(combinedTracks);

                // 4. Init MediaRecorder - Try MP4 first, then WebM
                let mimeType = 'video/webm; codecs=vp9';
                if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
                    mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
                } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mimeType = 'video/mp4';
                }

                const recorder = new MediaRecorder(combinedStream, {
                    mimeType,
                    videoBitsPerSecond: 25000000 // 25 Mbps for 4K High Quality
                });

                recordedChunksRef.current = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) recordedChunksRef.current.push(e.data);
                };

                recorder.onstop = () => {
                    if (shouldSaveRef.current) {
                        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        // Use correct extension based on mimeType
                        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
                        a.download = `video_export_${Date.now()}.${extension}`;
                        a.click();
                        URL.revokeObjectURL(url);
                        console.log('[VideoPreview] Export Complete');
                    } else {
                        console.log('[VideoPreview] Export Cancelled - No file saved');
                    }

                    isExportingRef.current = false;
                    setIsHighRes(false); // Switch back to Preview Mode
                    ctx.close();
                    resolve(); // Resolve the promise here!
                };

                recorder.start();
                mediaRecorderRef.current = recorder;

                // 5. Play through video
                onPlayPause(); // Start Playing
            });
        }
    }));

    // Detect End of Video for Export
    useEffect(() => {
        if (currentTime >= totalDuration && isExportingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('[VideoPreview] Ending Export sequence...');
            // Add a buffer to ensure the last frames are captured especially at 4K
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    console.log('[VideoPreview] Stopping Recorder (with buffer)...');
                    mediaRecorderRef.current.stop();
                    onStop(); // Stop playback
                }
            }, 1000); // 1 second buffer
        }
    }, [currentTime, totalDuration]);


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
            return new Promise<{ id: string; img: HTMLImageElement | null }>((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // CRITICAL FOR EXPORT
                img.onload = () => resolve({ id: clip.id, img });
                img.onerror = () => {
                    console.error(`[VideoPreview] Failed to load image for clip ${clip.id}: ${clip.imageUrl}`);
                    resolve({ id: clip.id, img: null }); // Resolve with null instead of rejecting
                };
                img.src = clip.imageUrl!;
            });
        });

        Promise.all(imagePromises)
            .then(results => {
                const images: Record<string, HTMLImageElement> = {};
                results.forEach(({ id, img }) => {
                    if (img) {
                        images[id] = img;
                    }
                });
                setLoadedImages(images);
                console.log('[VideoPreview] Loaded', Object.keys(images).length, 'images. Failed:', results.length - Object.keys(images).length);
            });
    }, [clips]);

    // Render current frame
    const renderFrame = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Optimize drawing: Disable smoothing in preview for performance
        // Enable smoothing in export (High Res) for quality
        const isExporting = isExportingRef.current;
        ctx.imageSmoothingEnabled = isExporting;
        if (isExporting) {
            ctx.imageSmoothingQuality = 'high';
        }

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
                for (let i = 0; i < 20; i++) {
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
                const maxSpeed = 1.0;
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

                // Pulse alpha (twinkle)
                p.phase += 0.05;
                p.alpha = 0.5 + Math.sin(p.phase) * 0.4;

                // Rendering "Firefly/Magic Light" Effect
                ctx.save();
                ctx.globalCompositeOperation = 'screen'; // Additive blending for glow
                ctx.globalAlpha = Math.max(0, p.alpha);

                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // White core (intense heat/light)
                gradient.addColorStop(0.1, 'rgba(255, 230, 100, 0.9)'); // Bright warm yellow
                gradient.addColorStop(0.4, 'rgba(255, 180, 0, 0.4)'); // Golden orange glow
                gradient.addColorStop(1, 'rgba(255, 140, 0, 0)'); // Fade to transparent

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            });
            ctx.restore();
        }

        // Render Logo Overlay (from logo-track) - Supports multiple layers
        const currentLogos = clips.filter(
            c => c.trackId === 'logo-track' && time >= c.startTime && time < c.startTime + c.duration
        );

        currentLogos.forEach(logoClip => {
            if (loadedImages[logoClip.id]) {
                const img = loadedImages[logoClip.id];

                // Position: Bottom Right (Updated per reference)
                const logoHeight = canvas.height * 0.15; // 15% height
                const logoWidth = (img.width / img.height) * logoHeight;
                const padding = canvas.width * 0.02;

                const x = canvas.width - logoWidth - padding;
                const y = canvas.height - logoHeight - padding;

                ctx.save();
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.shadowBlur = 4;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(img, x, y, logoWidth, logoHeight);
                ctx.restore();
            }
        });

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
        let lastRenderTime = 0;
        const TARGET_FPS = 30;
        const FRAME_INTERVAL = 1000 / TARGET_FPS;

        lastTimeRef.current = performance.now();

        const animate = (now: number) => {
            const delta = (now - lastTimeRef.current) / 1000;
            // Updating time ref must be smooth for physics/time calculation, so we update it every RAF
            lastTimeRef.current = now;

            // Only update if playing
            if (isPlayingRef.current) {
                let newTime = currentTimeRef.current + delta;

                // Prevent micro-backtracking
                if (newTime < currentTimeRef.current) newTime = currentTimeRef.current;

                currentTimeRef.current = newTime;

                if (newTime >= totalDuration) {
                    newTime = totalDuration;
                    currentTimeRef.current = newTime;
                    onStop();
                    onTimeUpdate(newTime);
                } else {
                    // THROTTLE RENDERING to 30 FPS
                    if (now - lastRenderTime >= FRAME_INTERVAL) {
                        renderFrame(newTime);
                        lastRenderTime = now;
                    }

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
                // Important: Audio Elements for Export must be connected to context
                // BUT browsers limit MediaElementSource to ONE context.
                // If we use simple <audio>, we need to be careful.
                // For Export, we recreate context.
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
                    width={isHighRes ? 3840 : 1280}
                    height={isHighRes ? 2160 : 720}
                    className="max-w-full max-h-full"
                    style={{ aspectRatio: '16/9' }}
                />
                {/* Independent Audio Elements */}
                <audio ref={narrationRef} muted={muted} crossOrigin="anonymous" />
                <audio ref={musicRef} muted={muted} crossOrigin="anonymous" />
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
});
