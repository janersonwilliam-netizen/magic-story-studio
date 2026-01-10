import { useRef, useEffect, useState } from 'react';
import type { TimelineClip } from '../../types/studio';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface TimelineProps {
    clips: TimelineClip[];
    currentTime: number;
    totalDuration: number;
    onTimeUpdate: (time: number) => void;
    selectedClipId?: string | null;
    onClipSelect?: (clipId: string) => void;
}

const TRACK_HEIGHT = 50; // Slightly smaller
const TRACK_PADDING = 8;
const TIMELINE_HEIGHT = (TRACK_HEIGHT + TRACK_PADDING) * 4 + 50; // 4 tracks + ruler
const MIN_PIXELS_PER_SECOND = 10; // More zoom out
const MAX_PIXELS_PER_SECOND = 300; // More zoom in

export function Timeline({
    clips,
    currentTime,
    totalDuration,
    onTimeUpdate,
    selectedClipId,
    onClipSelect
}: TimelineProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(50); // pixels per second
    const [scrollLeft, setScrollLeft] = useState(0);

    const timelineWidth = Math.max(totalDuration * zoom, 800);

    // Render timeline
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw time ruler
        drawTimeRuler(ctx);

        // Draw tracks
        drawTrack(ctx, 0, 'Caption', '#9333EA'); // Purple
        drawTrack(ctx, 1, 'Video', '#3B82F6'); // Blue
        drawTrack(ctx, 2, 'Sound', '#10B981'); // Green
        drawTrack(ctx, 3, 'Music', '#F59E0B'); // Amber

        // Draw clips
        clips.forEach(clip => {
            drawClip(ctx, clip);
        });

        // Draw playhead
        drawPlayhead(ctx);

    }, [clips, currentTime, zoom, timelineWidth]);

    const drawTimeRuler = (ctx: CanvasRenderingContext2D) => {
        const rulerHeight = 40;

        // Background
        ctx.fillStyle = '#F3F4F6';
        ctx.fillRect(0, 0, timelineWidth, rulerHeight);

        // Time markers
        ctx.fillStyle = '#6B7280';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';

        const interval = zoom < 50 ? 5 : zoom < 100 ? 2 : 1; // seconds
        for (let t = 0; t <= totalDuration; t += interval) {
            const x = t * zoom;

            // Draw tick
            ctx.strokeStyle = '#9CA3AF';
            ctx.beginPath();
            ctx.moveTo(x, rulerHeight - 10);
            ctx.lineTo(x, rulerHeight);
            ctx.stroke();

            // Draw time label
            const mins = Math.floor(t / 60);
            const secs = Math.floor(t % 60);
            const label = `${mins}:${secs.toString().padStart(2, '0')}`;
            ctx.fillText(label, x, 20);
        }
    };

    const drawTrack = (ctx: CanvasRenderingContext2D, trackIndex: number, label: string, color: string) => {
        const y = 40 + trackIndex * (TRACK_HEIGHT + TRACK_PADDING);

        // Track background
        ctx.fillStyle = trackIndex % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
        ctx.fillRect(0, y, timelineWidth, TRACK_HEIGHT);

        // Track border
        ctx.strokeStyle = '#E5E7EB';
        ctx.strokeRect(0, y, timelineWidth, TRACK_HEIGHT);

        // Track label
        ctx.fillStyle = color;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, 10, y + 20);
    };

    const drawClip = (ctx: CanvasRenderingContext2D, clip: TimelineClip) => {
        const x = clip.startTime * zoom;
        const width = clip.duration * zoom;
        const y = 40 + clip.track * (TRACK_HEIGHT + TRACK_PADDING) + 5;
        const height = TRACK_HEIGHT - 10;

        // Clip colors by type
        const colors: Record<string, { bg: string; border: string; text: string }> = {
            caption: { bg: '#A855F7', border: '#7C3AED', text: '#FFFFFF' },
            video: { bg: '#60A5FA', border: '#3B82F6', text: '#FFFFFF' },
            audio: { bg: '#34D399', border: '#10B981', text: '#FFFFFF' },
            music: { bg: '#FBBF24', border: '#F59E0B', text: '#000000' }
        };

        const color = colors[clip.type] || colors.video;

        // Clip background
        ctx.fillStyle = selectedClipId === clip.id ? color.border : color.bg;
        ctx.fillRect(x, y, width, height);

        // Clip border
        ctx.strokeStyle = color.border;
        ctx.lineWidth = selectedClipId === clip.id ? 3 : 1;
        ctx.strokeRect(x, y, width, height);

        // Clip label
        ctx.fillStyle = color.text;
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';

        const label = clip.text ?
            clip.text.substring(0, 30) + (clip.text.length > 30 ? '...' : '') :
            `${clip.type} ${Math.round(clip.duration)}s`;

        ctx.fillText(label, x + 5, y + height / 2 + 4);
    };

    const drawPlayhead = (ctx: CanvasRenderingContext2D) => {
        const x = currentTime * zoom;

        // Playhead line
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, TIMELINE_HEIGHT);
        ctx.stroke();

        // Playhead handle
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(x, 20, 6, 0, Math.PI * 2);
        ctx.fill();
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollLeft;
        const y = e.clientY - rect.top;

        // Check if clicked on ruler (seek)
        if (y < 40) {
            const newTime = Math.max(0, Math.min(x / zoom, totalDuration));
            onTimeUpdate(newTime);
            return;
        }

        // Check if clicked on a clip
        const clickedClip = clips.find(clip => {
            const clipX = clip.startTime * zoom;
            const clipWidth = clip.duration * zoom;
            const clipY = 40 + clip.track * (TRACK_HEIGHT + TRACK_PADDING) + 5;
            const clipHeight = TRACK_HEIGHT - 10;

            return x >= clipX && x <= clipX + clipWidth &&
                y >= clipY && y <= clipY + clipHeight;
        });

        if (clickedClip && onClipSelect) {
            onClipSelect(clickedClip.id);
        }
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 30, MAX_PIXELS_PER_SECOND));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 30, MIN_PIXELS_PER_SECOND));
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollLeft(e.currentTarget.scrollLeft);
    };

    return (
        <div className="space-y-4">
            {/* Zoom controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleZoomOut}
                        className="p-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                        disabled={zoom <= MIN_PIXELS_PER_SECOND}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 min-w-[60px] text-center">
                        {Math.round((zoom / MAX_PIXELS_PER_SECOND) * 100)}%
                    </span>
                    <button
                        onClick={handleZoomIn}
                        className="p-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                        disabled={zoom >= MAX_PIXELS_PER_SECOND}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>

                <div className="text-sm text-gray-500">
                    {clips.length} clips • {Math.round(totalDuration)}s total
                </div>
            </div>

            {/* Timeline canvas */}
            <div
                ref={containerRef}
                className="overflow-x-auto overflow-y-hidden bg-white rounded-lg border border-gray-200"
                style={{ height: TIMELINE_HEIGHT + 20 }}
                onScroll={handleScroll}
            >
                <canvas
                    ref={canvasRef}
                    width={timelineWidth}
                    height={TIMELINE_HEIGHT}
                    onClick={handleCanvasClick}
                    className="cursor-pointer"
                />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500 rounded"></div>
                    <span className="text-gray-600">Caption</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-gray-600">Video</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-gray-600">Sound</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded"></div>
                    <span className="text-gray-600">Music</span>
                </div>
            </div>
        </div>
    );
}
