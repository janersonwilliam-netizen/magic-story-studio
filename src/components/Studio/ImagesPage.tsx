/**
 * IMAGES Page - Batch Image Generation
 * Fourth step in the Studio workflow
 * Generates all scene images using Gemini Image API
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoryWithScenes } from '../../types/studio';
import { generateImagePrompt } from '../../services/gemini';
import { Loader2, Check, Image as ImageIcon, AlertCircle, Download } from 'lucide-react';

interface ImagesPageProps {
    storyWithScenes: StoryWithScenes;
    onComplete: () => void;
    onBack: () => void;
}

interface ImageGenerationStatus {
    sceneId: string;
    status: 'pending' | 'generating' | 'complete' | 'error';
    imageUrl?: string;
    error?: string;
}

export function ImagesPage({ storyWithScenes, onComplete, onBack }: ImagesPageProps) {
    const [generationStatus, setGenerationStatus] = useState<Record<string, ImageGenerationStatus>>({});
    const [generating, setGenerating] = useState(false);
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

    useEffect(() => {
        // Initialize status for all scenes
        const initialStatus: Record<string, ImageGenerationStatus> = {};
        storyWithScenes.scenes.forEach(scene => {
            initialStatus[scene.id] = {
                sceneId: scene.id,
                status: 'pending'
            };
        });
        setGenerationStatus(initialStatus);

        // Auto-start generation
        startGeneration();
    }, []);

    const startGeneration = async () => {
        setGenerating(true);

        // Get all character reference images
        const characterReferences = storyWithScenes.characterReferenceImages || {};

        console.log('[ImagesPage] Available character references:', Object.keys(characterReferences));

        for (let i = 0; i < storyWithScenes.scenes.length; i++) {
            const scene = storyWithScenes.scenes[i];
            setCurrentSceneIndex(i);

            // Update status to generating
            setGenerationStatus(prev => ({
                ...prev,
                [scene.id]: { ...prev[scene.id], status: 'generating' }
            }));

            try {
                console.log(`[ImagesPage] Generating image for scene ${i + 1}/${storyWithScenes.scenes.length}`);
                console.log(`[ImagesPage] Scene characters:`, scene.characters);

                // 1. Generate optimized image prompt
                const characterDescriptions = Object.values(storyWithScenes.characters)
                    .map(char => char.description)
                    .join('\n\n');

                const promptResult = await generateImagePrompt({
                    visual_description: scene.visualDescription,
                    emotion: scene.emotion,
                    characters: scene.characters,
                    visual_style: storyWithScenes.visualStyle,
                    characterDescriptions
                });

                // generateImagePrompt returns a string directly
                const optimizedPrompt = typeof promptResult === 'string' ? promptResult : (promptResult as any).optimized_prompt || promptResult;

                console.log(`[ImagesPage] Generated prompt for scene ${scene.order}:`, optimizedPrompt);

                // 2. Collect reference images for characters in THIS scene
                const sceneReferenceImages: string[] = [];
                const sceneCharacterStatuses: string[] = [];

                if (scene.characters && scene.characters.length > 0) {
                    for (const characterName of scene.characters) {
                        if (characterReferences[characterName]) {
                            sceneReferenceImages.push(characterReferences[characterName]);

                            // Get character status for conditional duplication
                            const characterData = storyWithScenes.characters[characterName];
                            sceneCharacterStatuses.push(characterData?.status || 'supporting');

                            console.log(`[ImagesPage] Added reference for ${characterName} (${characterData?.status})`);
                        } else {
                            console.warn(`[ImagesPage] No reference image for character: ${characterName}`);
                        }
                    }
                }

                // 3. Generate image with character-specific references
                let imageUrl: string;

                if (sceneReferenceImages.length > 0) {
                    // Use Gemini 3 Pro with character references AND statuses
                    const { generateImageWithReferences } = await import('../../services/google_image');
                    imageUrl = await generateImageWithReferences(
                        optimizedPrompt,
                        sceneReferenceImages,
                        sceneCharacterStatuses // Pass statuses for conditional duplication
                    );
                    console.log(`[ImagesPage] Scene ${i + 1} generated with ${sceneReferenceImages.length} character reference(s)`);
                } else {
                    // Fallback to standard generation if no references
                    const { generateImageWithNanoBanana } = await import('../../services/google_image');
                    imageUrl = await generateImageWithNanoBanana(optimizedPrompt);
                    console.log(`[ImagesPage] Scene ${i + 1} generated without references`);
                }

                // Update status to complete
                setGenerationStatus(prev => ({
                    ...prev,
                    [scene.id]: {
                        ...prev[scene.id],
                        status: 'complete',
                        imageUrl
                    }
                }));

                // Update scene with image URL
                scene.imageUrl = imageUrl;
                scene.imagePrompt = optimizedPrompt;

            } catch (error: any) {
                console.error(`[ImagesPage] Error generating image for scene ${scene.order}:`, error);

                setGenerationStatus(prev => ({
                    ...prev,
                    [scene.id]: {
                        ...prev[scene.id],
                        status: 'error',
                        error: error.message
                    }
                }));
            }

            // Small delay between generations to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        setGenerating(false);
    };

    const retryScene = async (sceneId: string) => {
        const scene = storyWithScenes.scenes.find(s => s.id === sceneId);
        if (!scene) return;

        setGenerationStatus(prev => ({
            ...prev,
            [sceneId]: { ...prev[sceneId], status: 'generating', error: undefined }
        }));

        try {
            const characterDescriptions = Object.values(storyWithScenes.characters)
                .map(char => char.description)
                .join('\n\n');

            const promptResult = await generateImagePrompt({
                visual_description: scene.visualDescription,
                emotion: scene.emotion,
                characters: scene.characters,
                visual_style: storyWithScenes.visualStyle,
                characterDescriptions
            });

            // generateImagePrompt returns a string directly
            const optimizedPrompt = typeof promptResult === 'string' ? promptResult : (promptResult as any).optimized_prompt || promptResult;

            const imageUrl = await generateImageWithNanoBanana(optimizedPrompt);

            setGenerationStatus(prev => ({
                ...prev,
                [sceneId]: {
                    ...prev[sceneId],
                    status: 'complete',
                    imageUrl
                }
            }));

            scene.imageUrl = imageUrl;
            scene.imagePrompt = optimizedPrompt;

        } catch (error: any) {
            setGenerationStatus(prev => ({
                ...prev,
                [sceneId]: {
                    ...prev[sceneId],
                    status: 'error',
                    error: error.message
                }
            }));
        }
    };

    /**
     * Download a single image with a descriptive filename
     */
    const downloadImage = (imageUrl: string, sceneNumber: number) => {
        try {
            // Convert data URL to blob
            const byteString = atob(imageUrl.split(',')[1]);
            const mimeString = imageUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cena_${sceneNumber}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            console.log(`[ImagesPage] Downloaded scene ${sceneNumber}`);
        } catch (error) {
            console.error('[ImagesPage] Error downloading image:', error);
        }
    };

    /**
     * Download all completed images as a zip (simplified: download one by one)
     */
    const downloadAllImages = () => {
        storyWithScenes.scenes.forEach((scene) => {
            const status = generationStatus[scene.id];
            if (status?.status === 'complete' && status.imageUrl) {
                // Small delay between downloads to avoid browser blocking
                setTimeout(() => {
                    downloadImage(status.imageUrl!, scene.order);
                }, scene.order * 500); // 500ms delay between each download
            }
        });
    };

    const completedCount = Object.values(generationStatus).filter(s => s.status === 'complete').length;
    const errorCount = Object.values(generationStatus).filter(s => s.status === 'error').length;
    const totalScenes = storyWithScenes.scenes.length;
    const progress = (completedCount / totalScenes) * 100;

    const allComplete = completedCount === totalScenes;
    const canProceed = completedCount > 0; // Allow proceeding even if some failed

    return (
        <div className="max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-8"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Oficina de Ilustração
                    </h1>
                    <p className="text-gray-600">
                        Gerando imagens mágicas para cada cena
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">
                            Progresso: {completedCount}/{totalScenes}
                        </span>
                        <span className="text-sm text-gray-600">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-[#FF0000] to-red-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    {errorCount > 0 && (
                        <p className="text-sm text-orange-600 mt-2">
                            ⚠️ {errorCount} imagem(ns) com erro - você pode tentar novamente
                        </p>
                    )}
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {storyWithScenes.scenes.map((scene, index) => {
                        const status = generationStatus[scene.id];

                        return (
                            <motion.div
                                key={scene.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200"
                            >
                                {/* Scene Number */}
                                <div className="absolute top-2 left-2 w-8 h-8 bg-[#FF0000] text-white rounded-full flex items-center justify-center font-bold text-sm z-10">
                                    {scene.order}
                                </div>

                                {/* Pending State */}
                                {status?.status === 'pending' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-12 h-12 text-gray-400" />
                                    </div>
                                )}

                                {/* Generating State */}
                                {status?.status === 'generating' && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50">
                                        <Loader2 className="w-12 h-12 text-[#FF0000] animate-spin mb-2" />
                                        <p className="text-xs text-gray-600">Gerando...</p>
                                    </div>
                                )}

                                {/* Complete State */}
                                {status?.status === 'complete' && status.imageUrl && (
                                    <>
                                        <img
                                            src={status.imageUrl}
                                            alt={`Cena ${scene.order}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-2 right-2 flex gap-2">
                                            <button
                                                onClick={() => downloadImage(status.imageUrl!, scene.order)}
                                                className="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors"
                                                title="Baixar imagem"
                                            >
                                                <Download className="w-4 h-4 text-white" />
                                            </button>
                                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Error State */}
                                {status?.status === 'error' && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                                        <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                                        <button
                                            onClick={() => retryScene(scene.id)}
                                            className="text-xs px-2 py-1 bg-[#FF0000] text-white rounded hover:bg-red-600"
                                        >
                                            Tentar Novamente
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Download All Button */}
                {completedCount > 0 && (
                    <div className="mb-4">
                        <button
                            onClick={downloadAllImages}
                            disabled={generating}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            Baixar Todas as Imagens ({completedCount})
                        </button>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={onBack}
                        disabled={generating}
                        className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Voltar
                    </button>
                    <button
                        onClick={onComplete}
                        disabled={!canProceed || generating}
                        className="flex-1 px-6 py-3 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Gerando {currentSceneIndex + 1}/{totalScenes}...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                EDITAR NA LINHA DO TEMPO
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
