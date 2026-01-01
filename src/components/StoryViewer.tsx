import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Loader2, Save, Check, Film } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateStoryWithGemini, generateScenesWithGemini, Scene } from '../services/gemini';
import { SceneList } from './SceneList';

interface StoryViewerProps {
    storyId: string;
    onBack: () => void;
}

interface Story {
    id: string;
    title: string;
    age_group: string;
    tone: string;
    duration: number;
    story_text: string | null;
    narration_text: string | null;
    status: string;
}

export function StoryViewer({ storyId, onBack }: StoryViewerProps) {
    const [story, setStory] = useState<Story | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatingScenes, setGeneratingScenes] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editedText, setEditedText] = useState('');

    useEffect(() => {
        fetchStoryAndScenes();
    }, [storyId]);

    async function fetchStoryAndScenes() {
        try {
            setLoading(true);

            // Fetch story
            const { data: storyData, error: storyError } = await supabase
                .from('stories')
                .select('*')
                .eq('id', storyId)
                .single();

            if (storyError) throw storyError;
            setStory(storyData);
            setEditedText(storyData.story_text || '');

            // Fetch scenes
            const { data: scenesData, error: scenesError } = await supabase
                .from('scenes')
                .select('*')
                .eq('story_id', storyId)
                .order('order_number', { ascending: true });

            if (scenesError && scenesError.code !== 'PGRST116') throw scenesError;

            if (scenesData) {
                setScenes(scenesData.map(s => ({
                    id: s.id,
                    order: s.order_number,
                    narration_text: s.narration_text,
                    visual_description: s.visual_description || '',
                    emotion: s.emotion || 'calma',
                    duration_estimate: s.duration_estimate || 10,
                    characters: s.characters || []
                })));
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerateStory() {
        if (!story) return;

        try {
            setGenerating(true);
            setError('');

            // Generate story with Gemini
            const { story_text, narration_text } = await generateStoryWithGemini({
                title: story.title,
                age_group: story.age_group,
                tone: story.tone,
                duration: story.duration,
            });

            // Update database
            const { error: updateError } = await supabase
                .from('stories')
                .update({
                    story_text,
                    narration_text,
                    status: 'draft',
                })
                .eq('id', storyId);

            if (updateError) throw updateError;

            // Update local state
            setStory({ ...story, story_text, narration_text });
            setEditedText(story_text);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    }

    async function handleGenerateScenes() {
        if (!story || !story.story_text) return; // Use story_text as backup if narration_text is null

        const textToUse = story.narration_text || story.story_text;

        try {
            setGeneratingScenes(true);
            setError('');

            // Clean existing scenes first
            await supabase.from('scenes').delete().eq('story_id', storyId);

            // Generate scenes with Gemini
            const result = await generateScenesWithGemini({
                narration_text: textToUse,
                duration: story.duration,
            });

            // Insert into Supabase
            const scenesToInsert = result.scenes.map(s => ({
                story_id: storyId,
                order_number: s.order,
                narration_text: s.narration_text,
                visual_description: s.visual_description,
                emotion: s.emotion,
                duration_estimate: s.duration_estimate,
                characters: s.characters
            }));

            const { data, error: insertError } = await supabase
                .from('scenes')
                .insert(scenesToInsert)
                .select();

            if (insertError) throw insertError;

            // Updated scenes from DB to maintain strict syncing or use local optimistically
            // Using DB result ensures we have IDs for subsequent edits
            if (data) {
                setScenes(data.map(s => ({
                    id: s.id,
                    order: s.order_number,
                    narration_text: s.narration_text,
                    visual_description: s.visual_description || '',
                    emotion: s.emotion || 'calma',
                    duration_estimate: s.duration_estimate || 10,
                    characters: s.characters || []
                })).sort((a, b) => a.order - b.order));
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingScenes(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            const { error } = await supabase
                .from('stories')
                .update({ story_text: editedText })
                .eq('id', storyId);

            if (error) throw error;

            setStory({ ...story!, story_text: editedText });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveScene(index: number, updatedScene: Scene) {
        try {
            // Optimistic update
            const newScenes = [...scenes];
            newScenes[index] = updatedScene;
            setScenes(newScenes);

            // Update DB
            if (updatedScene.id) {
                const { error } = await supabase
                    .from('scenes')
                    .update({
                        narration_text: updatedScene.narration_text,
                        visual_description: updatedScene.visual_description,
                        emotion: updatedScene.emotion,
                        duration_estimate: updatedScene.duration_estimate,
                        characters: updatedScene.characters
                    })
                    .eq('id', updatedScene.id);

                if (error) throw error;
            }

        } catch (err: any) {
            setError(err.message);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!story) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
                <div className="max-w-4xl mx-auto">
                    <p className="text-red-600">História não encontrada</p>
                    <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">
                        Voltar ao Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4">
            <div className="max-w-4xl mx-auto py-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar ao Dashboard
                    </button>
                    <h1 className="text-3xl font-bold mb-2">{story.title}</h1>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Idade: {story.age_group}</span>
                        <span className="capitalize">Tom: {story.tone}</span>
                        <span>Duração: {story.duration} min</span>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* No Story Yet */}
                {!story.story_text && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl border shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="h-10 w-10 text-purple-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Gerar História com IA</h2>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Clique no botão abaixo para gerar uma história mágica usando Inteligência Artificial!
                        </p>
                        <button
                            onClick={handleGenerateStory}
                            disabled={generating}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Gerando história...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    Gerar História
                                </>
                            )}
                        </button>
                        {generating && (
                            <p className="text-sm text-muted-foreground mt-4">
                                Isso pode levar 30-60 segundos...
                            </p>
                        )}
                    </motion.div>
                )}

                {/* Story Editor & Scenes */}
                {story.story_text && (
                    <div className="space-y-8">
                        {/* Editor Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl border shadow-sm p-8"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-semibold">História Gerada</h2>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleGenerateStory}
                                        disabled={generating}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Regenerando...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4" />
                                                Regenerar
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || editedText === story.story_text}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : editedText === story.story_text ? (
                                            <>
                                                <Check className="h-4 w-4" />
                                                Salvo
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4" />
                                                Salvar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <textarea
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="w-full min-h-[300px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 font-serif text-lg leading-relaxed mb-4"
                                placeholder="O texto da história aparecerá aqui..."
                            />

                            <div className="text-sm text-muted-foreground">
                                {editedText.split(' ').filter(w => w.length > 0).length} palavras
                            </div>
                        </motion.div>

                        {/* Scenes Section */}
                        <div className="border-t pt-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Film className="h-6 w-6 text-purple-600" />
                                    Cenas da História
                                </h2>
                                <button
                                    onClick={handleGenerateScenes}
                                    disabled={generatingScenes}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                                >
                                    {generatingScenes ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Gerando cenas...
                                        </>
                                    ) : (
                                        <>
                                            <Film className="h-5 w-5" />
                                            {scenes.length > 0 ? 'Regenerar Cenas' : 'Separar em Cenas'}
                                        </>
                                    )}
                                </button>
                            </div>

                            {scenes.length > 0 ? (
                                <SceneList scenes={scenes} onSaveScene={handleSaveScene} />
                            ) : (
                                <div className="bg-white rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                                    <Film className="h-10 w-10 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Nenhuma cena gerada ainda</p>
                                    <p className="text-sm mt-2">Clique em "Separar em Cenas" para dividir sua história automaticamente.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
