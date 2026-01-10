import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Save, Check, Film, Download, PackageCheck, Users, Headphones, Volume2, Trash2, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateStoryWithGemini, generateScenesWithGemini, generateImagePrompt, extractCharactersFromStory, generateAllCharacterSheets, Scene } from '../services/gemini';
import { generateImageWithNanoBanana } from '../services/google_image';
import { generateAudioNarration, generateLongAudioNarration } from '../services/tts';
import { SceneList } from './SceneList';
import { CharacterModal } from './CharacterModal';
import { StepWizard, STORY_CREATION_STEPS } from './StepWizard';
import JSZip from 'jszip';
import { Timeline } from './Studio/Timeline';
import { VideoPreview } from './Studio/VideoPreview';
import { ExportVideoModal } from './ExportVideoModal';

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
    full_audio_url?: string;
}

export function StoryViewer({ storyId, onBack }: StoryViewerProps) {
    const [story, setStory] = useState<Story | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatingScenes, setGeneratingScenes] = useState(false);
    const [generatingFullAudio, setGeneratingFullAudio] = useState(false);
    const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null);
    const [generatingPromptIndex, setGeneratingPromptIndex] = useState<number | null>(null);
    const [generatingAudioIndex, setGeneratingAudioIndex] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [editedText, setEditedText] = useState('');
    const [user, setUser] = useState<any>(null);
    const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
    const [characterDescriptions, setCharacterDescriptions] = useState<Record<string, string>>({});
    const [usageLimits, setUsageLimits] = useState<{ remaining: number; limit: number } | null>(null);
    const [validation, setValidation] = useState<{ isComplete: boolean; missingItems: string[] } | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [generatingCharacterSheets, setGeneratingCharacterSheets] = useState(false);
    const [characterSheetTemplate, setCharacterSheetTemplate] = useState<string>('');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Step navigation helpers
    const stepTitles = [
        { title: 'História', subtitle: 'Texto da história criada' },
        { title: 'Personagens', subtitle: 'Defina a aparência dos personagens' },
        { title: 'Narração', subtitle: 'Gere o áudio da narração' },
        { title: 'Cenas', subtitle: 'Gere cenas e imagens' },
        { title: 'Timeline', subtitle: 'Editor de vídeo (em breve)' },
        { title: 'Preview', subtitle: 'Visualização e download' },
    ];

    const getCompletedSteps = (): number[] => {
        const completed: number[] = [];
        if (story) {
            if (story.story_text) completed.push(0); // História
            if (Object.keys(characterDescriptions).length > 0) completed.push(1); // Personagens
            if (story.full_audio_url) completed.push(2); // Narração
            if (scenes.length > 0) completed.push(3); // Cenas
        }
        return completed;
    };

    const canGoNext = (): boolean => {
        switch (currentStep) {
            case 0: return !!story?.story_text; // História
            case 1: return Object.keys(characterDescriptions).length > 0; // Personagens
            case 2: return true; // Narração (opcional)
            case 3: return scenes.length > 0; // Cenas
            case 4: return true; // Timeline
            case 5: return false; // Preview (last)
            default: return false;
        }
    };

    const goToNextStep = () => {
        if (currentStep < STORY_CREATION_STEPS.length - 1 && canGoNext()) {
            setCurrentStep(currentStep + 1);
        }
    };

    const goToPrevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        }
        getUser();
    }, []);

    useEffect(() => {
        fetchStoryAndScenes();
    }, [storyId]);

    useEffect(() => {
        if (user) {
            fetchUsageLimits();
            loadUserPreferences();
        }
    }, [user]);

    async function loadUserPreferences() {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('user_preferences')
                .select('character_sheet_template')
                .eq('user_id', user.id)
                .single();

            // if (data?.character_sheet_template) {
            //    setCharacterSheetTemplate(data.character_sheet_template);
            // }
        } catch (err) {
            console.error('Error loading preferences:', err);
        }
    }

    async function fetchUsageLimits() {
        if (!user) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            // const { count } = await supabase
            //    .from('image_usage')
            //    .select('*', { count: 'exact', head: true })
            //    .eq('user_id', user.id)
            //    .gte('created_at', today);

            // setUsageLimits({ remaining: Math.max(0, 50 - (count || 0)), limit: 50 });
            setUsageLimits({ remaining: 50, limit: 50 });
        } catch (err) {
            console.error('Error fetching limits:', err);
        }
    }

    async function fetchStoryAndScenes() {
        try {
            setLoading(true);
            const { data: storyData, error: storyError } = await supabase
                .from('stories')
                .select('*')
                .eq('id', storyId)
                .single();

            if (storyError) throw storyError;
            setStory(storyData);
            setEditedText(storyData.story_text || '');

            const { data: scenesData } = await supabase
                .from('scenes')
                .select('*')
                .eq('story_id', storyId)
                .order('order_number', { ascending: true });

            if (scenesData) {
                setScenes(scenesData.map(s => ({
                    id: s.id,
                    order: s.order_number,
                    narration_text: s.narration_text,
                    visual_description: s.visual_description || '',
                    emotion: s.emotion || 'calma',
                    duration_estimate: s.duration_estimate || 10,
                    characters: s.characters || [],
                    imageUrl: s.image_url,
                    audioUrl: s.audio_url,
                    image_prompt: s.image_prompt
                })));
            }

            // Load character descriptions
            const { data: charData } = await supabase
                .from('character_descriptions')
                .select('*')
                .eq('story_id', storyId);

            if (charData && charData.length > 0) {
                const descriptions: Record<string, string> = {};
                charData.forEach(c => { descriptions[c.character_name] = c.description; });
                setCharacterDescriptions(descriptions);
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
            const { story_text, narration_text } = await generateStoryWithGemini({
                title: story.title,
                age_group: story.age_group,
                tone: story.tone,
                duration: story.duration,
            });

            await supabase.from('stories').update({ story_text, narration_text, status: 'draft' }).eq('id', storyId);
            setStory({ ...story, story_text, narration_text });
            setEditedText(story_text);

            // Extract character descriptions using Gemini
            const descriptions = await extractCharactersFromStory(story_text);
            if (Object.keys(descriptions).length > 0) {
                setCharacterDescriptions(descriptions);
                await handleSaveCharacters(descriptions);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            await supabase.from('stories').update({ story_text: editedText }).eq('id', storyId);
            setStory({ ...story!, story_text: editedText });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleGenerateScenes() {
        if (!story?.story_text) return;
        try {
            setGeneratingScenes(true);
            setError('');
            await supabase.from('scenes').delete().eq('story_id', storyId);

            const result = await generateScenesWithGemini({
                narration_text: story.narration_text || story.story_text,
                duration: story.duration,
            });

            const { data } = await supabase.from('scenes').insert(
                result.scenes.map(s => ({
                    story_id: storyId,
                    order_number: s.order,
                    narration_text: s.narration_text,
                    visual_description: s.visual_description,
                    emotion: s.emotion,
                    duration_estimate: s.duration_estimate,
                    characters: s.characters
                }))
            ).select();

            if (data) {
                setScenes(data.map(s => ({
                    id: s.id,
                    order: s.order_number,
                    narration_text: s.narration_text,
                    visual_description: s.visual_description || '',
                    emotion: s.emotion || 'calma',
                    duration_estimate: s.duration_estimate || 10,
                    characters: s.characters || [],
                    imageUrl: s.image_url,
                    audioUrl: s.audio_url
                })).sort((a, b) => a.order - b.order));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingScenes(false);
        }
    }

    async function handleSaveScene(index: number, updatedScene: Scene) {
        const newScenes = [...scenes];
        newScenes[index] = updatedScene;
        setScenes(newScenes);

        if (updatedScene.id) {
            await supabase.from('scenes').update({
                narration_text: updatedScene.narration_text,
                visual_description: updatedScene.visual_description,
                emotion: updatedScene.emotion,
                duration_estimate: updatedScene.duration_estimate,
                characters: updatedScene.characters
            }).eq('id', updatedScene.id);
        }
    }

    async function handleReorderScenes(newScenes: Scene[]) {
        setScenes(newScenes);
        // Update order in database
        const updates = newScenes.map((scene, index) => ({
            id: scene.id,
            order_number: index + 1
        }));

        for (const update of updates) {
            if (update.id) {
                await supabase.from('scenes').update({ order_number: update.order_number }).eq('id', update.id);
            }
        }
    }

    async function handleUpdateSceneDuration(sceneId: string, duration: number) {
        const index = scenes.findIndex(s => s.id === sceneId);
        if (index === -1) return;

        const newScenes = [...scenes];
        newScenes[index] = { ...newScenes[index], duration_estimate: duration };
        setScenes(newScenes);

        await supabase.from('scenes').update({ duration_estimate: duration }).eq('id', sceneId);
    }

    async function handleGeneratePrompt(index: number) {
        const scene = scenes[index];
        try {
            setGeneratingPromptIndex(index);
            const prompt = await generateImagePrompt({
                visual_description: scene.visual_description,
                emotion: scene.emotion,
                characters: scene.characters || [],
                characterDescriptions: characterDescriptions
            });
            const newScenes = [...scenes];
            newScenes[index] = { ...scene, image_prompt: prompt };
            setScenes(newScenes);
            if (scene.id) {
                await supabase.from('scenes').update({ image_prompt: prompt }).eq('id', scene.id);
            }
        } finally {
            setGeneratingPromptIndex(null);
        }
    }

    async function handleUpdatePrompt(index: number, newPrompt: string) {
        const scene = scenes[index];
        const newScenes = [...scenes];
        newScenes[index] = { ...scene, image_prompt: newPrompt };
        setScenes(newScenes);
        if (scene.id) {
            await supabase.from('scenes').update({ image_prompt: newPrompt }).eq('id', scene.id);
        }
    }

    async function handleGenerateImage(index: number) {
        const scene = scenes[index];
        if (!scene.image_prompt) return;
        try {
            setGeneratingImageIndex(index);
            const imageUrl = await generateImageWithNanoBanana(scene.image_prompt, characterDescriptions);
            const newScenes = [...scenes];
            newScenes[index] = { ...scene, imageUrl };
            setScenes(newScenes);
            if (scene.id) {
                await supabase.from('scenes').update({ image_url: imageUrl }).eq('id', scene.id);
            }
            fetchUsageLimits();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingImageIndex(null);
        }
    }

    async function handleGenerateAudio(index: number) {
        const scene = scenes[index];
        try {
            setGeneratingAudioIndex(index);
            const audioUrl = await generateAudioNarration({ text: scene.narration_text });
            const newScenes = [...scenes];
            newScenes[index] = { ...scene, audioUrl };
            setScenes(newScenes);
            if (scene.id) {
                await supabase.from('scenes').update({ audio_url: audioUrl }).eq('id', scene.id);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingAudioIndex(null);
        }
    }

    async function handleGenerateFullAudio() {
        if (!story?.story_text) return;
        try {
            setGeneratingFullAudio(true);
            const audioUrl = await generateLongAudioNarration({ text: story.narration_text || story.story_text });
            await supabase.from('stories').update({ full_audio_url: audioUrl }).eq('id', storyId);
            setStory({ ...story, full_audio_url: audioUrl });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingFullAudio(false);
        }
    }

    async function handleDeleteAudio() {
        if (!story) return;
        await supabase.from('stories').update({ full_audio_url: null }).eq('id', storyId);
        setStory({ ...story, full_audio_url: undefined });
    }

    async function handleSaveCharacters(descriptions: Record<string, string>) {
        await supabase.from('character_descriptions').delete().eq('story_id', storyId);
        const toInsert = Object.entries(descriptions).map(([name, desc]) => ({
            story_id: storyId,
            character_name: name,
            description: desc
        }));
        if (toInsert.length > 0) {
            await supabase.from('character_descriptions').insert(toInsert);
        }
        setCharacterDescriptions(descriptions);
    }

    async function handleGenerateCharacterSheets() {
        if (!story?.story_text) return;

        try {
            setGeneratingCharacterSheets(true);

            // First, extract characters if we don't have them
            let charactersToGenerate = Object.keys(characterDescriptions);

            if (charactersToGenerate.length === 0) {
                const extracted = await extractCharactersFromStory(story.story_text);
                charactersToGenerate = Object.keys(extracted);

                if (charactersToGenerate.length > 0) {
                    setCharacterDescriptions(prev => ({ ...prev, ...extracted }));
                }
            }

            if (charactersToGenerate.length === 0) {
                alert('Nenhum personagem encontrado automaticamente. Adicione nomes manualmente ou tente novamente.');
                return;
            }

            const sheets = await generateAllCharacterSheets(
                story.story_text,
                charactersToGenerate,
                characterSheetTemplate
            );

            // Update local state by merging
            const updatedDescriptions = { ...characterDescriptions, ...sheets };
            setCharacterDescriptions(updatedDescriptions);

            // Save to database
            await handleSaveCharacters(updatedDescriptions);

        } catch (err: any) {
            console.error('Error generating character sheets:', err);
            alert('Erro ao gerar Character Sheets: ' + err.message);
        } finally {
            setGeneratingCharacterSheets(false);
        }
    }

    function handleCheckValidation() {
        const missing: string[] = [];
        if (!story?.story_text) missing.push('História não gerada');
        if (scenes.length === 0) missing.push('Cenas não geradas');
        if (scenes.some(s => !s.imageUrl)) missing.push('Algumas cenas sem imagem');
        setValidation({ isComplete: missing.length === 0, missingItems: missing });
    }

    async function handleExport() {
        try {
            setExporting(true);
            const zip = new JSZip();
            zip.file('roteiro.txt', story?.story_text || '');

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                if (scene.imageUrl) {
                    try {
                        const response = await fetch(scene.imageUrl);
                        const blob = await response.blob();
                        zip.file(`imagens/cena_${i + 1}.png`, blob);
                    } catch (e) {
                        console.error('Error fetching image:', e);
                    }
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${story?.title || 'historia'}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#FF0000]" />
            </div>
        );
    }

    if (!story) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 p-8">
                <div className="max-w-4xl mx-auto">
                    <p className="text-red-600">História não encontrada</p>
                    <button onClick={onBack} className="mt-4 text-[#FF0000] hover:underline">Voltar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-orange-50 p-4">
            <div className="max-w-4xl mx-auto py-8">
                {/* Header */}
                <div className="mb-6">
                    <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar ao Dashboard
                    </button>
                    <h1 className="text-3xl font-bold mb-2">{story.title}</h1>
                    <div className="flex gap-4 text-sm text-gray-500">
                        <span>Idade: {story.age_group}</span>
                        <span className="capitalize">Tom: {story.tone}</span>
                        <span>Duração: {story.duration} min</span>
                    </div>
                </div>

                {/* Step Wizard */}
                <div className="mb-6">
                    <StepWizard
                        steps={STORY_CREATION_STEPS}
                        currentStep={currentStep}
                        completedSteps={getCompletedSteps()}
                        onStepClick={(index) => setCurrentStep(index)}
                    />
                </div>

                {/* Step Title */}
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-800">{stepTitles[currentStep].title}</h2>
                    <p className="text-sm text-gray-500">{stepTitles[currentStep].subtitle}</p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}

                {/* STEP 0: HISTÓRIA */}
                {/* STEP 0: HISTÓRIA */}
                {currentStep === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border shadow-sm p-8">
                        {story.story_text ? (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-semibold">História Gerada</h2>
                                    <div className="flex gap-3">
                                        <button onClick={handleGenerateStory} disabled={generating} className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                                            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            Regenerar
                                        </button>
                                        <button onClick={handleSave} disabled={saving || editedText === story.story_text} className="px-4 py-2 bg-[#FF0000] text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editedText === story.story_text ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                            {editedText === story.story_text ? 'Salvo' : 'Salvar'}
                                        </button>
                                    </div>
                                </div>
                                <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} className="w-full min-h-[300px] p-4 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-serif text-lg" placeholder="O texto aparecerá aqui..." />
                                <div className="text-sm text-gray-500 mt-2">{editedText.split(' ').filter(w => w.length > 0).length} palavras</div>
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Sparkles className="h-10 w-10 text-[#FF0000]" />
                                </div>
                                <h2 className="text-2xl font-bold mb-4">Vamos criar sua história!</h2>
                                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                    Com base nas suas escolhas ({story.title}, {story.age_group} anos, tom {story.tone}),
                                    a IA vai escrever uma história mágica para você.
                                </p>
                                <button
                                    onClick={handleGenerateStory}
                                    disabled={generating}
                                    className="px-8 py-4 bg-[#FF0000] text-white rounded-full font-bold text-lg hover:bg-red-700 transition-all flex items-center gap-3 mx-auto shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            Escrevendo sua história...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-6 w-6" />
                                            Gerar História Mágica
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 1: PERSONAGENS */}
                {currentStep === 1 && story.story_text && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border shadow-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <Users className="h-6 w-6 text-[#FF0000]" />
                                <h2 className="text-2xl font-bold">Personagens</h2>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleGenerateCharacterSheets}
                                    disabled={generatingCharacterSheets}
                                    className="text-sm font-medium px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {generatingCharacterSheets ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    Gerar Character Sheets (IA)
                                </button>
                                <button onClick={() => setIsCharacterModalOpen(true)} className="text-sm text-[#FF0000] hover:text-red-700 font-medium px-4 py-2 bg-red-50 rounded-lg">
                                    + Adicionar
                                </button>
                            </div>
                        </div>
                        {Object.keys(characterDescriptions).length > 0 ? (
                            <div className="space-y-4">
                                {Object.entries(characterDescriptions).map(([name, desc]) => (
                                    <div key={name} className="bg-gray-50 rounded-xl p-4 border">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                                <span className="text-red-700 font-bold">{name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <h3 className="font-bold text-lg">{name}</h3>
                                        </div>
                                        <textarea value={desc} onChange={(e) => setCharacterDescriptions(prev => ({ ...prev, [name]: e.target.value }))} className="w-full p-3 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none resize-none min-h-[150px] text-sm font-mono" placeholder={`Descrição de ${name}...`} />
                                    </div>
                                ))}
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm text-amber-800">💡 <strong>Dica:</strong> As descrições acima são usadas para manter a consistência visual nas imagens.</p>
                                </div>
                                <button onClick={() => handleSaveCharacters(characterDescriptions)} className="w-full py-3 bg-[#FF0000] text-white rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2">
                                    <Save className="h-5 w-5" />Salvar Personagens
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                                <Users className="h-10 w-10 mx-auto mb-4 opacity-50" />
                                <p>Nenhum personagem detectado ainda.</p>
                                <div className="flex flex-col items-center gap-3 mt-4">
                                    <button
                                        onClick={handleGenerateCharacterSheets}
                                        disabled={generatingCharacterSheets}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {generatingCharacterSheets ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                        Detectar e Gerar Character Sheets com IA
                                    </button>
                                    <span className="text-xs">ou</span>
                                    <button onClick={() => setIsCharacterModalOpen(true)} className="text-[#FF0000] hover:underline">
                                        + Adicionar Manualmente
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 2: NARRAÇÃO (Áudio) */}
                {currentStep === 2 && story.story_text && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border shadow-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <Headphones className="h-6 w-6 text-[#FF0000]" />
                                <h2 className="text-2xl font-bold">Narração em Áudio</h2>
                            </div>
                            <button onClick={handleGenerateFullAudio} disabled={generatingFullAudio} className="px-4 py-2 bg-[#FF0000] text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                                {generatingFullAudio ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</> : <><Volume2 className="h-4 w-4" />{story.full_audio_url ? 'Regenerar Áudio' : 'Gerar Narração'}</>}
                            </button>
                        </div>
                        {story.full_audio_url ? (
                            <div className="space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                    <p className="text-green-700 font-medium mb-3">✅ Narração gerada com sucesso!</p>
                                    <audio controls src={story.full_audio_url} className="w-full" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <a href={story.full_audio_url} download className="text-sm text-[#FF0000] hover:underline flex items-center gap-1">
                                        <Download className="h-4 w-4" />Baixar MP3
                                    </a>
                                    <button onClick={handleDeleteAudio} className="p-2 text-red-500 hover:bg-red-50 rounded-full flex items-center gap-2">
                                        <Trash2 className="h-4 w-4" />Excluir
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                                <Headphones className="h-10 w-10 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Nenhuma narração gerada</p>
                                <p className="text-sm mt-2">Clique em "Gerar Narração" para criar o áudio da história.</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 3: CENAS */}
                {currentStep === 3 && story.story_text && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="bg-white rounded-xl border shadow-sm p-6">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <Film className="h-6 w-6 text-[#FF0000]" />
                                    <div>
                                        <h2 className="text-xl font-bold">Cenas da História</h2>
                                        <p className="text-sm text-gray-500">{scenes.length} cenas</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {usageLimits && (
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${usageLimits.remaining > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            🖼️ {usageLimits.remaining}/{usageLimits.limit} imagens hoje
                                        </div>
                                    )}
                                    <button onClick={handleGenerateScenes} disabled={generatingScenes} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2">
                                        {generatingScenes ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</> : <><Film className="h-4 w-4" />{scenes.length > 0 ? 'Regenerar' : 'Gerar Cenas'}</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {scenes.length > 0 ? (
                            <SceneList scenes={scenes} onSaveScene={handleSaveScene} onGenerateImage={handleGenerateImage} onGeneratePrompt={handleGeneratePrompt} onUpdatePrompt={handleUpdatePrompt} onGenerateAudio={handleGenerateAudio} generatingImageIndex={generatingImageIndex} generatingPromptIndex={generatingPromptIndex} generatingAudioIndex={generatingAudioIndex} />
                        ) : (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                                <Film className="h-10 w-10 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Nenhuma cena gerada</p>
                                <p className="text-sm mt-2">Clique em "Gerar Cenas" para dividir sua história em cenas com prompts para imagens.</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 4: TIMELINE */}
                {currentStep === 4 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <VideoPreview scenes={scenes} />
                        <Timeline
                            scenes={scenes}
                            onReorder={handleReorderScenes}
                            onUpdateDuration={handleUpdateSceneDuration}
                        />
                    </motion.div>
                )}

                {/* STEP 5: PREVIEW/EXPORT */}
                {currentStep === 5 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                                        <PackageCheck className="h-6 w-6 text-green-600" />Exportar Projeto
                                    </h2>
                                    <p className="text-gray-600">Baixe todos os assets para edição externa</p>
                                </div>
                                <button onClick={handleCheckValidation} className="text-sm text-green-600 hover:underline flex items-center gap-1">
                                    <PackageCheck className="h-4 w-4" />Verificar
                                </button>
                            </div>
                            {validation && (
                                <div className={`p-4 rounded-lg mb-6 ${validation.isComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {validation.isComplete ? <p className="font-medium">✅ Projeto completo!</p> : (
                                        <div>
                                            <p className="font-medium mb-2">⚠️ Itens pendentes:</p>
                                            <ul className="list-disc list-inside text-sm">
                                                {validation.missingItems.map((item, i) => <li key={i}>{item}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button onClick={handleExport} disabled={exporting} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-3 text-lg">
                                {exporting ? <><Loader2 className="h-6 w-6 animate-spin" />Gerando ZIP...</> : <><Download className="h-6 w-6" />Baixar Projeto (.zip)</>}
                            </button>
                            <p className="text-xs text-gray-500 mt-4 text-center">O ZIP contém: imagens, áudios, roteiro e instruções</p>
                        </div>
                        <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Film className="h-8 w-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Vídeo Final</h3>
                            <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                Gere o vídeo completo da sua história, com narração, imagens e animações, pronto para postar!
                            </p>
                            <button
                                onClick={() => setIsExportModalOpen(true)}
                                className="px-8 py-3 bg-[#FF0000] text-white rounded-full font-bold hover:bg-red-700 hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                            >
                                <Video className="h-5 w-5" />
                                Gerar Vídeo MP4
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t">
                    <button onClick={goToPrevStep} disabled={currentStep === 0} className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${currentStep === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        <ArrowLeft className="h-5 w-5" />Anterior
                    </button>
                    <div className="text-sm text-gray-500">Passo {currentStep + 1} de {STORY_CREATION_STEPS.length}</div>
                    <button onClick={goToNextStep} disabled={currentStep === STORY_CREATION_STEPS.length - 1 || !canGoNext()} className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${currentStep === STORY_CREATION_STEPS.length - 1 || !canGoNext() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#FF0000] text-white hover:bg-red-700'}`}>
                        Próximo<ArrowRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Character Modal */}
            <CharacterModal
                isOpen={isCharacterModalOpen}
                onClose={() => setIsCharacterModalOpen(false)}
                detectedCharacters={Array.from(new Set(scenes.flatMap(s => s.characters || []).filter(c => c && c.trim().length > 0)))}
                initialDescriptions={characterDescriptions}
                onSave={handleSaveCharacters}
            />
            {/* Modals */}


            <ExportVideoModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                scenes={scenes}
                storyAudioUrl={story?.full_audio_url}
                storyTitle={story?.title || 'historia'}
            />
        </div>
    );
}
