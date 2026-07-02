/**
 * SCENES Page - Character DNA and Scene Generation
 * Third step in the Studio workflow
 * Generates scenes and extracts character information
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StoryWithNarration, StoryWithScenes, Scene, CharacterDNA } from '../../types/studio';
import { extractCharactersFromStory, extractStructuredCharacterData, generateScenesWithGemini, stripGreetingPrefix, stripClosingCTA } from '../../services/gemini';
import { generateImageWithNanoBanana } from '../../services/google_image';
import { IMAGE_STYLE_2D, IMAGE_STYLE_3D } from '../../lib/imageStyle';
import { Loader2, User, Palette, Shirt, Sparkles, RefreshCw } from 'lucide-react';

interface ScenesPageProps {
    story: StoryWithNarration;
    existingData?: StoryWithScenes; // Pass existing scenes/characters if returning to this step
    onComplete: (storyWithScenes: StoryWithScenes) => void;
    onBack: () => void;
}

/**
 * Remove a moldura de canal das cenas: a saudação inicial ("Hoje eu vou contar...")
 * sai da primeira cena (que passa a começar em "Era uma vez...") e o CTA de
 * encerramento ("Se você gostou...") sai da última cena (que passa a terminar na moral).
 * A saudação e o CTA continuam no áudio completo (storyText), apenas não nas cenas/imagens.
 */
function removeFramingFromScenes(scenes: Scene[]): Scene[] {
    if (scenes.length === 0) return scenes;
    const result = scenes.map(scene => ({ ...scene }));

    const first = result[0];
    const strippedFirst = stripGreetingPrefix(first.narrationText);
    if (strippedFirst && strippedFirst !== first.narrationText) {
        first.narrationText = strippedFirst;
    }

    const last = result[result.length - 1];
    const strippedLast = stripClosingCTA(last.narrationText);
    if (strippedLast && strippedLast !== last.narrationText) {
        last.narrationText = strippedLast;
    }

    return result;
}

export function ScenesPage({ story, existingData, onComplete, onBack }: ScenesPageProps) {
    const [loading, setLoading] = useState(!existingData); // Don't show loading if we have existing data
    const [scenes, setScenes] = useState<Scene[]>(existingData?.scenes || []);
    const [characters, setCharacters] = useState<Record<string, CharacterDNA>>(existingData?.characters || {});
    const [mainCharacter, setMainCharacter] = useState<CharacterDNA | null>(null);
    const [error, setError] = useState('');

    // Character reference images states (support multiple characters)
    const [generatingCharacterImages, setGeneratingCharacterImages] = useState<Record<string, boolean>>({});
    const [characterReferenceImages, setCharacterReferenceImages] = useState<Record<string, string>>(existingData?.characterReferenceImages || {});
    const [characterImageErrors, setCharacterImageErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        // Only generate if we don't have existing data
        if (!existingData || existingData.scenes.length === 0) {
            generateScenesAndCharacters();
        } else {
            console.log('[ScenesPage] Using existing scenes and characters');
            setLoading(false);
            // Set main character from existing data
            const charKeys = Object.keys(existingData.characters || {});
            if (charKeys.length > 0) {
                setMainCharacter(existingData.characters[charKeys[0]]);
            }
        }
    }, []);

    const generateScenesAndCharacters = async (forceLLMSeparation = false) => {
        setLoading(true);
        setError('');

        try {
            console.log('[ScenesPage] Generating scenes and characters...');

            // 1. Extract character names before scene separation so scenes can use official names.
            let extractedCharacters: Record<string, string> = {};
            try {
                extractedCharacters = await extractCharactersFromStory(story.storyText);
                console.log('[ScenesPage] Extracted characters:', extractedCharacters);
            } catch (err) {
                console.error('[ScenesPage] Error extracting characters:', err);
            }

            const characterNames = Object.keys(extractedCharacters);

            // 2. Generate or Map scenes
            let generatedScenes: Scene[] = [];

            if (story.rawScenes && story.rawScenes.length > 0 && !forceLLMSeparation) {
                console.log('[ScenesPage] Using rawScenes from Narration generation');
                generatedScenes = story.rawScenes.map((scene, index) => {
                    // Try to guess characters by name matching
                    const matchedCharacters = characterNames.filter(name => 
                        (scene.texto || '').toLowerCase().includes(name.toLowerCase()) ||
                        (scene.prompt_imagem || '').toLowerCase().includes(name.toLowerCase())
                    );
                    
                    return {
                        id: `scene-${index + 1}`,
                        order: index + 1,
                        narrationText: scene.texto,
                        visualDescription: scene.prompt_imagem || scene.texto,
                        imagePrompt: scene.prompt_imagem,
                        emotion: 'calma',
                        durationEstimate: Math.max(8, Math.round((scene.texto || '').split(' ').length / 2.5)),
                        characters: matchedCharacters.length > 0 ? matchedCharacters : (characterNames.length > 0 ? [characterNames[0]] : [])
                    };
                });
            } else {
                console.log('[ScenesPage] Generating scenes using Gemini separation (Fallback)');
                const scenesResult = await generateScenesWithGemini({
                    narration_text: story.storyText,
                    duration: story.duration,
                    targetSceneCount: story.sceneCount,
                    title: story.title,
                    knownCharacters: characterNames
                });

                generatedScenes = scenesResult.scenes.map((scene: any, index: number) => ({
                    id: `scene-${index + 1}`,
                    order: index + 1,
                    narrationText: scene.narration_text,
                    visualDescription: scene.visual_description,
                    emotion: scene.emotion || 'calma',
                    durationEstimate: scene.duration_estimate || 15,
                    characters: scene.characters || [],
                    imagePrompt: scene.image_prompt
                }));
            }

            // Remove a moldura (saudação/CTA) das cenas — fica só o corpo da história.
            generatedScenes = removeFramingFromScenes(generatedScenes);

            setScenes(generatedScenes);

            // 3. Generate structured character data for main characters
            const characterDNAs: Record<string, CharacterDNA> = {};

            const characterPromises = characterNames.slice(0, 5).map(async (name) => {
                try {
                    const structuredData = await extractStructuredCharacterData(story.storyText, name, story.visualStyle);

                    characterDNAs[name] = {
                        name,
                        species: structuredData.species,
                        mainColors: structuredData.main_colors,
                        clothing: structuredData.clothing,
                        accessories: structuredData.accessories,
                        description: structuredData.full_description,
                        status: characterNames.indexOf(name) === 0 ? 'protagonist' : 'supporting'
                    };

                    console.log(`[ScenesPage] Generated DNA for ${name}:`, characterDNAs[name]);
                } catch (err) {
                    console.error(`[ScenesPage] Error generating DNA for ${name}:`, err);
                }
            });

            await Promise.all(characterPromises);

            setCharacters(characterDNAs);

            // Set main character (first one)
            if (characterNames.length > 0 && characterDNAs[characterNames[0]]) {
                setMainCharacter(characterDNAs[characterNames[0]]);
            }

            setLoading(false);

        } catch (err: any) {
            console.error('[ScenesPage] Error:', err);
            setError(err.message || 'Erro ao gerar cenas');
            setLoading(false);
        }
    };

    const generateCharacterImage = async (characterName: string) => {
        const character = characters[characterName];
        if (!character) return;

        setGeneratingCharacterImages(prev => ({ ...prev, [characterName]: true }));
        setCharacterImageErrors(prev => ({ ...prev, [characterName]: '' }));

        try {
            console.log(`[ScenesPage] Generating reference image for ${characterName}...`);

            // Build a flat, highly descriptive prompt. STYLE GOES FIRST to avoid truncation.
            // Usa o mesmo vocabulário de estilo da capa e das cenas (src/lib/imageStyle.ts) para que
            // a ficha de referência do personagem já nasça no mesmo estilo visual usado no resto da história.
            const baseStyle = story.visualStyle === 'Estilo 2D Cartoon' ? IMAGE_STYLE_2D : IMAGE_STYLE_3D;

            // Truncate description to prevent it from pushing style instructions out of the prompt
            const shortDesc = (character.description || '').substring(0, 150);

            const characterPrompt = `${baseStyle}. A cute character design of ${character.name}, ${character.species}. Colors: ${character.mainColors.join(', ')}. Clothing: ${character.clothing}. ${character.accessories !== 'Nenhum' ? `Accessories: ${character.accessories}.` : ''} ${shortDesc}. Adorable, friendly, full body portrait, centered, white neutral background, high quality, professional character sheet.`;

            const imageUrl = await generateImageWithNanoBanana(characterPrompt, story.visualStyle);

            setCharacterReferenceImages(prev => ({ ...prev, [characterName]: imageUrl }));
            setGeneratingCharacterImages(prev => ({ ...prev, [characterName]: false }));

            console.log(`[ScenesPage] Reference image generated for ${characterName}`);

        } catch (err: any) {
            console.error(`[ScenesPage] Error generating image for ${characterName}:`, err);
            setCharacterImageErrors(prev => ({ ...prev, [characterName]: err.message || 'Erro ao gerar imagem' }));
            setGeneratingCharacterImages(prev => ({ ...prev, [characterName]: false }));
        }
    };

    const handleConfirm = () => {
        // Convert images object to array for backwards compatibility
        const referenceImagesArray = Object.values(characterReferenceImages);

        const storyWithScenes: StoryWithScenes = {
            ...story,
            scenes,
            characters,
            characterReferenceImage: referenceImagesArray.length > 0 ? referenceImagesArray[0] as string : null, // Backwards compatibility
            characterReferenceImages // Pass all character images by name
        };
        onComplete(storyWithScenes);
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Loading State */}
            {loading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-card rounded-2xl shadow-lg p-8 border border-border"
                >
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                        <p className="text-lg text-muted-foreground mb-2">Criando cenas e personagens...</p>
                        <p className="text-sm text-muted-foreground/60">Isso pode levar alguns segundos</p>
                    </div>
                </motion.div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="bg-destructive/10 border-2 border-destructive/20 rounded-xl p-6">
                    <p className="text-destructive font-semibold mb-2">Erro ao gerar cenas</p>
                    <p className="text-destructive/80 text-sm mb-4">{error}</p>
                    <button
                        onClick={generateScenesAndCharacters}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Tentar Novamente
                    </button>
                </div>
            )}

            {/* Content */}
            {!loading && !error && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Header */}
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-foreground mb-2">
                            Cenas e Personagens
                        </h1>
                        <p className="text-muted-foreground">
                            Confira o DNA visual do herói e as cenas geradas
                        </p>
                    </div>

                    {/* Character DNA Section - All Characters */}
                    {Object.keys(characters).length > 0 && (
                        <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-2xl shadow-lg p-6 border border-primary/10">
                            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-primary" />
                                DNA Visual dos Personagens ({Object.keys(characters).length})
                            </h2>

                            {/* Characters Grid */}
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Object.values(characters).map((character: CharacterDNA) => {
                                    const hasImage = !!characterReferenceImages[character.name];
                                    const isGenerating = generatingCharacterImages[character.name];
                                    const error = characterImageErrors[character.name];

                                    return (
                                        <div key={character.name} className="bg-card rounded-xl p-4 shadow-md border border-border">
                                            {/* Character Image/Avatar */}
                                            <div className="flex flex-col items-center mb-4">
                                                {!hasImage ? (
                                                    <>
                                                        <div className="w-24 h-24 bg-gradient-to-br from-primary/40 to-purple-600/40 rounded-full flex items-center justify-center mb-3">
                                                            <User className="w-12 h-12 text-foreground" />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-foreground">{character.name}</h3>
                                                        <p className="text-sm text-muted-foreground mb-2">{character.species}</p>
                                                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full mb-3">
                                                            {character.status === 'protagonist' ? '⭐ Protagonista' : '👥 Coadjuvante'}
                                                        </span>

                                                        {/* Generate Button */}
                                                        <button
                                                            onClick={() => generateCharacterImage(character.name)}
                                                            disabled={isGenerating}
                                                            className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                                        >
                                                            {isGenerating ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                    Gerando...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Sparkles className="w-4 h-4" />
                                                                    Gerar Imagem
                                                                </>
                                                            )}
                                                        </button>

                                                        {error && (
                                                            <p className="text-xs text-destructive mt-2">{error}</p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <img
                                                            src={characterReferenceImages[character.name]}
                                                            alt={character.name}
                                                            className="w-full h-48 object-cover rounded-lg mb-3 border-2 border-primary"
                                                        />
                                                        <h3 className="text-lg font-bold text-foreground">{character.name}</h3>
                                                        <p className="text-xs text-green-500 mb-2">✓ Imagem de Referência</p>
                                                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full mb-3">
                                                            {character.status === 'protagonist' ? '⭐ Protagonista' : '👥 Coadjuvante'}
                                                        </span>

                                                        {/* Regenerate Button */}
                                                        <button
                                                            onClick={() => generateCharacterImage(character.name)}
                                                            disabled={isGenerating}
                                                            className="w-full px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50 text-sm"
                                                        >
                                                            {isGenerating ? 'Regenerando...' : '🔄 Regenerar'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {/* Character Details */}
                                            <div className="space-y-2 text-sm">
                                                <div className="bg-muted/50 rounded p-2">
                                                    <p className="text-xs text-muted-foreground mb-1">Espécie</p>
                                                    <p className="font-semibold text-foreground">{character.species}</p>
                                                </div>
                                                <div className="bg-muted/50 rounded p-2">
                                                    <p className="text-xs text-muted-foreground mb-1">Cores</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {character.mainColors.map((color, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-1 bg-background rounded-full border border-border text-foreground">
                                                                {color}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Scenes List */}
                    <div className="bg-card rounded-2xl shadow-lg p-6 border border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-foreground">
                                Cenas Geradas ({scenes.length})
                            </h2>
                            <button
                                onClick={() => generateScenesAndCharacters(true)}
                                className="px-4 py-2 bg-secondary/80 text-secondary-foreground hover:bg-secondary rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Regenerar Divisão de Cenas
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                            {scenes.map((scene) => (
                                <div
                                    key={scene.id}
                                    className="bg-muted/30 rounded-xl p-4 border-2 border-border hover:border-primary transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold border border-primary/50">
                                            {scene.order}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-foreground leading-relaxed mb-2">
                                                {scene.narrationText}
                                            </p>
                                            <div className="flex gap-2 text-xs">
                                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                                                    {scene.emotion}
                                                </span>
                                                <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded">
                                                    ~{scene.durationEstimate}s
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
                            disabled={Object.keys(characterReferenceImages).length === 0}
                            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={Object.keys(characterReferenceImages).length === 0 ? 'Gere pelo menos uma imagem de personagem' : ''}
                        >
                            <Sparkles className="w-5 h-5" />
                            {Object.keys(characterReferenceImages).length === 0
                                ? 'GERE PELO MENOS UMA IMAGEM'
                                : `GERAR ILUSTRAÇÕES (${Object.keys(characterReferenceImages).length} ref.)`
                            }
                        </button>
                    </div>

                    {Object.keys(characterReferenceImages).length === 0 && (
                        <p className="text-center text-sm text-orange-600 mt-2">
                            ⚠️ Gere pelo menos uma imagem de personagem antes de continuar
                        </p>
                    )}
                    {Object.keys(characterReferenceImages).length > 0 && Object.keys(characterReferenceImages).length < Object.keys(characters).length && (
                        <p className="text-center text-sm text-blue-600 mt-2">
                            💡 Dica: Gere imagens para todos os personagens para melhor consistência
                        </p>
                    )}
                </motion.div>
            )}
        </div>
    );
}
