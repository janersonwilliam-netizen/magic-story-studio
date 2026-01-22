/**
 * SCENES Page - Character DNA and Scene Generation
 * Third step in the Studio workflow
 * Generates scenes and extracts character information
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StoryWithNarration, StoryWithScenes, Scene, CharacterDNA } from '../../types/studio';
import { generateScenesWithGemini, extractCharactersFromStory, generateCharacterSheet } from '../../services/gemini';
import { Loader2, User, Palette, Shirt, Sparkles } from 'lucide-react';

interface ScenesPageProps {
    story: StoryWithNarration;
    onComplete: (storyWithScenes: StoryWithScenes) => void;
    onBack: () => void;
}

export function ScenesPage({ story, onComplete, onBack }: ScenesPageProps) {
    const [loading, setLoading] = useState(true);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [characters, setCharacters] = useState<Record<string, CharacterDNA>>({});
    const [mainCharacter, setMainCharacter] = useState<CharacterDNA | null>(null);
    const [error, setError] = useState('');

    // Character reference images states (support multiple characters)
    const [generatingCharacterImages, setGeneratingCharacterImages] = useState<Record<string, boolean>>({});
    const [characterReferenceImages, setCharacterReferenceImages] = useState<Record<string, string>>({});
    const [characterImageErrors, setCharacterImageErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        generateScenesAndCharacters();
    }, []);

    const generateScenesAndCharacters = async () => {
        setLoading(true);
        setError('');

        try {
            console.log('[ScenesPage] Generating scenes and characters...');

            // 1. Generate scenes
            const scenesResult = await generateScenesWithGemini({
                narration_text: story.storyText,
                duration: story.duration,
                targetSceneCount: story.sceneCount,
                title: story.title
            });

            const generatedScenes: Scene[] = scenesResult.scenes.map((scene: any, index: number) => ({
                id: `scene-${index + 1}`,
                order: index + 1,
                narrationText: scene.narration_text,
                visualDescription: scene.visual_description,
                emotion: scene.emotion || 'calma',
                durationEstimate: scene.duration_estimate || 15,
                characters: scene.characters || [],
                imagePrompt: scene.image_prompt
            }));

            setScenes(generatedScenes);

            // 2. Extract character names
            const extractedCharacters = await extractCharactersFromStory(story.storyText);
            console.log('[ScenesPage] Extracted characters:', extractedCharacters);

            // 3. Generate structured character data for main characters
            const characterNames = Object.keys(extractedCharacters);
            const characterDNAs: Record<string, CharacterDNA> = {};

            for (const name of characterNames.slice(0, 3)) { // Limit to 3 main characters
                try {
                    // Use new structured extraction function
                    const { extractStructuredCharacterData } = await import('../../services/gemini');
                    const structuredData = await extractStructuredCharacterData(story.storyText, name);

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
            }

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

            // Build detailed prompt from character DNA with CHILD-FRIENDLY emphasis
            const characterPrompt = `CHILD-FRIENDLY PIXAR/DREAMWORKS STYLE CHARACTER:
- BIG expressive eyes (35-40% of face)
- Soft, rounded, cute features
- Adorable, friendly, non-threatening appearance
- Perfect for children ages 3-8

CHARACTER DETAILS:
${character.description}
Species: ${character.species}
Colors: ${character.mainColors.join(', ')}
Clothing: ${character.clothing}
${character.accessories !== 'Nenhum' ? `Accessories: ${character.accessories}` : ''}

TECHNICAL:
- Full body portrait, centered
- White/neutral background
- ${story.visualStyle}
- High quality, detailed
- Professional character sheet style
- NO realistic/adult features`;

            const { generateImageWithNanoBanana } = await import('../../services/google_image');
            const imageUrl = await generateImageWithNanoBanana(characterPrompt);

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
            characterReferenceImage: referenceImagesArray.length > 0 ? referenceImagesArray[0] : null, // Backwards compatibility
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
                    className="bg-white rounded-2xl shadow-lg p-8"
                >
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-16 h-16 text-[#FF0000] animate-spin mb-4" />
                        <p className="text-lg text-gray-600 mb-2">Criando cenas e personagens...</p>
                        <p className="text-sm text-gray-500">Isso pode levar alguns segundos</p>
                    </div>
                </motion.div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                    <p className="text-red-800 font-semibold mb-2">Erro ao gerar cenas</p>
                    <p className="text-red-600 text-sm mb-4">{error}</p>
                    <button
                        onClick={generateScenesAndCharacters}
                        className="px-4 py-2 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-colors"
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
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Cenas e Personagens
                        </h1>
                        <p className="text-gray-600">
                            Confira o DNA visual do herói e as cenas geradas
                        </p>
                    </div>

                    {/* Character DNA Section - All Characters */}
                    {Object.keys(characters).length > 0 && (
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-[#FF0000]" />
                                DNA Visual dos Personagens ({Object.keys(characters).length})
                            </h2>

                            {/* Characters Grid */}
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Object.values(characters).map((character: CharacterDNA) => {
                                    const hasImage = !!characterReferenceImages[character.name];
                                    const isGenerating = generatingCharacterImages[character.name];
                                    const error = characterImageErrors[character.name];

                                    return (
                                        <div key={character.name} className="bg-white rounded-xl p-4 shadow-md">
                                            {/* Character Image/Avatar */}
                                            <div className="flex flex-col items-center mb-4">
                                                {!hasImage ? (
                                                    <>
                                                        <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mb-3">
                                                            <User className="w-12 h-12 text-white" />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-gray-900">{character.name}</h3>
                                                        <p className="text-sm text-gray-600 mb-2">{character.species}</p>
                                                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full mb-3">
                                                            {character.status === 'protagonist' ? '⭐ Protagonista' : '👥 Coadjuvante'}
                                                        </span>

                                                        {/* Generate Button */}
                                                        <button
                                                            onClick={() => generateCharacterImage(character.name)}
                                                            disabled={isGenerating}
                                                            className="w-full px-3 py-2 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
                                                            <p className="text-xs text-red-600 mt-2">{error}</p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <img
                                                            src={characterReferenceImages[character.name]}
                                                            alt={character.name}
                                                            className="w-full h-48 object-cover rounded-lg mb-3 border-2 border-[#FF0000]"
                                                        />
                                                        <h3 className="text-lg font-bold text-gray-900">{character.name}</h3>
                                                        <p className="text-xs text-green-600 mb-2">✓ Imagem de Referência</p>
                                                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full mb-3">
                                                            {character.status === 'protagonist' ? '⭐ Protagonista' : '👥 Coadjuvante'}
                                                        </span>

                                                        {/* Regenerate Button */}
                                                        <button
                                                            onClick={() => generateCharacterImage(character.name)}
                                                            disabled={isGenerating}
                                                            className="w-full px-3 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm"
                                                        >
                                                            {isGenerating ? 'Regenerando...' : '🔄 Regenerar'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {/* Character Details */}
                                            <div className="space-y-2 text-sm">
                                                <div className="bg-gray-50 rounded p-2">
                                                    <p className="text-xs text-gray-600 mb-1">Espécie</p>
                                                    <p className="font-semibold text-gray-900">{character.species}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded p-2">
                                                    <p className="text-xs text-gray-600 mb-1">Cores</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {character.mainColors.map((color, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-1 bg-white rounded-full border border-gray-200">
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
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Cenas Geradas ({scenes.length})
                        </h2>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
                            {scenes.map((scene) => (
                                <div
                                    key={scene.id}
                                    className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200 hover:border-[#FF0000] transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 bg-[#FF0000] text-white rounded-full flex items-center justify-center font-bold">
                                            {scene.order}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-gray-900 leading-relaxed mb-2">
                                                {scene.narrationText}
                                            </p>
                                            <div className="flex gap-2 text-xs">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                    {scene.emotion}
                                                </span>
                                                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded">
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
                            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                        >
                            ← Voltar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={Object.keys(characterReferenceImages).length === 0}
                            className="flex-1 px-6 py-3 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
