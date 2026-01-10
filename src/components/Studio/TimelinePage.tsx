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
    const [loading, setLoading] = useState(true);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
    const [clips, setClips] = useState<TimelineClip[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
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

            // Estimate audio duration (will be updated when audio loads)
            // For now, use a rough estimate based on text length
            const estimatedAudioDuration = Math.max(3, scene.narrationText.length / 15); // ~15 chars per second
            const sceneDuration = storyWithScenes.scenePauseDuration || 15; // Average scene duration
            const totalSceneDuration = sceneDuration; // Use the configured average scene duration

            // Create video clip (image)
            newClips.push({
                id: `video-${sceneId}`,
                type: 'video',
                track: 1, // Video track
                startTime: currentStartTime,
                duration: totalSceneDuration,
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
                    duration: estimatedAudioDuration,
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
                duration: estimatedAudioDuration,
                sceneId,
                text: scene.narrationText
            });

            currentStartTime += totalSceneDuration;
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

            {/* Main Content */}
            <div className="p-6 space-y-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Video Preview - Larger and prominent */}
                    <div className="bg-white rounded-xl shadow-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-900">Preview</h2>
                            <div className="text-sm text-gray-600">
                                {storyWithScenes.scenes.length} cenas • {Math.round(totalDuration)}s
                            </div>
                        </div>
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

                    {/* Timeline - Compact but visible */}
                    <div className="bg-white rounded-xl shadow-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-900">Timeline</h2>
                            <div className="text-xs text-gray-500">
                                {clips.length} clips
                            </div>
                        </div>
                        <Timeline
                            clips={clips}
                            currentTime={currentTime}
                            totalDuration={totalDuration}
                            onTimeUpdate={setCurrentTime}
                            selectedClipId={selectedClipId}
                            onClipSelect={setSelectedClipId}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
