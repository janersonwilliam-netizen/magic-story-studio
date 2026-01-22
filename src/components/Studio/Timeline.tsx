/**
 * Timeline Component with Drag-and-Drop Support
 * Features: Draggable playhead, delete clips, media gallery integration
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ZoomIn, ZoomOut, GripVertical, Trash2, Image, Volume2 } from 'lucide-react';
import type { TimelineClip } from '../../types/studio';

interface MediaItem {
    id: string;
    type: 'image' | 'audio';
    url: string;
    label: string;
    duration?: number;
}

interface TimelineProps {
    clips: TimelineClip[];
    currentTime: number;
    totalDuration: number;
    onTimeUpdate: (time: number) => void;
    onClipsChange?: (clips: TimelineClip[]) => void;
    onClipDelete?: (clipId: string) => void;
    selectedClipId?: string | null;
    onClipSelect?: (clipId: string | null) => void;
    mediaItems?: MediaItem[];
}

const TRACK_HEIGHT = 36; // Compact height for all 4 tracks to fit
const MIN_PIXELS_PER_SECOND = 10;
const MAX_PIXELS_PER_SECOND = 200;

const TRACK_CONFIG = [
    { id: 0, label: 'Legenda', color: '#A855F7', bgColor: '#F3E8FF' },
    { id: 1, label: 'Vídeo', color: '#3B82F6', bgColor: '#DBEAFE' },
    { id: 2, label: 'Áudio', color: '#10B981', bgColor: '#D1FAE5' },
    { id: 3, label: 'Música', color: '#F59E0B', bgColor: '#FEF3C7' },
];

// Draggable Clip Component with Delete Button
function DraggableClip({
    clip,
    zoom,
    isSelected,
    onSelect,
    onResize,
    onDelete
}: {
    clip: TimelineClip;
    zoom: number;
    isSelected: boolean;
    onSelect: () => void;
    onResize?: (clipId: string, newDuration: number) => void;
    onDelete?: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: clip.id,
        data: clip
    });

    const resizeRef = useRef<{ startX: number; startDuration: number } | null>(null);

    const width = clip.duration * zoom;
    const left = clip.startTime * zoom;

    const colors: Record<string, { bg: string; border: string; text: string }> = {
        caption: { bg: '#A855F7', border: '#7C3AED', text: '#FFFFFF' },
        video: { bg: '#60A5FA', border: '#3B82F6', text: '#FFFFFF' },
        audio: { bg: '#34D399', border: '#10B981', text: '#FFFFFF' },
        music: { bg: '#FBBF24', border: '#F59E0B', text: '#1F2937' }
    };

    const style = {
        transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
        left: `${left}px`,
        width: `${Math.max(width, 40)}px`,
        opacity: isDragging ? 0.5 : 1,
    };

    const color = colors[clip.type] || colors.video;
    const label = clip.text
        ? clip.text.substring(0, 20) + (clip.text.length > 20 ? '...' : '')
        : `${clip.type} ${Math.round(clip.duration)}s`;

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        resizeRef.current = { startX: e.clientX, startDuration: clip.duration };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!resizeRef.current || !onResize) return;
            const delta = (moveEvent.clientX - resizeRef.current.startX) / zoom;
            const newDuration = Math.max(1, resizeRef.current.startDuration + delta);
            onResize(clip.id, newDuration);
        };

        const handleMouseUp = () => {
            resizeRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={`absolute top-1 bottom-1 rounded-md flex items-center group cursor-grab active:cursor-grabbing select-none transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-white shadow-lg z-10' : 'shadow hover:shadow-md'
                }`}
            {...attributes}
            {...listeners}
        >
            {/* Background */}
            <div
                className="absolute inset-0 rounded-md border-2"
                style={{ backgroundColor: color.bg, borderColor: color.border }}
            />

            {/* Drag Handle */}
            <GripVertical className="w-3 h-3 text-white/70 ml-1 relative z-10 flex-shrink-0" />

            {/* Label */}
            <span
                className="text-[10px] font-medium truncate relative z-10 flex-1 ml-1"
                style={{ color: color.text }}
            >
                {label}
            </span>

            {/* Delete Button - appears on hover/select */}
            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow"
                    title="Excluir clip"
                >
                    <Trash2 className="w-3 h-3 text-white" />
                </button>
            )}

            {/* Resize Handle (right edge) */}
            <div
                onMouseDown={handleResizeStart}
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r z-10"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
}

// Draggable Playhead Component
function DraggablePlayhead({
    currentTime,
    zoom,
    totalDuration,
    onTimeUpdate
}: {
    currentTime: number;
    zoom: number;
    totalDuration: number;
    onTimeUpdate: (time: number) => void;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startTime: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragRef.current = { startX: e.clientX, startTime: currentTime };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = (moveEvent.clientX - dragRef.current.startX) / zoom;
            const newTime = Math.max(0, Math.min(dragRef.current.startTime + delta, totalDuration));
            onTimeUpdate(newTime);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className={`absolute top-0 bottom-0 z-30 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ left: currentTime * zoom + 80 }} // +80 for track label offset
        >
            {/* Playhead Line */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" />

            {/* Draggable Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={`absolute -top-1 -left-2 w-5 h-5 bg-red-500 rounded-b-md hover:bg-red-600 transition-colors flex items-center justify-center ${isDragging ? 'scale-110' : ''
                    }`}
                title="Arraste para navegar"
            >
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white" />
            </div>
        </div>
    );
}

// Media Gallery Sidebar
function MediaGallery({
    mediaItems,
    onDragToTimeline
}: {
    mediaItems: MediaItem[];
    onDragToTimeline?: (item: MediaItem, track: number) => void;
}) {
    const images = mediaItems.filter(m => m.type === 'image');
    const audios = mediaItems.filter(m => m.type === 'audio');

    return (
        <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="p-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700">Galeria de Mídia</h3>
            </div>

            {/* Images Section */}
            <div className="p-2 border-b border-gray-200">
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <Image className="w-3 h-3" />
                    <span>Imagens ({images.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                    {images.map((img, idx) => (
                        <div
                            key={img.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('mediaItem', JSON.stringify(img));
                            }}
                            className="aspect-video bg-gray-200 rounded overflow-hidden cursor-grab hover:ring-2 ring-blue-400 transition-all"
                            title={`Cena ${idx + 1}`}
                        >
                            {img.url ? (
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <Image className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Audios Section */}
            <div className="p-2 flex-1 overflow-y-auto">
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <Volume2 className="w-3 h-3" />
                    <span>Áudios ({audios.length})</span>
                </div>
                <div className="space-y-1">
                    {audios.map((audio, idx) => (
                        <div
                            key={audio.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('mediaItem', JSON.stringify(audio));
                            }}
                            className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 cursor-grab hover:border-green-400 transition-all text-xs"
                            title={audio.label}
                        >
                            <Volume2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                            <span className="truncate flex-1">{audio.label || `Áudio ${idx + 1}`}</span>
                            {audio.duration && (
                                <span className="text-gray-400">{Math.round(audio.duration)}s</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-2 border-t border-gray-200 text-[10px] text-gray-400 text-center">
                Arraste itens para a timeline
            </div>
        </div>
    );
}

// Track Component
function Track({
    trackConfig,
    clips,
    zoom,
    totalWidth,
    selectedClipId,
    onClipSelect,
    onClipResize,
    onClipDelete
}: {
    trackConfig: typeof TRACK_CONFIG[0];
    clips: TimelineClip[];
    zoom: number;
    totalWidth: number;
    selectedClipId?: string | null;
    onClipSelect?: (clipId: string) => void;
    onClipResize?: (clipId: string, newDuration: number) => void;
    onClipDelete?: (clipId: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `track-${trackConfig.id}`,
        data: { track: trackConfig.id }
    });

    return (
        <div
            ref={setNodeRef}
            className={`relative border-b border-gray-700 transition-colors ${isOver ? 'bg-opacity-70' : ''}`}
            style={{
                height: TRACK_HEIGHT,
                width: totalWidth,
                backgroundColor: isOver ? trackConfig.color + '30' : trackConfig.bgColor
            }}
        >
            {/* Track Label */}
            <div
                className="absolute left-0 top-0 bottom-0 w-20 flex items-center pl-3 z-10 bg-gradient-to-r from-white via-white to-transparent"
                style={{ color: trackConfig.color }}
            >
                <span className="text-[10px] font-bold uppercase tracking-wide">{trackConfig.label}</span>
            </div>

            {/* Clips */}
            <div className="absolute left-20 right-0 top-0 bottom-0">
                {clips.map(clip => (
                    <DraggableClip
                        key={clip.id}
                        clip={clip}
                        zoom={zoom}
                        isSelected={selectedClipId === clip.id}
                        onSelect={() => onClipSelect?.(clip.id)}
                        onResize={onClipResize}
                        onDelete={onClipDelete ? () => onClipDelete(clip.id) : undefined}
                    />
                ))}
            </div>
        </div>
    );
}

export function Timeline({
    clips,
    currentTime,
    totalDuration,
    onTimeUpdate,
    onClipsChange,
    onClipDelete,
    selectedClipId,
    onClipSelect,
    mediaItems = []
}: TimelineProps) {
    const [zoom, setZoom] = useState(50);
    const [activeId, setActiveId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 }
        })
    );

    const totalWidth = Math.max(totalDuration * zoom + 100, 600);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta, over } = event;
        setActiveId(null);

        if (!onClipsChange) return;

        // Check if dropped from gallery
        if (over && active.data.current?.fromGallery) {
            // Handle gallery drop - add new clip
            return;
        }

        // Handle clip repositioning
        if (delta.x !== 0) {
            const updatedClips = clips.map(clip => {
                if (clip.id === active.id) {
                    const newStartTime = Math.max(0, clip.startTime + delta.x / zoom);
                    return { ...clip, startTime: newStartTime };
                }
                return clip;
            });
            onClipsChange(updatedClips);
        }
    };

    const handleClipResize = useCallback((clipId: string, newDuration: number) => {
        if (!onClipsChange) return;

        const updatedClips = clips.map(clip => {
            if (clip.id === clipId) {
                return { ...clip, duration: newDuration };
            }
            return clip;
        });

        onClipsChange(updatedClips);
    }, [clips, onClipsChange]);

    const handleClipDelete = useCallback((clipId: string) => {
        if (onClipDelete) {
            onClipDelete(clipId);
        } else if (onClipsChange) {
            const updatedClips = clips.filter(c => c.id !== clipId);
            onClipsChange(updatedClips);
        }
    }, [clips, onClipsChange, onClipDelete]);

    const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0) - 80;
        const newTime = Math.max(0, Math.min(x / zoom, totalDuration));
        onTimeUpdate(newTime);
    };

    // Generate time markers
    const interval = zoom < 30 ? 10 : zoom < 60 ? 5 : zoom < 120 ? 2 : 1;
    const markers = [];
    for (let t = 0; t <= totalDuration; t += interval) {
        markers.push(t);
    }

    return (
        <div className="flex gap-0">
            {/* Media Gallery Sidebar */}
            {mediaItems.length > 0 && (
                <MediaGallery mediaItems={mediaItems} />
            )}

            {/* Main Timeline */}
            <div className="flex-1 space-y-3">
                {/* Zoom Controls */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setZoom(prev => Math.max(prev - 20, MIN_PIXELS_PER_SECOND))}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            disabled={zoom <= MIN_PIXELS_PER_SECOND}
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-600 min-w-[40px] text-center font-medium">
                            {Math.round((zoom / MAX_PIXELS_PER_SECOND) * 100)}%
                        </span>
                        <button
                            onClick={() => setZoom(prev => Math.min(prev + 20, MAX_PIXELS_PER_SECOND))}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            disabled={zoom >= MAX_PIXELS_PER_SECOND}
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="text-xs text-gray-500">
                        {clips.length} clips • {Math.round(totalDuration)}s
                    </div>
                </div>

                {/* Timeline Container */}
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div
                        ref={containerRef}
                        className="relative bg-gray-900 rounded-lg border border-gray-700 overflow-x-auto overflow-y-hidden"
                        style={{ height: 'calc(4 * 36px + 28px)' }} // 4 tracks + ruler
                    >
                        {/* Time Ruler */}
                        <div
                            className="sticky top-0 z-20 bg-gray-50 border-b border-gray-300 flex items-end cursor-pointer"
                            style={{ height: 28, width: totalWidth }}
                            onClick={handleRulerClick}
                        >
                            <div className="w-20 flex-shrink-0 bg-gray-50" />
                            <div className="flex-1 relative h-full">
                                {markers.map(t => (
                                    <div
                                        key={t}
                                        className="absolute bottom-0 flex flex-col items-center"
                                        style={{ left: t * zoom }}
                                    >
                                        <span className="text-[9px] text-gray-500 mb-0.5">
                                            {Math.floor(t / 60)}:{(t % 60).toString().padStart(2, '0')}
                                        </span>
                                        <div className="w-px h-1.5 bg-gray-400" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tracks */}
                        <div style={{ width: totalWidth }} className="relative">
                            {TRACK_CONFIG.map(trackConfig => (
                                <Track
                                    key={trackConfig.id}
                                    trackConfig={trackConfig}
                                    clips={clips.filter(c => c.track === trackConfig.id)}
                                    zoom={zoom}
                                    totalWidth={totalWidth}
                                    selectedClipId={selectedClipId}
                                    onClipSelect={onClipSelect}
                                    onClipResize={handleClipResize}
                                    onClipDelete={handleClipDelete}
                                />
                            ))}

                            {/* Draggable Playhead */}
                            <DraggablePlayhead
                                currentTime={currentTime}
                                zoom={zoom}
                                totalDuration={totalDuration}
                                onTimeUpdate={onTimeUpdate}
                            />
                        </div>
                    </div>
                </DndContext>

                {/* Legend + Instructions */}
                <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-3">
                        {TRACK_CONFIG.map(track => (
                            <div key={track.id} className="flex items-center gap-1">
                                <div
                                    className="w-2.5 h-2.5 rounded"
                                    style={{ backgroundColor: track.color }}
                                />
                                <span className="text-gray-500">{track.label}</span>
                            </div>
                        ))}
                    </div>
                    <span className="text-gray-400">
                        🔴 Arraste a agulha • 📦 Arraste clips • 🗑️ Hover para excluir
                    </span>
                </div>
            </div>
        </div>
    );
}
