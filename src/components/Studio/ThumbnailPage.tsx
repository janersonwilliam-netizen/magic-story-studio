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
    // Initialize with existing thumbnail if available
    const [imageUrl, setImageUrl] = useState<string | null>(storyWithScenes.thumbnailUrl || null);
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

    // Find the Intro Scene - prefer TITLE CARD, otherwise use first scene
    const introSceneIndex = Math.max(
        0,
        storyWithScenes.scenes.findIndex((s: Scene) => s.visualDescription.includes('TITLE CARD'))
    );
    const introScene = storyWithScenes.scenes[introSceneIndex];

    const toggleCharacter = (name: string) => {
        setSelectedCharacters((prev: string[]) => {
            if (prev.includes(name)) {
                return prev.filter((c: string) => c !== name);
            } else {
                if (prev.length >= 2) {
                    return [...prev, name];
                }
                return [...prev, name];
            }
        });
    };

    // Multi-language state
    const [englishTitle, setEnglishTitle] = useState<string | null>(null);
    const [spanishTitle, setSpanishTitle] = useState<string | null>(null);
    const [generatedEnglish, setGeneratedEnglish] = useState(false);

    // Store all generated images
    const [images, setImages] = useState<{
        original: string | null;
        english: string | null;
        spanish: string | null;
    }>({
        original: storyWithScenes.thumbnailUrl || null,
        english: null,
        spanish: null
    });

    // If the thumbnail URL is already set, we assume the initial (likely Portuguese) one is done
    const initialGenerated = !!images.original;

    const generateThumbnail = async (language: 'original' | 'english' | 'spanish' = 'original') => {
        if (!introScene) return;

        setGenerating(true);
        setError('');

        try {
            console.log(`[ThumbnailPage] Generating thumbnail (${language})...`);

            // Determine effective title
            let effectiveTitle = storyWithScenes.title;

            if (language === 'english') {
                if (!englishTitle) {
                    const { translateTitle } = await import('../../services/gemini');
                    const translated = await translateTitle(storyWithScenes.title, 'English');
                    setEnglishTitle(translated);
                    effectiveTitle = translated;
                } else {
                    effectiveTitle = englishTitle;
                }
            } else if (language === 'spanish') {
                if (!spanishTitle) {
                    const { translateTitle } = await import('../../services/gemini');
                    const translated = await translateTitle(storyWithScenes.title, 'Spanish');
                    setSpanishTitle(translated);
                    effectiveTitle = translated;
                } else {
                    effectiveTitle = spanishTitle;
                }
            }

            // Collect references and statuses
            const references: string[] = [];
            const statuses: string[] = [];
            const selectedNames: string[] = [];

            // CRITICAL CHANGE: If generating English or Spanish, use the ORIGINAL image as the PRIMARY reference
            // to ensure consistency (change only title)
            if (language !== 'original' && images.original) {
                console.log('[ThumbnailPage] Using ORIGINAL cover as reference for consistency');
                references.push(images.original);
                statuses.push('protagonist'); // Give it broad weight
            }

            // Then add character references as usual (maybe with less weight if we have the main image?)
            // Actually, if we have the main image, adding characters again might confuse it or be redundant.
            // But let's keep them to be safe, especially if the original didn't capture them perfectly? 
            // Or maybe purely rely on the Original Image reference?
            // Let's rely on the Original Image + Prompt to Guide the change.

            if (language === 'original') {
                selectedCharacters.forEach((name: string) => {
                    if (storyWithScenes.characterReferenceImages?.[name]) {
                        references.push(storyWithScenes.characterReferenceImages[name]);
                        statuses.push('protagonist');
                        selectedNames.push(name);
                    }
                });
            }

            let prompt = '';

            // Enhanced prompt construction
            if (language !== 'original') {
                // Prompt for MODIFICATION / VARIATION
                const styleMod = storyWithScenes.visualStyle === 'Estilo 2D Cartoon'
                    ? `Premium 2D Cartoon style. The title text is now "${effectiveTitle}" in bold, colorful 2D typography`
                    : `Disney/Pixar 3D style. The title text is now "${effectiveTitle}" in BIG, BOLD, 3D TYPOGRAPHY`;

                prompt = `TITULO: ${effectiveTitle}
CENA: Movie Poster Layout. ${styleMod} at the top or center.
IMPORTANT: KEEP THE VISUAL IDENTICAL to the reference image provided. SAME characters, SAME pose, SAME background. ONLY CHANGE THE TEXT TITLE to "${effectiveTitle}".
EMOÇÃO: Happy, Excited, Adventurous.`;

            } else {
                // Standard Prompt for Original
                const { generateImageWithReferences } = await import('../../services/google_image'); // just for type check if needed, mostly logic below

                let charText = '';
                if (selectedNames.length > 0) {
                    const charDescriptions = selectedNames.map((name: string) => {
                        const charDNA = storyWithScenes.characters[name];
                        const visualDesc = charDNA?.description || charDNA?.full_description || '';
                        return `${name} (${visualDesc.slice(0, 150)}...)`;
                    });
                    charText = charDescriptions.length > 1
                        ? `Characters: ${charDescriptions.join(' AND ')}`
                        : `Character: ${charDescriptions[0]}`;
                }

                const styleModOrig = storyWithScenes.visualStyle === 'Estilo 2D Cartoon'
                    ? `Premium 2D Cartoon style. The title text "${effectiveTitle}" is displayed in bold, colorful 2D typography (like a modern mobile game logo) at the top or center. Vibrant colors, magical atmosphere, crisp lines, 16:9 wide shot, NO 3D rendering.`
                    : `Disney/Pixar 3D style. The title text "${effectiveTitle}" is displayed in BIG, BOLD, 3D TYPOGRAPHY (like a movie logo) at the top or center. Cinematic lighting, magical atmosphere, depth of field, 8k resolution, 16:9 wide shot.`;

                prompt = `TITULO: ${effectiveTitle}
CENA: Movie Poster Layout. ${styleModOrig}
PERSONAGEM: ${charText}. Posing dynamically interactions with the title text.
EMOÇÃO: Happy, Excited, Adventurous.`;
            }

            console.log(`[ThumbnailPage] Generating with references: ${references.length}`);

            const { generateImageWithReferences } = await import('../../services/google_image');

            // If we have references (either chars or original cover), use them
            // If standard generation with no chars, fallback to nano banana inside generateImageWithReferences (it handles empty refs)
            // But wait, generateImageWithReferences with empty refs falls back to standard.

            const url = await generateImageWithReferences(
                prompt,
                references,
                statuses
            );

            // Update specific image slot and set as current selected
            setImages((prev: any) => ({ ...prev, [language]: url }));
            setImageUrl(url);

            // Update state to unlock next steps
            if (language === 'english') {
                setGeneratedEnglish(true);
            }

        } catch (err: any) {
            console.error('[ThumbnailPage] Error:', err);
            setError(err.message || 'Erro ao gerar capa');
        } finally {
            setGenerating(false);
        }
    };

    const handleConfirm = () => {
        if (imageUrl) {
            onComplete({
                ...storyWithScenes,
                thumbnailUrl: imageUrl,
                // Do NOT modify scenes here — thumbnail is separate from scene images
            });
        }
    };

    if (!storyWithScenes.scenes || storyWithScenes.scenes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-xl text-gray-600 mb-4">Nenhuma cena encontrada. Volte e gere as cenas primeiro.</p>
                <button onClick={onBack} className="px-4 py-2 bg-gray-200 rounded-lg">Voltar</button>
            </div>
        );
    }

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
                        Capa da História
                    </h1>
                    <p className="text-muted-foreground">
                        Escolha quem aparece na capa e gere um título incrível
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-start">

                    {/* Preview Area - Scrollable List */}
                    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">

                        {/* 1. Original / Portuguese */}
                        <div className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all cursor-pointer group ${imageUrl === images.original && images.original ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                            onClick={() => images.original && setImageUrl(images.original)}>

                            {generating && !images.original && !images.english && !images.spanish ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30">
                                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-2" />
                                    <p className="text-muted-foreground font-medium">Criando capa mágica...</p>
                                </div>
                            ) : images.original ? (
                                <>
                                    <img src={images.original} alt="Capa Original" className="w-full h-full object-cover" />
                                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                        Portugues (Original)
                                    </div>
                                    {imageUrl === images.original && (
                                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground p-1 rounded-full">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-muted-foreground/50">
                                    Aguardando geração...
                                </div>
                            )}
                        </div>

                        {/* 2. English Version */}
                        {(generatedEnglish || images.english) && (
                            <div className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all cursor-pointer group ${imageUrl === images.english && images.english ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-100'}`}
                                onClick={() => images.english && setImageUrl(images.english)}>

                                {generating && !images.english && images.original ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30">
                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                                        <p className="text-blue-600 font-medium">Translating & Generating...</p>
                                    </div>
                                ) : images.english ? (
                                    <>
                                        <img src={images.english} alt="English Cover" className="w-full h-full object-cover" />
                                        <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                            English
                                        </div>
                                        {imageUrl === images.english && (
                                            <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-blue-50 text-blue-400">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. Spanish Version */}
                        {(images.spanish || (generatedEnglish && generating && !images.spanish && images.english)) ? (
                            <div className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all cursor-pointer group ${imageUrl === images.spanish && images.spanish ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-orange-100'}`}
                                onClick={() => images.spanish && setImageUrl(images.spanish)}>

                                {generating && !images.spanish ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30">
                                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                                        <p className="text-orange-600 font-medium">Traduciendo & Generando...</p>
                                    </div>
                                ) : images.spanish ? (
                                    <>
                                        <img src={images.spanish} alt="Spanish Cover" className="w-full h-full object-cover" />
                                        <div className="absolute top-2 left-2 bg-orange-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                            Español
                                        </div>
                                        {imageUrl === images.spanish && (
                                            <div className="absolute top-2 right-2 bg-orange-600 text-white p-1 rounded-full">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-orange-50 text-orange-400">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {error && (
                            <div className="flex flex-col items-center text-destructive p-4 text-center bg-red-50 rounded-lg">
                                <span className="text-2xl mb-2">⚠️</span>
                                <p>{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Controls Area */}
                    <div className="space-y-6">

                        {/* Protagonist Selection */}
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                            <label className="block text-sm font-semibold text-primary mb-3 flex items-center gap-2">
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
                                                ? 'bg-card border-primary shadow-md ring-2 ring-primary/20'
                                                : 'bg-card/50 border-border hover:bg-card hover:border-primary/50 opacity-70 hover:opacity-100'
                                                }`}
                                        >
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                                    <img src={imgUrl} alt={name} className="w-full h-full object-cover" />
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                                                        <Check className="w-2 h-2 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-sm font-medium block truncate text-foreground">{name}</span>
                                                <span className="text-xs text-primary/80 truncate block">
                                                    {storyWithScenes.characters[name]?.status === 'protagonist' ? 'Protagonista' : 'Coadjuvante'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-primary/70 mt-2 opacity-80">
                                Dica: Selecione quem é importante para o título "{storyWithScenes.title}"
                            </p>
                        </div>

                        {/* Title Display */}
                        <div className="bg-muted/30 p-4 rounded-xl border border-border">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                                Título da História
                            </label>
                            <p className="text-lg font-bold text-foreground leading-tight">
                                {storyWithScenes.title}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3 pt-2">
                            <button
                                onClick={() => generateThumbnail('original')}
                                disabled={generating}
                                className="w-full py-3 bg-card border-2 border-border text-foreground rounded-xl hover:border-primary hover:text-primary transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm"
                            >
                                {generating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-5 h-5" />
                                )}
                                {imageUrl ? 'Regenerar Capa (PT)' : 'Gerar Capa'}
                            </button>

                            {/* English Generation */}
                            {initialGenerated && (
                                <button
                                    onClick={() => generateThumbnail('english')}
                                    disabled={generating}
                                    className="w-full py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {generating ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <span className="text-lg">🇺🇸</span>
                                    )}
                                    Gerar em Inglês
                                </button>
                            )}

                            {/* Spanish Generation */}
                            {generatedEnglish && (
                                <button
                                    onClick={() => generateThumbnail('spanish')}
                                    disabled={generating}
                                    className="w-full py-3 bg-orange-50 border-2 border-orange-200 text-orange-700 rounded-xl hover:bg-orange-100 hover:border-orange-300 transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {generating ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <span className="text-lg">🇪🇸</span>
                                    )}
                                    Gerar em Espanhol
                                </button>
                            )}

                            <button
                                onClick={handleConfirm}
                                disabled={!imageUrl || generating}
                                className="w-full py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-bold text-lg shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        className="text-muted-foreground hover:text-foreground font-medium text-sm flex items-center gap-1"
                    >
                        ← Voltar para Personagens
                    </button>
                </div>

            </motion.div>
        </div>
    );
}
