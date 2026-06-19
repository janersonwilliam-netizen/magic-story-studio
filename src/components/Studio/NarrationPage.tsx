/**
 * NARRATION Page - Story Text Generation
 * Second step in the Studio workflow
 * Generates story text using Gemini AI
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StoryConfig, StoryWithNarration } from '../../types/studio';
import { generateStoryWithGemini } from '../../services/gemini';
import { generateLongAudioNarration, GEMINI_VOICES } from '../../services/tts';
import { Loader2, Check, Sparkles, Volume2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface NarrationPageProps {
    config: StoryConfig;
    existingStory?: StoryWithNarration; // Pass existing story if returning to this step
    onComplete: (story: StoryWithNarration) => void;
    onBack: () => void;
}

export function NarrationPage({ config, existingStory, onComplete, onBack }: NarrationPageProps) {
    const { user } = useAuth();
    const [generating, setGenerating] = useState(!existingStory?.storyText);
    const [storyText, setStoryText] = useState(existingStory?.storyText || '');
    const [rawScenes, setRawScenes] = useState<any[]>(existingStory?.rawScenes || []);
    const [error, setError] = useState('');
    const [voiceName, setVoiceName] = useState(existingStory?.voiceName || 'Kore');
    const [emotion, setEmotion] = useState(existingStory?.emotion || 'warmly');
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState(existingStory?.audioUrl || '');

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

            let customInstructions = undefined;
            if (user?.id) {
                try {
                    const { data, error } = await supabase
                        .from('user_preferences')
                        .select('master_prompt_instructions, master_prompt_instructions_biblica')
                        .eq('user_id', user.id)
                        .single();

                    if (data && !error) {
                        customInstructions = config.theme === 'biblica'
                            ? data.master_prompt_instructions_biblica
                            : data.master_prompt_instructions;
                    }
                } catch (err) {
                    console.error('[NarrationPage] Error fetching user preferences:', err);
                }
            }

            const result = await generateStoryWithGemini({
                title: config.title,
                age_group: config.ageGroup || '3-5',
                tone: config.tone || 'aventura',
                theme: config.theme || 'classica',
                duration: config.duration,
                sceneCount: config.sceneCount,
                storyIdea: config.storyIdea,
                customSystemInstructions: customInstructions
            });

            setStoryText(result.story_text);
            setRawScenes(result.rawScenes || []);
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
            const narrationText = storyText.replace(/\\n/g, '\n');

            const audioUrl = await generateLongAudioNarration({
                text: narrationText,
                voiceName,
                emotion: emotion as any,
                maxChunkChars: 900,
                disableLeveling: false
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

    const handleDownloadAudio = () => {
        if (!audioPreviewUrl) return;
        const safeTitle = (config.title || 'narracao')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .substring(0, 40) || 'narracao';
        const link = document.createElement('a');
        link.href = audioPreviewUrl;
        link.download = `${safeTitle}_narracao.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleConfirm = () => {
        if (storyText) {
            const storyWithNarration: StoryWithNarration = {
                ...config,
                storyId: existingStory?.storyId || `story-${Date.now()}`,
                storyText: storyText,
                narrationText: storyText,
                rawScenes: rawScenes,
                voiceName: voiceName,
                emotion: emotion,
                audioUrl: audioPreviewUrl
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
                    <div className="bg-red-950/40 border-2 border-red-500/50 rounded-xl p-6 mb-6">
                        <p className="text-red-200 font-bold mb-2 flex items-center gap-2 text-lg">
                            ⚠️ Erro ao gerar história
                        </p>
                        <p className="text-red-100/90 text-sm mb-4 bg-black/40 p-4 rounded-lg font-mono break-all border border-red-500/20">
                            {error}
                        </p>
                        <button
                            onClick={generateStory}
                            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all font-bold shadow-lg flex items-center gap-2"
                        >
                            🔄 Tentar Novamente
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
                                    {storyText.replace(/\\n/g, '\n')}
                                </p>
                            </div>
                        </div>

                        {/* Voice and Emotion Selection */}
                        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-xl p-6 mb-6 border border-primary/10">
                            <h3 className="text-lg font-bold text-foreground mb-4">🎙️ Configurações de Narração</h3>

                            {/* Model Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    MODELO
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                    {/* Flash TTS Pill */}
                                    <div className="relative group cursor-pointer">
                                        <input type="radio" id="m-flash" name="tts-model" value="flash-tts" className="absolute opacity-0 w-0 h-0" defaultChecked />
                                        <label htmlFor="m-flash" className="flex flex-col gap-1 p-3 rounded-xl border-[1.5px] border-primary/80 bg-primary/10 text-primary cursor-pointer transition-all">
                                            <span className="font-bold text-sm tracking-wide">⚡ Flash TTS</span>
                                            <span className="text-xs opacity-80">Rápido • Natural</span>
                                            <span className="text-[11px] font-bold text-primary mt-1">~$0,006/min</span>
                                        </label>
                                    </div>

                                    {/* Pro TTS Pill */}
                                    <div className="relative group cursor-pointer opacity-50">
                                        <input type="radio" id="m-pro" name="tts-model" value="pro-tts" className="absolute opacity-0 w-0 h-0" disabled />
                                        <label htmlFor="m-pro" className="flex flex-col gap-1 p-3 rounded-xl border-[1.5px] border-border bg-card cursor-not-allowed transition-all">
                                            <span className="font-bold text-sm text-foreground">🎭 Pro TTS</span>
                                            <span className="text-xs text-muted-foreground">Alta qualidade</span>
                                            <span className="text-[11px] font-bold text-amber-500 mt-1">~$0,019/min</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Voice Selection */}
                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    VOZ
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                                    {[
                                        { id: 'Kore', name: 'Kore', icon: '🧒', desc: 'Infantil • Doce' },
                                        { id: 'Puck', name: 'Puck', icon: '🧒', desc: 'Jovem • Alegre' },
                                        { id: 'Aoede', name: 'Aoede', icon: '👩', desc: 'Feminina • Suave' },
                                        { id: 'Charon', name: 'Charon', icon: '👨', desc: 'Masculina' },
                                        { id: 'Fenrir', name: 'Fenrir', icon: '🦁', desc: 'Dramática' },
                                        { id: 'Leda', name: 'Leda', icon: '👧', desc: 'Criança • Fofa' },
                                    ].map((v) => (
                                        <div key={v.id} className="relative group cursor-pointer">
                                            <input
                                                type="radio"
                                                id={`v-${v.id}`}
                                                name="tts-voice"
                                                className="absolute opacity-0 w-0 h-0"
                                                checked={voiceName === v.id}
                                                onChange={() => setVoiceName(v.id)}
                                            />
                                            <label
                                                htmlFor={`v-${v.id}`}
                                                className={`flex flex-col gap-1 p-3 rounded-xl border-[1.5px] cursor-pointer transition-all ${voiceName === v.id
                                                        ? 'border-primary bg-primary/10 text-primary scale-[1.02]'
                                                        : 'border-border bg-card hover:border-primary/50 text-foreground'
                                                    }`}
                                            >
                                                <span className="font-bold text-sm tracking-wide">{v.icon} {v.name}</span>
                                                <span className={`text-xs ${voiceName === v.id ? 'opacity-80' : 'text-muted-foreground'}`}>{v.desc}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Emotion Selection */}
                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    EMOÇÃO DA NARRAÇÃO
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                    {[
                                        { value: 'warmly', label: 'Calorosa', icon: '🤗' },
                                        { value: 'cheerfully', label: 'Alegre', icon: '😊' },
                                        { value: 'excitedly', label: 'Animada', icon: '🎉' },
                                        { value: 'calmly', label: 'Calma', icon: '😌' },
                                        { value: 'mysteriously', label: 'Misteriosa', icon: '🔮' },
                                        { value: 'sadly', label: 'Triste', icon: '😢' },
                                    ].map((emotionOption) => (
                                        <div key={emotionOption.value} className="relative group cursor-pointer">
                                            <input
                                                type="radio"
                                                id={`e-${emotionOption.value}`}
                                                name="tts-emotion"
                                                className="absolute opacity-0 w-0 h-0"
                                                checked={emotion === emotionOption.value}
                                                onChange={() => setEmotion(emotionOption.value)}
                                            />
                                            <label
                                                htmlFor={`e-${emotionOption.value}`}
                                                className={`flex items-center gap-2 p-3 rounded-xl border-[1.5px] cursor-pointer transition-all ${emotion === emotionOption.value
                                                        ? 'border-primary bg-primary/10 text-primary scale-[1.02]'
                                                        : 'border-border bg-card hover:border-primary/50 text-foreground'
                                                    }`}
                                            >
                                                <span className="text-lg">{emotionOption.icon}</span>
                                                <span className="font-bold text-sm">{emotionOption.label}</span>
                                            </label>
                                        </div>
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
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-semibold text-muted-foreground">Preview do Áudio:</p>
                                        <button
                                            onClick={handleDownloadAudio}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-semibold"
                                            title="Baixar áudio (.wav)"
                                        >
                                            <Download className="w-4 h-4" />
                                            Baixar Áudio
                                        </button>
                                    </div>
                                    <audio controls className="w-full" src={audioPreviewUrl} />
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
