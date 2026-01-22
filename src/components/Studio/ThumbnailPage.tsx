/**
 * THUMBNAIL Page - Title Card Generation
 * Intermediate step between SCENES and IMAGES
 * Generates the cover image (Scene 0) with specific Title Card prompts
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StoryWithScenes, Scene } from '../../types/studio';
import { Loader2, Sparkles, RefreshCw, Check, ArrowRight, User } from 'lucide-react';

interface ThumbnailPageProps {
    storyWithScenes: StoryWithScenes;
    onComplete: (storyWithScenes: StoryWithScenes) => void;
    onBack: () => void;
}

export function ThumbnailPage({ storyWithScenes, onComplete, onBack }: ThumbnailPageProps) {
    const [generating, setGenerating] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Multi-select state for characters
    // Default to ALL protagonists, or first available character if none
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(() => {
        const charNames = Object.keys(storyWithScenes.characterReferenceImages || {});
        // Try to find protagonists
        const protagonists = charNames.filter(name => storyWithScenes.characters[name]?.status === 'protagonist');

        if (protagonists.length > 0) return protagonists;
        if (charNames.length > 0) return [charNames[0]];
        return [];
    });

    // Find the Intro Scene (usually scene 0/1)
    const introSceneIndex = storyWithScenes.scenes.findIndex(s => s.visualDescription.includes('TITLE CARD'));
    const introScene = storyWithScenes.scenes[introSceneIndex];

    const toggleCharacter = (name: string) => {
        setSelectedCharacters(prev => {
            if (prev.includes(name)) {
                return prev.filter(c => c !== name);
            } else {
                if (prev.length >= 2) {
                    // Optional: Limit to 2 for thumbnail clarity, or allow more?
                    // Let's allow but maybe warn or just replace oldest?
                    // User request: "se forem 2 use os dois" -> Let's keep it simple, just add.
                    return [...prev, name];
                }
                return [...prev, name];
            }
        });
    };

    const generateThumbnail = async () => {
        if (!introScene) return;

        setGenerating(true);
        setError('');
        setImageUrl(null);

        try {
            console.log('[ThumbnailPage] Generating thumbnail...');

            // Build the specific Title Card prompt
            let prompt = introScene.imagePrompt || '';

            // Collect references for ALL selected characters
            const references: string[] = [];
            const statuses: string[] = [];
            const selectedNames: string[] = [];

            selectedCharacters.forEach(name => {
                if (storyWithScenes.characterReferenceImages?.[name]) {
                    references.push(storyWithScenes.characterReferenceImages[name]);
                    statuses.push('protagonist'); // Force high consistency for cover
                    selectedNames.push(name);
                }
            });

            // Enhanced prompt construction
            // If we have specific characters selected, mention them explicitly
            if (selectedNames.length > 0) {
                const { generateImageWithReferences } = await import('../../services/google_image');

                const charDescriptions = selectedNames.map(name => {
                    const charDNA = storyWithScenes.characters[name];
                    const visualDesc = charDNA?.description || charDNA?.full_description || ''; // Use most detailed available
                    // Extract key visual traits short enough for prompt
                    return `${name} (${visualDesc.slice(0, 150)}...)`;
                });

                const charText = charDescriptions.length > 1
                    ? `Characters: ${charDescriptions.join(' AND ')}`
                    : `Character: ${charDescriptions[0]}`;



                // New Prompt specialized for Title Card + Characters
                prompt = `TITULO: ${storyWithScenes.title}
CENA: Movie Poster Layout. Disney/Pixar 3D style. Cinematic lighting, magical atmosphere, 16:9 wide shot.
PERSONAGEM: ${charText}. Posing happily NEXT TO the title text.
EMOÇÃO: Happy, Excited.`;

                console.log(`[ThumbnailPage] Using references for: ${selectedNames.join(', ')}`);

                const url = await generateImageWithReferences(
                    prompt,
                    references,
                    statuses
                );

                setImageUrl(url);

            } else {
                // Fallback standard generation (no characters or no references)
                console.log('[ThumbnailPage] No characters selected, using standard generation');
                const { generateImageWithNanoBanana } = await import('../../services/google_image');

                if (!prompt.includes('TITLE CARD')) {
                    prompt = `TITLE CARD: "${storyWithScenes.title}". Disney/Pixar 3D style title text. Magical, vibrant, high quality 8k render.`;
                }

                const url = await generateImageWithNanoBanana(prompt);
                setImageUrl(url);
            }

        } catch (err: any) {
            console.error('[ThumbnailPage] Error:', err);
            setError(err.message || 'Erro ao gerar capa');
        } finally {
            setGenerating(false);
        }
    };

    const handleConfirm = () => {
        if (imageUrl && introScene) {
            // Update the scene in the story object
            const updatedScenes = [...storyWithScenes.scenes];
            updatedScenes[introSceneIndex] = {
                ...introScene,
                imageUrl: imageUrl,
                // Update characters list for this scene to match selection
                characters: selectedCharacters.length > 0 ? selectedCharacters : introScene.characters
            };

            onComplete({
                ...storyWithScenes,
                thumbnailUrl: imageUrl, // CRITICAL: Propagate thumbnailUrl to skip Scene 1 in ImagesPage
                scenes: updatedScenes
            });
        }
    };

    // Auto-generate removed per user request
    // User must click "Gerar Capa" manually

    if (!introScene) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-xl text-gray-600 mb-4">Cena de introdução não encontrada.</p>
                <button onClick={onBack} className="px-4 py-2 bg-gray-200 rounded-lg">Voltar</button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-8"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Capa da História
                    </h1>
                    <p className="text-gray-600">
                        Escolha quem aparece na capa e gere um título incrível
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-start">

                    {/* Preview Area */}
                    <div className="bg-gray-100 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center border-2 border-gray-200 shadow-inner group">
                        {generating ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-12 h-12 text-[#FF0000] animate-spin mb-2" />
                                <p className="text-gray-500 font-medium">Criando capa mágica...</p>
                            </div>
                        ) : imageUrl ? (
                            <>
                                <img
                                    src={imageUrl}
                                    alt="Thumbnail Preview"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                        {/* Overlay content if needed */}
                                    </div>
                                </div>
                            </>
                        ) : error ? (
                            <div className="flex flex-col items-center text-red-500 p-4 text-center">
                                <span className="text-2xl mb-2">⚠️</span>
                                <p>{error}</p>
                            </div>
                        ) : (
                            <p className="text-gray-400">Aguardando geração...</p>
                        )}
                    </div>

                    {/* Controls Area */}
                    <div className="space-y-6">

                        {/* Protagonist Selection */}
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <label className="block text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Escolha os Personagens da Capa ({selectedCharacters.length})
                            </label>

                            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                {Object.entries(storyWithScenes.characterReferenceImages || {}).map(([name, imgUrl]) => {
                                    const isSelected = selectedCharacters.includes(name);
                                    return (
                                        <button
                                            key={name}
                                            onClick={() => toggleCharacter(name)}
                                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${isSelected
                                                ? 'bg-white border-purple-500 shadow-md ring-2 ring-purple-200'
                                                : 'bg-white/50 border-gray-200 hover:bg-white hover:border-purple-300 opacity-70 hover:opacity-100'
                                                }`}
                                        >
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                                    <img src={imgUrl} alt={name} className="w-full h-full object-cover" />
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                                        <Check className="w-2 h-2 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-sm font-medium block truncate">{name}</span>
                                                <span className="text-xs text-purple-600 truncate block">
                                                    {storyWithScenes.characters[name]?.status === 'protagonist' ? 'Protagonista' : 'Coadjuvante'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-purple-700 mt-2 opacity-80">
                                Dica: Selecione quem é importante para o título "{storyWithScenes.title}"
                            </p>
                        </div>

                        {/* Title Display */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                                Título da História
                            </label>
                            <p className="text-lg font-bold text-gray-800 leading-tight">
                                {storyWithScenes.title}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3 pt-2">
                            <button
                                onClick={generateThumbnail}
                                disabled={generating}
                                className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-[#FF0000] hover:text-[#FF0000] transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm"
                            >
                                {generating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-5 h-5" />
                                )}
                                {imageUrl ? 'Regenerar Capa' : 'Gerar Capa'}
                            </button>

                            <button
                                onClick={handleConfirm}
                                disabled={!imageUrl || generating}
                                className="w-full py-4 bg-[#FF0000] text-white rounded-xl hover:bg-red-600 transition-colors font-bold text-lg shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <span>Continuar</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-gray-700 font-medium text-sm flex items-center gap-1"
                    >
                        ← Voltar para Personagens
                    </button>
                </div>

            </motion.div>
        </div>
    );
}
