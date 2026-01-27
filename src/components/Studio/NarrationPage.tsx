/**
 * NARRATION Page - Story Text Generation
 * Second step in the Studio workflow
 * Generates story text using Gemini AI
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StoryConfig, StoryWithNarration } from '../../types/studio';
import { generateStoryWithGemini } from '../../services/gemini';
import { generateAudioNarration } from '../../services/tts';
import { Loader2, Check, Sparkles, Volume2 } from 'lucide-react';

interface NarrationPageProps {
    config: StoryConfig;
    existingStory?: StoryWithNarration; // Pass existing story if returning to this step
    onComplete: (story: StoryWithNarration) => void;
    onBack: () => void;
}

export function NarrationPage({ config, existingStory, onComplete, onBack }: NarrationPageProps) {
    const [generating, setGenerating] = useState(!existingStory?.storyText);
    const [storyText, setStoryText] = useState(existingStory?.storyText || '');
    const [error, setError] = useState('');
    const [voiceName, setVoiceName] = useState(existingStory?.voiceName || 'Puck');
    const [emotion, setEmotion] = useState(existingStory?.emotion || 'warmly');
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState('');

    useEffect(() => {
        // Only generate if we don't have existing story text
        if (!existingStory?.storyText) {
            generateStory();
        } else {
            console.log('[NarrationPage] Using existing story text');
            setGenerating(false);
        }
    }, []);

    const generateStory = async () => {
        setGenerating(true);
        setError('');

        try {
            console.log('[NarrationPage] Generating story with config:', config);

            const result = await generateStoryWithGemini({
                title: config.title,
                age_group: config.ageGroup || '3-5',
                tone: config.tone || 'aventura',
                duration: config.duration
            });

            setStoryText(result.story_text);
            setGenerating(false);

        } catch (err: any) {
            console.error('[NarrationPage] Error generating story:', err);
            setError(err.message || 'Erro ao gerar história');
            setGenerating(false);
        }
    };

    const handleGenerateAudioPreview = async () => {
        if (!storyText) return;

        setGeneratingAudio(true);
        setAudioPreviewUrl('');

        try {
            console.log('[NarrationPage] Generating audio preview with voice:', voiceName, 'emotion:', emotion);

            const audioUrl = await generateAudioNarration({
                text: storyText,
                emotion: emotion as any,
                voiceName: voiceName
            });

            setAudioPreviewUrl(audioUrl);
            console.log('[NarrationPage] Audio preview generated successfully');
        } catch (err: any) {
            console.error('[NarrationPage] Error generating audio preview:', err);
            setError('Erro ao gerar áudio: ' + err.message);
        } finally {
            setGeneratingAudio(false);
        }
    };

    const handleConfirm = () => {
        if (storyText) {
            const storyWithNarration: StoryWithNarration = {
                ...config,
                storyId: existingStory?.storyId || `story-${Date.now()}`,
                storyText: storyText,
                narrationText: storyText,
                voiceName: voiceName,
                emotion: emotion
            };
            onComplete(storyWithNarration);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-lg p-8 border border-border"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">
                        Seu Conto foi Escrito!
                    </h1>
                    <p className="text-muted-foreground">
                        Leia a história completa abaixo
                    </p>
                </div>

                {/* Loading State */}
                {generating && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                        <p className="text-lg text-muted-foreground mb-2">Gerando sua história mágica...</p>
                        <p className="text-sm text-muted-foreground/60">Isso pode levar alguns segundos</p>
                    </div>
                )}

                {/* Error State */}
                {error && !generating && (
                    <div className="bg-destructive/10 border-2 border-destructive/20 rounded-xl p-6 mb-6">
                        <p className="text-destructive font-semibold mb-2">Erro ao gerar história</p>
                        <p className="text-destructive/80 text-sm mb-4">{error}</p>
                        <button
                            onClick={generateStory}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                )}

                {/* Story Text */}
                {storyText && !generating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {/* Story Info */}
                        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-xl p-4 mb-6 border border-primary/10">
                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-muted-foreground">Título:</span>
                                    <span className="text-foreground">{config.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-muted-foreground">Duração:</span>
                                    <span className="text-foreground">{config.duration} min</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-muted-foreground">Estilo:</span>
                                    <span className="text-foreground">{config.visualStyle}</span>
                                </div>
                            </div>
                        </div>

                        {/* Story Content */}
                        <div className="bg-muted/30 rounded-xl p-6 mb-6 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                            <div className="prose prose-lg max-w-none prose-invert">
                                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                                    {storyText}
                                </p>
                            </div>
                        </div>

                        {/* Voice and Emotion Selection */}
                        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-xl p-6 mb-6 border border-primary/10">
                            <h3 className="text-lg font-bold text-foreground mb-4">🎙️ Configurações de Narração</h3>

                            {/* Voice Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                                    VOZ DA NARRAÇÃO
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { value: 'Puck', label: 'Infantil/Jovem', icon: '👶' },
                                        { value: 'Kore', label: 'Feminina (Padrão)', icon: '👩' },
                                        { value: 'Aoede', label: 'Feminina (Suave)', icon: '🎵' },
                                        { value: 'Charon', label: 'Masculina (Padrão)', icon: '👨' },
                                        { value: 'Fenrir', label: 'Masculina (Profunda)', icon: '🎙️' },
                                    ].map((voice) => (
                                        <button
                                            key={voice.value}
                                            type="button"
                                            onClick={() => setVoiceName(voice.value)}
                                            className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${voiceName === voice.value
                                                ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                                                : 'bg-card text-muted-foreground hover:bg-secondary border border-border'
                                                }`}
                                        >
                                            <span className="text-lg">{voice.icon}</span>
                                            <span>{voice.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Emotion Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                                    EMOÇÃO DA NARRAÇÃO
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        { value: 'warmly', label: 'Calorosa', icon: '🤗' },
                                        { value: 'cheerfully', label: 'Alegre', icon: '😊' },
                                        { value: 'excitedly', label: 'Animada', icon: '🎉' },
                                        { value: 'calmly', label: 'Calma', icon: '😌' },
                                        { value: 'mysteriously', label: 'Misteriosa', icon: '🔮' },
                                        { value: 'sadly', label: 'Triste', icon: '😢' },
                                    ].map((emotionOption) => (
                                        <button
                                            key={emotionOption.value}
                                            type="button"
                                            onClick={() => setEmotion(emotionOption.value)}
                                            className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center gap-2 text-sm ${emotion === emotionOption.value
                                                ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                                                : 'bg-card text-muted-foreground hover:bg-secondary border border-border'
                                                }`}
                                        >
                                            <span className="text-lg">{emotionOption.icon}</span>
                                            <span>{emotionOption.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Audio Preview Button */}
                            <button
                                onClick={handleGenerateAudioPreview}
                                disabled={generatingAudio}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2 disabled:bg-muted disabled:cursor-not-allowed"
                            >
                                {generatingAudio ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Gerando Áudio...
                                    </>
                                ) : (
                                    <>
                                        <Volume2 className="w-5 h-5" />
                                        Gerar Áudio Completo (Preview)
                                    </>
                                )}
                            </button>

                            {/* Audio Player */}
                            {audioPreviewUrl && (
                                <div className="mt-4 p-4 bg-card rounded-lg border-2 border-primary/20">
                                    <p className="text-sm font-semibold text-muted-foreground mb-2">Preview do Áudio:</p>
                                    <audio controls className="w-full">
                                        <source src={audioPreviewUrl} type="audio/wav" />
                                    </audio>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={onBack}
                                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-semibold"
                            >
                                ← Voltar
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2"
                            >
                                <Check className="w-5 h-5" />
                                CONFIRMAR CENAS
                            </button>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
