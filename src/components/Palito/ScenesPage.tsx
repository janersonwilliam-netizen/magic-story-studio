import React, { useState } from 'react';
import { Layers, Loader2, RefreshCw, ArrowRight, ArrowLeft, CheckCircle, AlertCircle, ImageIcon } from 'lucide-react';
import { generatePalitoScenePrompts } from '../../services/palitoGemini';
import { generateImageWithNanoBanana, generateImageWithReferences } from '../../services/google_image';
import { PalitoTranscriptionLine, PalitoSceneLine, StoryCharacter } from '../../types/palito';

interface ScenesPageProps {
    title: string;
    transcription: PalitoTranscriptionLine[];
    characterImageUrl: string;
    storyCharacters?: StoryCharacter[];
    existingScenes?: PalitoSceneLine[];
    onComplete: (scenes: PalitoSceneLine[]) => void;
    onBack: () => void;
}

export function ScenesPage({ title, transcription, characterImageUrl, storyCharacters = [], existingScenes, onComplete, onBack }: ScenesPageProps) {
    const [scenes, setScenes] = useState<PalitoSceneLine[]>(
        existingScenes || transcription.map(t => ({ ...t, imagePrompt: '', imageUrl: undefined }))
    );
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [promptsGenerated, setPromptsGenerated] = useState(!!(existingScenes && existingScenes[0]?.imagePrompt));
    const [generatingPrompts, setGeneratingPrompts] = useState(false);
    const [promptBatchMsg, setPromptBatchMsg] = useState('');
    const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
    const [errors, setErrors] = useState<Record<number, string>>({});
    const [batchRunning, setBatchRunning] = useState(false);

    const totalImages = scenes.length;
    const doneImages = scenes.filter(s => s.imageUrl).length;
    const allDone = doneImages === totalImages && totalImages > 0;

    const handleGeneratePrompts = async () => {
        setGeneratingPrompts(true);
        try {
            const prompts = await generatePalitoScenePrompts(
                transcription,
                title,
                (done, total) => setPromptBatchMsg(`Lote ${done} de ${total}...`)
            );
            setScenes(prev => prev.map((s, i) => ({ ...s, imagePrompt: prompts[i] || s.imagePrompt })));
            setPromptsGenerated(true);
        } catch (e: any) {
            alert('Erro ao gerar prompts: ' + e.message);
        } finally {
            setGeneratingPrompts(false);
            setPromptBatchMsg('');
        }
    };

    const generateSingleImage = async (i: number) => {
        setGeneratingImages(prev => ({ ...prev, [i]: true }));
        setErrors(prev => ({ ...prev, [i]: '' }));
        try {
            const scene = scenes[i];
            const sceneTextLower = scene.text.toLowerCase();

            // Collect reference images: story characters mentioned in scene text
            // (narrator style is already baked into the prompt via STYLE_ANCHOR)
            const refs: string[] = [];
            for (const char of storyCharacters) {
                if (char.imageUrl) {
                    const nameParts = char.name.toLowerCase().split(' ');
                    const mentioned = nameParts.some(part => part.length > 3 && sceneTextLower.includes(part));
                    if (mentioned) refs.push(char.imageUrl);
                }
            }

            const url = refs.length > 0
                ? await generateImageWithReferences(scene.imagePrompt, refs)
                : await generateImageWithNanoBanana(scene.imagePrompt);

            setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, imageUrl: url } : s));
        } catch (e: any) {
            setErrors(prev => ({ ...prev, [i]: e.message || 'Erro ao gerar imagem' }));
        } finally {
            setGeneratingImages(prev => ({ ...prev, [i]: false }));
        }
    };

    const handleGenerateAll = async () => {
        setBatchRunning(true);
        const pending = scenes.map((s, i) => ({ s, i })).filter(({ s }) => !s.imageUrl);
        const BATCH = 3;
        for (let b = 0; b < pending.length; b += BATCH) {
            const chunk = pending.slice(b, b + BATCH);
            await Promise.all(chunk.map(({ i }) => generateSingleImage(i)));
        }
        setBatchRunning(false);
    };

    const updatePrompt = (i: number, value: string) => {
        setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, imagePrompt: value } : s));
    };

    const selected = scenes[selectedIndex];

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Imagens das Cenas</h2>
                    <p className="text-gray-400 text-sm">{totalImages} cenas · {doneImages} imagens geradas</p>
                </div>
                <div className="flex items-center gap-2">
                    {!promptsGenerated ? (
                        <button
                            onClick={handleGeneratePrompts}
                            disabled={generatingPrompts}
                            className="flex items-center gap-2 px-4 py-2 bg-[#242426] border border-primary text-primary rounded-lg font-semibold text-sm hover:bg-primary/10 disabled:opacity-50 transition-colors"
                        >
                            {generatingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                            {generatingPrompts ? `Gerando prompts — ${promptBatchMsg}` : 'Gerar Prompts'}
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerateAll}
                            disabled={batchRunning || allDone}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                            {batchRunning ? `Gerando (${doneImages}/${totalImages})...` : allDone ? 'Todas geradas ✓' : 'Gerar Todas'}
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#242426] rounded-full h-1.5">
                <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${totalImages > 0 ? (doneImages / totalImages) * 100 : 0}%` }}
                />
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-2 gap-4" style={{ minHeight: 520 }}>

                {/* LEFT — scene list */}
                <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-[#1a1a1c] border-b border-border">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cenas da transcrição</p>
                    </div>
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: 560 }}>
                        {scenes.map((scene, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedIndex(i)}
                                className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex items-start gap-2 ${
                                    selectedIndex === i
                                        ? 'bg-primary/10 border-l-2 border-l-primary'
                                        : 'hover:bg-[#242426]'
                                }`}
                            >
                                <span className="text-primary font-mono text-[10px] shrink-0 mt-0.5 w-10">{scene.timestamp}</span>
                                <p className="text-gray-300 text-xs leading-relaxed flex-1 line-clamp-2">{scene.text}</p>
                                <span className="shrink-0 mt-0.5">
                                    {scene.imageUrl
                                        ? <CheckCircle className="h-3 w-3 text-green-400" />
                                        : generatingImages[i]
                                            ? <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                            : errors[i]
                                                ? <AlertCircle className="h-3 w-3 text-red-400" />
                                                : <div className="h-3 w-3 rounded-full border border-border" />
                                    }
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT — selected scene detail */}
                <div className="flex flex-col gap-3">
                    {selected && (
                        <>
                            {/* Scene header */}
                            <div className="bg-[#242426] border border-border rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-primary font-mono text-xs">[{selected.timestamp}]</span>
                                    <span className="text-xs text-gray-500">cena {selectedIndex + 1} de {totalImages}</span>
                                </div>
                                <p className="text-white text-sm leading-relaxed">{selected.text}</p>
                            </div>

                            {/* Image area */}
                            <div className="bg-[#242426] border border-border rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
                                {selected.imageUrl ? (
                                    <img
                                        src={selected.imageUrl}
                                        alt={`Cena ${selected.timestamp}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : generatingImages[selectedIndex] ? (
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-xs">Gerando imagem...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-gray-600">
                                        <ImageIcon className="h-8 w-8" />
                                        <p className="text-xs">Sem imagem</p>
                                    </div>
                                )}
                            </div>

                            {/* Generate button for this scene */}
                            {promptsGenerated && (
                                <button
                                    onClick={() => generateSingleImage(selectedIndex)}
                                    disabled={generatingImages[selectedIndex] || batchRunning}
                                    className="flex items-center justify-center gap-2 py-2 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white hover:border-primary disabled:opacity-40 transition-colors"
                                >
                                    {generatingImages[selectedIndex]
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <RefreshCw className="h-4 w-4" />}
                                    {selected.imageUrl ? 'Regenerar esta cena' : 'Gerar esta cena'}
                                </button>
                            )}

                            {errors[selectedIndex] && (
                                <p className="text-red-400 text-xs px-1">{errors[selectedIndex]}</p>
                            )}

                            {/* Prompt */}
                            {promptsGenerated && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Prompt da cena</p>
                                    <textarea
                                        value={selected.imagePrompt}
                                        onChange={e => updatePrompt(selectedIndex, e.target.value)}
                                        rows={4}
                                        className="w-full bg-[#1a1a1c] border border-border text-gray-400 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] border border-border text-gray-300 rounded-lg text-sm hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                    onClick={() => onComplete(scenes)}
                    disabled={!allDone}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    Avançar <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
