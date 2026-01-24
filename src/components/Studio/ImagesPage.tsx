/**
 * IMAGES Page - Batch Image Generation
 * Fourth step in the Studio workflow
 * Generates all scene images using Gemini Image API
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoryWithScenes } from '../../types/studio';
import { generateImagePrompt } from '../../services/gemini';
import { Loader2, Check, Image as ImageIcon, AlertCircle, Download, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';

interface ImagesPageProps {
    storyWithScenes: StoryWithScenes;
    onComplete: (updatedStory: StoryWithScenes) => void;
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
        // Initialize status for all scenes - CHECK if images already exist
        const initialStatus: Record<string, ImageGenerationStatus> = {};
        let hasAllImages = true;

        storyWithScenes.scenes.forEach(scene => {
            if (scene.imageUrl) {
                // Scene already has an image - mark as complete
                initialStatus[scene.id] = {
                    sceneId: scene.id,
                    status: 'complete',
                    imageUrl: scene.imageUrl
                };
            } else {
                // Scene needs image generation
                initialStatus[scene.id] = {
                    sceneId: scene.id,
                    status: 'pending'
                };
                hasAllImages = false;
            }
        });
        setGenerationStatus(initialStatus);

        // Only auto-start if there are scenes without images
        if (!hasAllImages) {
            startGeneration();
        } else {
            console.log('[ImagesPage] All images already exist, skipping generation');
        }
    }, []);

    const startGeneration = async () => {
        setGenerating(true);

        // Get all character reference images
        const characterReferences = storyWithScenes.characterReferenceImages || {};

        console.log('[ImagesPage] Available character references:', Object.keys(characterReferences));

        for (let i = 0; i < storyWithScenes.scenes.length; i++) {
            const scene = storyWithScenes.scenes[i];
            setCurrentSceneIndex(i);

            // --- SKIP if scene already has an image ---
            if (scene.imageUrl) {
                console.log(`[ImagesPage] Scene ${i + 1} already has image, skipping`);
                setGenerationStatus(prev => ({
                    ...prev,
                    [scene.id]: { ...prev[scene.id], status: 'complete', imageUrl: scene.imageUrl }
                }));
                continue;
            }

            // Update status to generating
            setGenerationStatus(prev => ({
                ...prev,
                [scene.id]: { ...prev[scene.id], status: 'generating' }
            }));

            try {
                console.log(`[ImagesPage] Generating image for scene ${i + 1}/${storyWithScenes.scenes.length}`);
                console.log(`[ImagesPage] Scene characters:`, scene.characters);

                // --- OPTIMIZATION: SKIP FIRST SCENE (THUMBNAIL) ---
                if (i === 0 && storyWithScenes.thumbnailUrl) {
                    console.log('[ImagesPage] OPTIMIZATION: Skipping Scene 1 (Using existing Thumbnail)');

                    setGenerationStatus(prev => ({
                        ...prev,
                        [scene.id]: {
                            ...prev[scene.id],
                            status: 'complete',
                            imageUrl: storyWithScenes.thumbnailUrl
                        }
                    }));

                    scene.imageUrl = storyWithScenes.thumbnailUrl;
                    scene.imagePrompt = "Existing Thumbnail (Skipped Generation)";

                    await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause for UI update
                    continue;
                }

                // --- OPTIMIZATION: SKIP LAST SCENE (ENDING CARD) ---
                // If it's the last scene, force usage of the Ending Card
                if (i === storyWithScenes.scenes.length - 1) {
                    console.log('[ImagesPage] OPTIMIZATION: Skipping Last Scene (Using Ending Card)');
                    try {
                        const { storage } = await import('../../lib/storage');
                        const files = await storage.getAllFiles();
                        const defaultEnding = files.find((f: any) => f.category === 'ending_card' && f.isDefault);

                        if (defaultEnding) {
                            console.log('[ImagesPage] Using default ending card from library');
                            setGenerationStatus(prev => ({
                                ...prev,
                                [scene.id]: {
                                    ...prev[scene.id],
                                    status: 'complete',
                                    imageUrl: defaultEnding.url
                                }
                            }));
                            scene.imageUrl = defaultEnding.url;
                            scene.imagePrompt = "Default Ending Card (From Library)";
                            await new Promise(resolve => setTimeout(resolve, 100));
                            continue;
                        }
                    } catch (err) {
                        console.error('[ImagesPage] Error reading ending card:', err);
                    }
                    // If no card found, let it generate the fallback or proceed normally (optional: forcing a specific prompt here could act as backup)
                }

                // 1. Optimize Prompt or Use Pre-defined
                let optimizedPrompt = scene.imagePrompt;

                // Handle Ending Card Special Case
                if (optimizedPrompt === 'ENDING_CARD_PLACEHOLDER') {
                    try {
                        const { storage } = await import('../../lib/storage');
                        const files = await storage.getAllFiles();
                        const defaultEnding = files.find((f: any) => f.category === 'ending_card' && f.isDefault);

                        if (defaultEnding) {
                            console.log('[ImagesPage] Using default ending card from library');

                            setGenerationStatus(prev => ({
                                ...prev,
                                [scene.id]: {
                                    ...prev[scene.id],
                                    status: 'complete',
                                    imageUrl: defaultEnding.url
                                }
                            }));

                            scene.imageUrl = defaultEnding.url;
                            scene.imagePrompt = "Default Ending Card (From Library)";

                            // Skip to next scene
                            await new Promise(resolve => setTimeout(resolve, 500));
                            continue;
                        }
                    } catch (err) {
                        console.error('[ImagesPage] Error reading ending card from library:', err);
                    }

                    // Fallback if no card found
                    optimizedPrompt = "Vibrant Youtube Ending Card. Text: 'Inscreva-se'. Pixar Style background, cute characters waving goodbye.";
                }

                if (!optimizedPrompt) {
                    const characterDescriptionsMap: Record<string, string> = {};
                    Object.values(storyWithScenes.characters).forEach(char => {
                        characterDescriptionsMap[char.name] = char.description;
                    });

                    const promptResult = await generateImagePrompt({
                        visual_description: scene.visualDescription,
                        emotion: scene.emotion,
                        characters: scene.characters,
                        visual_style: storyWithScenes.visualStyle,
                        characterDescriptions: characterDescriptionsMap
                    });

                    // generateImagePrompt returns a string directly
                    optimizedPrompt = typeof promptResult === 'string' ? promptResult : (promptResult as any).optimized_prompt || promptResult;
                }

                console.log(`[ImagesPage] Using prompt for scene ${scene.order}:`, optimizedPrompt);

                // 2. Collect reference images for characters in THIS scene
                const sceneReferenceImages: string[] = [];
                const sceneCharacterStatuses: string[] = [];

                if (scene.characters && scene.characters.length > 0) {
                    for (const characterName of scene.characters) {

                        // SPECIAL CASE: Handle __PROTAGONIST__ marker for Intro/Outro
                        if (characterName === '__PROTAGONIST__') {
                            // Find the first character with a reference image (assumed main character)
                            const firstCharName = Object.keys(characterReferences)[0];
                            if (firstCharName && characterReferences[firstCharName]) {
                                sceneReferenceImages.push(characterReferences[firstCharName]);
                                sceneCharacterStatuses.push('protagonist');
                                console.log(`[ImagesPage] Resolved __PROTAGONIST__ to ${firstCharName}`);
                            }
                            continue;
                        }

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
                        optimizedPrompt!,
                        sceneReferenceImages,
                        sceneCharacterStatuses // Pass statuses for conditional duplication
                    );
                    console.log(`[ImagesPage] Scene ${i + 1} generated with ${sceneReferenceImages.length} character reference(s)`);
                } else {
                    // Fallback to standard generation if no references
                    const { generateImageWithNanoBanana } = await import('../../services/google_image');
                    imageUrl = await generateImageWithNanoBanana(optimizedPrompt!);
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
            // Create character descriptions map
            const characterDescriptions: Record<string, string> = {};
            if (storyWithScenes.characters) {
                Object.values(storyWithScenes.characters).forEach(char => {
                    characterDescriptions[char.name] = char.description;
                });
            }

            const promptResult = await generateImagePrompt({
                visual_description: scene.visualDescription,
                emotion: scene.emotion,
                characters: scene.characters,
                visual_style: storyWithScenes.visualStyle,
                characterDescriptions
            });

            // generateImagePrompt returns a string directly
            const optimizedPrompt = typeof promptResult === 'string' ? promptResult : (promptResult as any).optimized_prompt || promptResult;

            // Collect reference images using the same logic as startGeneration
            const characterReferences = storyWithScenes.characterReferenceImages || {};
            const sceneReferenceImages: string[] = [];
            const sceneCharacterStatuses: string[] = [];

            if (scene.characters && scene.characters.length > 0) {
                for (const characterName of scene.characters) {
                    if (characterReferences[characterName]) {
                        sceneReferenceImages.push(characterReferences[characterName]);
                        const characterData = storyWithScenes.characters[characterName];
                        sceneCharacterStatuses.push(characterData?.status || 'supporting');
                    }
                }
            }

            let imageUrl: string;

            if (sceneReferenceImages.length > 0) {
                const { generateImageWithReferences } = await import('../../services/google_image');
                imageUrl = await generateImageWithReferences(
                    optimizedPrompt,
                    sceneReferenceImages,
                    sceneCharacterStatuses
                );
            } else {
                const { generateImageWithNanoBanana } = await import('../../services/google_image');
                imageUrl = await generateImageWithNanoBanana(optimizedPrompt);
            }

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
            console.error(`[ImagesPage] Error regenerating scene ${scene.order}:`, error);
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
    /**
     * Download all completed images as a zip
     */
    const downloadAllImages = async () => {
        const zip = new JSZip();
        let count = 0;

        // Add images to zip
        storyWithScenes.scenes.forEach((scene) => {
            const status = generationStatus[scene.id];
            if (status?.status === 'complete' && status.imageUrl) {
                const imgData = status.imageUrl.split(',')[1];
                zip.file(`cena_${scene.order}.png`, imgData, { base64: true });
                count++;
            }
        });

        if (count > 0) {
            try {
                const content = await zip.generateAsync({ type: 'blob' });
                const url = window.URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `imagens_historia.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                console.log(`[ImagesPage] Downloaded zip with ${count} images`);
            } catch (error) {
                console.error('[ImagesPage] Error generating zip:', error);
            }
        }
    };

    const completedCount = Object.values(generationStatus).filter((s: ImageGenerationStatus) => s.status === 'complete').length;
    const errorCount = Object.values(generationStatus).filter((s: ImageGenerationStatus) => s.status === 'error').length;
    const totalScenes = storyWithScenes.scenes.length;
    const progress = (completedCount / totalScenes) * 100;

    const allComplete = completedCount === totalScenes;
    const canProceed = completedCount > 0; // Allow proceeding even if some failed

    // Build updated story with all generated image URLs
    const handleComplete = () => {
        const updatedScenes = storyWithScenes.scenes.map(scene => {
            const status = generationStatus[scene.id];
            if (status?.imageUrl) {
                return { ...scene, imageUrl: status.imageUrl };
            }
            return scene;
        });

        const updatedStory: StoryWithScenes = {
            ...storyWithScenes,
            scenes: updatedScenes
        };

        console.log('[ImagesPage] Passing updated story with', updatedScenes.filter(s => s.imageUrl).length, 'images');
        onComplete(updatedStory);
    };

    return (
        <div className="max-w-6xl mx-auto">
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
                                className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 group"
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

                                        {/* Regenerate Button (On Hover) */}
                                        {!generating && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        retryScene(scene.id);
                                                    }}
                                                    className="w-8 h-8 bg-white/90 hover:bg-white text-gray-700 hover:text-[#FF0000] rounded-full flex items-center justify-center shadow-lg transition-colors border border-gray-200"
                                                    title="Regenerar imagem"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )
                                }

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
                {
                    completedCount > 0 && (
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
                    )
                }

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
                        onClick={handleComplete}
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
            </motion.div >
        </div >
    );
}
