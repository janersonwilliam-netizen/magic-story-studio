import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Scissors, Upload, Type, Volume2, Mic, Gauge, Loader2, ZoomIn, ZoomOut, Sparkles, Wand2, Image, Zap, Music, FileImage, CreditCard, Plus, GripVertical, Layers, MessageSquareQuote, Layout, Download } from 'lucide-react';
import type { StoryWithScenes, TimelineClip } from '../../types/studio';
import { VideoPreview, VideoPreviewRef } from './VideoPreview';
import { Timeline, TimelineTrack } from './Timeline';
import { storage, StoredFile } from '../../lib/storage';

interface TimelinePageProps {
    storyWithScenes: StoryWithScenes;
    onComplete: (storyWithTimeline: any) => void;
    onBack: () => void;
}

export function TimelinePage({ storyWithScenes, onComplete, onBack }: TimelinePageProps) {
    // SAFETY CHECK
    if (!storyWithScenes?.scenes || storyWithScenes.scenes.length === 0) {
        return (
            <div className="h-screen bg-[#16161e] flex items-center justify-center">
                <div className="bg-[#1e1e2e] rounded-2xl p-8 max-w-md w-full text-center border border-[#2a2a3e]">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Erro</h2>
                    <p className="text-gray-400 mb-6">Nenhuma cena encontrada.</p>
                    <button onClick={onBack} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        ← Voltar
                    </button>
                </div>
            </div>
        );
    }

    const [loading, setLoading] = useState(true);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
    const [clips, setClips] = useState<TimelineClip[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [timelineZoom, setTimelineZoom] = useState(50);
    const [error, setError] = useState('');
    const [activePanel, setActivePanel] = useState('media'); // 'media', 'music', 'logos', 'endcards'
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const videoPreviewRef = React.useRef<VideoPreviewRef>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [libraryFiles, setLibraryFiles] = useState<StoredFile[]>([]);
    const [draggedItem, setDraggedItem] = useState<{ type: 'media' | 'audio'; data: any } | null>(null);
    const [customTracks, setCustomTracks] = useState<TimelineTrack[]>([
        { id: 'logo-track', type: 'media', label: 'Marca d\'água' },
        { id: 'caption-track', type: 'caption', label: 'Legendas' },
        { id: 'media-track', type: 'media', label: 'Vídeo Principal' },
        { id: 'audio-track', type: 'audio', label: 'Narração' },
        { id: 'music-track', type: 'audio', label: 'Música de Fundo' },
    ]);

    // Caption Settings
    const [showCaptions, setShowCaptions] = useState(false);
    const [captionStyle, setCaptionStyle] = useState({
        fontSize: 24,
        color: '#ffffff',
        showBackground: true,
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    });

    // Advanced Features Lists
    const transitionOptions = [
        { id: 'none', label: 'Nenhuma', icon: '⛔' },
        { id: 'fade', label: 'Fade', icon: '✨' },
        { id: 'slide-left', label: 'Slide Esq.', icon: '⬅️' },
        { id: 'slide-right', label: 'Slide Dir.', icon: '➡️' },
        { id: 'wipe', label: 'Wipe', icon: '🧹' },
        { id: 'page-turn', label: 'Livro', icon: '📖' }
    ];

    // Global Settings State
    // Global Settings State
    const [backgroundVolume, setBackgroundVolume] = useState(1.0);
    const [selectedTransition, setSelectedTransition] = useState('page-turn');
    const [visualEffect, setVisualEffect] = useState('ken-burns'); // 'none' | 'ken-burns'
    const [effectDuration, setEffectDuration] = useState(3);
    const [showSparkles, setShowSparkles] = useState(true);
    const [narrationLanguage, setNarrationLanguage] = useState<'pt' | 'en'>('pt');

    // Handlers
    const handleSelectMusic = (file: any) => {
        setClips((prev) => {
            // Remove existing music track
            const filtered = prev.filter(c => c.trackId !== 'music-track');
            // Add new music clip
            const newClip: TimelineClip = {
                id: `music - ${Date.now()} `,
                type: 'audio',
                track: 2, // Assuming track 2 is for music (based on previous logic)
                trackId: 'music-track',
                startTime: 0,
                duration: totalDuration || 300, // Cover whole video
                sceneId: 'bg-music-global',
                audioUrl: file.url,
                name: file.name
            };
            return [...filtered, newClip];
        });
    };

    const handleSelectLogo = (file: any) => {
        setClips((prev) => {
            const filtered = prev.filter(c => c.trackId !== 'logo-track');
            const newClip: TimelineClip = {
                id: `logo - ${Date.now()} `,
                type: 'video', // Using 'video' type but treating as image overlay
                track: 99, // High track number for overlay
                trackId: 'logo-track',
                startTime: 0,
                duration: totalDuration || 300,
                sceneId: 'global-logo',
                imageUrl: file.url
            };
            return [...filtered, newClip];
        });
    };

    useEffect(() => {
        initializeTimeline();
        // Defer heavy DB load to allow UI to paint first
        setTimeout(loadLibraryFiles, 500);
    }, []);

    // Helper to ensure Global Tracks (Logo, Music) match visual duration
    const ensureGlobalTracksSync = (currentClips: TimelineClip[]) => {
        const visualClips = currentClips.filter(c => c.trackId === 'media-track');
        if (visualClips.length === 0) return currentClips;

        // 1. Calculate Total Video Duration
        const visualDuration = visualClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);

        // 2. Adjust Logo Track
        // Find existing logo clips
        const logoClips = currentClips.filter(c => c.trackId === 'logo-track');
        let newClips = currentClips.filter(c => c.trackId !== 'logo-track'); // Remove old logos to replace

        logoClips.forEach(logo => {
            // Re-add logo with duration matching video
            newClips.push({
                ...logo,
                startTime: 0,
                duration: visualDuration
            });
        });

        // 3. Adjust Music Track (Loop & Trim)
        // Find original music source (assuming first music clip serves as source for looping)
        const musicClips = currentClips.filter(c => c.trackId === 'music-track');

        if (musicClips.length > 0) {
            // Remove all current music clips to rebuild the track
            newClips = newClips.filter(c => c.trackId !== 'music-track');

            // Setup source from the first music clip found (preserving ID/Url)
            const sourceMusic = musicClips[0];

            newClips.push({
                ...sourceMusic,
                startTime: 0,
                duration: visualDuration
            });
        }

        return newClips;
    };

    // Load library files from IndexedDB
    const loadLibraryFiles = async () => {
        try {
            console.log('[TimelinePage] Fetching library files...');
            const files = await storage.getAllFiles();
            setLibraryFiles(files);
            console.log(`[TimelinePage] Loaded ${files.length} library files.`);

            // Auto-select default PT Logo if no logo track exists
            const hasLogo = clips.some(c => c.trackId === 'logo-track');
            if (!hasLogo) {
                const defaultLogo = files.find(f => f.category === 'logo' && f.isDefault && (!f.language || f.language === 'pt'));
                if (defaultLogo) {
                    handleSelectLogo(defaultLogo);
                }
            }

            // Auto-select default PT EndCard
            const defaultEndCard = files.find(f => f.category === 'ending_card' && f.isDefault && (!f.language || f.language === 'pt'));
            if (defaultEndCard) {
                setClips(prev => {
                    const hasEndCard = prev.some(c => c.sceneId === 'end-card-auto');
                    if (hasEndCard) return prev;

                    const mediaClips = prev.filter(c => c.trackId === 'media-track');
                    const lastClip = mediaClips.sort((a, b) => (a.startTime + a.duration) - (b.startTime + b.duration)).pop();
                    const startTime = lastClip ? (lastClip.startTime + lastClip.duration) : 0;

                    const newClip: TimelineClip = {
                        id: `endcard - ${Date.now()} `,
                        type: 'video',
                        track: 1,
                        trackId: 'media-track',
                        startTime: startTime,
                        duration: 5,
                        sceneId: 'end-card-auto',
                        imageUrl: defaultEndCard.url,
                        name: defaultEndCard.name
                    };

                    return [...prev, newClip];
                });
            }

            // Auto-select Default Music
            const defaultMusic = files.find(f => f.category === 'music' && f.isDefault);
            if (defaultMusic) {
                setClips(prev => {
                    // Avoid duplicates if already has music
                    if (prev.some(c => c.trackId === 'music-track')) return ensureGlobalTracksSync(prev);

                    const newClip: TimelineClip = {
                        id: `music - ${Date.now()} `,
                        type: 'audio',
                        track: 2,
                        trackId: 'music-track',
                        startTime: 0,
                        duration: 300,
                        sceneId: 'bg-music-auto',
                        audioUrl: defaultMusic.url,
                        name: defaultMusic.name
                    };
                    // Apply sync after adding
                    return ensureGlobalTracksSync([...prev, newClip]);
                });
            } else {
                // Even if no music added, sync existing logo/tracks
                setClips(prev => ensureGlobalTracksSync(prev));
            }
        } catch (err) {
            console.error('[TimelinePage] Error loading library files:', err);
        }
    };

    // Set dark background for body and html when in editor mode
    useEffect(() => {
        const originalBodyBg = document.body.style.backgroundColor;
        const originalHtmlBg = document.documentElement.style.backgroundColor;
        const originalBodyMargin = document.body.style.margin;
        const originalBodyPadding = document.body.style.padding;

        document.body.style.backgroundColor = '#1a1a1a';
        document.documentElement.style.backgroundColor = '#1a1a1a';
        document.body.style.margin = '0';
        document.body.style.padding = '0';

        return () => {
            document.body.style.backgroundColor = originalBodyBg;
            document.documentElement.style.backgroundColor = originalHtmlBg;
            document.body.style.margin = originalBodyMargin;
            document.body.style.padding = originalBodyPadding;
        };
    }, []);

    // Handle Media Import
    const handleMediaImport = () => {
        fileInputRef.current?.click();
    };

    // Handle Export
    const handleExport = async () => {
        if (videoPreviewRef.current) {
            setIsExporting(true);
            try {
                await videoPreviewRef.current.exportVideo();
            } catch (err) {
                console.error("Export failed", err);
                setError("Falha na exportação. Tente novamente.");
            } finally {
                setIsExporting(false);
            }
        }
    };

    const handleCancelExport = () => {
        if (videoPreviewRef.current) {
            videoPreviewRef.current.cancelExport();
            setIsExporting(false);
        }
    };

    // Audio Preview State
    const [previewAudioId, setPreviewAudioId] = useState<string | null>(null);
    const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);
    const audioContextRef = React.useRef<AudioContext | null>(null);

    const toggleAudioPreview = (e: React.MouseEvent, file: StoredFile) => {
        e.stopPropagation();

        // 1. Stop Current Playback
        if (audioPreviewRef.current) {
            audioPreviewRef.current.pause();
            audioPreviewRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        // If clicking same file, just stop (already done above) and clear state
        if (previewAudioId === file.id) {
            setPreviewAudioId(null);
            return;
        }

        // 2. Start New Playback with Boost
        try {
            const audio = new Audio(file.url);
            audio.crossOrigin = 'anonymous';

            // Boost Volume using Web Audio API
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const source = ctx.createMediaElementSource(audio);
            const gainNode = ctx.createGain();

            gainNode.gain.value = 2.5; // 250% Volume Boost

            source.connect(gainNode);
            gainNode.connect(ctx.destination);

            audio.onended = () => {
                setPreviewAudioId(null);
                ctx.close().catch(() => { });
            };

            audio.play().catch(err => console.error('Preview play error:', err));

            audioPreviewRef.current = audio;
            audioContextRef.current = ctx;
            setPreviewAudioId(file.id);
        } catch (err) {
            console.error('Audio boost failed, falling back to normal:', err);
            // Fallback to standard player
            const audio = new Audio(file.url);
            audio.volume = 1.0;
            audio.onended = () => setPreviewAudioId(null);
            audio.play();
            audioPreviewRef.current = audio;
            setPreviewAudioId(file.id);
        }
    };

    // Clean up audio on unmount
    useEffect(() => {
        return () => {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { });
            }
        };
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        try {
            const fileList = Array.from(files);
            for (const file of fileList) {
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                    reader.onload = async () => {
                        const base64 = reader.result as string;
                        let category: any = 'media';

                        // Determinar categoria baseado no painel ativo ou tipo
                        if (activePanel === 'music') category = 'music';
                        else if (activePanel === 'logos') category = 'logo';
                        else if (activePanel === 'endcards') category = 'ending_card';
                        else if (activePanel === 'thumbnail') category = 'thumbnail';
                        else if (file.type.startsWith('audio')) category = 'music';

                        const newFile: StoredFile = {
                            id: crypto.randomUUID(),
                            name: file.name,
                            url: base64, // Saves locally with Base64 immediately
                            type: file.type.startsWith('audio') ? 'audio' : 'image',
                            category: category,
                            isDefault: false,
                            language: narrationLanguage,
                            createdAt: Date.now()
                        };

                        await storage.saveFile(newFile);
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            }

            // Reload library to show new files
            await loadLibraryFiles();

        } catch (error) {
            console.error('Error uploading file:', error);
            setError('Falha ao salvar arquivo na biblioteca.');
        } finally {
            setLoading(false);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const initializeTimeline = async () => {
        try {
            setLoading(true);

            // Check if we already have audio URLs from a previous step
            const existingAudioUrls = (storyWithScenes as any).audioUrls as Record<string, string> | undefined;

            if (existingAudioUrls && Object.keys(existingAudioUrls).length > 0) {
                console.log('[TimelinePage] Using existing audio URLs');
                setAudioUrls(existingAudioUrls);
                calculateTimeline(existingAudioUrls);
            } else {
                // No audio - initialize timeline with images only
                console.log('[TimelinePage] Initializing timeline without audio (audio generation moved to Narration step)');
                calculateTimeline({});
            }

            setLoading(false);
        } catch (err: any) {
            console.error('[TimelinePage] Error:', err);
            setError(err.message || 'Erro ao inicializar');
            setLoading(false);
        }
    };

    // Note: Audio generation has been moved to the Narration step
    // This page now only handles timeline/editor functionality


    const calculateTimeline = (urls: Record<string, string>) => {
        const newClips: TimelineClip[] = [];
        let currentStartTime = 0;

        storyWithScenes.scenes.forEach((scene) => {
            const sceneId = scene.id;
            const audioUrl = urls[sceneId];
            const audioDuration = Math.max(3, scene.narrationText.length / 15);
            const clipDuration = audioDuration + 1;

            newClips.push({
                id: `video - ${sceneId} `,
                type: 'video',
                track: 1,
                trackId: 'media-track',
                startTime: currentStartTime,
                duration: clipDuration,
                sceneId,
                imageUrl: scene.imageUrl
            });

            if (audioUrl) {
                newClips.push({
                    id: `audio - ${sceneId} `,
                    type: 'audio',
                    track: 2,
                    trackId: 'audio-track',
                    startTime: currentStartTime,
                    duration: audioDuration,
                    sceneId,
                    audioUrl,
                    name: `Narração Cena ${storyWithScenes.scenes.findIndex(s => s.id === sceneId) + 1} `
                });
            }

            newClips.push({
                id: `caption - ${sceneId} `,
                type: 'caption',
                track: 0,
                startTime: currentStartTime,
                duration: audioDuration,
                sceneId,
                text: scene.narrationText
            });

            currentStartTime += clipDuration;
        });

        setClips(newClips);
        setTotalDuration(currentStartTime);
    };

    const handleConfirm = () => {
        onComplete({
            ...storyWithScenes,
            clips,
            totalDuration,
            audioUrls
        });
    };

    const handleClipDelete = (clipId: string) => {
        setClips(clips.filter(c => c.id !== clipId));
    };

    // Drag & Drop handlers for media items
    const handleDragStart = (e: React.DragEvent, type: 'media' | 'audio', data: any) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, data }));
        setDraggedItem({ type, data });
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const handleDropOnTimeline = useCallback(async (trackId: string, data: { type: 'media' | 'audio'; data: any }, dropTime: number) => {
        const newClipId = `custom - ${Date.now()} `;

        let defaultDuration = data.type === 'audio' ? 10 : 5;

        if (data.type === 'audio' && data.data.url) {
            try {
                const audio = new Audio(data.data.url);
                audio.preload = 'metadata';
                await new Promise<void>((resolve) => {
                    audio.onloadedmetadata = () => resolve();
                    audio.onerror = () => resolve();
                    setTimeout(resolve, 1000);
                });
                if (audio.duration && Number.isFinite(audio.duration)) {
                    defaultDuration = audio.duration;
                }
            } catch (e) {
                console.warn('Could not detect audio duration:', e);
            }
        }

        setClips(prev => {
            // Check for collision with existing clip in the target track
            // If dropping on top of a clip, snap to its start and push it (Ripple Insert Before)
            const conflictClip = prev.find(c => c.trackId === trackId && c.startTime <= dropTime && (c.startTime + c.duration) > dropTime);

            const finalStartTime = conflictClip ? conflictClip.startTime : dropTime;

            // Shift future clips in the same track
            const updatedClips = prev.map(c => {
                if (c.trackId === trackId && c.startTime >= finalStartTime) {
                    return { ...c, startTime: c.startTime + defaultDuration };
                }
                return c;
            });

            const newClip: TimelineClip = {
                id: newClipId,
                type: data.type === 'audio' ? 'audio' : 'video',
                track: data.type === 'audio' ? 2 : 1,
                trackId: trackId,
                startTime: finalStartTime,
                duration: defaultDuration,
                sceneId: newClipId,
                ...(data.type === 'audio' ? { audioUrl: data.data.url } : { imageUrl: data.data.imageUrl || data.data.url }),
                name: data.data.name || (data.type === 'audio' ? 'Áudio' : 'Clip')
            };

            return [...updatedClips, newClip];
        });
    }, []);

    // Add new empty track
    const handleAddTrack = (type: 'media' | 'audio') => {
        const timestamp = Date.now();
        const existingOfType = customTracks.filter(t => t.type === type).length;
        const newTrack: TimelineTrack = {
            id: `${type} -${timestamp} `,
            type,
            label: `${type === 'media' ? 'Mídia' : 'Áudio'} ${existingOfType + 1} `
        };
        // Add track - it will be empty, ready to receive dragged elements
        setCustomTracks(prev => [...prev, newTrack]);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')} `;
    };

    // Loading state
    if (loading) {
        return (
            <div className="h-screen bg-[#16161e] flex items-center justify-center">
                <div className="bg-[#1e1e2e] rounded-2xl p-8 max-w-md w-full text-center border border-[#2a2a3e]">
                    <Loader2 className="w-16 h-16 text-red-500 animate-spin mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">
                        {generatingAudio ? 'Gerando Áudio' : 'Preparando Timeline'}
                    </h2>
                    {generatingAudio && (
                        <>
                            <p className="text-gray-400 mb-4">Criando narração...</p>
                            <div className="w-full bg-[#2a2a3e] rounded-full h-2 mb-2">
                                <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${audioProgress}% ` }} />
                            </div>
                            <p className="text-sm text-gray-500">{audioProgress}%</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="h-screen bg-[#16161e] flex items-center justify-center">
                <div className="bg-[#1e1e2e] rounded-2xl p-8 max-w-md w-full text-center border border-[#2a2a3e]">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Erro</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button onClick={onBack} className="px-6 py-3 bg-[#2a2a3e] text-white rounded-lg hover:bg-[#3a3a4e]">
                        ← Voltar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen flex flex-col bg-[#1a1a1a] overflow-hidden fixed inset-0">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-3 md:px-6 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex-shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white">
                        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <span className="text-white font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-none">{storyWithScenes.title || 'Editor'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        disabled={isExporting}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        Voltar
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/20 transition-all font-medium text-sm flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {isExporting ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Exportando...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Exportar Vídeo
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex gap-2 md:gap-4 p-2 md:p-4 overflow-hidden min-h-0">
                {/* Left Sidebar - Icon Menu */}
                <div className="w-12 md:w-16 bg-[#1f1f1f] rounded-xl flex flex-col items-center py-3 md:py-4 gap-4 md:gap-6 flex-shrink-0">
                    <button
                        onClick={() => setActivePanel('narration')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'narration' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Mic className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Narração</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('media')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'media' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Image className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Mídia</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('music')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'music' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Music className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Música</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('thumbnail')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'thumbnail' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Layout className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Capa</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('logos')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'logos' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <FileImage className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Logos</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('endcards')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'endcards' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Cartões</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('transitions')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'transitions' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Sparkles className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Trans.</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('effects')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'effects' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Wand2 className="w-5 h-5" />
                        <span className="text-[10px] mt-1">FX</span>
                    </button>
                    <button
                        onClick={() => setActivePanel('subtitles')}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${activePanel === 'subtitles' ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <MessageSquareQuote className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Legendas</span>
                    </button>
                    <button className="w-10 h-10 md:w-12 md:h-12 bg-[#2a2a2a] rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-[#3a3a3a] hover:text-white transition-colors">
                        <Type className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Texto</span>
                    </button>
                </div>

                {/* Media/Music/Logos/Endcards Panel - Hidden on mobile */}
                <div className="hidden lg:flex w-48 xl:w-56 bg-[#1f1f1f] rounded-xl flex-col flex-shrink-0 overflow-hidden">
                    <div className="p-3 md:p-4 border-b border-[#2a2a2a]">
                        <h3 className="text-white font-medium text-sm mb-3">
                            {activePanel === 'narration' && 'Configurações de Narração'}
                            {activePanel === 'media' && 'Minha mídia'}
                            {activePanel === 'music' && 'Fundo musical'}
                            {activePanel === 'thumbnail' && 'Capa / Thumbnail'}
                            {activePanel === 'logos' && 'Logos'}
                            {activePanel === 'endcards' && 'Cartões finais'}
                        </h3>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,audio/*"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={handleMediaImport}
                            className={`w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2 ${activePanel === 'subtitles' ? 'hidden' : ''}`}
                        >
                            <Upload className="w-4 h-4" />
                            Importar {activePanel === 'music' ? 'áudio' : activePanel === 'logos' ? 'logo' : activePanel === 'endcards' ? 'cartão' : activePanel === 'thumbnail' ? 'capa' : 'mídia'}
                        </button>
                    </div>

                    {/* Content Grid - Scrollable with Drag Support */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-3">
                        {activePanel === 'narration' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-[#2a2a2a] rounded-lg space-y-3">
                                    <label className="text-xs text-gray-400 block mb-2">Idioma da História</label>
                                    <select
                                        value={narrationLanguage}
                                        onChange={(e) => setNarrationLanguage(e.target.value as 'pt' | 'en')}
                                        className="w-full bg-[#1a1a1a] text-white text-sm rounded-lg p-2.5 border border-[#3a3a3a] focus:border-red-500 focus:outline-none"
                                    >
                                        <option value="pt">Português (Brasil)</option>
                                        <option value="en">Inglês (Em breve)</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 italic">
                                        Ao alterar o idioma, os recursos visuais (logotipos e cartões) serão filtrados automaticamente.
                                    </p>
                                </div>
                            </div>
                        )}
                        {activePanel === 'subtitles' && (
                            <div className="space-y-6">
                                {/* Toggle Visibility */}
                                <div className="flex items-center justify-between p-2 bg-[#2a2a2a] rounded-lg">
                                    <span className="text-gray-300 text-sm font-medium">Exibir Legendas</span>
                                    <button
                                        onClick={() => setShowCaptions(!showCaptions)}
                                        className={`w-10 h-5 rounded-full p-0.5 transition-colors ${showCaptions ? 'bg-red-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow ${showCaptions ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {showCaptions && (
                                    <>
                                        {/* Font Size */}
                                        <div className="space-y-2 px-1">
                                            <div className="flex justify-between">
                                                <label className="text-xs text-gray-500">Tamanho</label>
                                                <span className="text-xs text-gray-400">{captionStyle.fontSize}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="16"
                                                max="64"
                                                value={captionStyle.fontSize}
                                                onChange={(e) => setCaptionStyle({ ...captionStyle, fontSize: parseInt(e.target.value) })}
                                                className="w-full accent-purple-600 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>

                                        {/* Colors */}
                                        <div className="space-y-3 px-1">
                                            <label className="text-xs text-gray-500">Cor do Texto</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {['#ffffff', '#fff100', '#00ff00', '#ff0000', '#00ffff'].map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setCaptionStyle({ ...captionStyle, color })}
                                                        className={`w-8 h-8 rounded-full border-2 ${captionStyle.color === color ? 'border-red-500' : 'border-transparent'}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                                <input
                                                    type="color"
                                                    value={captionStyle.color}
                                                    onChange={(e) => setCaptionStyle({ ...captionStyle, color: e.target.value })}
                                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 overflow-hidden"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between px-1 p-2 bg-[#2a2a2a] rounded-lg">
                                            <label className="text-xs text-gray-300">Tarja Escura</label>
                                            <input
                                                type="checkbox"
                                                checked={captionStyle.showBackground}
                                                onChange={(e) => setCaptionStyle({ ...captionStyle, showBackground: e.target.checked })}
                                                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {activePanel === 'media' && (
                            <>
                                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                    <GripVertical className="w-3 h-3" /> Arraste para a timeline
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {storyWithScenes.scenes.map((scene, idx) => (
                                        <div
                                            key={scene.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'media', scene)}
                                            onDragEnd={handleDragEnd}
                                            className="aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing hover:ring-2 ring-purple-500 transition-all relative group"
                                        >
                                            {scene.imageUrl ? (
                                                <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                                    {idx + 1}
                                                </div>
                                            )}
                                            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <GripVertical className="w-4 h-4 text-white drop-shadow-lg" />
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white text-[10px] truncate">cena_{idx}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        {activePanel === 'music' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                    <label className="text-xs text-gray-400 mb-2 block font-medium">Volume da Música</label>
                                    <div className="flex items-center gap-3">
                                        <Volume2 className="w-4 h-4 text-gray-400" />
                                        <input
                                            type="range"
                                            min="0" max="1" step="0.1"
                                            value={backgroundVolume}
                                            onChange={(e) => setBackgroundVolume(parseFloat(e.target.value))}
                                            className="flex-1 accent-purple-600 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <span className="text-xs text-gray-400 w-8 text-right">{Math.round(backgroundVolume * 100)}%</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {libraryFiles
                                        .filter(f => f.category === 'music')
                                        .map((file) => (
                                            <div
                                                key={file.id}
                                                className="aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-purple-500 transition-all relative group"
                                            >
                                                {/* Card Content - Click adds to timeline */}
                                                <div
                                                    className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-[#2a2a2a]"
                                                    onClick={() => handleSelectMusic(file)}
                                                >
                                                    <Music className="w-8 h-8 text-purple-400" />
                                                </div>

                                                {/* Play Button Overlay - Click toggles preview */}
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        onClick={(e) => toggleAudioPreview(e, file)}
                                                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                                    >
                                                        {previewAudioId === file.id ? (
                                                            <Pause className="w-4 h-4 text-purple-600 fill-current" />
                                                        ) : (
                                                            <Play className="w-4 h-4 text-purple-600 fill-current ml-0.5" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <div className="bg-red-600 rounded-full p-1">
                                                        <Plus className="w-3 h-3 text-white" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                                    <p className="text-white text-[10px] truncate">{file.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    {libraryFiles.filter(f => f.category === 'music').length === 0 && (
                                        <div className="text-center text-gray-400 text-xs py-8 col-span-2">
                                            <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            Nenhum áudio cadastrado
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activePanel === 'thumbnail' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-[#2a2a2a] rounded-lg">
                                    <label className="text-xs text-gray-400 block mb-2">Idioma da Capa</label>
                                    <select
                                        value={narrationLanguage}
                                        onChange={(e) => setNarrationLanguage(e.target.value as 'pt' | 'en')}
                                        className="w-full bg-[#1a1a1a] text-white text-sm rounded-lg p-2.5 border border-[#3a3a3a] focus:border-red-500 focus:outline-none"
                                    >
                                        <option value="pt">Português (Brasil)</option>
                                        <option value="en">Inglês (Em breve - Gerar)</option>
                                    </select>
                                </div>

                                {narrationLanguage === 'en' ? (
                                    <div className="text-center py-8 bg-[#2a2a2a] rounded-lg border border-dashed border-gray-700">
                                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Layout className="w-6 h-6 text-gray-500" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-300">Em breve</p>
                                        <p className="text-xs text-gray-500 mt-1 px-4">A geração automática de thumbnails em inglês estará disponível futuramente.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Current Story Thumbnail (if exists) */}
                                        {storyWithScenes.thumbnailUrl && (
                                            <div className="aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden relative group ring-2 ring-red-500/50">
                                                <img src={storyWithScenes.thumbnailUrl} alt="Atual" className="w-full h-full object-cover" />
                                                <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                                                    ATUAL
                                                </div>
                                            </div>
                                        )}

                                        {/* Library Thumbnails */}
                                        {libraryFiles
                                            .filter(f => f.category === 'thumbnail' && (!f.language || f.language === 'pt'))
                                            .map((file) => (
                                                <div
                                                    key={file.id}
                                                    className="aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-red-500 transition-all relative group"
                                                    onClick={() => {/* Logic to set story thumbnail would go here, but storyWithScenes is prop. We might need a callback prop onSetThumbnail? For now just visual selection logic */ }}
                                                >
                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <p className="text-white text-[10px] truncate">{file.name}</p>
                                                    </div>
                                                </div>
                                            ))}

                                        {!storyWithScenes.thumbnailUrl && libraryFiles.filter(f => f.category === 'thumbnail' && (!f.language || f.language === 'pt')).length === 0 && (
                                            <div className="text-center text-gray-400 text-xs py-8 col-span-2">
                                                <Layout className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                Nenhuma capa PT encontrada
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {activePanel === 'logos' && (
                            <div className="grid grid-cols-2 gap-2">
                                {libraryFiles
                                    .filter(f => f.category === 'logo' && (!f.language || f.language === narrationLanguage))
                                    .map((file) => (
                                        <div
                                            key={file.id}
                                            onClick={() => handleSelectLogo(file)}
                                            className="aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-red-500 transition-all relative group"
                                        >
                                            {file.url && (
                                                <img src={file.url} alt={file.name} className="w-full h-full object-contain bg-gray-800" />
                                            )}
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-red-600 rounded-full p-1">
                                                    <Plus className="w-3 h-3 text-white" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white text-[10px] truncate">{file.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                {libraryFiles.filter(f => f.category === 'logo' && (!f.language || f.language === narrationLanguage)).length === 0 && (
                                    <div className="text-center text-gray-400 text-xs py-8 col-span-2">
                                        <FileImage className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        Nenhum logo {narrationLanguage.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        )}
                        {activePanel === 'transitions' && (
                            <div className="grid grid-cols-3 gap-2">
                                {transitionOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setSelectedTransition(opt.id)}
                                        className={`flex flex - col items - center justify - center p - 3 rounded - lg gap - 2 transition - colors ${selectedTransition === opt.id ? 'bg-red-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'} `}
                                    >
                                        <span className="text-2xl">{opt.icon}</span>
                                        <span className="text-[10px] text-center">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {activePanel === 'effects' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-[#2a2a2a] rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-200">Zoom In (Ken Burns)</span>
                                        <input
                                            type="checkbox"
                                            checked={visualEffect === 'ken-burns'}
                                            onChange={(e) => setVisualEffect(e.target.checked ? 'ken-burns' : 'none')}
                                            className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                                        />
                                    </div>
                                    {visualEffect === 'ken-burns' && (
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs text-gray-400">Duração do Efeito</label>
                                                <span className="text-xs text-gray-400">{effectDuration}s</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1" max="10"
                                                value={effectDuration}
                                                onChange={(e) => setEffectDuration(parseInt(e.target.value))}
                                                className="w-full accent-purple-600 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-[#3a3a3a]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">✨</span>
                                            <span className="text-sm font-medium text-gray-200">Brilhos Mágicos</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={showSparkles}
                                            onChange={(e) => setShowSparkles(e.target.checked)}
                                            className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {activePanel === 'endcards' && (
                            <div className="grid grid-cols-2 gap-2">
                                {libraryFiles
                                    .filter(f => f.category === 'ending_card' && (!f.language || f.language === narrationLanguage))
                                    .map((file) => (
                                        <div
                                            key={file.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, 'media', file)}
                                            onDragEnd={handleDragEnd}
                                            className="aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing hover:ring-2 ring-purple-500 transition-all relative group"
                                        >
                                            {file.url && (
                                                <img src={file.url} alt={file.name} className="w-full h-full object-cover" draggable={false} />
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white text-[10px] truncate">{file.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                {libraryFiles.filter(f => f.category === 'ending_card' && (!f.language || f.language === narrationLanguage)).length === 0 && (
                                    <div className="text-center text-gray-400 text-xs py-8 col-span-2">
                                        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        Nenhum cartão {narrationLanguage.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content - Preview + Timeline in Single Block */}
                <div className="flex-1 bg-[#1f1f1f] rounded-xl flex flex-col overflow-hidden min-w-0">
                    <div className="h-[45%] w-full flex items-center justify-center p-3 min-h-0 flex-shrink-0 relative">
                        {isExporting && (
                            <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md">
                                <div className="bg-[#1e1e2e] border border-[#2a2a3e] p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
                                    {/* Animated Background */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-gradient-x" />

                                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                        <Download className="w-8 h-8 text-red-500" />
                                    </div>

                                    <h3 className="text-2xl font-bold text-white mb-2">Exportando Vídeo</h3>
                                    <p className="text-gray-400 text-sm mb-6">
                                        O vídeo está sendo renderizado em tempo real. <br />
                                        Por favor, não feche esta aba.
                                    </p>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-[#2a2a3e] rounded-full h-4 mb-2 overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-red-600 to-orange-600 transition-all duration-300 ease-out relative"
                                            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-8 font-mono">
                                        <span>Processando...</span>
                                        <span>{(currentTime / totalDuration * 100).toFixed(0)}%</span>
                                    </div>

                                    <button
                                        onClick={handleCancelExport}
                                        className="text-gray-500 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium border border-gray-700 hover:border-gray-500"
                                    >
                                        Cancelar Exportação
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="h-full aspect-video shadow-lg">
                            <VideoPreview
                                ref={videoPreviewRef}
                                clips={clips}
                                currentTime={currentTime}
                                totalDuration={totalDuration}
                                isPlaying={isPlaying}
                                onTimeUpdate={setCurrentTime}
                                onPlayPause={() => setIsPlaying(!isPlaying)}
                                onStop={() => { setIsPlaying(false); setCurrentTime(0); }}
                                hideControls={true}
                                compact={true}
                                showCaptions={showCaptions}
                                captionStyle={captionStyle}
                                musicVolume={backgroundVolume}
                                transitionType={selectedTransition}
                                visualEffect={visualEffect}
                                effectDuration={effectDuration}
                                showSparkles={showSparkles}
                            />
                        </div>
                    </div>

                    {/* Timeline Section - Larger (approximately 65% of height) */}
                    <div className="flex-1 border-t border-[#2a2a2a] flex flex-col min-h-0">
                        {/* Playback Controls - Centralized */}
                        <div className="flex items-center justify-between py-2 px-4 border-b border-[#2a2a2a] flex-shrink-0">
                            {/* Left - Zoom Controls + Add Track */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTimelineZoom(Math.max(5, timelineZoom - 10))}
                                    className="p-1.5 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Zoom out"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-gray-500 w-10 text-center">{timelineZoom}%</span>
                                <button
                                    onClick={() => setTimelineZoom(Math.min(200, timelineZoom + 10))}
                                    className="p-1.5 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Zoom in"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                                <div className="w-px h-5 bg-[#3a3a3a] mx-2" />
                                <button
                                    onClick={() => handleAddTrack('media')}
                                    className="p-1.5 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                                    title="Adicionar track de mídia"
                                >
                                    <Plus className="w-3 h-3" />
                                    <Image className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => handleAddTrack('audio')}
                                    className="p-1.5 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                                    title="Adicionar track de áudio"
                                >
                                    <Plus className="w-3 h-3" />
                                    <Music className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Center - Play Controls and Time */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                                    className="p-1.5 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Voltar 5s"
                                >
                                    <SkipBack className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="w-9 h-9 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors shadow-lg"
                                    title={isPlaying ? "Pausar" : "Reproduzir"}
                                >
                                    {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                                </button>

                                <button
                                    onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 5))}
                                    className="p-1.5 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title="Avançar 5s"
                                >
                                    <SkipForward className="w-4 h-4" />
                                </button>

                                <div className="text-xs text-gray-400 font-mono ml-2">
                                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                                </div>
                            </div>

                            {/* Right - Track Info */}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Layers className="w-4 h-4" />
                                <span>{customTracks.length} tracks</span>
                            </div>
                        </div>

                        {/* Timeline Component - Takes remaining space */}
                        <div
                            className="flex-1 bg-[#1a1a1a] overflow-hidden min-h-0"
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                try {
                                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    // Calculate time based on scroll? The rect is container, container scrolls?
                                    // rect.left is viewport relative. element scrollLeft affects content.
                                    // e.clientX - rect.left is position within visible area.
                                    // Add scrollLeft to get absolute position in timeline width?
                                    // No, dropTime logic before seemed simplistic: `(e.clientX - rect.left) / zoom`.
                                    // If scrolled, this inserts at screen position + 0? Usually we add scroll.
                                    // But Timeline renders absolute content.
                                    // Let's assume user scrolls to see insertion point.
                                    // If we use scrollLeft:
                                    const scrollLeft = e.currentTarget.scrollLeft;
                                    const dropTime = ((e.clientX - rect.left + scrollLeft - 80) / timelineZoom); // 80 is LABEL_WIDTH

                                    // Detect target track
                                    const target = e.target as HTMLElement;
                                    const trackElement = target.closest('[data-track-id]');
                                    let trackId = trackElement?.getAttribute('data-track-id');

                                    // Smart Default Fallback
                                    if (!trackId) {
                                        if (data.type === 'audio') trackId = 'music-track';
                                        else trackId = 'media-track';
                                    }

                                    handleDropOnTimeline(trackId, data, Math.max(0, dropTime));
                                } catch (err) {
                                    console.error('Drop error:', err);
                                }
                            }}
                        >
                            <Timeline
                                clips={clips}
                                currentTime={currentTime}
                                totalDuration={totalDuration}
                                zoom={timelineZoom}
                                onTimeUpdate={setCurrentTime}
                                onClipsChange={setClips}
                                onClipDelete={handleClipDelete}
                                selectedClipId={selectedClipId}
                                onClipSelect={setSelectedClipId}
                                customTracks={customTracks.filter(t => showCaptions || t.type !== 'caption')}
                                isDraggingExternal={!!draggedItem}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
