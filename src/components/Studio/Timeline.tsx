/**
 * Timeline Component - Canva/Clipchamp Style
 * Multi-track timeline with visual thumbnails, separated by media and audio
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragMoveEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Trash2, Image, Music, Type } from 'lucide-react';
import type { TimelineClip } from '../../types/studio';

// Export TimelineTrack interface for external use
export interface TimelineTrack {
    id: string;
    type: 'media' | 'audio' | 'caption';
    label: string;
}

interface TimelineProps {
    clips: TimelineClip[];
    currentTime: number;
    totalDuration: number;
    zoom?: number; // External zoom control (percentage)
    onTimeUpdate: (time: number) => void;
    onClipsChange?: (clips: TimelineClip[]) => void;
    onClipDelete?: (clipId: string) => void;
    onClipReplace?: (clipId: string, newData: any) => void;
    selectedClipId?: string | null;
    onClipSelect?: (clipId: string | null) => void;
    customTracks?: TimelineTrack[];
    isDraggingExternal?: boolean;
    onExternalDragOver?: (trackId: string, clientX: number) => void;
}

const TRACK_HEIGHT = 52;
const LABEL_WIDTH = 80;

// Default track configuration if no custom tracks provided
const DEFAULT_TRACK_CONFIG: TimelineTrack[] = [
    { id: 'caption-0', type: 'caption', label: 'Legendas' },
    { id: 'media-1', type: 'media', label: 'Vídeo' },
    { id: 'audio-2', type: 'audio', label: 'Áudio' },
];

// Draggable Clip Component
function DraggableClip({
    clip,
    pixelsPerSecond,
    isSelected,
    onSelect,
    onResizeRight,
    onResizeLeft,
    onDelete,
    onReplaceContent,
}: {
    clip: TimelineClip;
    pixelsPerSecond: number;
    isSelected: boolean;
    onSelect: () => void;
    onResizeRight?: (clipId: string, newDuration: number) => void;
    onResizeLeft?: (clipId: string, newStartTime: number, newDuration: number) => void;
    onDelete?: () => void;
    onReplaceContent?: (clipId: string, newData: any) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: clip.id,
        data: clip
    });

    const [isHovered, setIsHovered] = useState(false);
    const [showReplaceOverlay, setShowReplaceOverlay] = useState(false);
    const resizeLeftRef = useRef<{ startX: number; startTime: number; startDuration: number; endTime: number } | null>(null);
    const resizeRightRef = useRef<{ startX: number; startDuration: number } | null>(null);
    const width = clip.duration * pixelsPerSecond;
    const left = clip.startTime * pixelsPerSecond;

    const style = {
        transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
        left: `${left}px`,
        width: `${Math.max(width, 30)}px`,
        opacity: isDragging ? 0.5 : 1,
    };

    // Handle resize from LEFT edge - keeps the END position fixed, changes START
    const handleResizeLeftStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const endTime = clip.startTime + clip.duration; // This stays fixed
        resizeLeftRef.current = {
            startX: e.clientX,
            startTime: clip.startTime,
            startDuration: clip.duration,
            endTime: endTime
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!resizeLeftRef.current || !onResizeLeft) return;
            const delta = (moveEvent.clientX - resizeLeftRef.current.startX) / pixelsPerSecond;
            // Calculate new start time (can't go past end or below 0)
            const newStartTime = Math.max(0, Math.min(
                resizeLeftRef.current.startTime + delta,
                resizeLeftRef.current.endTime - 1 // Minimum 1 second duration
            ));
            // Duration is determined by fixed end time
            const newDuration = resizeLeftRef.current.endTime - newStartTime;
            onResizeLeft(clip.id, newStartTime, newDuration);
        };

        const handleMouseUp = () => {
            resizeLeftRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle resize from RIGHT edge - keeps the START position fixed, changes END
    const handleResizeRightStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        resizeRightRef.current = { startX: e.clientX, startDuration: clip.duration };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!resizeRightRef.current || !onResizeRight) return;
            const delta = (moveEvent.clientX - resizeRightRef.current.startX) / pixelsPerSecond;
            const newDuration = Math.max(1, resizeRightRef.current.startDuration + delta);
            onResizeRight(clip.id, newDuration);
        };

        const handleMouseUp = () => {
            resizeRightRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle drop for replacement
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowReplaceOverlay(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setShowReplaceOverlay(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowReplaceOverlay(false);

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (onReplaceContent && data) {
                onReplaceContent(clip.id, data);
            }
        } catch (err) {
            console.error('Drop replace error:', err);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            // Drag handlers removed to allow proper insertion on track
            className={`absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing select-none transition-all group
            ${isSelected
                    ? 'ring-2 ring-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)] z-20'
                    : isHovered
                        ? 'ring-1 ring-white/50 z-10'
                        : ''
                }`}
            {...attributes}
            {...listeners}
        >
            {/* Background with content */}
            <div className="absolute inset-0 rounded overflow-hidden">
                {/* Video thumbnails */}
                {clip.type === 'video' && clip.imageUrl && (
                    <div className="flex h-full">
                        {Array.from({ length: Math.max(1, Math.floor(width / 40)) }).map((_, i) => (
                            <img
                                key={i}
                                src={clip.imageUrl}
                                alt=""
                                className="h-full w-auto object-cover"
                                style={{ minWidth: '40px' }}
                                draggable={false}
                            />
                        ))}
                    </div>
                )}

                {/* Audio waveform with gradient background */}
                {clip.type === 'audio' && (
                    <div className="flex items-center h-full pr-2 bg-blue-600 relative overflow-hidden border border-blue-400/30">
                        {/* Content Overlay - Left Side */}
                        <div className="flex items-center gap-2 text-white font-medium text-xs px-2 py-1 z-20 flex-shrink-0 max-w-[60%]">
                            <Music className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate drop-shadow-sm">
                                {clip.name || (clip.audioUrl?.startsWith('data:') ? 'Áudio Importado' : clip.audioUrl?.split('/').pop()?.split('?')[0]) || 'Áudio sem nome'}
                            </span>
                        </div>

                        {/* Waveform Background - Fills remaining space to the right */}
                        <div className="flex-1 h-full flex items-center gap-0.5 opacity-40 overflow-hidden">
                            {Array.from({ length: Math.floor(width / 6) }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-0.5 bg-white rounded-full flex-shrink-0"
                                    style={{ height: `${20 + Math.sin(i * 0.5) * 40 + Math.random() * 30}%` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Caption with gradient */}
                {clip.type === 'caption' && (
                    <div className="flex items-center h-full px-3 bg-gradient-to-r from-purple-600 to-pink-500">
                        <span className="text-white text-xs truncate font-medium flex items-center gap-1.5">
                            <span className="text-white/80">T</span>
                            {clip.text?.substring(0, 40)}
                        </span>
                    </div>
                )}
            </div>

            {/* Left resize handle - only shown on hover or selected */}
            {(isHovered || isSelected) && (
                <div
                    onMouseDown={handleResizeLeftStart}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center z-30"
                >
                    <div className="w-1 h-8 bg-white rounded-full shadow-lg" />
                </div>
            )}

            {/* Right resize handle - only shown on hover or selected */}
            {(isHovered || isSelected) && (
                <div
                    onMouseDown={handleResizeRightStart}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center z-30"
                >
                    <div className="w-1 h-8 bg-white rounded-full shadow-lg" />
                </div>
            )}

            {/* Replace overlay when dragging over */}
            {showReplaceOverlay && (
                <div className="absolute inset-0 bg-purple-600/80 rounded flex items-center justify-center z-40 border-2 border-dashed border-white">
                    <div className="flex items-center gap-2 text-white text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Substituir
                    </div>
                </div>
            )}

            {/* Delete button - shown on hover */}
            {onDelete && isHovered && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-30 shadow-lg transition-colors"
                >
                    <Trash2 className="w-3 h-3 text-white" />
                </button>
            )}
        </div>
    );
}

// Playhead Component
function Playhead({
    currentTime,
    pixelsPerSecond,
    totalDuration,
    onTimeUpdate,
    leftOffset = 0
}: {
    currentTime: number;
    pixelsPerSecond: number;
    totalDuration: number;
    onTimeUpdate: (time: number) => void;
    leftOffset?: number;
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
            const delta = (moveEvent.clientX - dragRef.current.startX) / pixelsPerSecond;
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
            className={`absolute top-0 z-40 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ left: leftOffset + currentTime * pixelsPerSecond }}
        >
            <div
                onMouseDown={handleMouseDown}
                className="absolute -top-0 -left-2 w-4 h-4 bg-white rounded-b flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#0f172a] mt-0.5" />
            </div>
            {/* Extended Line - Always visible, full height */}
            <div className="w-0.5 h-[200vh] bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)] pointer-events-none mx-auto" />
        </div>
    );
}

// Track Component
function Track({
    trackConfig,
    clips,
    pixelsPerSecond,
    totalWidth,
    selectedClipId,
    onClipSelect,
    onClipResizeRight,
    onClipResizeLeft,
    onClipDelete,
    onClipReplace,
    isDraggingExternal,
    onExternalDragOver
}: {
    trackConfig: TimelineTrack;
    clips: TimelineClip[];
    pixelsPerSecond: number;
    totalWidth: number;
    selectedClipId?: string | null;
    onClipSelect?: (clipId: string) => void;
    onClipResizeRight?: (clipId: string, newDuration: number) => void;
    onClipResizeLeft?: (clipId: string, newStartTime: number, newDuration: number) => void;
    onClipDelete?: (clipId: string) => void;
    onClipReplace?: (clipId: string, newData: any) => void;
    isDraggingExternal?: boolean;
    onExternalDragOver?: (trackId: string, clientX: number) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `track-${trackConfig.id}`,
        data: { track: trackConfig.id, type: trackConfig.type }
    });

    const handleDragOver = (e: React.DragEvent) => {
        if (isDraggingExternal && onExternalDragOver) {
            e.preventDefault();
            e.stopPropagation();
            onExternalDragOver(trackConfig.id, e.clientX);
        }
    };

    const getTrackColors = () => {
        switch (trackConfig.type) {
            case 'media':
                return { bg: '#1e293b', border: '#334155', accent: '#f97316' }; // Orange for Media (Primary)
            case 'audio':
                return { bg: '#1e293b', border: '#334155', accent: '#10b981' }; // Emerald for Audio
            case 'caption':
            default:
                return { bg: '#1e293b', border: '#334155', accent: '#8b5cf6' }; // Violet for others
        }
    };

    const colors = getTrackColors();

    return (
        <div
            ref={setNodeRef}
            onDragOver={handleDragOver}
            data-track-id={trackConfig.id}
            className={`relative border-b transition-all ${isOver || (isDraggingExternal && isOver) ? 'ring-2 ring-inset' : ''}`}
            style={{
                height: TRACK_HEIGHT,
                width: totalWidth,
                backgroundColor: isOver ? colors.accent + '20' : colors.bg,
                borderColor: colors.border,
                ringColor: isOver ? colors.accent : 'transparent'
            }}
        >
            {/* Empty track indicator */}
            {clips.length === 0 && !isDraggingExternal && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <div
                        className="w-16 h-8 rounded border-2 border-dashed flex items-center justify-center"
                        style={{ borderColor: colors.accent + '40' }}
                    >
                        <span className="text-[10px] opacity-40" style={{ color: colors.accent }}>+</span>
                    </div>
                    <span className="text-[10px] opacity-30 text-gray-500">Arraste elementos aqui</span>
                </div>
            )}
            {/* Drop zone indicator when dragging */}
            {isDraggingExternal && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ backgroundColor: colors.accent + '05' }}
                >
                    {/* <span className="text-xs text-gray-400 opacity-50">Solte aqui</span> */}
                </div>
            )}
            {clips.map(clip => (
                <DraggableClip
                    key={clip.id}
                    clip={clip}
                    pixelsPerSecond={pixelsPerSecond}
                    isSelected={selectedClipId === clip.id}
                    onSelect={() => onClipSelect?.(clip.id)}
                    onResizeRight={onClipResizeRight}
                    onResizeLeft={onClipResizeLeft}
                    onDelete={onClipDelete ? () => onClipDelete(clip.id) : undefined}
                    onReplaceContent={onClipReplace}
                />
            ))}
        </div>
    );
}

// Insertion Indicator Component
function InsertionIndicator({
    position,
    visible,
    color = '#8b5cf6'
}: {
    position: number;
    visible: boolean;
    color?: string;
}) {
    if (!visible) return null;

    return (
        <div
            className="absolute top-0 bottom-0 w-0.5 z-50 pointer-events-none animate-pulse"
            style={{
                left: position,
                backgroundColor: color,
                boxShadow: `0 0 8px 2px ${color}80`
            }}
        >
            <div className="absolute top-0 -translate-x-1/2 -mt-1 w-3 h-3 rotate-45 transform bg-violet-500" />
            <div className="absolute bottom-0 -translate-x-1/2 mb-1 w-3 h-3 rotate-45 transform bg-violet-500" />
        </div>
    );
}

export function Timeline({
    clips,
    currentTime,
    totalDuration,
    zoom = 50,
    onTimeUpdate,
    onClipsChange,
    onClipDelete,
    onClipReplace,
    selectedClipId,
    onClipSelect,
    customTracks,
    isDraggingExternal = false,
    onExternalDragOver
}: TimelineProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const tracks = customTracks || DEFAULT_TRACK_CONFIG;
    const pixelsPerSecond = zoom;
    const totalWidth = Math.max(totalDuration * pixelsPerSecond + 100, 800);

    const [insertIndicator, setInsertIndicator] = useState<{ position: number; trackId?: string } | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    // Helper to get clips for a specific track ID or type
    const getClipsForTrackId = useCallback((trackId: string) => {
        return clips.filter(c => {
            if (c.trackId === trackId) return true;
            const track = tracks.find(t => t.id === trackId);
            if (track && c.type === track.type && !c.trackId) {
                return false;
            }
            return false;
        }).sort((a, b) => a.startTime - b.startTime);
    }, [clips, tracks]);

    // Consistent logic with render:
    const getClipsVisualsForTrack = useCallback((trackId: string) => {
        const track = tracks.find(t => t.id === trackId);
        if (!track) return [];

        const explicitClips = clips.filter(c => c.trackId === track.id);
        const isFirstOfType = tracks.filter(t => t.type === track.type).indexOf(track) === 0;

        if (isFirstOfType) {
            const legacyClips = clips.filter(c => {
                if (c.trackId) return false;
                if (track.type === 'caption') return c.type === 'caption';
                if (track.type === 'media') return c.type === 'video';
                return c.type === 'audio' || c.type === 'music';
            });
            return [...explicitClips, ...legacyClips].sort((a, b) => a.startTime - b.startTime);
        }
        return explicitClips.sort((a, b) => a.startTime - b.startTime);
    }, [clips, tracks]);


    // Find clips in the same track as the given clip (for internal drag)
    const getClipsInSameTrack = useCallback((clipId: string) => {
        const targetClip = clips.find(c => c.id === clipId);
        if (!targetClip) return [];

        if (targetClip.trackId) {
            return getClipsVisualsForTrack(targetClip.trackId).filter(c => c.id !== clipId);
        }

        return clips.filter(c => {
            if (c.id === targetClip.id) return false;
            if (targetClip.trackId && c.trackId) return c.trackId === targetClip.trackId;
            if (targetClip.track !== undefined && c.track !== undefined) return c.track === targetClip.track;
            return c.type === targetClip.type;
        }).sort((a, b) => a.startTime - b.startTime);
    }, [clips, getClipsVisualsForTrack]);

    const calculateInsertPosition = (
        dragPixelX: number,
        trackId: string,
        ignoreClipId?: string
    ) => {
        let sameTrackClips = getClipsVisualsForTrack(trackId);

        if (ignoreClipId) {
            sameTrackClips = sameTrackClips.filter(c => c.id !== ignoreClipId);
        }

        if (sameTrackClips.length === 0) {
            return { insertIndex: 0, insertPixelX: 0 };
        }

        for (let i = 0; i < sameTrackClips.length; i++) {
            const clip = sameTrackClips[i];
            const clipStart = clip.startTime * pixelsPerSecond;
            const clipEnd = (clip.startTime + clip.duration) * pixelsPerSecond;
            const clipMiddle = (clipStart + clipEnd) / 2;

            if (dragPixelX < clipMiddle) {
                return { insertIndex: i, insertPixelX: clipStart };
            }
        }

        const lastClip = sameTrackClips[sameTrackClips.length - 1];
        const endPos = (lastClip.startTime + lastClip.duration) * pixelsPerSecond;
        return { insertIndex: sameTrackClips.length, insertPixelX: endPos };
    };

    const handleDragMove = (event: DragMoveEvent) => {
        const { active, delta } = event;
        const draggedClip = clips.find(c => c.id === active.id);
        if (!draggedClip) return;

        const currentPixelX = draggedClip.startTime * pixelsPerSecond + delta.x;
        const trackId = draggedClip.trackId || (
            tracks.find(t =>
                (draggedClip.type === 'video' && t.type === 'media') ||
                (draggedClip.type === 'audio' && t.type === 'audio')
            )?.id
        );

        if (trackId) {
            const { insertPixelX } = calculateInsertPosition(currentPixelX, trackId, draggedClip.id);
            setInsertIndicator({
                position: insertPixelX,
                trackId: trackId
            });
        }
    };

    const handleInternalExternalDragOver = (trackId: string, clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const relativeX = clientX - rect.left + containerRef.current.scrollLeft - LABEL_WIDTH;

        const { insertPixelX } = calculateInsertPosition(relativeX, trackId);

        setInsertIndicator({
            position: insertPixelX,
            trackId: trackId
        });

        if (onExternalDragOver) {
            onExternalDragOver(trackId, clientX);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta } = event;
        setActiveId(null);
        setInsertIndicator(null);

        if (!onClipsChange || delta.x === 0) return;

        const draggedClip = clips.find(c => c.id === active.id);
        if (!draggedClip) return;

        const trackId = draggedClip.trackId || (
            tracks.find(t =>
                (draggedClip.type === 'video' && t.type === 'media') ||
                (draggedClip.type === 'audio' && t.type === 'audio')
            )?.id
        );

        if (!trackId) return;

        const currentPixelX = draggedClip.startTime * pixelsPerSecond + delta.x;
        const { insertIndex } = calculateInsertPosition(currentPixelX, trackId, draggedClip.id);
        const sameTrackClips = getClipsVisualsForTrack(trackId);
        const otherClips = clips.filter(c => c.id !== draggedClip.id);
        const targetTrackClips = sameTrackClips.filter(c => c.id !== draggedClip.id);

        const reorderedTrackClips = [
            ...targetTrackClips.slice(0, insertIndex),
            draggedClip,
            ...targetTrackClips.slice(insertIndex)
        ];

        let currentTime = 0;
        const updatedTrackClips = reorderedTrackClips.map(clip => {
            const updated = { ...clip, startTime: currentTime, trackId: trackId };
            currentTime += clip.duration;
            return updated;
        });

        const clipsInOtherTracks = otherClips.filter(c => {
            const cTrackId = c.trackId || tracks.find(t => t.type === c.type)?.id;
            return cTrackId !== trackId;
        });

        onClipsChange([...clipsInOtherTracks, ...updatedTrackClips]);
    };

    const getMaxDurationForClip = useCallback((clipId: string) => {
        const clipIndex = clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return Infinity;

        const clip = clips[clipIndex];
        const sameTrackClips = getClipsInSameTrack(clipId);
        const nextClip = sameTrackClips.find(c => c.startTime > clip.startTime);

        if (nextClip) {
            return nextClip.startTime - clip.startTime;
        }

        return totalDuration - clip.startTime;
    }, [clips, getClipsInSameTrack, totalDuration]);

    const handleClipResizeRight = useCallback((clipId: string, newDuration: number) => {
        if (!onClipsChange) return;
        const maxDuration = getMaxDurationForClip(clipId);
        const clampedDuration = Math.min(Math.max(1, newDuration), maxDuration);
        const updatedClips = clips.map(clip =>
            clip.id === clipId ? { ...clip, duration: clampedDuration } : clip
        );
        onClipsChange(updatedClips);
    }, [clips, onClipsChange, getMaxDurationForClip]);

    const handleClipResizeLeft = useCallback((clipId: string, newStartTime: number, newDuration: number) => {
        if (!onClipsChange) return;

        const currentClip = clips.find(c => c.id === clipId);
        if (!currentClip) return;

        const sameTrackClips = getClipsInSameTrack(clipId);
        const connectedPrevClip = sameTrackClips.find(c =>
            Math.abs((c.startTime + c.duration) - currentClip.startTime) < 0.05
        );

        if (connectedPrevClip && newStartTime > connectedPrevClip.startTime) {
            const delta = newStartTime - currentClip.startTime;
            const newPrevDuration = connectedPrevClip.duration + delta;

            if (newPrevDuration >= 0.5) {
                const updatedClips = clips.map(c => {
                    if (c.id === clipId) {
                        return { ...c, startTime: newStartTime, duration: newDuration };
                    }
                    if (c.id === connectedPrevClip.id) {
                        return { ...c, duration: newPrevDuration };
                    }
                    return c;
                });
                onClipsChange(updatedClips);
                return;
            }
        }

        const blockingClip = sameTrackClips
            .filter(c => c.startTime + c.duration <= newStartTime + 0.01 && c.id !== clipId)
            .sort((a, b) => b.startTime - a.startTime)[0];

        const minStartTime = blockingClip ? blockingClip.startTime + blockingClip.duration : 0;
        const clampedStartTime = Math.max(minStartTime, newStartTime);
        const originalEndTime = newStartTime + newDuration;
        const clampedDuration = Math.max(0.5, originalEndTime - clampedStartTime);

        const updatedClips = clips.map(c =>
            c.id === clipId ? { ...c, startTime: clampedStartTime, duration: clampedDuration } : c
        );
        onClipsChange(updatedClips);
    }, [clips, onClipsChange, getClipsInSameTrack]);

    const handleClipDelete = useCallback((clipId: string) => {
        if (onClipDelete) {
            onClipDelete(clipId);
        } else if (onClipsChange) {
            onClipsChange(clips.filter(c => c.id !== clipId));
        }
    }, [clips, onClipsChange, onClipDelete]);

    const handleClipReplace = useCallback((clipId: string, newData: any) => {
        if (onClipReplace) {
            onClipReplace(clipId, newData);
        } else if (onClipsChange) {
            const updatedClips = clips.map(clip => {
                if (clip.id === clipId) {
                    if (newData.type === 'media' && clip.type === 'video') {
                        return { ...clip, imageUrl: newData.data?.imageUrl || newData.data?.url };
                    } else if (newData.type === 'audio' && clip.type === 'audio') {
                        return { ...clip, audioUrl: newData.data?.url };
                    }
                }
                return clip;
            });
            onClipsChange(updatedClips);
        }
    }, [clips, onClipsChange, onClipReplace]);

    const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0) - LABEL_WIDTH;
        const newTime = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
        onTimeUpdate(newTime);
    };

    const interval = pixelsPerSecond < 30 ? 10 : pixelsPerSecond < 60 ? 5 : pixelsPerSecond < 100 ? 2 : 1;
    const markers = [];
    for (let t = 0; t <= totalDuration + interval; t += interval) {
        markers.push(t);
    }

    const mediaTracks = tracks.filter(t => t.type === 'media' || t.type === 'caption');
    const audioTracks = tracks.filter(t => t.type === 'audio');

    const getClipsForTrack = (track: TimelineTrack, trackIndex: number) => {
        return getClipsVisualsForTrack(track.id);
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragMove={handleDragMove}
        >
            <div className="relative bg-background h-full flex flex-col">
                <style>{`
                    .timeline-scroll::-webkit-scrollbar {
                        height: 10px;
                        width: 10px;
                    }
                    .timeline-scroll::-webkit-scrollbar-track {
                        background: #1a1a1a;
                    }
                    .timeline-scroll::-webkit-scrollbar-thumb {
                        background: #4b5563;
                        border-radius: 5px;
                        border: 2px solid #1a1a1a;
                    }
                    .timeline-scroll::-webkit-scrollbar-thumb:hover {
                        background: #6b7280;
                    }
                    .timeline-scroll::-webkit-scrollbar-corner {
                        background: #1a1a1a;
                    }
                `}</style>

                {/* Unified Scroll Container */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-auto timeline-scroll relative"
                >
                    {/* Time Ruler (Sticky Top) */}
                    <div
                        className="sticky top-0 z-40 bg-[#1f1f1f] border-b border-[#333333] flex items-end cursor-pointer"
                        style={{ height: 28, minWidth: '100%', width: 'fit-content' }}
                        onClick={handleRulerClick}
                    >
                        {/* Label spacer - Sticky Left */}
                        <div className="sticky left-0 z-50 bg-[#1f1f1f] border-r border-[#333333] flex-shrink-0" style={{ width: LABEL_WIDTH, height: '100%' }} />

                        <div className="relative h-full" style={{ width: totalWidth }}>
                            {markers.map(t => (
                                <div
                                    key={t}
                                    className="absolute bottom-0 flex flex-col items-center"
                                    style={{ left: t * pixelsPerSecond }}
                                >
                                    <span className="text-[9px] text-gray-500 mb-0.5">
                                        {Math.floor(t / 60)}:{(Math.floor(t) % 60).toString().padStart(2, '0')}
                                    </span>
                                    <div className="w-px h-2 bg-[#2d2d4a]" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content Group (Tracks) */}
                    <div style={{ width: totalWidth + LABEL_WIDTH, minWidth: '100%' }} className="relative">

                        {/* Media Section Header */}
                        {mediaTracks.length > 0 && (
                            <div className="sticky left-0 z-30 flex items-center gap-2 px-2 py-1.5 bg-[#2a2a2a] border-b border-[#333333] text-xs text-gray-300" style={{ width: 'fit-content', minWidth: LABEL_WIDTH }}>
                                <Image className="w-3 h-3" />
                                <span className="font-medium hidden sm:inline">Mídia</span>
                            </div>
                        )}

                        {/* Media Tracks */}
                        {mediaTracks.map((trackConfig, idx) => (
                            <div key={trackConfig.id} className="relative flex">
                                {/* Track Label - Sticky Left */}
                                <div
                                    className="flex-shrink-0 flex items-center justify-end pr-3 bg-[#1f1f1f] border-r border-b border-[#333333] sticky left-0 z-20"
                                    style={{ width: LABEL_WIDTH, height: TRACK_HEIGHT }}
                                >
                                    <span className="text-[10px] text-gray-500 truncate">{trackConfig.label}</span>
                                </div>
                                {/* Track Content */}
                                <div className="relative flex-1">
                                    <Track
                                        trackConfig={trackConfig}
                                        clips={getClipsForTrack(trackConfig, idx)}
                                        pixelsPerSecond={pixelsPerSecond}
                                        totalWidth={totalWidth}
                                        selectedClipId={selectedClipId}
                                        onClipSelect={onClipSelect}
                                        onClipResizeRight={handleClipResizeRight}
                                        onClipResizeLeft={handleClipResizeLeft}
                                        onClipDelete={handleClipDelete}
                                        onClipReplace={handleClipReplace}
                                        isDraggingExternal={isDraggingExternal && (trackConfig.type === 'media' || trackConfig.type === 'caption')}
                                        onExternalDragOver={handleInternalExternalDragOver}
                                    />
                                    <InsertionIndicator
                                        visible={!!insertIndicator && insertIndicator.trackId === trackConfig.id}
                                        position={insertIndicator?.position || 0}
                                        color="#4f46e5"
                                    />
                                </div>
                            </div>
                        ))}



                        {/* Audio Section Header */}
                        {audioTracks.length > 0 && (
                            <div className="sticky left-0 z-30 flex items-center gap-2 px-2 py-1.5 bg-[#2a2a2a] border-b border-[#333333] text-xs text-gray-300" style={{ width: 'fit-content', minWidth: LABEL_WIDTH }}>
                                <Music className="w-3 h-3" />
                                <span className="font-medium hidden sm:inline">Áudio</span>
                            </div>
                        )}

                        {/* Audio Tracks */}
                        {audioTracks.map((trackConfig, idx) => (
                            <div key={trackConfig.id} className="relative flex">
                                <div
                                    className="flex-shrink-0 flex items-center justify-end pr-3 bg-[#1f1f1f] border-r border-b border-[#333333] sticky left-0 z-20"
                                    style={{ width: LABEL_WIDTH, height: TRACK_HEIGHT }}
                                >
                                    <span className="text-[10px] text-gray-500 truncate">{trackConfig.label}</span>
                                </div>
                                <div className="relative flex-1">
                                    <Track
                                        trackConfig={trackConfig}
                                        clips={getClipsForTrack(trackConfig, idx)}
                                        pixelsPerSecond={pixelsPerSecond}
                                        totalWidth={totalWidth}
                                        selectedClipId={selectedClipId}
                                        onClipSelect={onClipSelect}
                                        onClipResizeRight={handleClipResizeRight}
                                        onClipResizeLeft={handleClipResizeLeft}
                                        onClipDelete={handleClipDelete}
                                        onClipReplace={handleClipReplace}
                                        isDraggingExternal={isDraggingExternal && trackConfig.type === 'audio'}
                                        onExternalDragOver={handleInternalExternalDragOver}
                                    />
                                    <InsertionIndicator
                                        visible={!!insertIndicator && insertIndicator.trackId === trackConfig.id}
                                        position={insertIndicator?.position || 0}
                                        color="#10b981"
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Visual Playhead Line for Audio (Offset based on Media height?) */}
                        {/* This is tricky to align perfectly without absolute math. 
                             Let's just put standard playhead line covering everything?
                             No, separated is okay visually. Or just use Global Playhead.
                         */}
                    </div>

                    {/* Main Playhead Handle (Drag) */}
                    <Playhead
                        currentTime={currentTime}
                        pixelsPerSecond={pixelsPerSecond}
                        totalDuration={totalDuration}
                        onTimeUpdate={onTimeUpdate}
                        leftOffset={LABEL_WIDTH}
                    />

                </div>
            </div>
        </DndContext>
    );
}
