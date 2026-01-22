import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Pause, Volume2, Loader2 } from 'lucide-react';
import type { StoryWithScenes, TimelineClip } from '../../types/studio';
import { generateAudioNarration } from '../../services/tts';
import { VideoPreview } from './VideoPreview';
import { Timeline } from './Timeline';

interface TimelinePageProps {
    storyWithScenes: StoryWithScenes;
    onComplete: (storyWithTimeline: any) => void;
    onBack: () => void;
}

export function TimelinePage({ storyWithScenes, onComplete, onBack }: TimelinePageProps) {
    // SAFETY CHECK: Ensure scenes exist before proceeding
    if (!storyWithScenes?.scenes || storyWithScenes.scenes.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro</h2>
                    <p className="text-gray-600 mb-6">Nenhuma cena encontrada. Volte e regenere as cenas.</p>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                    >
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
    const [galleryTab, setGalleryTab] = useState<'media' | 'audio' | 'effects'>('media');
    const [timelineZoom, setTimelineZoom] = useState(50);
    const [error, setError] = useState('');

    useEffect(() => {
        initializeTimeline();
    }, []);

    const initializeTimeline = async () => {
        try {
            setLoading(true);
            setGeneratingAudio(true);

            // Generate audio for all scenes
            await generateAllAudio();

            setGeneratingAudio(false);
            setLoading(false);
        } catch (err: any) {
            console.error('[TimelinePage] Error initializing:', err);
            setError(err.message || 'Erro ao inicializar timeline');
            setLoading(false);
        }
    };

    const generateAllAudio = async () => {
        const urls: Record<string, string> = {};
        const totalScenes = storyWithScenes.scenes.length;

        for (let i = 0; i < totalScenes; i++) {
            const scene = storyWithScenes.scenes[i];
            setAudioProgress(Math.round((i / totalScenes) * 100));

            try {
                console.log(`[TimelinePage] Generating audio for scene ${i + 1}/${totalScenes}`);

                // Generate speech using Gemini TTS
                const audioUrl = await generateAudioNarration({
                    text: scene.narrationText,
                    emotion: (storyWithScenes.emotion as any) || 'warmly',
                    voiceName: storyWithScenes.voiceName || 'Puck'
                });
                urls[scene.id] = audioUrl;

                console.log(`[TimelinePage] Audio generated for scene ${scene.id}`);
            } catch (err: any) {
                console.error(`[TimelinePage] Error generating audio for scene ${scene.id}:`, err);
                // Continue with other scenes even if one fails
            }
        }

        setAudioUrls(urls);
        setAudioProgress(100);

        // Calculate clips and timeline
        calculateTimeline(urls);
    };

    const calculateTimeline = (urls: Record<string, string>) => {
        const newClips: TimelineClip[] = [];
        let currentStartTime = 0;

        storyWithScenes.scenes.forEach((scene, index) => {
            const sceneId = scene.id;
            const audioUrl = urls[sceneId];

            // Calculate duration based on text length (audio duration)
            // This ensures video matches audio - no gaps!
            const audioDuration = Math.max(3, scene.narrationText.length / 15); // ~15 chars per second
            const clipDuration = audioDuration + 1; // Add 1s buffer for smooth transitions

            // Create video clip (image) - duration matches audio!
            newClips.push({
                id: `video-${sceneId}`,
                type: 'video',
                track: 1, // Video track
                startTime: currentStartTime,
                duration: clipDuration, // FIXED: Now matches audio duration
                sceneId,
                imageUrl: scene.imageUrl
            });

            // Create audio clip (narration)
            if (audioUrl) {
                newClips.push({
                    id: `audio-${sceneId}`,
                    type: 'audio',
                    track: 2, // Sound track
                    startTime: currentStartTime,
                    duration: audioDuration, // Use actual audio duration
                    sceneId,
                    audioUrl
                });
            }

            // Create caption clip (optional)
            newClips.push({
                id: `caption-${sceneId}`,
                type: 'caption',
                track: 0, // Caption track
                startTime: currentStartTime,
                duration: audioDuration, // Same as audio
                sceneId,
                text: scene.narrationText
            });

            currentStartTime += clipDuration; // Move to next clip position (contiguous!)
        });

        setClips(newClips);
        setTotalDuration(currentStartTime);

        console.log('[TimelinePage] Timeline calculated:', {
            totalClips: newClips.length,
            totalDuration: currentStartTime
        });
    };

    const handleConfirm = () => {
        const storyWithTimeline = {
            ...storyWithScenes,
            clips,
            totalDuration,
            audioUrls
        };
        onComplete(storyWithTimeline);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
                >
                    <Loader2 className="w-16 h-16 text-[#FF0000] animate-spin mx-auto mb-4" />

                    {generatingAudio ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                Gerando Áudio das Cenas
                            </h2>
                            <p className="text-gray-600 mb-4">
                                Criando narração com Gemini TTS...
                            </p>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                                <div
                                    className="bg-[#FF0000] h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${audioProgress}%` }}
                                />
                            </div>
                            <p className="text-sm text-gray-500">{audioProgress}%</p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                Preparando Timeline
                            </h2>
                            <p className="text-gray-600">
                                Calculando sincronização...
                            </p>
                        </>
                    )}
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
                >
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        ← Voltar
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Editor de Timeline</h1>
                            <p className="text-sm text-gray-600">
                                {storyWithScenes.scenes.length} cenas • {Math.round(totalDuration)}s total
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="px-6 py-3 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                    >
                        FINALIZAR EDIÇÃO →
                    </button>
                </div>
            </div>

            {/* Main Content - Contained Layout - Dark Theme */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col bg-gray-900" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col flex-1 gap-3 overflow-hidden"
                >
                    {/* Top Row: Gallery (LEFT) + Preview (RIGHT) - Compact */}
                    <div className="flex gap-3" style={{ height: '25%' }}>
                        {/* Media Gallery - CapCut Style */}
                        <div className="w-72 bg-gray-900 rounded-xl shadow-lg flex flex-col overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-gray-700">
                                <button onClick={() => setGalleryTab('media')} className={`flex-1 px-2 py-2 text-xs font-medium ${galleryTab === 'media' ? 'text-white bg-gray-800 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}>
                                    📷 Mídia
                                </button>
                                <button onClick={() => setGalleryTab('audio')} className={`flex-1 px-2 py-2 text-xs font-medium ${galleryTab === 'audio' ? 'text-white bg-gray-800 border-b-2 border-green-500' : 'text-gray-400 hover:text-white'}`}>
                                    🎵 Áudio
                                </button>
                                <button onClick={() => setGalleryTab('effects')} className={`flex-1 px-2 py-2 text-xs font-medium ${galleryTab === 'effects' ? 'text-white bg-gray-800 border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'}`}>
                                    ✨ Efeitos
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-2 min-h-0">
                                {galleryTab === 'media' && (
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {storyWithScenes.scenes.map((scene, idx) => (
                                            <div key={scene.id} draggable onDragStart={(e) => { e.dataTransfer.setData('mediaType', 'video'); e.dataTransfer.setData('sceneId', scene.id); }} className="aspect-video bg-gray-700 rounded overflow-hidden cursor-grab hover:ring-2 ring-blue-400 group relative">
                                                {scene.imageUrl ? <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">{idx + 1}</div>}
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] text-white px-1 py-0.5 opacity-0 group-hover:opacity-100">Cena {idx + 1}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {galleryTab === 'audio' && (
                                    <div className="space-y-1.5">
                                        {Object.entries(audioUrls).map(([sceneId, url], idx) => (
                                            <div key={sceneId} draggable onDragStart={(e) => { e.dataTransfer.setData('mediaType', 'audio'); e.dataTransfer.setData('sceneId', sceneId); }} className="flex items-center gap-2 p-2 bg-gray-800 rounded border border-gray-700 cursor-grab hover:border-green-500 text-xs">
                                                <div className="w-7 h-7 bg-green-600 rounded flex items-center justify-center text-sm">🎵</div>
                                                <div className="flex-1"><div className="text-white">Áudio {idx + 1}</div><div className="text-gray-500 text-[10px]">Narração</div></div>
                                            </div>
                                        ))}
                                        {Object.keys(audioUrls).length === 0 && <div className="text-gray-500 text-xs text-center py-4">Nenhum áudio</div>}
                                    </div>
                                )}
                                {galleryTab === 'effects' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {['🌟 Fade In', '✨ Fade Out', '🎬 Transição', '💫 Zoom'].map((fx, i) => (
                                            <div key={i} className="p-3 bg-gray-800 rounded border border-gray-700 text-center opacity-50">
                                                <div className="text-xl mb-1">{fx.split(' ')[0]}</div>
                                                <div className="text-[10px] text-gray-400">{fx.split(' ')[1]}</div>
                                            </div>
                                        ))}
                                        <div className="col-span-2 text-gray-500 text-[10px] text-center">Em breve</div>
                                    </div>
                                )}
                            </div>
                            <div className="p-2 border-t border-gray-700 text-[10px] text-gray-500 text-center bg-gray-800">Arraste para a timeline</div>
                        </div>

                        {/* Video Preview - RIGHT - Dark Theme */}
                        <div className="flex-1 bg-gray-800 rounded-xl shadow-lg p-3 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-sm font-bold text-white">Preview</h2>
                                <div className="text-xs text-gray-400">
                                    {storyWithScenes.scenes.length} cenas • {Math.round(totalDuration)}s
                                </div>
                            </div>
                            <div className="flex-1 min-h-0">
                                <VideoPreview
                                    clips={clips}
                                    currentTime={currentTime}
                                    totalDuration={totalDuration}
                                    isPlaying={isPlaying}
                                    onTimeUpdate={setCurrentTime}
                                    onPlayPause={() => setIsPlaying(!isPlaying)}
                                    onStop={() => {
                                        setIsPlaying(false);
                                        setCurrentTime(0);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Timeline - Full remaining height */}
                    <div className="flex-1 bg-gray-800 rounded-xl shadow-lg p-3 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                            <h2 className="text-sm font-bold text-white">Timeline</h2>
                            <div className="flex items-center gap-3">
                                {/* Zoom Controls */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setTimelineZoom(prev => Math.max(20, prev - 20))}
                                        className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
                                    >−</button>
                                    <span className="text-xs text-gray-400 w-10 text-center">{timelineZoom}%</span>
                                    <button
                                        onClick={() => setTimelineZoom(prev => Math.min(200, prev + 20))}
                                        className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
                                    >+</button>
                                </div>
                                <div className="text-xs text-gray-400">
                                    {clips.length} clips
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-x-auto overflow-y-hidden">
                            <Timeline
                                clips={clips}
                                currentTime={currentTime}
                                totalDuration={totalDuration}
                                onTimeUpdate={setCurrentTime}
                                onClipsChange={setClips}
                                selectedClipId={selectedClipId}
                                onClipSelect={setSelectedClipId}
                            />
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

